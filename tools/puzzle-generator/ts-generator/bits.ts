export const bitCount = (value: number) => {
  let current = value >>> 0;
  current -= (current >>> 1) & 0x55555555;
  current = (current & 0x33333333) + ((current >>> 2) & 0x33333333);
  current = (current + (current >>> 4)) & 0x0f0f0f0f;
  return (current * 0x01010101) >>> 24;
};

export const trailingZeroCount = (value: number) => {
  const current = value >>> 0;
  if (!current) {
    throw new Error("trailingZeroCount expected non-zero value");
  }
  return 31 - Math.clz32(current & -current);
};
