const puzzleModes = ["tutorial", "small", "medium", "large"] as const;

export type PuzzleHistoryMode = (typeof puzzleModes)[number];

// Progress is keyed by stable puzzle name so that reordering or extending the
// puzzle catalog never remaps a user's history to different puzzles.
export type PuzzleHistory = Record<PuzzleHistoryMode, string[]>;
export type PuzzleNames = Record<PuzzleHistoryMode, string[]>;

export const puzzleProgressVersion = 2;

export interface PuzzleProgress {
  version: typeof puzzleProgressVersion;
  played: PuzzleHistory;
  completed: PuzzleHistory;
}

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

const asHistorySource = (
  value: unknown,
): Partial<Record<PuzzleHistoryMode, unknown>> =>
  value && typeof value === "object"
    ? (value as Partial<Record<PuzzleHistoryMode, unknown>>)
    : {};

export const normalizePuzzleHistory = (
  value: unknown,
  puzzleNames: PuzzleNames,
): PuzzleHistory => {
  const source = asHistorySource(value);
  return Object.fromEntries(
    puzzleModes.map((mode) => {
      const entries = Array.isArray(source[mode]) ? source[mode] : [];
      const knownNames = new Set(puzzleNames[mode]);
      const validEntries = entries.filter(
        (entry): entry is string =>
          typeof entry === "string" && knownNames.has(entry),
      );
      return [mode, [...new Set(validEntries)]];
    }),
  ) as PuzzleHistory;
};

// Schema v1 stored puzzle indexes. Map each valid index to the name it pointed
// to so existing progress carries over.
export const migrateLegacyPuzzleHistory = (
  value: unknown,
  puzzleNames: PuzzleNames,
): PuzzleHistory => {
  const source = asHistorySource(value);
  return Object.fromEntries(
    puzzleModes.map((mode) => {
      const entries = Array.isArray(source[mode]) ? source[mode] : [];
      const migratedEntries = entries
        .filter(
          (entry): entry is number =>
            typeof entry === "number" &&
            Number.isInteger(entry) &&
            entry >= 0 &&
            entry < puzzleNames[mode].length,
        )
        .map((entry) => puzzleNames[mode][entry]);
      return [mode, [...new Set(migratedEntries)]];
    }),
  ) as PuzzleHistory;
};

export const serializePuzzleProgress = (
  played: PuzzleHistory,
  completed: PuzzleHistory,
): PuzzleProgress => ({
  version: puzzleProgressVersion,
  played,
  completed,
});

// Prefer the current schema when present, otherwise fall back to migrating the
// legacy index-based keys. The caller must not write the migrated result back
// eagerly: persisting only on the next real progress update keeps a downgrade
// to an older app version lossless.
export const resolvePuzzleProgress = ({
  stored,
  legacyPlayed,
  legacyCompleted,
  puzzleNames,
}: {
  stored: unknown;
  legacyPlayed: unknown;
  legacyCompleted: unknown;
  puzzleNames: PuzzleNames;
}): { played: PuzzleHistory; completed: PuzzleHistory } => {
  if (
    stored &&
    typeof stored === "object" &&
    (stored as Partial<PuzzleProgress>).version === puzzleProgressVersion
  ) {
    const progress = stored as Partial<PuzzleProgress>;
    return {
      played: normalizePuzzleHistory(progress.played, puzzleNames),
      completed: normalizePuzzleHistory(progress.completed, puzzleNames),
    };
  }
  return {
    played: migrateLegacyPuzzleHistory(legacyPlayed, puzzleNames),
    completed: migrateLegacyPuzzleHistory(legacyCompleted, puzzleNames),
  };
};
