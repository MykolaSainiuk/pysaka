export class LogSerializer extends EventEmitter {
    constructor(loggerId: any, severity: any, encoding?: string, format?: string);
    loggerId: any;
    severity: any;
    encoding: string;
    format: string;
    getFormat(): string;
    serializeJSON(args: any, logLevel: any): Buffer;
    serializeText(args: any, logLevel: any): Buffer;
    getLogItem([msg, ...rest]: [any, ...any[]], logLevel: any): {
        time: number;
        level: any;
        pid: number;
    };
    getLocaleTimestamp(t?: number): string;
}
import { EventEmitter } from "events";
