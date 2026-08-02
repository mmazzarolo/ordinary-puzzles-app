const puzzleModes = ["tutorial", "small", "medium", "large"] as const;

export type PuzzleHistoryMode = (typeof puzzleModes)[number];

// Progress is keyed by the stable content-derived puzzle id (see
// scripts/inject-puzzle-ids.mjs), so reordering, extending, or RENAMING
// catalog puzzles never remaps a user's history to different puzzles.
export type PuzzleHistory = Record<PuzzleHistoryMode, string[]>;
export type PuzzleIds = Record<PuzzleHistoryMode, string[]>;

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
  puzzleIds: PuzzleIds,
): PuzzleHistory => {
  const source = asHistorySource(value);
  return Object.fromEntries(
    puzzleModes.map((mode) => {
      const entries = Array.isArray(source[mode]) ? source[mode] : [];
      const knownIds = new Set(puzzleIds[mode]);
      const validEntries = entries.filter(
        (entry): entry is string =>
          typeof entry === "string" && knownIds.has(entry),
      );
      return [mode, [...new Set(validEntries)]];
    }),
  ) as PuzzleHistory;
};

// Schema v1 stored puzzle indexes. Map each valid index to the id of the
// puzzle it pointed to so existing progress carries over.
export const migrateLegacyPuzzleHistory = (
  value: unknown,
  puzzleIds: PuzzleIds,
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
            entry < puzzleIds[mode].length,
        )
        .map((entry) => puzzleIds[mode][entry]);
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
  puzzleIds,
}: {
  stored: unknown;
  legacyPlayed: unknown;
  legacyCompleted: unknown;
  puzzleIds: PuzzleIds;
}): { played: PuzzleHistory; completed: PuzzleHistory } => {
  if (
    stored &&
    typeof stored === "object" &&
    (stored as Partial<PuzzleProgress>).version === puzzleProgressVersion
  ) {
    const progress = stored as Partial<PuzzleProgress>;
    return {
      played: normalizePuzzleHistory(progress.played, puzzleIds),
      completed: normalizePuzzleHistory(progress.completed, puzzleIds),
    };
  }
  return {
    played: migrateLegacyPuzzleHistory(legacyPlayed, puzzleIds),
    completed: migrateLegacyPuzzleHistory(legacyCompleted, puzzleIds),
  };
};
