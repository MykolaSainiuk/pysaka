"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { isMainThread, parentPort, workerData } = require('node:worker_threads');
if (isMainThread) {
    throw new Error('This file is not intended be loaded in the main thread');
}
const { LogSerializer } = require('./serializer.js');
const logSerializer = new LogSerializer(workerData.loggerId, workerData.severity, workerData.encoding, workerData.format);
const format = logSerializer.getFormat();
const sharedMemoryAsBuffer = workerData.sharedMemoryAsBuffer;
const atomicLogsLeftToWriteCountdown = new Int32Array(sharedMemoryAsBuffer);
parentPort.on('message', ([logLevel, ...args]) => {
    const lvl = logLevel ?? logSerializer.severity;
    const bufferContent = format === 'text'
        ? logSerializer.serializeText(args, lvl)
        : logSerializer.serializeJSON(args, lvl);
    if (process.stdout.writable) {
        process.stdout.write(bufferContent);
        Atomics.sub(atomicLogsLeftToWriteCountdown, 0, 1);
    }
});
//# sourceMappingURL=worker.js.map