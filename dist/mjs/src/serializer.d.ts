export class LogSerializer extends EventEmitter<[never]> {
    constructor(loggerId: any, severity: any, encoding?: string, format?: string, prefix?: string);
    loggerId: any;
    severity: any;
    encoding: string;
    format: string;
    prefix: string;
    getFormat(): string;
    serializeJSON(args: any, logLevel: any): Buffer;
    serializeText(args: any, logLevel: any): Buffer;
    getLogItem([msg, ...rest]: [any, ...any[]], logLevel: any): {
        time: string;
        level: any;
        pid: number;
    };
    getLocaleTimestamp(t?: number): string;
    setSeverity(severity: any): void;
    setFormat(format: any): void;
    setPrefix(prefix: any): void;
}
import { EventEmitter } from 'node:events';
