// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EventEmitter } = require('node:stream');

const SeverityLevelValueToKey = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'CRITICAL',
};

class LogSerializer extends EventEmitter {
  constructor(loggerId, severity, encoding = 'utf-8', format = 'json') {
    super();
    this.loggerId = loggerId;
    this.severity = severity;
    this.encoding = encoding;
    this.format = format;
  }

  getFormat() {
    return this.format;
  }

  serializeJSON(args) {
    const logObj = this.getLogItem(args);

    return Buffer.from(
      JSON.stringify(logObj, undefined, 0) + '\n',
      this.encoding,
    );
  }

  serializeText(args) {
    const logObj = this.getLogItem(args);

    let str = `[${this.getLocaleTimestamp(logObj.time)}] ${logObj.level} (${
      logObj.pid
    })`;
    if (logObj.msg) {
      str += ` "${logObj.msg}"`;
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

  getLogItem([msg, ...rest]) {
    const logObj = {
      time: Date.now(),
      level: SeverityLevelValueToKey[this.severity] ?? this.severity,
      pid: process.pid,
    };
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
}

module.exports = { LogSerializer };
