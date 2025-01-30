import path from 'node:path';
import { finished, pipeline } from 'node:stream/promises';
import { Worker } from 'node:worker_threads';
import { serialize } from 'node:v8';
import { Buffer } from 'node:buffer';
import { BUFFER_ARGS_SEPARATOR, BUFFER_LOGS_END_SEPARATOR, BUFFER_LOGS_START_SEPARATOR, DEFAULT_LOGGER_PARAMS, LOGGER_PREFIX, } from './consts.js';
import { SeverityLevelEnum } from './enums.js';
import { generateNumericId, getTypeAsBuffer } from './util.js';
import { getDirName } from './dirname.js';
export class PysakaLogger {
    destination;
    severity;
    format;
    prefix;
    internalLogs = false;
    serializerEncoding = 'utf-8';
    isDestroyed = false;
    loggerId;
    logWorker;
    constructor(__params) {
        const params = { ...DEFAULT_LOGGER_PARAMS, ...__params };
        this.destination = params.destination;
        if (!this.destination.writable) {
            throw new Error(`${LOGGER_PREFIX} Destination is not writable`);
        }
        this.severity = params.severity;
        this.format = params.format;
        this.prefix = params.prefix;
        this.internalLogs = params.internalLogs ?? false;
        try {
            this.init();
        }
        catch (err) {
            process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');
            this.destructor();
            throw new Error(`${LOGGER_PREFIX} Failed to initialize logger`);
        }
    }
    log(...args) {
        return this.write(SeverityLevelEnum.INFO, ...args);
    }
    info(...args) {
        return this.write(SeverityLevelEnum.INFO, ...args);
    }
    warn(...args) {
        return this.write(SeverityLevelEnum.WARN, ...args);
    }
    error(...args) {
        return this.write(SeverityLevelEnum.ERROR, ...args);
    }
    debug(...args) {
        return this.write(SeverityLevelEnum.DEBUG, ...args);
    }
    fatal(...args) {
        return this.write(SeverityLevelEnum.FATAL, ...args);
    }
    init() {
        this.initWorker();
        this.setupPipeline();
        this.internalLogs &&
            process.stdout.write(`${LOGGER_PREFIX} Logger is initialized\n`);
    }
    initWorker() {
        this.loggerId = generateNumericId(10);
        const dirname = getDirName();
        const workerPath = path.join(dirname, 'worker.js');
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
        this.internalLogs &&
            process.stdout.write(`${LOGGER_PREFIX} Logger's worker is initialized\n`);
    }
    setupPipeline() {
        pipeline(this.logWorker.stdout, this.destination, { end: false })
            .then(() => this.internalLogs &&
            process.stdout.write(`${LOGGER_PREFIX} Pipeline logWorker.stdout->destination had no errors\n`))
            .catch(this.handleStreamError.bind(this));
        this.internalLogs &&
            process.stdout.write(`${LOGGER_PREFIX} Logger's stream's pipeline is ready\n`);
    }
    handleStreamError(err) {
        if (this.isDestroyed)
            return;
        if (err) {
            process.stderr.write(`${LOGGER_PREFIX} Pipeline logWorker.stdout->destination has failed\n`);
            process.stderr.write(LOGGER_PREFIX + ' ' + err.message + '\n');
        }
    }
    write(logLevel, ...args) {
        if (logLevel < this.severity) {
            return this;
        }
        const buffers = [
            BUFFER_LOGS_START_SEPARATOR,
            Buffer.from(String(logLevel)),
            BUFFER_ARGS_SEPARATOR,
        ];
        const l = args.length;
        for (let i = 0; i < l; i++) {
            const item = args[i] instanceof Error
                ? {
                    message: args[i].message,
                    stack: args[i].stack,
                }
                : args[i];
            const itemBuf = item === Object(item)
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
    destructor() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        if (this.logWorker) {
            this.logWorker.removeAllListeners();
            this.logWorker.terminate();
        }
        this.internalLogs &&
            process.stdout.write(`${LOGGER_PREFIX} Logger is shut down\n`);
    }
    async gracefulShutdown() {
        if (this.isDestroyed)
            return;
        this.logWorker.postMessage({ end: true });
        await finished(this.logWorker.stdout);
        await Promise.all([
            this.logWorker.stdin.end(),
            finished(this.logWorker.stdin),
        ]);
        await Promise.all([
            new Promise((resolve) => this.destination.once('drain', resolve)),
            setTimeout(() => this.destination.emit('drain'), 1),
        ]);
        this.destructor();
    }
    async close() {
        if (this.isDestroyed)
            return;
        await new Promise((resolve) => this.gracefulShutdown().finally(resolve));
    }
    setSeverity(severity) {
        this.severity = severity;
        this.logWorker.postMessage({ severity });
    }
    setFormat(format) {
        this.format = format;
        this.logWorker.postMessage({ format });
    }
    setPrefix(prefix) {
        this.prefix = prefix;
        this.logWorker.postMessage({ prefix });
    }
    child(newPrefix) {
        return this;
    }
}
export default PysakaLogger;
