import { PysakaLogger } from '../src/logger';

// NO Test Runner test

const logger1 = new PysakaLogger({
  format: 'text' as any,
  debugLogsOfLogger: true,
});
logger1.log('-------------------->');

const logger2 = new PysakaLogger({
  format: 'json' as any,
  debugLogsOfLogger: true,
});
logger2.warn('Here is another one!!!');
logger2.closeSync(); // can be bcz neverSpikeCPU=true

logger1.error('some text', 17, null, [1, true], {
  foo: 'bar',
  'some extra': { a: false, b: [3, 3] },
});

logger1.log('<--------------------');

// eslint-disable-next-line prefer-const
const tid = setTimeout(() => {
  logger1.close().finally(() => {
    clearTimeout(tid);
    // process.exit(0); // for debugger
    process.stdout.write('All done but process.stdout is still available!\n');
  });
});
