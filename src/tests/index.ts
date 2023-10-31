import assert from 'node:assert';
import fs from 'node:fs';
import { test } from 'node:test';

import { PysakaLogger } from '../logger';

test('PysakaLogger', (t) => {
  const logger = new PysakaLogger();
  assert.ok(logger);
  logger.closeSync();
});

test.skip('test to caboom!', (t) => {
  assert.equal(false, true);
});

test('Log msg', async (t) => {
  const logger = new PysakaLogger();
  logger.log('Hello, world!');
  await logger.close();
});

test('Log smth more (JSON)', async (t) => {
  const logger = new PysakaLogger({
    format: 'json' as any,
    fallbackSupport: false,
  });
  logger.log('some json', 'Hello, world!', {
    foo: 'bar',
    'some extra': { a: false, b: [1, 2] },
  });
  await logger.close();
});
test.only('Log smth more (TEXT)', async (t) => {
  const logger = new PysakaLogger({
    format: 'text' as any,
    fallbackSupport: false,
    severity: 'debug' as any,
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

test('Log smth more with fallback support', async (t) => {
  const logger = new PysakaLogger();
  logger.log('some log info', 'Hello, world!');
  await logger.close();
});

test('Log to fallback stream: no logs lost', async (t) => {
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

test('Log to fallback stream: no logs lost. Unavailability twice', async (t) => {
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

test('No fallback stream: logs lost bcz no fallback support', async (t) => {
  const logger = new PysakaLogger({ fallbackSupport: false });

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

// test.only('No fallback stream: logs lost bcz no fallback support', async (t) => {
//   const logger = new PysakaLogger({ fallbackSupport: false });

//   logger.log('-------------------->');

//   let i = 0;
//   await new Promise((resolve) => {
//     const id = setInterval(() => {
//       logger.log('step: ', i, '    ' + '*'.repeat(1e3));
//       i++;
//       if (i === 10) {
//         process.stdout.cork();
//       }
//       if (i === 70) {
//         process.stdout.uncork();
//       }
//       if (i === 90) {
//         clearInterval(id);
//         resolve(null);
//       }
//     }, 50);
//   });

//   logger
//     .gracefulShutdown()
//     .finally(() => process.stdout.end('---- DONE ----\n'));
// });

test('Log smth to file', async (t) => {
  const logger = new PysakaLogger({
    format: 'json' as any,
    fallbackSupport: false,
    destination: fs.createWriteStream('./__temp/test.log'),
  });
  logger.log('some json', 'Hello, world!', {
    foo: 'bar',
    'some extra': { a: false, b: [1, 2] },
  });
  await logger.close();
});
