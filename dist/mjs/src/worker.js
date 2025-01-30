import { isMainThread, workerData, parentPort } from 'node:worker_threads';
import { deserialize } from 'node:v8';
import { LogSerializer } from './serializer.js';
if (isMainThread) {
    throw new Error('This file is not intended be loaded in the main thread');
}
const logSerializer = new LogSerializer(workerData.loggerId, workerData.severity, workerData.encoding, workerData.format, workerData.prefix);
const format = logSerializer.getFormat();
const BUFFER_ARGS_SEPARATOR = Buffer.from('¦', 'utf-8');
const BUFFER_LOGS_START_SEPARATOR = Buffer.from('¿', 'utf-8');
const BUFFER_LOGS_END_SEPARATOR = Buffer.from('¬', 'utf-8');
const emptyBuffer = Buffer.alloc(0);
const parseError = '?parse_err?';
let contentFromLastBatch = Buffer.from(emptyBuffer);
parentPort.on('message', ({ end, severity, format, prefix } = {}) => {
    if (end) {
        if (contentFromLastBatch.length) {
            const { parsed } = parseContent(fullContent);
            process.stdout.write(parsed);
        }
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
    if (prefix) {
        logSerializer.setPrefix(prefix);
    }
});
(async () => {
    const intervalId = setInterval(() => {
        process.stdout.writableCorked
            ? process.stdout.cork()
            : process.stdout.uncork();
    }, 10);
    for await (const buf of process.stdin) {
        if (!buf.length || !process.stdout.writable) {
            continue;
        }
        const fullContent = contentFromLastBatch.length
            ? Buffer.concat([contentFromLastBatch, buf])
            : buf;
        let { parsed, rest } = parseContent(fullContent);
        process.stdout.write(parsed);
        while (rest.indexOf(BUFFER_LOGS_START_SEPARATOR) > -1 &&
            rest.indexOf(BUFFER_LOGS_END_SEPARATOR) > -1) {
            ({ parsed, rest } = parseContent(rest));
            process.stdout.write(parsed);
        }
        if (rest?.length) {
            contentFromLastBatch = Buffer.from(rest?.length ? rest : emptyBuffer);
        }
    }
    clearInterval(intervalId);
})();
function parseContent(buf) {
    const startIdx = buf.indexOf(BUFFER_LOGS_START_SEPARATOR);
    const endIdx = buf.indexOf(BUFFER_LOGS_END_SEPARATOR, startIdx + 1);
    if (startIdx === -1 || endIdx === -1) {
        process.stderr.write('Invalid buffer content. Missing start or end separator');
        return { parsed: emptyBuffer, rest: emptyBuffer };
    }
    const args = [];
    let lastIdx = startIdx + BUFFER_LOGS_START_SEPARATOR.length;
    const l = BUFFER_ARGS_SEPARATOR.length;
    const lvl = buf.slice(lastIdx, lastIdx + 1);
    lastIdx += 3;
    while (lastIdx > -1 && lastIdx < endIdx) {
        const nextIdx = Math.min(buf.indexOf(BUFFER_ARGS_SEPARATOR, lastIdx + 1), buf.indexOf(BUFFER_LOGS_END_SEPARATOR, lastIdx + 1));
        if (nextIdx === -1) {
            const b = buf.slice(lastIdx, buf.length - l);
            args.push(deserializeBuffer(b));
            break;
        }
        const b = buf.slice(lastIdx, nextIdx);
        args.push(deserializeBuffer(b));
        lastIdx = nextIdx + l;
    }
    const bufferContent = format === 'text'
        ? logSerializer.serializeText(args, lvl)
        : logSerializer.serializeJSON(args, lvl);
    return {
        parsed: bufferContent,
        rest: endIdx + BUFFER_LOGS_END_SEPARATOR.length < buf.length
            ? buf.slice(endIdx + BUFFER_LOGS_END_SEPARATOR.length)
            : emptyBuffer,
    };
}
function deserializeBuffer(buffer) {
    const type = Number.parseInt(buffer.slice(0, 1).toString('utf-8'), 10);
    const buf = buffer.slice(1);
    const typeAsStr = getTypeByBuffer(type);
    if (typeAsStr !== 'object') {
        return castBufferToPrimitive(buf.toString('utf-8'), typeAsStr);
    }
    try {
        return deserialize(buf);
    }
    catch (err) {
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
