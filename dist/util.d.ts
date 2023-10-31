import { WriteStream } from 'node:fs';
export declare const openFileInSyncWay: (filePath: string, encoding: BufferEncoding, highWaterMark: number, signal?: AbortSignal) => WriteStream;
export declare const openFileSafelyAsStream: (filePath: string, encoding: BufferEncoding, highWaterMark: number, signal: AbortSignal) => Promise<WriteStream>;
export declare const truncateFile: (filePath: string) => Promise<void>;
export declare const generateNumericId: (l?: number) => string;
