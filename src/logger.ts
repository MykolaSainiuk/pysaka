import { WriteStream, unlinkSync } from 'node:fs';
import path from 'node:path';
import { Duplex, PassThrough, once } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
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
  private proxyOutputStreamAC: AbortController;
  private proxyOutputSteamBufferSize: number; // in bytes

  private fallbackSupportEnabled: boolean;
  private fallbackStream: Duplex;
  private fallbackStreamAC: AbortController;
  private fallbackFilePath: string;
  private fallbackStreamBufferSize: number; // in bytes
  private fallbackWStream: WriteStream;
  private fallbackWStreamAC: AbortController;
  private fallbackItemsCount: number = 0;
  private fallbackCheckId: NodeJS.Timeout | null;

  private loggerId: string;
  private logWorkerAC: AbortController;
  private logWorker: Worker;
  private serializer: LogSerializer;

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
      this.shutdown();
      throw new Error(
        `${LOGGER_PREFIX} Failed to initialize logger. Pardon me`,
      );
    }

    // process.once('exit', this.shutdown.bind(this));
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

    this.logWorkerAC = new AbortController();
    this.logWorker = new Worker(workerPath, {
      name: this.loggerId,
      stdout: true,
      stdin: true,
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
    this.proxyOutputStreamAC = new AbortController();
    this.proxyOutputSteamBufferSize = 5e5; // 5 MB
    this.proxyOutputSteam = new PassThrough({
      highWaterMark: this.proxyOutputSteamBufferSize,
      signal: this.proxyOutputStreamAC.signal,
    });

    pipeline(this.logWorker.stdout, this.proxyOutputSteam, {
      signal: this.logWorkerAC.signal,
      end: false,
    }).catch((err) => {
      if (err) {
        process.stderr.write(
          `${LOGGER_PREFIX} Pipeline logWorker->proxyOutputSteam failed\n`,
        );
        process.stderr.write(`${LOGGER_PREFIX} ${err.message}\n`);
      } else {
        process.stdout.write('Pipeline succeeded.');
      }
    });

    this.pipeOutputToDestination();

    process.stdout.write(`${LOGGER_PREFIX} Logger's output stream is piped\n`);
  }

  private initFallbackStream() {
    this.fallbackStreamBufferSize = 5e5; // 500kb bcz RAM is cheap :)
    this.fallbackStreamAC = new AbortController();
    this.fallbackStream = new PassThrough({
      highWaterMark: this.fallbackStreamBufferSize,
      signal: this.fallbackStreamAC.signal,
    });

    this.fallbackWStreamAC = new AbortController();
    this.fallbackFilePath = `${process.cwd()}/__temp/pysaka_${Date.now()}.log`;
    this.fallbackWStream = openFileInSyncWay(
      this.fallbackFilePath,
      this.serializerEncoding,
      this.fallbackStreamBufferSize,
      this.fallbackWStreamAC.signal,
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

  private shutdown() {
    process.stdout.write(`${LOGGER_PREFIX} Logger is shutting down...\n`);
    this.destinationCheckId && clearTimeout(this.destinationCheckId);
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);

    this.proxyOutputSteam.unpipe(this.destination);
    this.logWorkerAC?.abort();
    this.logWorker?.terminate();
    this.proxyOutputStreamAC?.abort();

    if (this.fallbackStreamAC) {
      this.fallbackStreamAC.abort();
      this.fallbackWStreamAC.abort();
      unlinkSync(this.fallbackFilePath);
    }
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

  private async pipeOutputToDestination() {
    this.destinationCheckId && clearTimeout(this.destinationCheckId);
    try {
      await pipeline(this.proxyOutputSteam, this.destination, {
        signal: this.proxyOutputStreamAC.signal,
        end: false,
      });
    } catch (err) {
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
  }

  private async pipeFallbackStream() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    // const that = this;
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);
    try {
      await Promise.all([
        pipeline(
          this.fallbackStream,
          // async function* incRestoreCounter(logs: AsyncIterable<Buffer>) {
          //   for await (const log of logs) {
          //     that.fallbackItemsCount++;
          //     yield log;
          //   }
          // },
          this.fallbackWStream,
          {
            signal: this.fallbackStreamAC.signal,
            end: true,
          },
        ),
        pipeline(this.fallbackStream, this.proxyOutputSteam, {
          signal: this.fallbackStreamAC.signal,
          end: true,
        }),
      ]);
    } catch (err) {
      process.stderr.write(`${LOGGER_PREFIX} Pipeline fallbackStream failed\n`);
      process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');

      this.fallbackSupportEnabled = false;
      this.fallbackCheckId = setTimeout(
        () => this.initFallbackStream(),
        DEFAULT_STREAMS_RECOVERY_TIMEOUT,
      );
    }
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

  // private __write(content: Buffer): Promise<void> {
  //   if (!this.isDestinationAvailable()) {
  //     this.fallbackSupportEnabled && this.fallbackWrite(content);
  //     return;
  //   }

  //   this.proxyOutputSteam.write(
  //     content + '\n',
  //     this.serializerEncoding,
  //     (err) =>
  //       err && this.fallbackSupportEnabled && this.fallbackWrite(content),
  //   );

  //   if (this.proxyOutputSteam.writableNeedDrain) {
  //     this.proxyOutputSteam.emit('drain');
  //   }
  //   // TODO: reason about shrinking the fallback file
  //   // if (this.fallbackItemsCount) {
  //   //   setTimeout(() => truncateFile(this.fallbackFilePath), 10);
  //   //   this.fallbackItemsCount = 0;
  //   // }
  // }

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

  public async gracefulShutdown() {
    this.destinationCheckId && clearTimeout(this.destinationCheckId);
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);

    this.logWorker.postMessage('__DONE');

    await Promise.race([
      finished(this.logWorker.stdout),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
    if (!this.logWorker.stdout.readableEnded) {
      this.logWorker.stdin.emit('finish');
      this.logWorker.stdout.emit('end');
    }

    if (this.proxyOutputSteam.writableNeedDrain) {
      await once(this.proxyOutputSteam, 'drain');
    }
    if (process.stdout.writableNeedDrain) {
      await once(process.stdout, 'drain');
    }

    await finished(this.proxyOutputSteam);

    this.shutdown();

    process.stdout.write(`${LOGGER_PREFIX} Logger is shut down\n`);
    // process.exit(0);
  }
}
