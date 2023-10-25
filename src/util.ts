import { WriteStream, constants, createWriteStream } from 'node:fs';
import { FileHandle, access, open } from 'node:fs/promises';

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
    process.stderr.write(`Pysaka: Failed to create file: ${err.message}\n`);
    throw err;
  } finally {
    await fd?.close();
  }
  try {
    await access(filePath, constants.W_OK);
  } catch (err) {
    process.stderr.write(`Pysaka: Failed to open file: ${err.message}\n`);
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
    process.stderr.write(`Pysaka: Failed to truncate file: ${err.message}\n`);
    throw err;
  } finally {
    await fd?.close();
  }
};
