import {
  createEmptyPuzzleHistory,
  normalizePuzzleHistory,
  parseStoredJson,
} from "./puzzleHistory";

const puzzleCounts = {
  tutorial: 8,
  small: 99,
  medium: 99,
  large: 99,
};

describe("puzzle history recovery", () => {
  it("rejects malformed JSON", () => {
    expect(parseStoredJson("{not-json")).toBeUndefined();
  });

  it("fills missing modes and removes invalid entries", () => {
    expect(
      normalizePuzzleHistory(
        {
          tutorial: [0, 0, 7, 8],
          small: [0, -1, 1.5, "2"],
          medium: "invalid",
        },
        puzzleCounts,
      ),
    ).toEqual({
      tutorial: [0, 7],
      small: [0],
      medium: [],
      large: [],
    });
  });

  it("creates independent empty histories", () => {
    const first = createEmptyPuzzleHistory();
    const second = createEmptyPuzzleHistory();
    first.small.push(1);
    expect(second.small).toEqual([]);
  });
});
