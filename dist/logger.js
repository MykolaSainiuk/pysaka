"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PysakaLogger = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_stream_1 = require("node:stream");
const promises_1 = require("node:stream/promises");
const node_worker_threads_1 = require("node:worker_threads");
const consts_1 = require("./consts");
const enums_1 = require("./enums");
const serializer_js_1 = require("./serializer.js");
const util_1 = require("./util");
class PysakaLogger {
    destination;
    severity;
    format;
    destinationUnavailable = false;
    destinationCheckId;
    serializerEncoding = 'utf-8';
    proxyOutputSteam;
    proxyOutputSteamBufferSize;
    fallbackSupportEnabled;
    fallbackStream;
    fallbackFilePath;
    fallbackStreamBufferSize;
    fallbackWStream;
    fallbackItemsCount = 0;
    fallbackCheckId;
    loggerId;
    logWorker;
    serializer;
    streamsToDestroy = [];
    isDestroyed = false;
    debugLogs = false;
    tempDirPath;
    static __singleInstance = {};
    constructor(__params) {
        const paramsStringified = JSON.stringify(__params ?? {});
        if (PysakaLogger.__singleInstance[paramsStringified]) {
            return PysakaLogger.__singleInstance[paramsStringified];
        }
        PysakaLogger.__singleInstance[paramsStringified] = this;
        const params = { ...consts_1.DEFAULT_LOGGER_PARAMS, ...__params };
        this.destination = params.destination;
        this.destinationUnavailable = !this.destination.writable;
        if (this.destinationUnavailable) {
            throw new Error(`${consts_1.LOGGER_PREFIX} Destination is not writable`);
        }
        if (params.tempDirPath && params.tempDirPath.includes('/')) {
            throw new Error(`${consts_1.LOGGER_PREFIX} tempDirPath should be a relative path without slashes`);
        }
        this.fallbackSupportEnabled = params.fallbackSupport;
        this.severity = params.severity;
        this.format = params.format;
        this.debugLogs = params.debugLogs ?? false;
        this.tempDirPath = params.tempDirPath ?? '__temp';
        try {
            this.init();
        }
        catch (err) {
            process.stderr.write(consts_1.LOGGER_PREFIX + ' ' + err.message + '\n');
            this.destructor();
            throw new Error(`${consts_1.LOGGER_PREFIX} Failed to initialize logger`);
        }
        process.once('exit', this.gracefulShutdown.bind(this));
    }
    init() {
        this.initWorker();
        this.initOutputStream();
        this.fallbackSupportEnabled && this.initFallbackStream();
        this.debugLogs &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger is initialized\n`);
    }
    initWorker() {
        this.loggerId = (0, util_1.generateNumericId)(10);
        const workerPath = node_path_1.default.join(__dirname, './worker.js');
        this.logWorker = new node_worker_threads_1.Worker(workerPath, {
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
        this.debugLogs &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger's worker is initialized\n`);
    }
    initOutputStream() {
        this.proxyOutputSteamBufferSize = 5e5;
        this.proxyOutputSteam = new node_stream_1.PassThrough({
            highWaterMark: this.proxyOutputSteamBufferSize,
        });
        const s = (0, node_stream_1.pipeline)(this.logWorker.stdout, this.proxyOutputSteam, () => { });
        this.streamsToDestroy.push(s);
        this.pipeOutputToDestination();
        this.debugLogs &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger's output stream is piped\n`);
    }
    initFallbackStream() {
        this.fallbackStreamBufferSize = 5e5;
        this.fallbackStream = new node_stream_1.PassThrough({
            highWaterMark: this.fallbackStreamBufferSize,
        });
        this.fallbackFilePath = `${process.cwd()}/${this.tempDirPath}/pysaka_${this.loggerId}.log`;
        this.fallbackWStream = (0, util_1.openFileInSyncWay)(this.fallbackFilePath, this.serializerEncoding, this.fallbackStreamBufferSize);
        this.serializer = new serializer_js_1.LogSerializer(this.loggerId, this.severity, this.serializerEncoding, this.format);
        this.pipeFallbackStream();
        this.debugLogs &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger's fallback stream is on\n`);
    }
    async pipeOutputToDestination() {
        this.destinationCheckId && clearTimeout(this.destinationCheckId);
        this.proxyOutputSteam.unpipe(this.destination);
        this.proxyOutputSteam.once('error', this.handleOutputStreamError.bind(this));
        this.destination.once('error', this.handleOutputStreamError.bind(this));
        const s = this.proxyOutputSteam.pipe(this.destination, { end: false });
        this.streamsToDestroy.push(s);
    }
    handleOutputStreamError(err) {
        if (this.isDestroyed)
            return;
        if (!this.destination.writableEnded) {
            process.stderr.write(`${consts_1.LOGGER_PREFIX} Destination is not writable\n}`);
            this.gracefulShutdown();
            return;
        }
        process.stderr.write(`${consts_1.LOGGER_PREFIX} Pipeline proxyOutputSteam->destination failed\n`);
        process.stderr.write(consts_1.LOGGER_PREFIX + ' ' + err.message + '\n');
        if (!this.isDestinationAvailable()) {
            this.destinationUnavailable = true;
            this.destinationCheckId = setTimeout(() => this.pipeOutputToDestination(), consts_1.DEFAULT_STREAMS_RECOVERY_TIMEOUT);
        }
    }
    pipeFallbackStream() {
        this.fallbackCheckId && clearTimeout(this.fallbackCheckId);
        const s1 = (0, node_stream_1.pipeline)(this.fallbackStream, this.fallbackWStream, this.handleFallbackStreamError.bind(this));
        const s2 = (0, node_stream_1.pipeline)(this.fallbackStream, this.proxyOutputSteam, this.handleFallbackStreamError.bind(this));
        this.streamsToDestroy.push(s1, s2);
    }
    handleFallbackStreamError(err) {
        if (this.isDestroyed)
            return;
        process.stderr.write(`${consts_1.LOGGER_PREFIX} Pipeline fallbackStream failed\n`);
        process.stderr.write(consts_1.LOGGER_PREFIX + ' ' + err.message + '\n');
        this.fallbackSupportEnabled = false;
        this.fallbackCheckId = setTimeout(() => this.initFallbackStream(), consts_1.DEFAULT_STREAMS_RECOVERY_TIMEOUT);
    }
    log(...args) {
        return this.write(enums_1.SeverityLevelEnum.INFO, ...args);
    }
    info(...args) {
        return this.write(enums_1.SeverityLevelEnum.INFO, ...args);
    }
    warn(...args) {
        return this.write(enums_1.SeverityLevelEnum.WARN, ...args);
    }
    error(...args) {
        return this.write(enums_1.SeverityLevelEnum.ERROR, ...args);
    }
    debug(...args) {
        return this.write(enums_1.SeverityLevelEnum.DEBUG, ...args);
    }
    fatal(...args) {
        return this.write(enums_1.SeverityLevelEnum.FATAl, ...args);
    }
    isDestinationAvailable() {
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
    write(logLevel, ...args) {
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
            if (item instanceof Error) {
                serializableArgs.push({
                    message: item.message,
                    stack: item.stack,
                    cause: item.cause,
                });
                continue;
            }
            serializableArgs.push(item);
        }
        this.logWorker.postMessage(serializableArgs);
        return this;
    }
    fallbackWrite(args) {
        const content = this.serializer.serializeJSON(args);
        if (!this.fallbackStream.writable) {
            process.stderr.write(`${consts_1.LOGGER_PREFIX} Fallback stream is unavailable\n`);
            process.stderr.write(`${consts_1.LOGGER_PREFIX} Lost content(nl):\n` +
                content.toString(this.serializerEncoding));
            return;
        }
        if (!this.fallbackStream.writableNeedDrain) {
            this.fallbackStream.write(content);
            return;
        }
        this.fallbackStream.once('drain', () => this.fallbackStream.write(content, this.serializerEncoding));
    }
    destructor() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        this.destinationCheckId && clearTimeout(this.destinationCheckId);
        this.fallbackCheckId && clearTimeout(this.fallbackCheckId);
        this.logWorker.stdout.unpipe();
        this.proxyOutputSteam.unpipe();
        this.proxyOutputSteam.unpipe(this.destination);
        if (this.fallbackStream) {
            this.fallbackStream.unpipe();
        }
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
            (0, node_fs_1.unlinkSync)(this.fallbackFilePath);
        }
        this.debugLogs &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger is shut down\n`);
    }
    async gracefulShutdown() {
        if (this.isDestroyed)
            return;
        this.destinationCheckId && clearTimeout(this.destinationCheckId);
        this.fallbackCheckId && clearTimeout(this.fallbackCheckId);
        this.logWorker.postMessage([0, '__DONE']);
        await Promise.race([
            (0, promises_1.finished)(this.logWorker.stdout),
            new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
        this.logWorker.stdout.unpipe(this.proxyOutputSteam);
        this.streamsToDestroy?.forEach((s) => {
            s.removeAllListeners();
        });
        this.logWorker.stdin.emit('finish');
        this.logWorker.stdout.emit('end');
        if (this.proxyOutputSteam.writableNeedDrain) {
            await (0, node_stream_1.once)(this.proxyOutputSteam, 'drain');
        }
        if (process.stdout.writableNeedDrain) {
            await (0, node_stream_1.once)(process.stdout, 'drain');
        }
        await (0, promises_1.finished)(this.proxyOutputSteam);
        this.destructor();
    }
    closeSync() {
        this.destructor();
    }
    async close() {
        await this.gracefulShutdown();
    }
    child() {
        return this;
    }
}
exports.PysakaLogger = PysakaLogger;
exports.default = PysakaLogger;
