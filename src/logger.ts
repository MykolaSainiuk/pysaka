import { WriteStream, unlinkSync } from 'node:fs';
import { Duplex, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  DEFAULT_LOGGER_PARAMS,
  DEFAULT_STREAMS_RECOVERY_TIMEOUT,
  LOGGER_PREFIX,
} from './consts';
import {
  PrintFormatEnum,
  SeverityLevelEnum,
  SeverityLevelValueToKey,
} from './enums';
import type {
  DestinationType,
  IPysakaLogger,
  LogItem,
  PysakaLoggerParams,
} from './types';
import { openFileInSyncWay } from './util';

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
      process.stderr.write(LOGGER_PREFIX + ' ' + err.message);
      this.shutdown();
      throw new Error(
        `${LOGGER_PREFIX} Failed to initialize logger. Pardon me`,
      );
    }
    process.once('exit', this.shutdown.bind(this));
  }

  private init() {
    this.initOutputStream();
    this.fallbackSupportEnabled && this.initFallbackStream();

    process.stdout.write(`${LOGGER_PREFIX} Logger initialized\n`);
  }

  private initOutputStream() {
    this.proxyOutputStreamAC = new AbortController();
    this.proxyOutputSteamBufferSize = 5e5; // 5 MB
    this.proxyOutputSteam = new PassThrough({
      highWaterMark: this.proxyOutputSteamBufferSize,
      signal: this.proxyOutputStreamAC.signal,
    });

    this.pipeOutputToDestination();
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

    this.pipeFallbackStream();
  }

  private shutdown() {
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
      process.stderr.write(LOGGER_PREFIX + ' ' + err.message);

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
    const that = this;
    this.fallbackCheckId && clearTimeout(this.fallbackCheckId);
    try {
      await Promise.all([
        pipeline(
          this.fallbackStream,
          async function* incRestoreCounter(logs: AsyncIterable<Buffer>) {
            for await (const log of logs) {
              that.fallbackItemsCount++;
              yield log;
            }
          },
          this.fallbackWStream,
          {
            signal: this.fallbackStreamAC.signal,
            end: false,
          },
        ),
        pipeline(this.fallbackStream, this.proxyOutputSteam, {
          signal: this.fallbackStreamAC.signal,
          end: false,
        }),
      ]);
    } catch (err) {
      process.stderr.write(LOGGER_PREFIX + ' ' + err.message);

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

  // TODO: implement bcz slowest place must be
  private write(logLevel: SeverityLevelEnum, ...args: any[]): this {
    if (logLevel < this.severity) {
      return this;
    }

    // TODO: must be a BOTTLENECK
    const logContent: Buffer =
      this.format === PrintFormatEnum.JSON
        ? this.serializeJSON(args)
        : this.serializeText(args);

    this.__write(logContent);

    return this;
  }

  private serializeJSON(args: any[]): Buffer {
    const logObj: LogItem = this.getLogItem(args);

    return Buffer.from(
      JSON.stringify(logObj, undefined, 0),
      this.serializerEncoding,
    );
  }

  private getLogItem([msg, ...rest]: any[]): LogItem {
    const logObj: LogItem = {
      time: Date.now(),
      level: SeverityLevelValueToKey[this.severity] ?? this.severity,
      pid: process.pid,
    };
    const dataKey =
      this.severity >= SeverityLevelEnum.ERROR ? 'errors' : 'data';
    if (typeof msg === 'string' || msg instanceof String) {
      logObj.msg = String(msg);
    } else {
      rest.unshift(msg);
    }
    if (rest.length) {
      logObj[dataKey] = rest;
    }

    return logObj;
  }

  // TODO: implement text print
  private serializeText(args: any[]): Buffer {
    const logObj: LogItem = this.getLogItem(args);

    let str = `[${this.getLocaleTimestamp(logObj.time)}] ${logObj.level} (${
      logObj.pid
    })`;
    if (logObj.msg) {
      str += ` "${logObj.msg}"`;
    }
    if (logObj.data || logObj.errors) {
      str += ` :: ${JSON.stringify(logObj.data ?? logObj.errors)}`;
    }

    return Buffer.from(str, this.serializerEncoding);
  }

  private getLocaleTimestamp(t: number = Date.now()) {
    const d = new Date(t);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  }

  private __write(content: Buffer): Promise<void> {
    if (!this.isDestinationAvailable()) {
      this.fallbackSupportEnabled && this.fallbackWrite(content);
      return;
    }

    this.proxyOutputSteam.write(
      content + '\n',
      this.serializerEncoding,
      (err) =>
        err && this.fallbackSupportEnabled && this.fallbackWrite(content),
    );

    if (this.proxyOutputSteam.writableNeedDrain) {
      this.proxyOutputSteam.emit('drain');
    }
    // TODO: reason about shrinking the fallback file
    // if (this.fallbackItemsCount) {
    //   setTimeout(() => truncateFile(this.fallbackFilePath), 10);
    //   this.fallbackItemsCount = 0;
    // }
  }

  private fallbackWrite(content: Buffer): void {
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
}
