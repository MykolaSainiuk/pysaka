"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGGER_PREFIX = exports.DEFAULT_LOGGER_PARAMS = void 0;
const enums_1 = require("./enums");
exports.DEFAULT_LOGGER_PARAMS = {
    destination: process.stdout,
    severity: enums_1.SeverityLevelEnum.INFO,
    format: enums_1.PrintFormatEnum.JSON,
    debugLogsOfLogger: false,
    neverSpikeCPU: true,
};
exports.LOGGER_PREFIX = '[Pysaka]';
//# sourceMappingURL=consts.js.map