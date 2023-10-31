import {
  WriteStream,
  closeSync,
  constants,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
} from 'node:fs';
import { FileHandle, access, open } from 'node:fs/promises';

import { LOGGER_PREFIX } from './consts';

export const openFileInSyncWay = (
  filePath: string,
  encoding: BufferEncoding,
  highWaterMark: number,
  signal?: AbortSignal,
): WriteStream => {
  const filePaths = filePath.split('/');
  const cwd = process.cwd();
  const cwdDir = cwd.split('/').slice(-1)[0];
  const si = filePaths.indexOf(cwdDir) + 1;
  for (let i = si; i <= filePaths.length; i++) {
    const p = filePaths.slice(0, i).join('/');
    if (existsSync(p)) continue;
    i === filePaths.length ? createEmptyFile(p) : createEmptyDir(p);
  }

  return createWriteStream(filePath, {
    encoding,
    signal,
    autoClose: true,
    highWaterMark,
  });
};

export const openFileSafelyAsStream = async (
  filePath: string,
  encoding: BufferEncoding,
  highWaterMark: number,
  signal: AbortSignal,
): Promise<WriteStream> => {
  let fd: FileHandle;
  try {
    fd = await open(filePath, 'w');
  } catch (err) {
    process.stderr.write(
      `${LOGGER_PREFIX} Failed to create file: ${err.message}\n`,
    );
    throw err;
  } finally {
    await fd?.close();
  }
  try {
    await access(filePath, constants.W_OK);
  } catch (err) {
    process.stderr.write(
      `${LOGGER_PREFIX} Failed to open file: ${err.message}\n`,
    );
    throw err;
  }

  const ws = createWriteStream(filePath, {
    encoding,
    signal,
    autoClose: true,
    highWaterMark,
  });
  //   const [err] = await once(ws, 'error');
  //   if (err) {
  //     ac.abort();
  //     throw err;
  //   }
  return ws;
};

export const truncateFile = async (filePath: string): Promise<void> => {
  let fd: FileHandle;
  try {
    fd = await open(filePath, 'w');
    await fd.truncate();
  } catch (err) {
    process.stderr.write(
      `${LOGGER_PREFIX} Failed to truncate file: ${err.message}\n`,
    );
    throw err;
  } finally {
    await fd?.close();
  }
};

function createEmptyFile(filePath: string) {
  let fd: number;
  try {
    fd = openSync(filePath, 'w');
  } catch (err) {
    process.stderr.write(
      `${LOGGER_PREFIX} Failed to create file: ${err.message}\n`,
    );
    throw err;
  } finally {
    fd && closeSync(fd);
  }
}

function createEmptyDir(dirPath: string) {
  try {
    mkdirSync(dirPath);
  } catch (err) {
    process.stderr.write(
      `${LOGGER_PREFIX} Failed to create dir: ${err.message}\n`,
    );
    throw err;
  }
}

export const generateNumericId = (l: number = 10): string => {
  let n = '';
  for (let i = 0; i < l; ++i) {
    n += Math.floor(Math.random() * 10);
  }
  return n;
};
