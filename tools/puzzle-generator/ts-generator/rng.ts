export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextUint32() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  int(maxExclusive: number) {
    if (maxExclusive <= 0) {
      throw new Error(`Rng.int expected positive max, got ${maxExclusive}`);
    }
    return this.nextUint32() % maxExclusive;
  }

  pick<T>(items: T[]) {
    if (!items.length) {
      throw new Error("Rng.pick expected a non-empty array");
    }
    return items[this.int(items.length)];
  }
}

export const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};
