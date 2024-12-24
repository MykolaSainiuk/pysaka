/// <reference types="node" />
import { WriteStream } from 'node:fs';
export declare const openFileInSyncWay: (filePath: string, encoding: BufferEncoding, highWaterMark: number, signal?: AbortSignal) => WriteStream;
export declare const generateNumericId: (l?: number) => string;
