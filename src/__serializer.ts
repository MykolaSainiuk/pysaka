import { EventEmitter } from 'node:stream';

import { SeverityLevelEnum, SeverityLevelValueToKey } from './enums';
import { LogItem } from './types.js';

export class LogSerializer extends EventEmitter {
  private loggerId: string;
  private severity: number;
  private encoding: BufferEncoding;

  constructor(loggerId: string, severity: number, encoding?: BufferEncoding) {
    super();
    this.loggerId = loggerId;
    this.severity = severity;
    this.encoding = encoding ?? 'utf-8';
  }

  serializeJSON(args: any[]): Buffer {
    const logObj: LogItem = this.getLogItem(args);

    return Buffer.from(JSON.stringify(logObj, undefined, 0), this.encoding);
  }

  serializeText(args: any[]): Buffer {
    const logObj: LogItem = this.getLogItem(args);

    let str = `[${this.getLocaleTimestamp(logObj.time)}] ${logObj.level} (${
      logObj.pid
    })`;
    if (logObj.msg) {
      str += ` "${logObj.msg}"`;
    }
    if (logObj.data || logObj.errors) {
      str += ` :: ${JSON.stringify(logObj.data ?? logObj.errors)}`;
    }

    return Buffer.from(str, this.encoding);
  }

  private getLogItem([msg, ...rest]: any[]): LogItem {
    const logObj: LogItem = {
      time: Date.now(),
      level: SeverityLevelValueToKey[this.severity] ?? this.severity,
      pid: process.pid,
    };
    if (typeof msg === 'string' || msg instanceof String) {
      logObj.msg = String(msg);
    } else {
      rest.unshift(msg);
    }
    const dataKey =
      this.severity >= SeverityLevelEnum.ERROR ? 'errors' : 'data';
    if (rest.length) {
      logObj[dataKey] = rest;
    }

    return logObj;
  }

  private getLocaleTimestamp(t: number = Date.now()) {
    const d = new Date(t);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  }
}
