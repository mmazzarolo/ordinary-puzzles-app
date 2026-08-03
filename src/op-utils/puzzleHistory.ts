const puzzleModes = [
  "tutorial",
  "small",
  "medium",
  "large",
  "extraordinary",
] as const;

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

// The fully resolved on-device progress. "Unknown" holds ids that are stored
// on the device but absent from this build's catalog (catalog rollback, app
// downgrade, or a document written by a newer build). They are invisible to
// the picker, the score, and the stats, but they are always written back
// verbatim, so no load→save cycle can destroy them. `readOnly` blocks every
// write when the stored data cannot be safely rewritten by this build.
export interface PuzzleProgressState {
  played: PuzzleHistory;
  completed: PuzzleHistory;
  unknownPlayed: PuzzleHistory;
  unknownCompleted: PuzzleHistory;
  readOnly: boolean;
}

export const createEmptyPuzzleHistory = (): PuzzleHistory => ({
  tutorial: [],
  small: [],
  medium: [],
  large: [],
  extraordinary: [],
});

const createEmptyProgressState = (readOnly: boolean): PuzzleProgressState => ({
  played: createEmptyPuzzleHistory(),
  completed: createEmptyPuzzleHistory(),
  unknownPlayed: createEmptyPuzzleHistory(),
  unknownCompleted: createEmptyPuzzleHistory(),
  readOnly,
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

// Splits a stored history into the ids this build's catalog knows and the ids
// it does not. Order is preserved within each half; duplicates and
// non-strings are dropped.
export const splitPuzzleHistory = (
  value: unknown,
  puzzleIds: PuzzleIds,
): { known: PuzzleHistory; unknown: PuzzleHistory } => {
  const source = asHistorySource(value);
  const known = createEmptyPuzzleHistory();
  const unknown = createEmptyPuzzleHistory();
  puzzleModes.forEach((mode) => {
    const entries = Array.isArray(source[mode]) ? source[mode] : [];
    const knownIds = new Set(puzzleIds[mode]);
    const seen = new Set<string>();
    entries.forEach((entry) => {
      if (typeof entry !== "string" || seen.has(entry)) return;
      seen.add(entry);
      (knownIds.has(entry) ? known : unknown)[mode].push(entry);
    });
  });
  return { known, unknown };
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

const mergeHistories = (
  known: PuzzleHistory,
  unknown: PuzzleHistory,
): PuzzleHistory =>
  Object.fromEntries(
    puzzleModes.map((mode) => [mode, [...known[mode], ...unknown[mode]]]),
  ) as PuzzleHistory;

// The serialized document re-joins known and passthrough ids: storage never
// learns the difference, so a later build with a bigger catalog reclaims the
// ids transparently.
export const serializePuzzleProgress = (
  state: Pick<
    PuzzleProgressState,
    "played" | "completed" | "unknownPlayed" | "unknownCompleted"
  >,
): PuzzleProgress => ({
  version: puzzleProgressVersion,
  played: mergeHistories(state.played, state.unknownPlayed),
  completed: mergeHistories(state.completed, state.unknownCompleted),
});

// Resolution order: current schema → newer schema (best-effort, read-only) →
// legacy index keys. The caller must not write the resolved result back
// eagerly: persisting only on the next real progress update keeps a downgrade
// to an older app version lossless.
export const resolvePuzzleProgress = ({
  stored,
  legacyPlayed,
  legacyCompleted,
  puzzleIds,
  readFailed = false,
}: {
  stored: unknown;
  legacyPlayed: unknown;
  legacyCompleted: unknown;
  puzzleIds: PuzzleIds;
  readFailed?: boolean;
}): PuzzleProgressState => {
  // A failed storage read is not the same as an absent document: writing after
  // it could overwrite intact data with an empty history.
  if (readFailed) return createEmptyProgressState(true);

  if (stored && typeof stored === "object") {
    const version = (stored as Partial<PuzzleProgress>).version;
    const isCurrent = version === puzzleProgressVersion;
    const isNewer =
      typeof version === "number" && version > puzzleProgressVersion;
    if (isCurrent || isNewer) {
      const progress = stored as Partial<PuzzleProgress>;
      const played = splitPuzzleHistory(progress.played, puzzleIds);
      const completed = splitPuzzleHistory(progress.completed, puzzleIds);
      return {
        played: played.known,
        completed: completed.known,
        unknownPlayed: played.unknown,
        unknownCompleted: completed.unknown,
        // A newer build wrote this document. Read it best-effort so the
        // player still sees their progress, but never write: this build
        // would destroy fields it does not understand.
        readOnly: isNewer,
      };
    }
  }

  return {
    ...createEmptyProgressState(false),
    played: migrateLegacyPuzzleHistory(legacyPlayed, puzzleIds),
    completed: migrateLegacyPuzzleHistory(legacyCompleted, puzzleIds),
  };
};
