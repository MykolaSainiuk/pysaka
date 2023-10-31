"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGGER_PREFIX = exports.DEFAULT_STREAMS_RECOVERY_TIMEOUT = exports.DEFAULT_LOGGER_PARAMS = void 0;
const enums_1 = require("./enums");
exports.DEFAULT_LOGGER_PARAMS = {
    destination: process.stdout,
    fallbackSupport: true,
    severity: enums_1.SeverityLevelEnum.INFO,
    format: enums_1.PrintFormatEnum.JSON,
    debugLogs: false,
    tempDirPath: '__temp',
};
exports.DEFAULT_STREAMS_RECOVERY_TIMEOUT = 1000;
exports.LOGGER_PREFIX = '[Pysaka]';
//# sourceMappingURL=consts.js.map