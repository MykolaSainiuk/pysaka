import path from 'node:path';
import { finished, pipeline } from 'node:stream/promises';
import { Worker } from 'node:worker_threads';

import { DEFAULT_LOGGER_PARAMS, LOGGER_PREFIX } from './consts';
import { PrintFormatEnum, SeverityLevelEnum } from './enums';
import type {
  DestinationType,
  IPysakaLogger,
  PysakaLoggerParams,
} from './types';
import { generateNumericId } from './util';

// EventEmitter.defaultMaxListeners = 100;
export class PysakaLogger implements IPysakaLogger {
  private destination: DestinationType;
  private severity: SeverityLevelEnum;
  private format: PrintFormatEnum;

  private serializerEncoding: BufferEncoding = 'utf-8';

  private loggerId: string;
  private logWorker: Worker;

  private isDestroyed: boolean = false;
  private debugLogsOfLogger: boolean = false;
  private neverSpikeCPU: boolean = true;

  private sharedMemoryAsBuffer: SharedArrayBuffer;
  private atomicLogsLeftToWriteCountdown: Int32Array;
  private paramsStringified: string;

  private static __cache: Record<
    string,
    { logger: PysakaLogger; count: number }
  > = {};

  constructor(__params?: PysakaLoggerParams) {
    // TODO: singleton for now
    const paramsStringified = JSON.stringify(__params ?? {});
    if (PysakaLogger.__cache[paramsStringified]) {
      PysakaLogger.__cache[paramsStringified].count++;
      return PysakaLogger.__cache[paramsStringified].logger;
    }
    this.paramsStringified = paramsStringified;
    PysakaLogger.__cache[paramsStringified] = {
      logger: this,
      count: 1,
    };

    const params = { ...DEFAULT_LOGGER_PARAMS, ...__params };

    this.destination = params.destination;
    // TODO: surround with atomics
    if (!this.destination.writable) {
      throw new Error(`${LOGGER_PREFIX} Destination is not writable`);
    }

    this.severity = params.severity;
    this.format = params.format;
    this.debugLogsOfLogger = params.debugLogsOfLogger ?? false;
    this.neverSpikeCPU = params.neverSpikeCPU ?? false;

    // Main thread
    this.sharedMemoryAsBuffer = new SharedArrayBuffer(4); // A shared buffer with space for one 32-bit integer
    this.atomicLogsLeftToWriteCountdown = new Int32Array(
      this.sharedMemoryAsBuffer,
    ); // a typed array view
    Atomics.store(this.atomicLogsLeftToWriteCountdown, 0, 0);

    process.once('exit', this.gracefulShutdown.bind(this));

    try {
      this.init();
    } catch (err) {
      process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');
      this.destructor();
      throw new Error(`${LOGGER_PREFIX} Failed to initialize logger`);
    }
  }

  // public methods
  public log(...args: any[]): this {
    return this.write(SeverityLevelEnum.INFO, ...args);
  }
  public info(...args: any[]): this {
    return this.write(SeverityLevelEnum.INFO, ...args);
  }
  public warn(...args: any[]): this {
    return this.write(SeverityLevelEnum.WARN, ...args);
  }
  public error(...args: any[]): this {
    return this.write(SeverityLevelEnum.ERROR, ...args);
  }
  public debug(...args: any[]): this {
    return this.write(SeverityLevelEnum.DEBUG, ...args);
  }
  public fatal(...args: any[]): this {
    return this.write(SeverityLevelEnum.FATAl, ...args);
  }

  // private methods
  private init() {
    this.initWorker();
    this.setupPipeline();

    this.debugLogsOfLogger &&
      process.stdout.write(`${LOGGER_PREFIX} Logger is initialized\n`);
  }

  private initWorker() {
    this.loggerId = generateNumericId(10);

    const dirname = process.cwd();
    const workerPath = path.join(dirname, './src/worker.js');

    this.logWorker = new Worker(workerPath, {
      name: this.loggerId,
      stdout: true,
      stdin: true,
      stderr: false,
      workerData: {
        loggerId: this.loggerId,
        severity: this.severity,
        encoding: this.serializerEncoding,
        format: this.format,
        sharedMemoryAsBuffer: this.sharedMemoryAsBuffer, // amount of logs in the buffer not written to the destination
      },
    });
    this.logWorker.unref();

    this.debugLogsOfLogger &&
      process.stdout.write(`${LOGGER_PREFIX} Logger's worker is initialized\n`);
  }

  private setupPipeline() {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    pipeline(
      this.logWorker.stdout,
      this.destination,
      // this.handleStreamError.bind(this),
      { end: false },
    )
      .then(
        () =>
          this.debugLogsOfLogger &&
          process.stdout.write(
            `${LOGGER_PREFIX} Pipeline logWorker.stdout->destination had no errors\n`,
          ),
      )
      .catch(this.handleStreamError.bind(this));

    this.debugLogsOfLogger &&
      process.stdout.write(
        `${LOGGER_PREFIX} Logger's stream's pipeline is ready\n`,
      );
  }

  private handleStreamError(err) {
    if (this.isDestroyed) return;
    if (err) {
      process.stderr.write(
        `${LOGGER_PREFIX} Pipeline logWorker.stdout->destination has failed\n`,
      );
      process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');
    }
  }

  private write(logLevel: SeverityLevelEnum, ...args: any[]): this {
    if (logLevel < this.severity) {
      return this;
    }

    const serializableArgs = new Array(1 + args.length);
    serializableArgs[0] = logLevel;

    for (let i = 0; i < args.length; i++) {
      const item = args[i];
      // dunno why but Error isn't transferable by default via HTML structured clone algorithm
      if (item instanceof Error) {
        serializableArgs[i + 1] = {
          message: item.message,
          stack: item.stack,
          cause: item.cause,
        };
      } else {
        serializableArgs[i + 1] = item;
      }
    }

    if (this.neverSpikeCPU) {
      setImmediate(() => {
        this.logWorker.postMessage(serializableArgs);
        Atomics.add(this.atomicLogsLeftToWriteCountdown, 0, 1);
      });
    } else {
      this.logWorker.postMessage(serializableArgs);
      Atomics.add(this.atomicLogsLeftToWriteCountdown, 0, 1);
    }

    return this;
  }

  private destructor() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    // drop Singleton cached instance
    this.paramsStringified &&
      delete PysakaLogger.__cache[this.paramsStringified];

    if (this.logWorker) {
      // this.logWorker.unref();
      this.logWorker.removeAllListeners();
      this.logWorker.terminate();
    }

    // process.stdout.write(
    //   `${LOGGER_PREFIX} Destination is writableEnded ${this.destination.writableEnded} [false is good]\n`,
    // );
    this.debugLogsOfLogger &&
      process.stdout.write(`${LOGGER_PREFIX} Logger is shut down\n`);
  }

  public async gracefulShutdown() {
    if (this.isDestroyed) return;

    // yeah, but it's a bit convoluted
    await new Promise((resolve) => {
      const intervalId = setInterval(() => {
        if (Atomics.load(this.atomicLogsLeftToWriteCountdown, 0) <= 0) {
          clearInterval(intervalId);
          resolve(void 0);
        }
      }, 1);
    });

    this.logWorker.stdin.writableEnded || this.logWorker.stdin.end();
    await finished(this.logWorker.stdin);

    // force "flush" under/into destination
    await Promise.all([
      new Promise((resolve) => this.destination.once('drain', resolve)),
      // new Promise((resolve) => {
      //   this.destination.emit('drain');
      //   resolve(void 0);
      // }),
      setTimeout(() => this.destination.emit('drain'), 1),
    ]);

    this.destructor();
  }

  public async close() {
    if (this.isDestroyed) return;

    PysakaLogger.__cache[this.paramsStringified].count--;
    if (PysakaLogger.__cache[this.paramsStringified].count > 0) {
      delete PysakaLogger.__cache[this.paramsStringified].logger;
      // not the last instance
      return;
    }
    await new Promise((resolve) =>
      this.neverSpikeCPU
        ? setTimeout(() => this.gracefulShutdown().finally(resolve as never), 1)
        : // bcz we must allow all neverSpikeCPU setImmediate callbacks to finish
          this.gracefulShutdown().finally(resolve as never),
    );
    // await this.gracefulShutdown();
  }

  public closeSync() {
    if (this.isDestroyed) return;
    if (this.neverSpikeCPU) {
      this.debugLogsOfLogger &&
        process.stdout.write(
          `${LOGGER_PREFIX} Sync closing isn't allowed when neverSpikeCPU=true\n`,
        );
      return;
    }

    PysakaLogger.__cache[this.paramsStringified].count--;
    if (PysakaLogger.__cache[this.paramsStringified].count > 0) {
      delete PysakaLogger.__cache[this.paramsStringified].logger;
      // not the last instance
      return;
    }

    // yep, scary
    while (Atomics.load(this.atomicLogsLeftToWriteCountdown, 0) > 0) {}

    this.logWorker.stdin.writableEnded || this.logWorker.stdin.end();
    // force "flush" under/into destination
    this.destination.emit('drain');

    // bcz .end() and .emit('drain') are not synchronous
    setTimeout(() => this.destructor(), 1);
  }

  // TODO: implement
  public child() {
    return this;
  }
}

export default PysakaLogger;
