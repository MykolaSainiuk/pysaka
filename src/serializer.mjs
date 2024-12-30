import { EventEmitter } from 'node:events';

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
  MILK_WHITE: '\x1b[97m',
};

export class LogSerializer extends EventEmitter {
  constructor(
    loggerId,
    severity,
    encoding = 'utf-8',
    format = 'json',
    scope = '',
  ) {
    super();
    this.loggerId = loggerId;
    this.severity = severity;
    this.encoding = encoding;
    this.format = format;
    this.scope = scope;
  }

  getFormat() {
    return this.format;
  }

  serializeJSON(args, logLevel, scope) {
    const logObj = this.getLogItem(args, logLevel, scope);

    return Buffer.from(
      JSON.stringify(logObj, undefined, 0) + '\n',
      this.encoding,
    );
  }

  serializeText(args, logLevel, scope) {
    const logObj = this.getLogItem(args, logLevel);
    const cReset = TEXT_COLORS.DEFAULT_COLOR;
    const time = this.getLocaleTimestamp(logObj.time);
    const parts = time.split(' ');
    let timeStr = time;
    if (parts.length >= 3) {
      timeStr = `${parts[0]} ${TEXT_COLORS.PURPLE}${parts[1]}${cReset} ${parts[2]}`;
    } else {
      timeStr = `${parts[0]} ${TEXT_COLORS.PURPLE}${parts[1]}${cReset}`;
    }
    const ll = logLevel ?? this.severity;
    const llc =
      logLevel >= 3
        ? TEXT_COLORS.RED
        : ll == 2
        ? TEXT_COLORS.YELLOW
        : ll == 0
        ? TEXT_COLORS.MILK_WHITE
        : TEXT_COLORS.GREEN;

    let str = `[${timeStr}] ${llc}${logObj.level}${cReset} (${logObj.pid})`;
    if (scope) {
      str += ` ${TEXT_COLORS.GREY}${scope}${cReset}`;
    }
    if (logObj.msg) {
      str += ` ${TEXT_COLORS.CYAN}"${logObj.msg}"${cReset}`;
    }
    if (logObj.data || logObj.errors) {
      str += ` ${JSON.stringify(
        logObj.data ?? logObj.errors,
        undefined,
        2,
      ).slice(1, -1)}`;
    }

    return Buffer.from(str + '\n', this.encoding);
  }

  getLogItem([msg, ...rest], logLevel, scope) {
    const logObj = {
      time: Date.now(),
      level:
        SeverityLevelValueToKey[logLevel ?? this.severity] ?? this.severity,
      pid: process.pid,
    };
    if (this.scope) {
      logObj.scope = this.scope;
    }
    if (typeof msg === 'string' || msg instanceof String) {
      logObj.msg = String(msg);
    } else {
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

  setScope(scope) {
    this.scope = scope;
  }
}
