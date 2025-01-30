"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogSerializer = void 0;
const node_events_1 = require("node:events");
const SeverityLevelValueToKey = {
    0: 'DEBUG',
    1: 'INFO',
    2: 'WARN',
    3: 'ERROR',
    4: 'CRITICAL',
};
const TEXT_COLORS = {
    DEFAULT_COLOR: '\x1b[0m',
    CYAN: '\x1b[36m',
    YELLOW: '\x1b[33m',
    ORANGE: '\x1b[38;5;208m',
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    PURPLE: '\x1b[35m',
    GREY: '\x1b[90m',
};
class LogSerializer extends node_events_1.EventEmitter {
    constructor(loggerId, severity, encoding = 'utf-8', format = 'json', prefix = '') {
        super();
        this.loggerId = loggerId;
        this.severity = severity;
        this.encoding = encoding;
        this.format = format;
        this.prefix = prefix;
    }
    getFormat() {
        return this.format;
    }
    serializeJSON(args, logLevel) {
        const logObj = this.getLogItem(args, logLevel);
        return Buffer.from(JSON.stringify(logObj, undefined, 0) + '\n', this.encoding);
    }
    serializeText(args, logLevel) {
        const logObj = this.getLogItem(args, logLevel);
        const cReset = TEXT_COLORS.DEFAULT_COLOR;
        const time = this.getLocaleTimestamp(logObj.time);
        const parts = time.split(' ');
        let timeStr = time;
        if (parts.length >= 3) {
            timeStr = `${parts[0]} ${TEXT_COLORS.PURPLE}${parts[1]}${cReset} ${parts[2]}`;
        }
        else {
            timeStr = `${parts[0]} ${TEXT_COLORS.PURPLE}${parts[1]}${cReset}`;
        }
        const ll = logLevel ?? this.severity;
        const llc = logLevel >= 3
            ? TEXT_COLORS.RED
            : ll == 0
                ? TEXT_COLORS.YELLOW
                : TEXT_COLORS.GREEN;
        let str = `[${timeStr}] ${llc}${logObj.level}${cReset} (${logObj.pid})`;
        if (logObj.prefix) {
            str += ` ${TEXT_COLORS.GREY}${logObj.prefix}${cReset}`;
        }
        if (logObj.msg) {
            str += ` ${TEXT_COLORS.CYAN}"${logObj.msg}"${cReset}`;
        }
        if (logObj.data || logObj.errors) {
            str += ` ${JSON.stringify(logObj.data ?? logObj.errors, undefined, 2).slice(1, -1)}`;
        }
        return Buffer.from(str + '\n', this.encoding);
    }
    getLogItem([msg, ...rest], logLevel) {
        const logObj = {
            time: Date.now(),
            level: SeverityLevelValueToKey[logLevel ?? this.severity] ?? this.severity,
            pid: process.pid,
        };
        if (this.prefix) {
            logObj.prefix = this.prefix;
        }
        if (typeof msg === 'string' || msg instanceof String) {
            logObj.msg = String(msg);
        }
        else {
            rest.unshift(msg);
        }
        const dataKey = this.severity >= 3 ? 'errors' : 'data';
        if (rest.length) {
            logObj[dataKey] = rest;
        }
        return logObj;
    }
    getLocaleTimestamp(t = Date.now()) {
        const d = new Date(t);
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    }
    setSeverity(severity) {
        this.severity = severity;
    }
    setFormat(format) {
        this.format = format;
    }
    setPrefix(prefix) {
        this.prefix = prefix;
    }
}
exports.LogSerializer = LogSerializer;
