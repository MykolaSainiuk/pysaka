"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
const logger = new logger_1.PysakaLogger({
    format: 'text',
    fallbackSupport: true,
});
logger.log('-------------------->');
logger.log('some text', 'Hello, world!', {
    foo: 'bar',
    'some extra': { a: false, b: [1, 2] },
});
logger.log('<--------------------');
logger.close();
//# sourceMappingURL=debug_test.js.map