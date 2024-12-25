export const generateNumericId = (l: number = 10): string => {
  let n = '';
  for (let i = 0; i < l; ++i) {
    n += Math.floor(Math.random() * 10);
  }
  return n;
};
