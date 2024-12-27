import { PrintFormatEnum, SeverityLevelEnum } from './enums.js';
import type { IPysakaLogger, PysakaLoggerParams } from './types.js';
export declare class PysakaLogger implements IPysakaLogger {
    private destination;
    private severity;
    private format;
    private prefix;
    private internalLogs;
    private serializerEncoding;
    private isDestroyed;
    private loggerId;
    private logWorker;
    constructor(__params?: PysakaLoggerParams);
    log(...args: any[]): this;
    info(...args: any[]): this;
    warn(...args: any[]): this;
    error(...args: any[]): this;
    debug(...args: any[]): this;
    fatal(...args: any[]): this;
    private init;
    private initWorker;
    private setupPipeline;
    private handleStreamError;
    private write;
    private destructor;
    gracefulShutdown(): Promise<void>;
    close(): Promise<void>;
    setSeverity(severity: SeverityLevelEnum): void;
    setFormat(format: PrintFormatEnum): void;
    setPrefix(prefix: string): void;
    child(newPrefix?: string): this;
}
export default PysakaLogger;
