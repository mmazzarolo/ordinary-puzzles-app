const puzzleModes = ["tutorial", "small", "medium", "large"] as const;

export type PuzzleHistoryMode = (typeof puzzleModes)[number];
export type PuzzleHistory = Record<PuzzleHistoryMode, number[]>;

export const createEmptyPuzzleHistory = (): PuzzleHistory => ({
  tutorial: [],
  small: [],
  medium: [],
  large: [],
});

export const parseStoredJson = (serializedValue: string | null): unknown => {
  if (!serializedValue) return undefined;
  try {
    return JSON.parse(serializedValue);
  } catch {
    return undefined;
  }
};

export const normalizePuzzleHistory = (
  value: unknown,
  puzzleCounts: Record<PuzzleHistoryMode, number>,
): PuzzleHistory => {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<PuzzleHistoryMode, unknown>>)
      : {};

  return Object.fromEntries(
    puzzleModes.map((mode) => {
      const entries = Array.isArray(source[mode]) ? source[mode] : [];
      const validEntries = entries.filter(
        (entry): entry is number =>
          typeof entry === "number" &&
          Number.isInteger(entry) &&
          entry >= 0 &&
          entry < puzzleCounts[mode],
      );
      return [mode, [...new Set(validEntries)]];
    }),
  ) as PuzzleHistory;
};
