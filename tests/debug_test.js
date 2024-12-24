"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../src/logger");
const logger = new logger_1.PysakaLogger({
    format: 'text',
    debugLogsOfLogger: true,
    neverSpikeCPU: true,
});
logger.log('-------------------->');
logger.log('some text', 'Hello, world!', {
    foo: 'bar',
    'some extra': { a: false, b: [1, 2] },
});
logger.log('<--------------------');
let intervalId = setTimeout(() => { }, 1e7);
logger.close().finally(() => {
    clearInterval(intervalId);
});
//# sourceMappingURL=debug_test.js.map