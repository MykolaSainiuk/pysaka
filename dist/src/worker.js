"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { isMainThread, parentPort, workerData } = require('node:worker_threads');
if (isMainThread) {
    throw new Error('This file is not intended be loaded in the main thread');
}
const { LogSerializer } = require('./serializer.js');
const logSerializer = new LogSerializer(workerData.loggerId, workerData.severity, workerData.encoding, workerData.format);
const format = logSerializer.getFormat();
const sharedBuffer = workerData.sharedBuffer;
const sharedArray = new Int32Array(sharedBuffer);
parentPort.on('message', ([logLevel, ...args]) => {
    if (args?.[0] === '__KILL_THE_WORKER')
        return;
    const bufferContent = format === 'text'
        ? logSerializer.serializeText(args, logLevel ?? logSerializer.severity)
        : logSerializer.serializeJSON(args);
    if (process.stdout.writable) {
        process.stdout.write(bufferContent);
        Atomics.sub(sharedArray, 0, 1);
    }
});
//# sourceMappingURL=worker.js.map