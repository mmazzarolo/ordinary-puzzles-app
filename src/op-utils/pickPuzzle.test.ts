import { pickNextPuzzleId, PickablePuzzle } from "./pickPuzzle";

const tier = (ratings: number[], retired: number[] = []): PickablePuzzle[] =>
  ratings.map((rating, index) => ({
    id: `p${index}`,
    rating,
    retired: retired.includes(index) || undefined,
  }));

// A deterministic "random" that always picks the first pool entry.
const first = () => 0;

describe("pickNextPuzzleId", () => {
  it("serves the lowest difficulty band first", () => {
    const puzzles = tier([50, 10, 40, 20, 30]);
    // 5 puzzles across 10 bands: every puzzle is its own band; easiest is p1.
    expect(pickNextPuzzleId({ puzzles, random: first })).toBe("p1");
  });

  it("moves to the next band once the easier ones are played", () => {
    const puzzles = tier([50, 10, 40, 20, 30]);
    expect(
      pickNextPuzzleId({ puzzles, playedIds: ["p1", "p3"], random: first }),
    ).toBe("p4");
  });

  it("picks randomly inside a band", () => {
    const puzzles = tier([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // bandCount 2: the lower band is ratings 1..5 (p0..p4).
    const seen = new Set(
      [0, 0.3, 0.6, 0.99].map((value) =>
        pickNextPuzzleId({ puzzles, bandCount: 2, random: () => value }),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
    seen.forEach((id) => {
      expect(["p0", "p1", "p2", "p3", "p4"]).toContain(id);
    });
  });

  it("never serves a retired puzzle", () => {
    const puzzles = tier([10, 20, 30], [0]);
    expect(pickNextPuzzleId({ puzzles, random: first })).toBe("p1");
    expect(
      pickNextPuzzleId({ puzzles, playedIds: ["p1", "p2"], random: first }),
    ).not.toBe("p0");
  });

  it("ignores history ids the pack does not contain", () => {
    const puzzles = tier([10, 20]);
    expect(
      pickNextPuzzleId({ puzzles, playedIds: ["ghost", "p0"], random: first }),
    ).toBe("p1");
  });

  it("rotates an exhausted tier by least recently played", () => {
    const puzzles = tier([10, 20, 30]);
    expect(pickNextPuzzleId({ puzzles, playedIds: ["p2", "p0", "p1"] })).toBe(
      "p2",
    );
  });

  it("never repeats the most recent puzzle back-to-back", () => {
    // One-puzzle tier is the degenerate case: repeating is unavoidable.
    expect(pickNextPuzzleId({ puzzles: tier([10]), playedIds: ["p0"] })).toBe(
      "p0",
    );
    const two = tier([10, 20]);
    expect(pickNextPuzzleId({ puzzles: two, playedIds: ["p0", "p1"] })).toBe(
      "p0",
    );
  });

  it("returns undefined for an empty or fully retired tier", () => {
    expect(pickNextPuzzleId({ puzzles: [] })).toBeUndefined();
    expect(
      pickNextPuzzleId({ puzzles: tier([10, 20], [0, 1]) }),
    ).toBeUndefined();
  });
});
