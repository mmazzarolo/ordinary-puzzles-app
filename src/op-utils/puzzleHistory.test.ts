import {
  createEmptyPuzzleHistory,
  migrateLegacyPuzzleHistory,
  normalizePuzzleHistory,
  parseStoredJson,
  puzzleProgressVersion,
  resolvePuzzleProgress,
  serializePuzzleProgress,
} from "./puzzleHistory";

const puzzleNames = {
  tutorial: ["tu-0", "tu-1"],
  small: ["alpha", "beta", "gamma"],
  medium: ["delta", "epsilon"],
  large: ["zeta"],
};

describe("puzzle history recovery", () => {
  it("rejects malformed JSON", () => {
    expect(parseStoredJson("{not-json")).toBeUndefined();
  });

  it("fills missing modes and removes unknown or invalid entries", () => {
    expect(
      normalizePuzzleHistory(
        {
          tutorial: ["tu-0", "tu-0", "tu-9"],
          small: ["alpha", 0, "not-a-puzzle"],
          medium: "invalid",
        },
        puzzleNames,
      ),
    ).toEqual({
      tutorial: ["tu-0"],
      small: ["alpha"],
      medium: [],
      large: [],
    });
  });

  it("keeps the chronological order of entries", () => {
    expect(
      normalizePuzzleHistory({ small: ["gamma", "alpha", "gamma"] }, puzzleNames)
        .small,
    ).toEqual(["gamma", "alpha"]);
  });

  it("creates independent empty histories", () => {
    const first = createEmptyPuzzleHistory();
    const second = createEmptyPuzzleHistory();
    first.small.push("alpha");
    expect(second.small).toEqual([]);
  });
});

describe("legacy index migration", () => {
  it("maps legacy indexes to puzzle names in order", () => {
    expect(
      migrateLegacyPuzzleHistory(
        {
          tutorial: [0, 0, 7, 8],
          small: [2, -1, 1.5, "2", 0],
          medium: "invalid",
        },
        puzzleNames,
      ),
    ).toEqual({
      tutorial: ["tu-0"],
      small: ["gamma", "alpha"],
      medium: [],
      large: [],
    });
  });
});

describe("puzzle progress resolution", () => {
  it("prefers the current schema when present", () => {
    const stored = serializePuzzleProgress(
      { ...createEmptyPuzzleHistory(), small: ["beta"] },
      { ...createEmptyPuzzleHistory(), small: ["beta"] },
    );
    const result = resolvePuzzleProgress({
      stored,
      legacyPlayed: { small: [0] },
      legacyCompleted: { small: [0] },
      puzzleNames,
    });
    expect(result.played.small).toEqual(["beta"]);
    expect(result.completed.small).toEqual(["beta"]);
  });

  it("migrates legacy keys when the current schema is missing", () => {
    const result = resolvePuzzleProgress({
      stored: undefined,
      legacyPlayed: { small: [0, 1] },
      legacyCompleted: { small: [0] },
      puzzleNames,
    });
    expect(result.played.small).toEqual(["alpha", "beta"]);
    expect(result.completed.small).toEqual(["alpha"]);
  });

  it("falls back to legacy keys when the stored version is unknown", () => {
    const result = resolvePuzzleProgress({
      stored: { version: puzzleProgressVersion + 1, played: {}, completed: {} },
      legacyPlayed: { small: [2] },
      legacyCompleted: undefined,
      puzzleNames,
    });
    expect(result.played.small).toEqual(["gamma"]);
    expect(result.completed.small).toEqual([]);
  });

  it("returns empty histories when nothing is stored", () => {
    const result = resolvePuzzleProgress({
      stored: undefined,
      legacyPlayed: undefined,
      legacyCompleted: undefined,
      puzzleNames,
    });
    expect(result.played).toEqual(createEmptyPuzzleHistory());
    expect(result.completed).toEqual(createEmptyPuzzleHistory());
  });

  it("serializes progress with the current version", () => {
    expect(
      serializePuzzleProgress(
        createEmptyPuzzleHistory(),
        createEmptyPuzzleHistory(),
      ).version,
    ).toBe(puzzleProgressVersion);
  });
});
