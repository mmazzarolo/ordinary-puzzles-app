import last from "lodash/last";
import difference from "lodash/difference";
import takeRight from "lodash/takeRight";

interface Params {
  allPuzzlesLength: number;
  playedHistory?: number[];
  recentlyPlayedFactor?: number;
  completedHistory?: number[];
}

const contains = <T>(arr: T[], el: T) => arr.indexOf(el) > -1;

export const pickRandomPuzzle = ({
  allPuzzlesLength,
  playedHistory = [],
  completedHistory = [],
  recentlyPlayedFactor = Math.floor(allPuzzlesLength / 2)
}: Params) => {
  const hasPlayedAllPuzzles = playedHistory.length >= allPuzzlesLength;
  // If there's at least a puzzle that has not been played yet, pick one from
  // the next one from the not-played puzzle list
  if (!hasPlayedAllPuzzles) {
    const lastPlayedPuzzle = last(playedHistory);
    const nextPuzzle =
      lastPlayedPuzzle === undefined ? 0 : lastPlayedPuzzle + 1;
    // Should always be true... but it's better to be safe than sorry
    if (!contains(playedHistory, nextPuzzle)) return nextPuzzle;
  }
  const hasCompletedAllPuzzles =
    completedHistory.length >= allPuzzlesLength &&
    completedHistory.length >= playedHistory.length;
  // If all the puzzles for this mode have already been completed, pick a random
  // one, making sure it wasn't played recently
  if (hasCompletedAllPuzzles) {
    const recentPuzzles = takeRight(playedHistory, recentlyPlayedFactor);
    const pickRandomPuzzle = (): number => {
      const randomPuzzle = Math.floor(Math.random() * allPuzzlesLength);
      const isRecent = contains(recentPuzzles, randomPuzzle);
      return !isRecent ? randomPuzzle : pickRandomPuzzle();
    };
    return pickRandomPuzzle();
  }
  // If there's at least a puzzle that has not been completed yet, pick it from
  // the list
  return difference(playedHistory, completedHistory)[0];
};
