import { Writable } from 'node:stream';

import { PrintFormatEnum, SeverityLevelEnum } from './enums';

export type DestinationType = Writable;

export type PysakaLoggerParams = {
  destination?: DestinationType;
  severity?: SeverityLevelEnum;
  format?: PrintFormatEnum;
  scope?: string;
  internalLogs?: boolean;
};

export interface IPysakaLogger {
  log(...args: any[]): this;
  info(...args: any[]): this;
  warn(...args: any[]): this;
  error(...args: any[]): this;
  debug(...args: any[]): this;
  fatal(...args: any[]): this;
  close(): Promise<void>;
  // auxiliary methods
  setSeverity(severity: SeverityLevelEnum): void;
  setFormat(format: PrintFormatEnum): void;
  setScope(scope: string): void;
}

export type LogItem = {
  time: number;
  level: string | SeverityLevelEnum;
  pid: number;

  msg?: string;
  data?: any[];
  errors?: any[];
};

export type WorkerData = {
  severity: SeverityLevelEnum;
  encoding: BufferEncoding;
  format: PrintFormatEnum;
};
