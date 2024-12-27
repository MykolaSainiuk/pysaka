import { PysakaLogger } from '../dist/src/index.js';
const logger1 = new PysakaLogger({
    format: 'text',
    internalLogs: false,
    prefix: 'debug.ts',
});
logger1.log('-------------------->');
logger1.error('msg_text', { error: 'error_text' });
logger1.error('some text', 17, null, [1, true], {
    foo: 'bar',
    'some extra': { a: false, b: [3, 3] },
});
logger1.log('<--------------------');
await logger1.close();
process.stdout.write('All done but process.stdout is still available!\n');
setInterval(() => { }, 1 << 30);
//# sourceMappingURL=debug.mjs.map