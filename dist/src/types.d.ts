/// <reference types="node" />
import { Writable } from 'node:stream';
import { PrintFormatEnum, SeverityLevelEnum } from './enums';
export type DestinationType = Writable;
export type PysakaLoggerParams = {
    destination?: DestinationType;
    severity?: SeverityLevelEnum;
    format?: PrintFormatEnum;
    name?: string;
    debugLogsOfLogger?: boolean;
};
export interface IPysakaLogger {
    log(...args: any[]): this;
    info(...args: any[]): this;
    warn(...args: any[]): this;
    error(...args: any[]): this;
    debug(...args: any[]): this;
    fatal(...args: any[]): this;
    closeSync(): void;
    close(): Promise<void>;
}
export type LogItem = {
    time: number;
    level: string | SeverityLevelEnum;
    pid: number;
    msg?: string;
    data?: any[];
    errors?: any[];
};
