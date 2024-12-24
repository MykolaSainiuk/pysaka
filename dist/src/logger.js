"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PysakaLogger = void 0;
const node_path_1 = __importDefault(require("node:path"));
const node_stream_1 = require("node:stream");
const node_worker_threads_1 = require("node:worker_threads");
const consts_1 = require("./consts");
const enums_1 = require("./enums");
const util_1 = require("./util");
class PysakaLogger {
    destination;
    severity;
    format;
    serializerEncoding = 'utf-8';
    proxyOutputSteam;
    proxyOutputSteamBufferSize;
    loggerId;
    logWorker;
    streamsToDestroy = [];
    isDestroyed = false;
    debugLogsOfLogger = false;
    neverSpikeCPU = true;
    sharedBuffer;
    sharedArray;
    paramsStringified;
    static __singleInstance = {};
    constructor(__params) {
        const paramsStringified = JSON.stringify(__params ?? {});
        if (PysakaLogger.__singleInstance[paramsStringified]) {
            return PysakaLogger.__singleInstance[paramsStringified].logger;
        }
        this.paramsStringified = paramsStringified;
        PysakaLogger.__singleInstance[paramsStringified] = {
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
        this.neverSpikeCPU = params.neverSpikeCPU ?? false;
        this.sharedBuffer = new SharedArrayBuffer(4);
        this.sharedArray = new Int32Array(this.sharedBuffer);
        Atomics.store(this.sharedArray, 0, 0);
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
    init() {
        this.initWorker();
        this.initOutputStream();
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
                sharedBuffer: this.sharedBuffer,
            },
        });
        this.logWorker.unref();
        this.debugLogsOfLogger &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger's worker is initialized\n`);
    }
    initOutputStream() {
        this.proxyOutputSteamBufferSize = 2e5;
        this.proxyOutputSteam = new node_stream_1.PassThrough({
            highWaterMark: this.proxyOutputSteamBufferSize,
        });
        const s = (0, node_stream_1.pipeline)(this.logWorker.stdout, this.proxyOutputSteam, () => { });
        this.streamsToDestroy.push(s);
        this.pipeOutputToDestination();
        this.debugLogsOfLogger &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger's output stream is piped\n`);
    }
    async pipeOutputToDestination() {
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
    }
    write(logLevel, ...args) {
        if (logLevel < this.severity) {
            return this;
        }
        const serializableArgs = new Array(1 + args.length);
        serializableArgs[0] = logLevel;
        for (let i = 0; i < args.length; i++) {
            const item = args[i];
            if (item instanceof Error) {
                serializableArgs[i + 1] = {
                    message: item.message,
                    stack: item.stack,
                    cause: item.cause,
                };
            }
            else {
                serializableArgs[i + 1] = item;
            }
        }
        if (this.neverSpikeCPU) {
            setImmediate(() => {
                this.logWorker.postMessage(serializableArgs);
                Atomics.add(this.sharedArray, 0, 1);
            });
        }
        else {
            this.logWorker.postMessage(serializableArgs);
            Atomics.add(this.sharedArray, 0, 1);
        }
        return this;
    }
    destructor() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        this.logWorker.stdout && this.logWorker.stdout.unpipe();
        this.proxyOutputSteam && this.proxyOutputSteam.unpipe();
        this.streamsToDestroy?.forEach((s) => {
            s.removeAllListeners();
            s.destroyed || s.destroy();
        });
        if (this.logWorker) {
            this.logWorker.removeAllListeners();
            this.logWorker.terminate();
        }
        if (this.proxyOutputSteam) {
            this.proxyOutputSteam.end();
            this.proxyOutputSteam.removeAllListeners();
            this.proxyOutputSteam.destroy();
        }
        this.debugLogsOfLogger &&
            process.stdout.write(`${consts_1.LOGGER_PREFIX} Logger is shut down\n`);
        this.paramsStringified &&
            delete PysakaLogger.__singleInstance[this.paramsStringified];
    }
    async gracefulShutdown() {
        if (this.isDestroyed)
            return;
        this.logWorker.postMessage([0, '__KILL_THE_WORKER']);
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
    async close() {
        if (this.isDestroyed)
            return;
        PysakaLogger.__singleInstance[this.paramsStringified].count--;
        if (PysakaLogger.__singleInstance[this.paramsStringified].count > 0) {
            return;
        }
        await new Promise((resolve) => this.neverSpikeCPU
            ? setTimeout(() => this.gracefulShutdown().finally(resolve), 1)
            :
                this.gracefulShutdown().finally(resolve));
    }
    closeSync() {
        if (this.isDestroyed)
            return;
        if (this.neverSpikeCPU) {
            this.debugLogsOfLogger &&
                process.stdout.write(`${consts_1.LOGGER_PREFIX} Sync closing isn't allowed when neverSpikeCPU=true\n`);
            return;
        }
        PysakaLogger.__singleInstance[this.paramsStringified].count--;
        if (PysakaLogger.__singleInstance[this.paramsStringified].count > 0) {
            return;
        }
        this.logWorker.postMessage([0, '__KILL_THE_WORKER']);
        while (Atomics.load(this.sharedArray, 0) > 0) { }
        this.logWorker.stdin.emit('drain');
        this.streamsToDestroy?.forEach((s) => {
            s.emit('drain');
        });
        this.proxyOutputSteam.emit('drain');
        this.destination.emit('drain');
        setImmediate(() => this.destructor());
    }
    child() {
        return this;
    }
}
exports.PysakaLogger = PysakaLogger;
exports.default = PysakaLogger;
//# sourceMappingURL=logger.js.map