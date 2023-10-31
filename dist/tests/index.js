"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = __importDefault(require("node:assert"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_test_1 = require("node:test");
const logger_1 = require("../logger");
(0, node_test_1.test)('PysakaLogger', (t) => {
    const logger = new logger_1.PysakaLogger();
    node_assert_1.default.ok(logger);
    logger.closeSync();
});
node_test_1.test.skip('test to caboom!', (t) => {
    node_assert_1.default.equal(false, true);
});
(0, node_test_1.test)('Log msg', async (t) => {
    const logger = new logger_1.PysakaLogger();
    logger.log('Hello, world!');
    await logger.close();
});
(0, node_test_1.test)('Log smth more (JSON)', async (t) => {
    const logger = new logger_1.PysakaLogger({
        format: 'json',
        fallbackSupport: false,
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
        fallbackSupport: false,
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
node_test_1.test.only('Log some err (TEXT)', async (t) => {
    const logger = new logger_1.PysakaLogger({
        format: 'text',
        fallbackSupport: false,
    });
    logger.log('>--------------------');
    logger.error('shit happened', new Error('indeed happen'));
    logger.log('<--------------------');
    await logger.close();
});
(0, node_test_1.test)('Log smth more with fallback support', async (t) => {
    const logger = new logger_1.PysakaLogger();
    logger.log('some log info', 'Hello, world!');
    await logger.close();
});
(0, node_test_1.test)('Log to fallback stream: no logs lost', async (t) => {
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
(0, node_test_1.test)('Log to fallback stream: no logs lost. Unavailability twice', async (t) => {
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
            if (i === 110) {
                process.stdout.cork();
            }
            if (i === 170) {
                process.stdout.uncork();
            }
            if (i === 180) {
                clearInterval(id);
                resolve(null);
            }
        }, 50);
    });
    await logger.close();
});
(0, node_test_1.test)('No fallback stream: logs lost bcz no fallback support', async (t) => {
    const logger = new logger_1.PysakaLogger({ fallbackSupport: false });
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
        fallbackSupport: false,
        destination: node_fs_1.default.createWriteStream('./__temp/test.log'),
    });
    logger.log('some json', 'Hello, world!', {
        foo: 'bar',
        'some extra': { a: false, b: [1, 2] },
    });
    await logger.close();
});
//# sourceMappingURL=index.js.map