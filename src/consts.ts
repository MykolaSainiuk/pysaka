import { PrintFormatEnum, SeverityLevelEnum } from './enums';
import type { PysakaLoggerParams } from './types';

export const DEFAULT_LOGGER_PARAMS: PysakaLoggerParams = {
  destination: process.stdout,
  fallbackSupport: false,
  severity: SeverityLevelEnum.INFO,
  format: PrintFormatEnum.JSON,
  debugLogs: false,
  tempDirPath: '__temp',
};

export const DEFAULT_STREAMS_RECOVERY_TIMEOUT = 1000;

export const LOGGER_PREFIX = '[Pysaka]';
