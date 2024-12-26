import { PrintFormatEnum } from './enums';
import PysakaLogger from './logger';

export * from './enums';
export * from './logger';
export type * from './types';

export const textLogger = new PysakaLogger({ format: PrintFormatEnum.TEXT });
export const jsonLogger = new PysakaLogger({ format: PrintFormatEnum.JSON });
