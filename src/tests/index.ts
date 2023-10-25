import assert from 'node:assert';
import { test } from 'node:test';

import { PysakaLogger } from '../logger';

test('PysakaLogger', (t) => {
  const logger = new PysakaLogger();
  assert.ok(logger);
});

test.skip('test to caboom!', (t) => {
  assert.equal(false, true);
});

test('Log smth', (t) => {
  const logger = new PysakaLogger();
  logger.log('info', 'Hello, world!', { foo: 'bar' });
});

test('Log to fallback stream: no logs lost', async (t) => {
  const logger = new PysakaLogger();

  logger.log('-------------------->');

  let i = 0;
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
    }
  }, 50);
});

test.only('Log to fallback stream: no logs lost. Unavailability twice', async (t) => {
  t.runOnly(true);
  const logger = new PysakaLogger();

  logger.log('-------------------->');

  let i = 0;
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
    }
  }, 50);
});
