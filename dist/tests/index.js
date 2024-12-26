"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const logger_1 = require("../src/logger");
(0, node_test_1.test)('Create an instance -> log a message -> close the logger', async () => {
    const logger = new logger_1.PysakaLogger();
    logger.log('Hello, world!');
    await logger.close();
});
//# sourceMappingURL=index.js.map