import { PrintFormatEnum, SeverityLevelEnum } from './enums.js';
export const DEFAULT_LOGGER_PARAMS = {
    destination: process.stdout,
    severity: SeverityLevelEnum.INFO,
    format: PrintFormatEnum.JSON,
    internalLogs: false,
    prefix: '',
};
export const LOGGER_PREFIX = '[Pysaka]';
export const BUFFER_ARGS_SEPARATOR = Buffer.from('¦', 'utf-8');
export const BUFFER_LOGS_START_SEPARATOR = Buffer.from('¿', 'utf-8');
export const BUFFER_LOGS_END_SEPARATOR = Buffer.from('¬', 'utf-8');
export const BUFFER_STRING_TYPE = Buffer.from('0');
export const BUFFER_INTEGER_TYPE = Buffer.from('1');
export const BUFFER_DOUBLE_TYPE = Buffer.from('2');
export const BUFFER_OBJECT_TYPE = Buffer.from('3');
export const BUFFER_BOOLEAN_TYPE = Buffer.from('4');
export const BUFFER_UNDEFINED_TYPE = Buffer.from('5');
export const BUFFER_NULL_TYPE = Buffer.from('6');
export const EXIT_SIGNALS = [
    'beforeExit',
    'uncaughtException',
    'unhandledRejection',
    'SIGHUP',
    'SIGINT',
    'SIGQUIT',
    'SIGILL',
    'SIGTRAP',
    'SIGABRT',
    'SIGBUS',
    'SIGFPE',
    'SIGUSR1',
    'SIGSEGV',
    'SIGUSR2',
    'SIGTERM',
];
