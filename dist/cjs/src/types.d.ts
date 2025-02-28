/// <reference types="node" />
import { Writable } from 'node:stream';
import { PrintFormatEnum, SeverityLevelEnum } from './enums';
export type DestinationType = Writable;
export type PysakaLoggerParams = {
    destination?: DestinationType;
    severity?: SeverityLevelEnum;
    format?: PrintFormatEnum;
    prefix?: string;
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
    setSeverity(severity: SeverityLevelEnum): void;
    setFormat(format: PrintFormatEnum): void;
    setPrefix(prefix: string): void;
}
export type LogItem = {
    time: number;
    level: string | SeverityLevelEnum;
    pid: number;
    msg?: string;
    data?: any[];
    errors?: any[];
};
