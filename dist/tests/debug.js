"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../src/logger");
const logger1 = new logger_1.PysakaLogger({
    format: 'text',
    debugLogsOfLogger: true,
    neverSpikeCPU: false,
});
logger1.log('-------------------->');
const logger2 = new logger_1.PysakaLogger({
    format: 'json',
    debugLogsOfLogger: true,
    neverSpikeCPU: false,
});
logger2.warn('Here is another one!!!');
logger2.closeSync();
logger1.error('some text', 'Hello, world!', {
    foo: 'bar',
    'some extra': { a: false, b: [1, 2] },
});
logger1.log('<--------------------');
let intervalId = setTimeout(() => { }, 1e7);
logger1.close().finally(() => {
    clearInterval(intervalId);
    process.stdout.write('All done but process.stdout is still available!\n');
});
//# sourceMappingURL=debug.js.map