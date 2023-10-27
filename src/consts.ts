import { PrintFormatEnum, SeverityLevelEnum } from './enums';
import type { PysakaLoggerParams } from './types.d';

export const DEFAULT_LOGGER_PARAMS: PysakaLoggerParams = {
  destination: process.stdout, // TODO
  fallbackSupport: true,
  severity: SeverityLevelEnum.INFO,
  format: PrintFormatEnum.JSON,
};

export const DEFAULT_STREAMS_RECOVERY_TIMEOUT = 1000;

export const LOGGER_PREFIX = 'Pysaka:';
