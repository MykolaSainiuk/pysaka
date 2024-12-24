import path from 'node:path';
import { Duplex, PassThrough, pipeline } from 'node:stream';
import { Worker } from 'node:worker_threads';

import { DEFAULT_LOGGER_PARAMS, LOGGER_PREFIX } from './consts';
import { PrintFormatEnum, SeverityLevelEnum } from './enums';
import type {
  DestinationType,
  IPysakaLogger,
  PysakaLoggerParams,
} from './types';
import { generateNumericId } from './util';

// __DONE is customer this logger-specific termination signal

// EventEmitter.defaultMaxListeners = 100;
export class PysakaLogger implements IPysakaLogger {
  private destination: DestinationType;
  private severity: SeverityLevelEnum;
  private format: PrintFormatEnum;

  private serializerEncoding: BufferEncoding = 'utf-8';

  private proxyOutputSteam: Duplex;
  private proxyOutputSteamBufferSize: number; // in bytes

  private loggerId: string;
  private logWorker: Worker;

  private streamsToDestroy = [];
  private isDestroyed: boolean = false;
  private debugLogsOfLogger: boolean = false;
  private neverSpikeCPU: boolean = true;

  private sharedBuffer: SharedArrayBuffer;
  private sharedArray: Int32Array;
  private paramsStringified: string;

  private static __singleInstance: Record<string, PysakaLogger> = {};

  constructor(__params?: PysakaLoggerParams) {
    // TODO: singleton for now
    const paramsStringified = JSON.stringify(__params ?? {});
    if (PysakaLogger.__singleInstance[paramsStringified]) {
      return PysakaLogger.__singleInstance[paramsStringified];
    }
    this.paramsStringified = paramsStringified;
    PysakaLogger.__singleInstance[paramsStringified] = this;

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
    this.sharedBuffer = new SharedArrayBuffer(4); // A shared buffer with space for one 32-bit integer
    this.sharedArray = new Int32Array(this.sharedBuffer); // Create a typed array view
    Atomics.store(this.sharedArray, 0, 0);

    // let lastValue = -100;
    // setInterval(() => {
    //   // const newValue = +this.sharedArray[0];
    //   const newValue = Atomics.load(this.sharedArray, 0);
    //   if (newValue === lastValue) return;
    //   process.stdout.write('New value:' + newValue.toString() + '\n');
    //   lastValue = newValue;
    // }, 1); // Print the value every 100 milliseconds

    try {
      this.init();
    } catch (err) {
      process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');
      this.destructor();
      throw new Error(`${LOGGER_PREFIX} Failed to initialize logger`);
    }

    process.once('exit', this.gracefulShutdown.bind(this));
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
    this.initOutputStream();

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
        sharedBuffer: this.sharedBuffer, // amount of logs in the buffer not written to the destination
      },
    });
    this.logWorker.unref();

    this.debugLogsOfLogger &&
      process.stdout.write(`${LOGGER_PREFIX} Logger's worker is initialized\n`);
  }

  private initOutputStream() {
    this.proxyOutputSteamBufferSize = 2e5; // 2 MB
    this.proxyOutputSteam = new PassThrough({
      highWaterMark: this.proxyOutputSteamBufferSize,
    });

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const s = pipeline(this.logWorker.stdout, this.proxyOutputSteam, () => {});
    this.streamsToDestroy.push(s);

    this.pipeOutputToDestination();

    this.debugLogsOfLogger &&
      process.stdout.write(
        `${LOGGER_PREFIX} Logger's output stream is piped\n`,
      );
  }

  private async pipeOutputToDestination() {
    this.proxyOutputSteam.unpipe(this.destination); // just in case

    this.proxyOutputSteam.once(
      'error',
      this.handleOutputStreamError.bind(this),
    );
    this.destination.once('error', this.handleOutputStreamError.bind(this));

    const s = this.proxyOutputSteam.pipe(this.destination, { end: false });
    this.streamsToDestroy.push(s);
  }

  private handleOutputStreamError(err) {
    if (this.isDestroyed) return;

    if (!this.destination.writableEnded) {
      process.stderr.write(`${LOGGER_PREFIX} Destination is not writable\n}`);
      this.gracefulShutdown();
      return;
    }

    process.stderr.write(
      `${LOGGER_PREFIX} Pipeline proxyOutputSteam->destination failed\n`,
    );
    process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');
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
        Atomics.add(this.sharedArray, 0, 1);
      });
    } else {
      this.logWorker.postMessage(serializableArgs);
      Atomics.add(this.sharedArray, 0, 1);
    }

    return this;
  }

  private destructor() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // do all possible unpipes
    this.logWorker.stdout && this.logWorker.stdout.unpipe();
    this.proxyOutputSteam && this.proxyOutputSteam.unpipe();

    // pipe results as streams to be cleaned
    this.streamsToDestroy?.forEach((s) => {
      s.removeAllListeners();
      s.destroyed || s.destroy();
    });

    if (this.logWorker) {
      // this.logWorker.unref();
      this.logWorker.removeAllListeners();
      this.logWorker.terminate();
    }

    if (this.proxyOutputSteam) {
      this.proxyOutputSteam.end();
      this.proxyOutputSteam.removeAllListeners();
      this.proxyOutputSteam.destroy();
    }

    // process.stdout.write(
    //   `${LOGGER_PREFIX} Destination is writableEnded ${this.destination.writableEnded} [false is good]\n`,
    // );
    this.debugLogsOfLogger &&
      process.stdout.write(`${LOGGER_PREFIX} Logger is shut down\n`);

    // drop Singleton cached instance
    this.paramsStringified &&
      delete PysakaLogger.__singleInstance[this.paramsStringified];
  }

  public async gracefulShutdown() {
    if (this.isDestroyed) return;

    this.logWorker.postMessage([0, '__DONE']);

    // yeah, but it's a bit more complicated
    await new Promise((resolve) => {
      const intervalId = setInterval(() => {
        if (Atomics.load(this.sharedArray, 0) <= 0) {
          clearInterval(intervalId);
          resolve(null);
        }
      }, 1);
    });

    await Promise.all([
      new Promise((resolve) => this.logWorker.stdin.once('drain', resolve)),
      (() => {
        setTimeout(() => this.logWorker.stdin.emit('drain'), 0);
      })(),
    ]);
    this.streamsToDestroy?.forEach((s) => {
      // s.removeAllListeners();
      s.emit('drain');
    });
    await Promise.all([
      new Promise((resolve) => this.proxyOutputSteam.once('drain', resolve)),
      (() => {
        setTimeout(() => this.proxyOutputSteam.emit('drain'), 0);
      })(),
    ]);
    await Promise.all([
      new Promise((resolve) => this.destination.once('drain', resolve)),
      (() => {
        setTimeout(() => this.destination.emit('drain'), 0);
      })(),
    ]);

    this.destructor();
  }

  public async close() {
    // bcz we must allow all neverSpikeCPU setImmediate callbacks to finish
    await new Promise((resolve) =>
      this.neverSpikeCPU
        ? setTimeout(
            () => this.gracefulShutdown().finally(() => resolve(null)),
            1,
          )
        : this.gracefulShutdown().finally(() => resolve(null)),
    );
    // await this.gracefulShutdown();
  }

  public closeSync() {
    if (this.isDestroyed) return;
    if (this.neverSpikeCPU) {
      this.debugLogsOfLogger &&
        process.stdout.write(
          `${LOGGER_PREFIX} Sync closing isn't  allowed when neverSpikeCPU=true\n`,
        );
      return;
    }

    this.logWorker.postMessage([0, '__DONE']);

    // yeah, but it's a bit more complicated
    while (Atomics.load(this.sharedArray, 0) > 0) {}

    this.logWorker.stdin.emit('drain');
    this.streamsToDestroy?.forEach((s) => {
      // s.removeAllListeners();
      s.emit('drain');
    });
    this.proxyOutputSteam.emit('drain');
    this.destination.emit('drain');

    setImmediate(() => this.destructor());
  }

  // TODO: implement
  public child() {
    return this;
  }
}

export default PysakaLogger;
