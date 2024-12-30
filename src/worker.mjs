import { isMainThread, workerData, parentPort } from 'node:worker_threads';
import { deserialize } from 'node:v8';

import { LogSerializer } from './serializer.mjs';

if (isMainThread) {
  throw new Error('This file is not intended be loaded in the main thread');
}

const logSerializer = new LogSerializer(
  workerData.severity,
  workerData.encoding,
  workerData.format,
  // workerData.scope,
);
const format = logSerializer.getFormat();

const encoding = workerData.encoding || 'utf-8';
// copied from src/consts.ts - keep in sync!!
const BUFFER_ARGS_SEPARATOR = Buffer.from('¦', encoding);
const BUFFER_LOGS_START_SEPARATOR = Buffer.from('¿', encoding);
const BUFFER_LOGS_END_SEPARATOR = Buffer.from('¬', encoding);

const emptyBuffer = Buffer.alloc(0);
const parseError = '?parse_err?';

let contentFromLastBatch = Buffer.from(emptyBuffer);

parentPort.on('message', ({ end, severity, format, scope } = {}) => {
  if (end) {
    // process.stderr.write('[[[' + contentFromLastBatch.toString(encoding) + ']]]');
    if (contentFromLastBatch.length) {
      const { parsed } = parseContent(fullContent);
      process.stdout.write(parsed);
    }
    // TODO: do it via Atomic and break;
    process.stdin.emit('end');
    process.stdout.writableEnded || process.stdout.end();
    parentPort.removeAllListeners();
    return;
  }

  if (severity) {
    logSerializer.setSeverity(severity);
  }
  if (format) {
    logSerializer.setFormat(format);
  }
  // if (scope) {
  //   logSerializer.setScope(scope);
  // }
});

(async () => {
  const intervalId = setInterval(() => {
    process.stdout.writableCorked
      ? process.stdout.cork()
      : process.stdout.uncork();
  }, 10);

  for await (const buf of process.stdin) {
    // process.stderr.write(
    //   '\nReceived buffer: ' + buf.toString(encoding) + '\n\n',
    // );
    if (!buf.length || !process.stdout.writable) {
      continue;
    }

    const fullContent = contentFromLastBatch.length
      ? Buffer.concat([contentFromLastBatch, buf])
      : buf;

    let { parsed, rest } = parseContent(fullContent);
    process.stdout.write(parsed);

    while (
      rest.indexOf(BUFFER_LOGS_START_SEPARATOR) > -1 &&
      rest.indexOf(BUFFER_LOGS_END_SEPARATOR) > -1
    ) {
      // process.stderr.write('\nRest buffer: ' + rest.toString(encoding) + '\n\n');
      ({ parsed, rest } = parseContent(rest));
      process.stdout.write(parsed);
    }

    if (rest?.length) {
      // process.stderr.write('[[[' + rest.toString(encoding) + ']]]');
      contentFromLastBatch = Buffer.from(rest?.length ? rest : emptyBuffer);
    }
  }

  clearInterval(intervalId);
})();

function parseContent(buf) {
  // process.stderr.write('[[[' + buf.toString(encoding) + ']]]');
  const startIdx = buf.indexOf(BUFFER_LOGS_START_SEPARATOR);
  const endIdx = buf.indexOf(BUFFER_LOGS_END_SEPARATOR, startIdx + 1);
  // TODO: consider a few messages in the buffer

  if (startIdx === -1 || endIdx === -1) {
    process.stderr.write(
      'Invalid buffer content. Missing start or end separator',
    );
    return { parsed: emptyBuffer, rest: emptyBuffer };
  }

  const args = [];
  let lastIdx = startIdx + BUFFER_LOGS_START_SEPARATOR.length;
  const l = BUFFER_ARGS_SEPARATOR.length;
  const lvl = buf.subarray(lastIdx, lastIdx + 1);
  lastIdx += 3; // 2 is for separator and 1 for level digit

  const postLvlChar = buf.subarray(lastIdx, lastIdx + 2);
  let scope = '';
  // yes, 0 means equal, damn
  if (Buffer.compare(postLvlChar, BUFFER_ARGS_SEPARATOR) === 0) {
    // no scope defined - skipping
    lastIdx += 2;
  } else {
    // scope is defined
    const nextIdx = buf.indexOf(BUFFER_ARGS_SEPARATOR, lastIdx + 1);
    scope = buf.subarray(lastIdx, nextIdx).toString(encoding);
    // args.push(buf.subarray(lastIdx, nextIdx).toString(encoding));
    lastIdx = nextIdx + l;
  }

  while (lastIdx > -1 && lastIdx < endIdx) {
    const nextIdx = Math.min(
      buf.indexOf(BUFFER_ARGS_SEPARATOR, lastIdx + 1),
      buf.indexOf(BUFFER_LOGS_END_SEPARATOR, lastIdx + 1),
    );
    // process.stderr.write('>>>>>>>>>>>>> nextIdx=' + nextIdx + '\n');
    if (nextIdx === -1) {
      const b = buf.subarray(lastIdx, buf.length - l);
      // process.stderr.write('>>>>>>>>>>>>> last buffer:' + b.toString(encoding) + '\n');
      args.push(deserializeBuffer(b));
      break;
    }
    const b = buf.subarray(lastIdx, nextIdx);
    // process.stderr.write('>>>>>>>>>>>>> + buffer:' + b.toString(encoding) + '\n');
    args.push(deserializeBuffer(b));
    lastIdx = nextIdx + l;
  }

  // process.stderr.write('-> length:' + args.length + '\n');
  // process.stderr.write('\n\n-> args:' + args.join(', ') + '\n\n');

  // serialization here so no extra CPU consumption in the main thread
  const bufferContent =
    format === 'text'
      ? logSerializer.serializeText(args, lvl, scope)
      : logSerializer.serializeJSON(args, lvl, scope);

  // process.stderr.write('-> bufferContent:' + bufferContent.toString(encoding) + '\n');
  return {
    parsed: bufferContent,
    rest:
      endIdx + BUFFER_LOGS_END_SEPARATOR.length < buf.length
        ? buf.subarray(endIdx + BUFFER_LOGS_END_SEPARATOR.length)
        : emptyBuffer,
  };
}

function deserializeBuffer(buffer) {
  // first buffer el is the type but do not take by index
  const type = Number.parseInt(buffer.slice(0, 1).toString(encoding), 10);
  // process.stderr.write('<<<<< + type[' + type + ']\n');

  const buf = buffer.slice(1);
  // process.stderr.write('<<<<< + buffer[' + buf.toString(encoding) + ']\n');
  const typeAsStr = getTypeByBuffer(type);
  // process.stderr.write('<<<<< + typeAsStr[' + typeAsStr + ']\n');
  if (typeAsStr !== 'object') {
    return castBufferToPrimitive(buf.toString(encoding), typeAsStr);
  }

  try {
    return deserialize(buf);
  } catch (err) {
    process.stderr.write('Error deserializing buffer:' + err.message + '\n');
    return parseError;
  }
}

function getTypeByBuffer(tbuf) {
  switch (Number.parseInt(tbuf, 10)) {
    case 0:
      return 'string';
    case 1:
      return 'integer';
    case 2:
      return 'double';
    case 3:
      return 'object';
    case 4:
      return 'boolean';
    case 5:
      return 'undefined';
    case 6:
      return 'null';
    default:
      return 'object';
  }
}

function castBufferToPrimitive(bufferAsStr, type) {
  switch (type) {
    case 'string':
      return bufferAsStr;
    case 'integer':
      return Number.parseInt(bufferAsStr, 10);
    case 'double':
      return Number.parseFloat(bufferAsStr);
    case 'boolean':
      return bufferAsStr === 'true';
    case 'undefined':
      return undefined;
    case 'null':
      return null;
    default:
      return parseError;
  }
}
