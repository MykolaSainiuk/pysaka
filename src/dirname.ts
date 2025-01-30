import path from 'node:path';

export const getDirName = () => {
  const dirname =
    typeof __dirname !== 'undefined'
      ? __dirname
      : // @ts-ignore
        path.dirname(new URL(import.meta.url).pathname);
  return dirname;
};
