import times from "lodash/times";
import { pickRandomPuzzle } from "./pickPuzzle";

describe("pickRandomPuzzle", () => {
  const allPuzzlesLength = 6;
  describe("with 6 available puzzles", () => {
    describe("with no puzzles played yet", () => {
      it("should return the puzzle with index 0", () => {
        expect(
          pickRandomPuzzle({
            allPuzzlesLength: allPuzzlesLength,
            playedHistory: [],
          })
        ).toBe(0);
      });
    });

    describe("with 1 puzzle played", () => {
      it("should return the second puzzle", () => {
        expect(
          pickRandomPuzzle({
            allPuzzlesLength: allPuzzlesLength,
            playedHistory: [0],
          })
        ).toBe(1);
      });
    });

    describe("with 2 puzzle played", () => {
      it("should return the third puzzle", () => {
        expect(
          pickRandomPuzzle({
            allPuzzlesLength: allPuzzlesLength,
            playedHistory: [0, 1],
          })
        ).toBe(2);
      });
    });

    describe("with 3 puzzle played", () => {
      it("should return the fourth puzzle", () => {
        expect(
          pickRandomPuzzle({
            allPuzzlesLength: allPuzzlesLength,
            playedHistory: [0, 1, 2],
          })
        ).toBe(3);
      });
    });

    describe("with 4 puzzle played", () => {
      it("should return the fifth puzzle", () => {
        expect(
          pickRandomPuzzle({
            allPuzzlesLength: allPuzzlesLength,
            playedHistory: [0, 1, 2, 3],
          })
        ).toBe(4);
      });
    });

    describe("with 5 puzzle played", () => {
      it("should return the sixth puzzle", () => {
        expect(
          pickRandomPuzzle({
            allPuzzlesLength: allPuzzlesLength,
            playedHistory: [0, 1, 2, 3, 4],
          })
        ).toBe(5);
      });
    });

    describe("with all puzzles played", () => {
      describe("with all puzzles completed", () => {
        const randomTestSuite = times(10);
        it.each(randomTestSuite)(
          "should return a random non-recently played puzzle",
          () => {
            const randomPuzzle = pickRandomPuzzle({
              allPuzzlesLength: allPuzzlesLength,
              playedHistory: [0, 1, 2, 3, 4, 5],
              completedHistory: [0, 1, 2, 3, 4, 5],
            });
            expect([0, 1, 2]).toContain(randomPuzzle);
          }
        );
      });

      describe("with at least a non-completed puzzle", () => {
        it("should return a non-completed puzzle", () => {
          const pickedPuzzle = pickRandomPuzzle({
            allPuzzlesLength: allPuzzlesLength,
            playedHistory: [0, 1, 2, 3, 4, 5],
            completedHistory: [0, 1, 4, 5],
          });
          expect(pickedPuzzle).toBe(2);
        });
      });
    });
  });
});
