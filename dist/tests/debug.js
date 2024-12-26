"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../src/logger");
const logger1 = new logger_1.PysakaLogger({
    format: 'text',
    internalLogs: false,
    prefix: 'debug.ts',
});
logger1.log('-------------------->');
logger1.error('msg_text', { error: 'error_text' });
logger1.error('some text', 17, null, [1, true], {
    foo: 'bar',
    'some extra': { a: false, b: [3, 3] },
});
logger1.log('<--------------------');
logger1.close().finally(() => {
    process.stdout.write('All done but process.stdout is still available!\n');
});
//# sourceMappingURL=debug.js.map