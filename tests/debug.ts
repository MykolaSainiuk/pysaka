import { PysakaLogger } from '../src/logger';

// NO Test Runner test

const logger1 = new PysakaLogger({
  format: 'text' as any,
  debugLogsOfLogger: true,
  neverSpikeCPU: true,
});

logger1.log('-------------------->');

const logger2 = new PysakaLogger({
  format: 'json' as any,
  debugLogsOfLogger: true,
  neverSpikeCPU: false,
});
logger2.warn('Here is another one!!!');

logger1.error('some text', 'Hello, world!', {
  foo: 'bar',
  'some extra': { a: false, b: [1, 2] },
});

logger2.closeSync(); // can be bcz neverSpikeCPU=true

logger1.log('<--------------------');

// logger.closeSync();

// eslint-disable-next-line prefer-const
let intervalId = setTimeout(() => {}, 1e7);
logger1.close().finally(() => {
  clearInterval(intervalId);
  process.exit(0); // for debugger
});
