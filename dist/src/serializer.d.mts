export class LogSerializer extends EventEmitter<[never]> {
    constructor(loggerId: any, severity: any, encoding?: string, format?: string, scope?: string);
    loggerId: any;
    severity: any;
    encoding: string;
    format: string;
    scope: string;
    getFormat(): string;
    serializeJSON(args: any, logLevel: any, scope: any): Buffer;
    serializeText(args: any, logLevel: any, scope: any): Buffer;
    getLogItem([msg, ...rest]: [any, ...any[]], logLevel: any, scope: any): {
        time: number;
        level: any;
        pid: number;
    };
    getLocaleTimestamp(t?: number): string;
    setSeverity(severity: any): void;
    setFormat(format: any): void;
    setScope(scope: any): void;
}
import { EventEmitter } from 'node:events';
