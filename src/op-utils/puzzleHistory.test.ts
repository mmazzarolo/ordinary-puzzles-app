import {
  createEmptyPuzzleHistory,
  migrateLegacyPuzzleHistory,
  parseStoredJson,
  puzzleProgressVersion,
  resolvePuzzleProgress,
  serializePuzzleProgress,
  splitPuzzleHistory,
} from "./puzzleHistory";

const puzzleIds = {
  tutorial: ["tu-0", "tu-1"],
  small: ["alpha", "beta", "gamma"],
  medium: ["delta", "epsilon"],
  large: ["zeta"],
};

describe("puzzle history recovery", () => {
  it("rejects malformed JSON", () => {
    expect(parseStoredJson("{not-json")).toBeUndefined();
  });

  it("splits known from unknown ids and drops invalid entries", () => {
    const { known, unknown } = splitPuzzleHistory(
      {
        tutorial: ["tu-0", "tu-0", "tu-9"],
        small: ["alpha", 0, "not-a-puzzle"],
        medium: "invalid",
      },
      puzzleIds,
    );
    expect(known).toEqual({
      tutorial: ["tu-0"],
      small: ["alpha"],
      medium: [],
      large: [],
    });
    expect(unknown).toEqual({
      tutorial: ["tu-9"],
      small: ["not-a-puzzle"],
      medium: [],
      large: [],
    });
  });

  it("keeps the chronological order of entries", () => {
    expect(
      splitPuzzleHistory({ small: ["gamma", "alpha", "gamma"] }, puzzleIds)
        .known.small,
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
  it("maps legacy indexes to puzzle ids in order", () => {
    expect(
      migrateLegacyPuzzleHistory(
        {
          tutorial: [0, 0, 7, 8],
          small: [2, -1, 1.5, "2", 0],
          medium: "invalid",
        },
        puzzleIds,
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
    const stored = {
      version: puzzleProgressVersion,
      played: { ...createEmptyPuzzleHistory(), small: ["beta"] },
      completed: { ...createEmptyPuzzleHistory(), small: ["beta"] },
    };
    const result = resolvePuzzleProgress({
      stored,
      legacyPlayed: { small: [0] },
      legacyCompleted: { small: [0] },
      puzzleIds,
    });
    expect(result.played.small).toEqual(["beta"]);
    expect(result.completed.small).toEqual(["beta"]);
    expect(result.readOnly).toBe(false);
  });

  it("migrates legacy keys when the current schema is missing", () => {
    const result = resolvePuzzleProgress({
      stored: undefined,
      legacyPlayed: { small: [0, 1] },
      legacyCompleted: { small: [0] },
      puzzleIds,
    });
    expect(result.played.small).toEqual(["alpha", "beta"]);
    expect(result.completed.small).toEqual(["alpha"]);
    expect(result.readOnly).toBe(false);
  });

  it("reads a newer-version document best-effort and blocks writes", () => {
    // A document written by a FUTURE build must never be destroyed: read what
    // this build understands, show it, and refuse to write anything back.
    const result = resolvePuzzleProgress({
      stored: {
        version: puzzleProgressVersion + 1,
        played: { small: ["alpha", "id-from-the-future"] },
        completed: { small: ["alpha"] },
      },
      legacyPlayed: { small: [2] },
      legacyCompleted: undefined,
      puzzleIds,
    });
    expect(result.played.small).toEqual(["alpha"]);
    expect(result.unknownPlayed.small).toEqual(["id-from-the-future"]);
    expect(result.completed.small).toEqual(["alpha"]);
    expect(result.readOnly).toBe(true);
  });

  it("blocks writes when the storage read itself failed", () => {
    const result = resolvePuzzleProgress({
      stored: undefined,
      legacyPlayed: undefined,
      legacyCompleted: undefined,
      puzzleIds,
      readFailed: true,
    });
    expect(result.played).toEqual(createEmptyPuzzleHistory());
    expect(result.readOnly).toBe(true);
  });

  it("returns empty writable histories when nothing is stored", () => {
    const result = resolvePuzzleProgress({
      stored: undefined,
      legacyPlayed: undefined,
      legacyCompleted: undefined,
      puzzleIds,
    });
    expect(result.played).toEqual(createEmptyPuzzleHistory());
    expect(result.completed).toEqual(createEmptyPuzzleHistory());
    expect(result.readOnly).toBe(false);
  });

  it("unknown ids survive a load-then-save cycle", () => {
    // The passthrough guarantee: an id this catalog does not know (rollback,
    // downgrade, retired puzzle) must reappear verbatim in the next write.
    const stored = {
      version: puzzleProgressVersion,
      played: { small: ["alpha", "ghost-played"] },
      completed: { small: ["ghost-done", "alpha"] },
    };
    const resolved = resolvePuzzleProgress({
      stored,
      legacyPlayed: undefined,
      legacyCompleted: undefined,
      puzzleIds,
    });
    const rewritten = serializePuzzleProgress(resolved);
    expect(rewritten.played.small).toContain("ghost-played");
    expect(rewritten.completed.small).toContain("ghost-done");
    expect(rewritten.played.small).toContain("alpha");
    expect(rewritten.version).toBe(puzzleProgressVersion);
  });

  it("serializes progress with the current version", () => {
    expect(
      serializePuzzleProgress({
        played: createEmptyPuzzleHistory(),
        completed: createEmptyPuzzleHistory(),
        unknownPlayed: createEmptyPuzzleHistory(),
        unknownCompleted: createEmptyPuzzleHistory(),
      }).version,
    ).toBe(puzzleProgressVersion);
  });
});
