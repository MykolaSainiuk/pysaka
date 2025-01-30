import { dirname } from 'node:path';
export const getDirName = () => dirname(new URL(import.meta.url).pathname);
