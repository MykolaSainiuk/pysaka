import { Writable } from 'node:stream';

import { PrintFormatEnum, SeverityLevelEnum } from './enums';

export type DestinationType = Writable;

export type PysakaLoggerParams = {
  destination: DestinationType;
  severity: SeverityLevelEnum;
  format: PrintFormatEnum;
  prefix?: string;
  name?: string;
};

export interface IPysakaLogger {
  log(...args: any[]): this;
  info(...args: any[]): this;
  warn(...args: any[]): this;
  error(...args: any[]): this;
  debug(...args: any[]): this;
  critical(...args: any[]): this;
}
