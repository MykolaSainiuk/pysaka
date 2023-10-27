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

parentPort.on('message', (args) => {
  if (args === '__DONE') {
    // TODO: surround with Atomics
    workerData.timeToBuy = true;
    return;
  }

  // serialization here so no extra CPU consumption in the main thread
  const bufferContent =
    logSerializer.getFormat() === 'text'
      ? logSerializer.serializeText(args)
      : logSerializer.serializeJSON(args);

  // TODO: pass FD and pipe it directly?
  // pipe it to the destination stream
  process.stdout.write(bufferContent);

  // in case of long operation
  if (workerData.timeToBuy) {
    process.stdout.emit('finish');
    process.stdout.end();
    // parentPort.close();
  }
});
