"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PysakaLogger = void 0;
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = require("node:stream/promises");
const node_worker_threads_1 = require("node:worker_threads");
const node_v8_1 = require("node:v8");
const node_buffer_1 = require("node:buffer");
const consts_1 = require("./consts");
const enums_1 = require("./enums");
const util_1 = require("./util");
class PysakaLogger {
    destination;
    severity;
    format;
    debugLogsOfLogger = false;
    serializerEncoding = 'utf-8';
    isDestroyed = false;
    loggerId;
    logWorker;
    sharedMemoryAsBuffer;
    atomicLogsLeftToWriteCountdown;
    paramsStringified;
    static __cache = {};
    constructor(__params) {
        const paramsStringified = JSON.stringify(__params ?? {});
        if (PysakaLogger.__cache[paramsStringified]) {
            PysakaLogger.__cache[paramsStringified].count += 1;
            return PysakaLogger.__cache[paramsStringified].logger;
        }
        this.paramsStringified = paramsStringified;
        PysakaLogger.__cache[paramsStringified] = {
            logger: this,
            count: 1,
        };
        const params = { ...consts_1.DEFAULT_LOGGER_PARAMS, ...__params };
        this.destination = params.destination;
        if (!this.destination.writable) {
            throw new Error(`${consts_1.LOGGER_PREFIX} Destination is not writable`);
        }
        this.severity = params.severity;
        this.format = params.format;
        this.debugLogsOfLogger = params.debugLogsOfLogger ?? false;
        this.sharedMemoryAsBuffer = new SharedArrayBuffer(4);
        this.atomicLogsLeftToWriteCountdown = new Int32Array(this.sharedMemoryAsBuffer);
        Atomics.store(this.atomicLogsLeftToWriteCountdown, 0, 0);
        process.once('exit', this.gracefulShutdown.bind(this));
        try {
            this.init();
        }
        catch (err) {
            process.stderr.write(consts_1.LOGGER_PREFIX + ' ' + err.message + '\n');
            this.destructor();
            throw new Error(`${consts_1.LOGGER_PREFIX} Failed to initialize logger`);
        }
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
        return this.write(enums_1.SeverityLevelEnum.FATAL, ...args);
    }
    init() {
        this.initWorker();
        this.setupPipeline();
        this.debugLogsOfLogger &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger is initialized\n`);
    }
    initWorker() {
        this.loggerId = (0, util_1.generateNumericId)(10);
        const dirname = process.cwd();
        const workerPath = node_path_1.default.join(dirname, './src/worker.js');
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
                sharedMemoryAsBuffer: this.sharedMemoryAsBuffer,
            },
        });
        this.logWorker.unref();
        this.logWorker.stderr.pipe(process.stderr);
        this.debugLogsOfLogger &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger's worker is initialized\n`);
    }
    setupPipeline() {
        (0, promises_1.pipeline)(this.logWorker.stdout, this.destination, { end: false })
            .then(() => this.debugLogsOfLogger &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Pipeline logWorker.stdout->destination had no errors\n`))
            .catch(this.handleStreamError.bind(this));
        this.debugLogsOfLogger &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger's stream's pipeline is ready\n`);
    }
    handleStreamError(err) {
        if (this.isDestroyed)
            return;
        if (err) {
            process.stderr.write(`${consts_1.LOGGER_PREFIX} Pipeline logWorker.stdout->destination has failed\n`);
            process.stderr.write(consts_1.LOGGER_PREFIX + ' ' + err.message + '\n');
        }
    }
    write(logLevel, ...args) {
        if (logLevel < this.severity) {
            return this;
        }
        const buffers = [
            consts_1.BUFFER_LOGS_START_SEPARATOR,
            node_buffer_1.Buffer.from(String(logLevel)),
            consts_1.BUFFER_ARGS_SEPARATOR,
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
                ? (0, node_v8_1.serialize)(item)
                : node_buffer_1.Buffer.from(String(item), 'utf-8');
            const type = (0, util_1.getTypeAsBuffer)(item);
            buffers.push(type, itemBuf);
            i < l - 1 && buffers.push(consts_1.BUFFER_ARGS_SEPARATOR);
        }
        buffers.push(consts_1.BUFFER_LOGS_END_SEPARATOR);
        const bufToSend = node_buffer_1.Buffer.concat(buffers);
        this.logWorker.stdin.write(bufToSend);
        return this;
    }
    destructor() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        this.paramsStringified &&
            delete PysakaLogger.__cache[this.paramsStringified];
        if (this.logWorker) {
            this.logWorker.removeAllListeners();
            this.logWorker.terminate();
        }
        this.debugLogsOfLogger &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger is shut down\n`);
    }
    async gracefulShutdown() {
        if (this.isDestroyed)
            return;
        this.logWorker.postMessage(-1);
        await Promise.all([
            (0, promises_1.finished)(this.logWorker.stdout),
            (0, promises_1.finished)(this.logWorker.stdin),
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
        PysakaLogger.__cache[this.paramsStringified].count--;
        if (PysakaLogger.__cache[this.paramsStringified].count > 0) {
            return;
        }
        delete PysakaLogger.__cache[this.paramsStringified];
        await new Promise((resolve) => this.gracefulShutdown().finally(resolve));
    }
    closeSync() {
        if (this.isDestroyed)
            return;
        PysakaLogger.__cache[this.paramsStringified].count--;
        if (PysakaLogger.__cache[this.paramsStringified].count > 0) {
            return;
        }
        delete PysakaLogger.__cache[this.paramsStringified];
        Atomics.add(this.atomicLogsLeftToWriteCountdown, 0, 1);
        this.logWorker.postMessage(-1);
        while (Atomics.load(this.atomicLogsLeftToWriteCountdown, 0) > 0) { }
        this.destination.emit('drain');
        setTimeout(() => this.destructor(), 1);
    }
    child() {
        return this;
    }
}
exports.PysakaLogger = PysakaLogger;
exports.default = PysakaLogger;
//# sourceMappingURL=logger.js.map