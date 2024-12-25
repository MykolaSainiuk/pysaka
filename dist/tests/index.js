"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = __importDefault(require("node:assert"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_test_1 = require("node:test");
const logger_1 = require("../src/logger");
(0, node_test_1.afterEach)((ctx, done) => {
    setTimeout(() => {
        done();
    }, 1);
});
(0, node_test_1.test)('PysakaLogger', (t) => {
    const logger = new logger_1.PysakaLogger();
    node_assert_1.default.ok(logger);
    logger.closeSync();
});
(0, node_test_1.test)('Log msg', async (t) => {
    const logger = new logger_1.PysakaLogger();
    logger.log('Hello, world!');
    await logger.close();
});
(0, node_test_1.test)('Log smth more (JSON)', async (t) => {
    const logger = new logger_1.PysakaLogger({
        format: 'json',
    });
    logger.log('some json', 'Hello, world!', {
        foo: 'bar',
        'some extra': { a: false, b: [1, 2] },
    });
    await logger.close();
});
(0, node_test_1.test)('Log smth more (TEXT)', async (t) => {
    const logger = new logger_1.PysakaLogger({
        format: 'text',
        severity: 'debug',
    });
    logger.warn('>--------------------');
    logger.log('some text', 'Hello, world!', {
        foo: 'bar',
        'some extra': { a: false, b: [1, 2] },
    });
    logger.warn('<--------------------');
    logger.error('shit happened', {
        message: 'this is error message',
        stack: {},
    });
    await logger.close();
});
(0, node_test_1.test)('Log some err (TEXT)', async (t) => {
    const logger = new logger_1.PysakaLogger({
        format: 'text',
    });
    logger.log('>--------------------');
    logger.error('shit happened', new Error('indeed happen'));
    logger.log('<--------------------');
    await logger.close();
});
node_test_1.test.only('Log smth more with fallback support', async (t) => {
    const logger = new logger_1.PysakaLogger();
    logger.log('some log info', 'Hello, world!');
    await logger.close();
});
(0, node_test_1.test)('No fallback stream: logs lost bcz no fallback support', async (t) => {
    const logger = new logger_1.PysakaLogger();
    logger.log('-------------------->');
    let i = 0;
    await new Promise((resolve) => {
        const id = setInterval(() => {
            logger.log('step: ', i, '    ' + '*'.repeat(1e3));
            i++;
            if (i === 10) {
                process.stdout.cork();
            }
            if (i === 70) {
                process.stdout.uncork();
            }
            if (i === 90) {
                clearInterval(id);
                resolve(null);
            }
        }, 50);
    });
    await logger.close();
});
(0, node_test_1.test)('Log smth to file', async (t) => {
    const logger = new logger_1.PysakaLogger({
        format: 'json',
        destination: node_fs_1.default.createWriteStream('./__temp/test.log'),
    });
    logger.log('some json', 'Hello, world!', {
        foo: 'bar',
        'some extra': { a: false, b: [1, 2] },
    });
    await logger.close();
});
//# sourceMappingURL=index.js.map