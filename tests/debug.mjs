import { PysakaLogger } from '../dist/src/index.js';

// NO Test Runner test

const logger1 = new PysakaLogger({
  format: 'text',
  internalLogs: false,
  prefix: 'debug.ts',
  severity: 0,
});
logger1.log('-------------------->');

// const logger2 = new PysakaLogger({
//   format: 'json',
//   internalLogs: true,
//   prefix: 'logger2',
// });
// logger2.warn('Here is another one!!!');
// logger2.error('msg_text', new Error('Some error'));
logger1.debug('msg_text', { error: 'error_text' });
// logger2.closeSync(); // can be bcz neverSpikeCPU=true

// setTimeout(() => logger2.closeSync(), 1000);
// process.exit(0);
// throw new Error('exit uncaught error');

logger1.error('some text', 17, null, [1, true], {
  foo: 'bar',
  'some extra': { a: false, b: [3, 3] },
});

logger1.log('<--------------------');

await logger1.close();

// logger1.close().finally(() => {
process.stdout.write('All done but process.stdout is still available!\n');
// });

// in order to keep the process running
// setInterval(() => {}, 1 << 30);

// eslint-disable-next-line prefer-const
// const tid = setTimeout(() => {
//   logger1.close().finally(() => {
//     clearTimeout(tid);
//     // process.exit(0); // for debugger
//     process.stdout.end('All done but process.stdout is still available!\n');
//   });
// });
// const tid2 = setTimeout(() => {
//   logger2.close().finally(() => {
//     clearTimeout(tid2);
//     // process.exit(0); // for debugger
//     process.stdout.write('All done but process.stdout is still available!\n');
//   });
// });
