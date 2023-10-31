"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { isMainThread, parentPort, workerData } = require('node:worker_threads');
if (isMainThread) {
    throw new Error('This file is not intended be loaded in the main thread');
}
const { LogSerializer } = require('./serializer.js');
const logSerializer = new LogSerializer(workerData.loggerId, workerData.severity, workerData.encoding, workerData.format);
const format = logSerializer.getFormat();
parentPort.on('message', ([logLevel, ...args]) => {
    if (args?.[0] === '__DONE') {
        workerData.done = true;
        return;
    }
    const bufferContent = format === 'text'
        ? logSerializer.serializeText(args, logLevel ?? logSerializer.severity)
        : logSerializer.serializeJSON(args);
    process.stdout.write(bufferContent);
    if (workerData.done) {
        process.stdout.emit('finish');
        process.stdout.end();
    }
});
//# sourceMappingURL=worker.js.map