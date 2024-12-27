import path from 'node:path';
import { finished, pipeline } from 'node:stream/promises';
import { Worker } from 'node:worker_threads';
import { serialize } from 'node:v8';
import { Buffer } from 'node:buffer';

import {
  BUFFER_ARGS_SEPARATOR,
  BUFFER_LOGS_END_SEPARATOR,
  BUFFER_LOGS_START_SEPARATOR,
  DEFAULT_LOGGER_PARAMS,
  // EXIT_SIGNALS,
  LOGGER_PREFIX,
} from './consts';
import { PrintFormatEnum, SeverityLevelEnum } from './enums';
import type {
  DestinationType,
  IPysakaLogger,
  PysakaLoggerParams,
} from './types';
import { generateNumericId, getTypeAsBuffer } from './util';
// import { once } from 'node:events';

// EventEmitter.defaultMaxListeners = 100;
export class PysakaLogger implements IPysakaLogger {
  private destination: DestinationType;
  private severity: SeverityLevelEnum;
  private format: PrintFormatEnum;
  private prefix: string;
  private internalLogs: boolean = false;
  private serializerEncoding: BufferEncoding = 'utf-8';

  private isDestroyed: boolean = false;
  private loggerId: string;
  private logWorker: Worker;

  constructor(__params?: PysakaLoggerParams) {
    const params = { ...DEFAULT_LOGGER_PARAMS, ...__params };

    this.destination = params.destination;
    // TODO: surround with atomics
    if (!this.destination.writable) {
      throw new Error(`${LOGGER_PREFIX} Destination is not writable`);
    }

    this.severity = params.severity;
    this.format = params.format;
    this.prefix = params.prefix;
    this.internalLogs = params.internalLogs ?? false;

    // EXIT_SIGNALS.forEach((event) =>
    //   process.once(event, async (code) => {
    //     await this.gracefulShutdown();
    //     process.exit(Number.isNaN(+code) ? 0 : code);
    //   }),
    // );
    // process.once('exit', this.destructor.bind(this));

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
    return this.write(SeverityLevelEnum.FATAL, ...args);
  }

  // private methods
  private init() {
    this.initWorker();
    this.setupPipeline();

    this.internalLogs &&
      process.stdout.write(`${LOGGER_PREFIX} Logger is initialized\n`);
  }

  private initWorker() {
    this.loggerId = generateNumericId(10);

    const dirname = process.cwd();
    const workerPath = path.join(dirname, './src/worker.mjs');

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
        prefix: this.prefix,
      },
    });
    // this.logWorker.unref();
    // this.logWorker.stderr.pipe(process.stderr);

    this.internalLogs &&
      process.stdout.write(`${LOGGER_PREFIX} Logger's worker is initialized\n`);
  }

  private setupPipeline() {
    pipeline(this.logWorker.stdout, this.destination, { end: false })
      .then(
        () =>
          this.internalLogs &&
          process.stdout.write(
            `${LOGGER_PREFIX} Pipeline logWorker.stdout->destination had no errors\n`,
          ),
      )
      .catch(this.handleStreamError.bind(this));

    this.internalLogs &&
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

    // convert to Buffer
    const buffers: Buffer[] = [
      BUFFER_LOGS_START_SEPARATOR,
      Buffer.from(String(logLevel)), // no need for type bcz it's always INT
      BUFFER_ARGS_SEPARATOR,
    ];
    const l = args.length;
    for (let i = 0; i < l; i++) {
      const item =
        // dunno why but Error isn't transferable by default via HTML structured clone algorithm
        args[i] instanceof Error
          ? {
              message: args[i].message,
              stack: args[i].stack,
            }
          : args[i];

      const itemBuf =
        item === Object(item)
          ? serialize(item)
          : Buffer.from(String(item), 'utf-8');
      const type = getTypeAsBuffer(item);

      buffers.push(type, itemBuf);

      i < l - 1 && buffers.push(BUFFER_ARGS_SEPARATOR);
    }
    buffers.push(BUFFER_LOGS_END_SEPARATOR);

    const bufToSend = Buffer.concat(buffers);

    this.logWorker.stdin.write(bufToSend);

    return this;
  }

  private destructor() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.logWorker) {
      // this.logWorker.unref();
      this.logWorker.removeAllListeners();
      this.logWorker.terminate();
    }

    this.internalLogs &&
      process.stdout.write(`${LOGGER_PREFIX} Logger is shut down\n`);
  }

  public async gracefulShutdown() {
    if (this.isDestroyed) return;

    // signal worker to end async iter over read stream
    this.logWorker.postMessage({ end: true });

    // read all logs from worker first
    await finished(this.logWorker.stdout);
    await Promise.all([
      this.logWorker.stdin.end(),
      // write downstream the logs into destination
      // once(this.logWorker.stdin, 'finish'),
      finished(this.logWorker.stdin),
    ]);

    // force "flush" under/into destination
    await Promise.all([
      new Promise((resolve) => this.destination.once('drain', resolve)),
      setTimeout(() => this.destination.emit('drain'), 1),
    ]);

    this.destructor();
  }

  public async close() {
    if (this.isDestroyed) return;

    await new Promise((resolve) =>
      this.gracefulShutdown().finally(resolve as never),
    );
  }

  setSeverity(severity: SeverityLevelEnum): void {
    this.severity = severity;
    this.logWorker.postMessage({ severity });
  }

  setFormat(format: PrintFormatEnum): void {
    this.format = format;
    this.logWorker.postMessage({ format });
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
    this.logWorker.postMessage({ prefix });
  }

  // TODO: implement
  public child(newPrefix?: string) {
    return this;
  }
}

export default PysakaLogger;
