// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isMainThread, parentPort, workerData } = require('node:worker_threads');
if (isMainThread) {
  throw new Error('This file is not intended be loaded in the main thread');
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LogSerializer } = require('./serializer.js');

const logSerializer = new LogSerializer(
  workerData.loggerId,
  workerData.severity,
  workerData.encoding,
  workerData.format,
);
const format = logSerializer.getFormat();

parentPort.on('message', ([logLevel, ...args]) => {
  if (args?.[0] === '__DONE') {
    // TODO: surround with Atomics
    workerData.done = true;
    return;
  }

  // serialization here so no extra CPU consumption in the main thread
  const bufferContent =
    format === 'text'
      ? logSerializer.serializeText(args, logLevel ?? logSerializer.severity)
      : logSerializer.serializeJSON(args);

  process.stdout.write(bufferContent);

  // in case of long operation
  if (workerData.done) {
    process.stdout.emit('finish');
    process.stdout.end();
    // parentPort.close();
  }
});
