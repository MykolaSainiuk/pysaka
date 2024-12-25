import { PrintFormatEnum, SeverityLevelEnum } from './enums';
import type { PysakaLoggerParams } from './types';

export const DEFAULT_LOGGER_PARAMS: PysakaLoggerParams = {
  destination: process.stdout,
  severity: SeverityLevelEnum.INFO,
  format: PrintFormatEnum.JSON,
  debugLogsOfLogger: false,
  neverSpikeCPU: true,
};

export const LOGGER_PREFIX = '[Pysaka]';
