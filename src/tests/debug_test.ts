import { PysakaLogger } from '../logger';

// NO Test Runner test

const logger = new PysakaLogger({
  format: 'text' as any,
  debugLogsOfLogger: true,
  neverSpikeCPU: true,
});

logger.log('-------------------->');

logger.log('some text', 'Hello, world!', {
  foo: 'bar',
  'some extra': { a: false, b: [1, 2] },
});

logger.log('<--------------------');

// logger.closeSync();

// eslint-disable-next-line prefer-const
let intervalId = setTimeout(() => {}, 1e7);
logger.close().finally(() => {
  clearInterval(intervalId);
});

// setTimeout(() => {
//   process.exit(0);
// }, 1000);
// let i = 0;

// const id = setInterval(() => {
//   logger.log('step: ', i, '    ' + '*'.repeat(1e3));
//   i++;
//   if (i === 10) {
//     process.stdout.cork();
//   }
//   if (i === 70) {
//     process.stdout.uncork();
//   }
//   if (i === 110) {
//     process.stdout.cork();
//   }
//   if (i === 170) {
//     process.stdout.uncork();
//   }
//   if (i === 180) {
//     clearInterval(id);
//   }
// }, 50);

// logger.log('<--------------------');
