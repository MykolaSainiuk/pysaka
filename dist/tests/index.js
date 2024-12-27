import fs from 'node:fs';
import { open, mkdir } from 'node:fs/promises';
import { test } from 'node:test';
import { PysakaLogger } from '../src/logger.js';
test('Create an instance -> log a message -> close the logger', async () => {
    const logger = new PysakaLogger();
    logger.log('Hello, world!');
    await logger.close();
});
test('Log smth more (JSON)', async (t) => {
    const logger = new PysakaLogger({
        format: 'json',
    });
    logger.log('some json', 'Hello, world!', {
        foo: 'bar',
        'some extra': { a: false, b: [1, 2] },
    });
    await logger.close();
});
test('Log smth more (TEXT)', async (t) => {
    const logger = new PysakaLogger({
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
test('Log some err (TEXT)', async (t) => {
    const logger = new PysakaLogger({
        format: 'text',
    });
    logger.log('>--------------------');
    logger.error('shit happened', new Error('indeed happen'));
    logger.log('<--------------------');
    await logger.close();
});
test.only('Log smth more params of other types', async (t) => {
    const logger = new PysakaLogger();
    logger.log('some log info', 'Hello, world!', true, null);
    await logger.close();
});
test('Log smth to file', async (t) => {
    try {
        await mkdir('./__temp');
    }
    catch { }
    try {
        await open('./__temp/test.log', 'w');
    }
    catch { }
    const logger = new PysakaLogger({
        format: 'json',
        destination: fs.createWriteStream('./__temp/test.log'),
    });
    logger.log('some json', 'Hello, world!', {
        foo: 'bar',
        'some extra': { a: false, b: [1, 2] },
    });
    await logger.close();
});
test('No fallback stream: logs lost bcz no fallback support', async (t) => {
    const logger = new PysakaLogger();
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
//# sourceMappingURL=index.js.map