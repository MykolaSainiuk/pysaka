"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintFormatEnum = exports.SeverityLevelValueToKey = exports.SeverityLevelEnum = void 0;
var SeverityLevelEnum;
(function (SeverityLevelEnum) {
    SeverityLevelEnum[SeverityLevelEnum["DEBUG"] = 0] = "DEBUG";
    SeverityLevelEnum[SeverityLevelEnum["INFO"] = 1] = "INFO";
    SeverityLevelEnum[SeverityLevelEnum["WARN"] = 2] = "WARN";
    SeverityLevelEnum[SeverityLevelEnum["ERROR"] = 3] = "ERROR";
    SeverityLevelEnum[SeverityLevelEnum["FATAl"] = 4] = "FATAl";
})(SeverityLevelEnum || (exports.SeverityLevelEnum = SeverityLevelEnum = {}));
exports.SeverityLevelValueToKey = {
    0: 'DEBUG',
    1: 'INFO',
    2: 'WARN',
    3: 'ERROR',
    4: 'FATAL',
};
var PrintFormatEnum;
(function (PrintFormatEnum) {
    PrintFormatEnum["JSON"] = "json";
    PrintFormatEnum["TEXT"] = "text";
})(PrintFormatEnum || (exports.PrintFormatEnum = PrintFormatEnum = {}));
