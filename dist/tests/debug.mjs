import { PysakaLogger } from '../dist/src/index.js';
import { WorkerPool } from '../dist/src/wpool.js';
const logger1 = new PysakaLogger({
    format: 'text',
    internalLogs: false,
    scope: 'debug.ts',
    severity: 0,
});
logger1.log('-------------------->');
const logger2 = new PysakaLogger({
    format: 'text',
    internalLogs: true,
    scope: 'logger2',
    severity: 0,
});
logger2.warn('Here is another one!!!');
logger2.error('msg_text', new Error('Some error'));
logger1.error('msg_text', { error: 'error_text' });
logger1.debug('some text', 17, null, [1, true], {
    foo: 'bar',
    'some extra': { a: false, b: [3, 3] },
});
logger1.log('<--------------------');
const logger3 = new PysakaLogger({
    format: 'text',
    severity: 0,
});
process.stdout.write('worker pool N=' + WorkerPool.__singletonInstance.workersMap.size + '\n');
await logger1.close();
await logger2.close();
await logger3.close();
process.stdout.write('All done but process.stdout is still available!\n');
//# sourceMappingURL=debug.mjs.map