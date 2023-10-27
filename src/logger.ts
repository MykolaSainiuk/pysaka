import { WriteStream, unlinkSync } from 'node:fs';
import path from 'node:path';
import { Duplex, PassThrough, once, pipeline } from 'node:stream';
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
  private static __singleInstance: Record<string, PysakaLogger> = {};

  constructor(__params?: PysakaLoggerParams) {
    // TODO: singleton for now
    const paramsStringified = JSON.stringify(__params ?? {});
    if (PysakaLogger.__singleInstance[paramsStringified]) {
      return PysakaLogger.__singleInstance[paramsStringified];
    }
    PysakaLogger.__singleInstance[paramsStringified] = this;

    const params = { ...DEFAULT_LOGGER_PARAMS, ...__params };
    this.destination = params.destination;
    // TODO: surround with atomics
    this.destinationUnavailable = !this.destination.writable;
    if (this.destinationUnavailable) {
      throw new Error(`${LOGGER_PREFIX} Destination is not writable`);
    }

    this.fallbackSupportEnabled = params.fallbackSupport;
    this.severity = params.severity;
    this.format = params.format;

    try {
      this.init();
    } catch (err) {
      process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');
      this.destructor();
      throw new Error(
        `${LOGGER_PREFIX} Failed to initialize logger. Pardon me`,
      );
    }

    process.once('exit', this.destructor.bind(this));
  }

  private init() {
    this.initWorker();
    this.initOutputStream();
    this.fallbackSupportEnabled && this.initFallbackStream();

    process.stdout.write(`${LOGGER_PREFIX} Logger is initialized\n`);
  }

  private initWorker() {
    this.loggerId = generateNumericId(10);
    const workerPath = path.join(process.cwd(), './src/worker.js');

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
      },
    });
    this.logWorker.unref();

    process.stdout.write(`${LOGGER_PREFIX} Logger's worker is initialized\n`);
  }

  private initOutputStream() {
    this.proxyOutputSteamBufferSize = 5e5; // 5 MB
    this.proxyOutputSteam = new PassThrough({
      highWaterMark: this.proxyOutputSteamBufferSize,
    });

    const s = pipeline(this.logWorker.stdout, this.proxyOutputSteam, () => {});
    this.streamsToDestroy.push(s);

    this.pipeOutputToDestination();

    process.stdout.write(`${LOGGER_PREFIX} Logger's output stream is piped\n`);
  }

  private initFallbackStream() {
    this.fallbackStreamBufferSize = 5e5; // 500kb bcz RAM is cheap :)
    this.fallbackStream = new PassThrough({
      highWaterMark: this.fallbackStreamBufferSize,
    });

    this.fallbackFilePath = `${process.cwd()}/__temp/pysaka_${
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
  public critical(...args: any[]): this {
    return this.write(SeverityLevelEnum.CRITICAL, ...args);
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

    this.logWorker.postMessage(args);

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
    this.logWorker.stdout.unpipe();
    this.proxyOutputSteam.unpipe();
    this.proxyOutputSteam.unpipe(this.destination);
    if (this.fallbackStream) {
      this.fallbackStream.unpipe();
    }
    // pipe results as streams to be cleaned
    this.streamsToDestroy?.forEach((s) => {
      s.removeAllListeners();
      s.destroyed || s.destroy();
    });

    if (this.logWorker) {
      this.logWorker.unref();
      this.logWorker.removeAllListeners();
      this.logWorker.terminate();
    }

    this.proxyOutputSteam.end();
    this.proxyOutputSteam.removeAllListeners();
    this.proxyOutputSteam.destroy();

    if (this.fallbackStream) {
      this.fallbackWStream.emit('finish');
      this.fallbackStream.end();
      this.fallbackStream.removeAllListeners();
      this.fallbackWStream.destroy();
      this.fallbackStream.destroy();
      unlinkSync(this.fallbackFilePath);
    }

    process.stdout.write(
      `${LOGGER_PREFIX} Destination is writableEnded ${this.destination.writableEnded} [false is good]\n`,
    );
    process.stdout.write(`${LOGGER_PREFIX} Logger is shut down\n`);
  }

  public async gracefulShutdown() {
    this.destinationCheckId && clearTimeout(this.destinationCheckId);
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);

    this.logWorker.postMessage('__DONE');

    await Promise.race([
      finished(this.logWorker.stdout),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);

    this.logWorker.stdout.unpipe(this.proxyOutputSteam);
    this.streamsToDestroy?.forEach((s) => {
      s.removeAllListeners();
    });
    this.logWorker.stdin.emit('finish');
    this.logWorker.stdout.emit('end');

    if (this.proxyOutputSteam.writableNeedDrain) {
      await once(this.proxyOutputSteam, 'drain');
    }
    if (process.stdout.writableNeedDrain) {
      await once(process.stdout, 'drain');
    }

    await finished(this.proxyOutputSteam);

    this.destructor();
  }

  public closeSync() {
    this.destructor();
  }

  public async close() {
    await this.gracefulShutdown();
  }
}

export default PysakaLogger;
