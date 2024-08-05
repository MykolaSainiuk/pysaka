import { WriteStream, unlinkSync } from 'node:fs';
import path from 'node:path';
import { Duplex, PassThrough, pipeline } from 'node:stream';
import { finished } from 'node:stream/promises';
import { Worker } from 'node:worker_threads';

import {
  DEFAULT_LOGGER_PARAMS,
  DEFAULT_STREAMS_RECOVERY_TIMEOUT,
  LOGGER_PREFIX,
} from './consts';
import { PrintFormatEnum, SeverityLevelEnum } from './enums';
import { LogSerializer } from './serializer.js';
import type {
  DestinationType,
  IPysakaLogger,
  PysakaLoggerParams,
} from './types';
import { generateNumericId, openFileInSyncWay } from './util';

// __DONE is customer this logger-specific termination signal

// EventEmitter.defaultMaxListeners = 100;
export class PysakaLogger implements IPysakaLogger {
  private destination: DestinationType;
  private severity: SeverityLevelEnum;
  private format: PrintFormatEnum;

  private destinationUnavailable: boolean = false;
  private destinationCheckId: NodeJS.Timeout | null;
  private serializerEncoding: BufferEncoding = 'utf-8';

  private proxyOutputSteam: Duplex;
  private proxyOutputSteamBufferSize: number; // in bytes

  private fallbackSupportEnabled: boolean;
  private fallbackStream: Duplex;
  private fallbackFilePath: string;
  private fallbackStreamBufferSize: number; // in bytes
  private fallbackWStream: WriteStream;
  private fallbackItemsCount: number = 0;
  private fallbackCheckId: NodeJS.Timeout | null;

  private loggerId: string;
  private logWorker: Worker;
  private serializer: LogSerializer;

  private streamsToDestroy = [];
  private isDestroyed: boolean = false;
  private debugLogsOfLogger: boolean = false;
  private tempDirPath: string;
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
    this.destinationUnavailable = !this.destination.writable;
    if (this.destinationUnavailable) {
      throw new Error(`${LOGGER_PREFIX} Destination is not writable`);
    }
    if (params.tempDirPath && params.tempDirPath.includes('/')) {
      throw new Error(
        `${LOGGER_PREFIX} tempDirPath should be a relative path without slashes`,
      );
    }

    this.fallbackSupportEnabled = params.fallbackSupport;
    this.severity = params.severity;
    this.format = params.format;
    this.debugLogsOfLogger = params.debugLogsOfLogger ?? false;
    this.tempDirPath = params.tempDirPath ?? '__temp';
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

  private init() {
    this.initWorker();
    this.initOutputStream();
    // TODO: test it thoroughly
    this.fallbackSupportEnabled && this.initFallbackStream();

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
    this.proxyOutputSteamBufferSize = 5e5; // 5 MB
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

  private initFallbackStream() {
    this.fallbackStreamBufferSize = 5e5; // 500kb bcz RAM is cheap :)
    this.fallbackStream = new PassThrough({
      highWaterMark: this.fallbackStreamBufferSize,
    });

    this.fallbackFilePath = `${process.cwd()}/${this.tempDirPath}/pysaka_${
      this.loggerId
    }.log`;
    this.fallbackWStream = openFileInSyncWay(
      this.fallbackFilePath,
      this.serializerEncoding,
      this.fallbackStreamBufferSize,
    );
    this.serializer = new LogSerializer(
      this.loggerId,
      this.severity,
      this.serializerEncoding,
      this.format,
    );

    this.pipeFallbackStream();

    this.debugLogsOfLogger &&
      process.stdout.write(`${LOGGER_PREFIX} Logger's fallback stream is on\n`);
  }

  private async pipeOutputToDestination() {
    this.destinationCheckId && clearTimeout(this.destinationCheckId);
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

    if (!this.isDestinationAvailable()) {
      this.destinationUnavailable = true;
      this.destinationCheckId = setTimeout(
        () => this.pipeOutputToDestination(),
        DEFAULT_STREAMS_RECOVERY_TIMEOUT,
      );
    }
  }

  private pipeFallbackStream() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    // const that = this;
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);
    const s1 = pipeline(
      this.fallbackStream,
      // async function* incRestoreCounter(logs: AsyncIterable<Buffer>) {
      //   for await (const log of logs) {
      //     that.fallbackItemsCount++;
      //     yield log;
      //   }
      // },
      this.fallbackWStream,
      // () => {},
      this.handleFallbackStreamError.bind(this),
    );
    const s2 = pipeline(
      this.fallbackStream,
      this.proxyOutputSteam,
      // () => {},
      this.handleFallbackStreamError.bind(this),
    );

    this.streamsToDestroy.push(s1, s2);
  }

  private handleFallbackStreamError(err) {
    if (this.isDestroyed) return;

    process.stderr.write(`${LOGGER_PREFIX} Pipeline fallbackStream failed\n`);
    process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');

    this.fallbackSupportEnabled = false;
    this.fallbackCheckId = setTimeout(
      () => this.initFallbackStream(),
      DEFAULT_STREAMS_RECOVERY_TIMEOUT,
    );
  }

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

  private isDestinationAvailable(): boolean {
    this.destinationUnavailable =
      !this.destination.writable || this.destination.writableNeedDrain;

    if (this.destinationUnavailable) {
      if (this.destination.writableNeedDrain) {
        process.nextTick(() => this.destination.emit('drain'));
      }
      return false;
    }
    this.destinationUnavailable = true;
    return true;
  }

  private write(logLevel: SeverityLevelEnum, ...args: any[]): this {
    if (logLevel < this.severity) {
      return this;
    }

    if (!this.isDestinationAvailable() && this.fallbackSupportEnabled) {
      this.fallbackWrite(args);
      return;
    }

    const serializableArgs = [];
    serializableArgs.push(logLevel);

    for (const item of args) {
      // dunno why but Error isn't transferable by default via HTML structured clone algorithm
      if (item instanceof Error) {
        serializableArgs.push({
          message: item.message,
          stack: item.stack,
          cause: item.cause,
        });
      } else {
        serializableArgs.push(item);
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

  private fallbackWrite(args: any[]): void {
    const content: Buffer = this.serializer.serializeJSON(args);

    if (!this.fallbackStream.writable) {
      process.stderr.write(`${LOGGER_PREFIX} Fallback stream is unavailable\n`);
      process.stderr.write(
        `${LOGGER_PREFIX} Lost content(nl):\n` +
          content.toString(this.serializerEncoding),
      );
      return;
    }

    if (!this.fallbackStream.writableNeedDrain) {
      this.fallbackStream.write(content);
      return;
    }

    this.fallbackStream.once('drain', () =>
      this.fallbackStream.write(content, this.serializerEncoding),
    );
  }

  private destructor() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.destinationCheckId && clearTimeout(this.destinationCheckId);
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);

    // do all possible unpipes
    this.logWorker.stdout && this.logWorker.stdout.unpipe();
    this.proxyOutputSteam && this.proxyOutputSteam.unpipe();
    this.fallbackStream && this.fallbackStream.unpipe();

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

    if (this.fallbackStream) {
      // this.fallbackWStream.emit('finish');
      this.fallbackStream.end();
      this.fallbackStream.removeAllListeners();
      this.fallbackWStream.destroy();
      this.fallbackStream.destroy();

      unlinkSync(this.fallbackFilePath);
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

    this.destinationCheckId && clearTimeout(this.destinationCheckId);
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);

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
          `${LOGGER_PREFIX} Sync closing isn't in case of neverSpikeCPU=true\n`,
        );
      return;
    }

    this.destinationCheckId && clearTimeout(this.destinationCheckId);
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);

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
