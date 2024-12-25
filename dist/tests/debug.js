"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../src/logger");
const logger1 = new logger_1.PysakaLogger({
    format: 'text',
    debugLogsOfLogger: true,
});
logger1.log('-------------------->');
const logger2 = new logger_1.PysakaLogger({
    format: 'json',
    debugLogsOfLogger: true,
});
logger2.warn('Here is another one!!!');
logger2.closeSync();
logger1.error('some text', 17, null, [1, true], {
    foo: 'bar',
    'some extra': { a: false, b: [3, 3] },
});
logger1.log('<--------------------');
const tid = setTimeout(() => {
    logger1.close().finally(() => {
        clearTimeout(tid);
        process.stdout.write('All done but process.stdout is still available!\n');
    });
});
//# sourceMappingURL=debug.js.map