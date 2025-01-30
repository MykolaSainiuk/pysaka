"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXIT_SIGNALS = exports.BUFFER_NULL_TYPE = exports.BUFFER_UNDEFINED_TYPE = exports.BUFFER_BOOLEAN_TYPE = exports.BUFFER_OBJECT_TYPE = exports.BUFFER_DOUBLE_TYPE = exports.BUFFER_INTEGER_TYPE = exports.BUFFER_STRING_TYPE = exports.BUFFER_LOGS_END_SEPARATOR = exports.BUFFER_LOGS_START_SEPARATOR = exports.BUFFER_ARGS_SEPARATOR = exports.LOGGER_PREFIX = exports.DEFAULT_LOGGER_PARAMS = void 0;
const enums_1 = require("./enums");
exports.DEFAULT_LOGGER_PARAMS = {
    destination: process.stdout,
    severity: enums_1.SeverityLevelEnum.INFO,
    format: enums_1.PrintFormatEnum.JSON,
    internalLogs: false,
    prefix: '',
};
exports.LOGGER_PREFIX = '[Pysaka]';
exports.BUFFER_ARGS_SEPARATOR = Buffer.from('¦', 'utf-8');
exports.BUFFER_LOGS_START_SEPARATOR = Buffer.from('¿', 'utf-8');
exports.BUFFER_LOGS_END_SEPARATOR = Buffer.from('¬', 'utf-8');
exports.BUFFER_STRING_TYPE = Buffer.from('0');
exports.BUFFER_INTEGER_TYPE = Buffer.from('1');
exports.BUFFER_DOUBLE_TYPE = Buffer.from('2');
exports.BUFFER_OBJECT_TYPE = Buffer.from('3');
exports.BUFFER_BOOLEAN_TYPE = Buffer.from('4');
exports.BUFFER_UNDEFINED_TYPE = Buffer.from('5');
exports.BUFFER_NULL_TYPE = Buffer.from('6');
exports.EXIT_SIGNALS = [
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
