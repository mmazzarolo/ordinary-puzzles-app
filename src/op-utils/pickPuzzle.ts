export interface PickablePuzzle {
  id: string;
  rating: number;
  retired?: boolean;
}

interface Params {
  puzzles: PickablePuzzle[];
  // Chronological play order, oldest first (a replay moves an id to the end).
  playedIds?: string[];
  bandCount?: number;
  random?: () => number;
}

// Picks the next puzzle for a tier.
//
// Unplayed puzzles are served in ascending difficulty bands: the tier's
// records are ranked by rating and cut into `bandCount` bands; the pick is
// random WITHIN the lowest band that still has unplayed puzzles. The player
// climbs the tier's real difficulty curve without ever seeing the same
// ordering as another player.
//
// When every puzzle has been played, the tier rotates: the least recently
// played puzzle is served, and the most recent one is never repeated
// back-to-back.
//
// Retired puzzles are never served. Ids in the history that the pack does not
// contain are ignored. Returns undefined only for an empty (or fully retired)
// tier.
export const pickNextPuzzleId = ({
  puzzles,
  playedIds = [],
  bandCount = 10,
  random = Math.random,
}: Params): string | undefined => {
  const active = puzzles.filter((puzzle) => !puzzle.retired);
  if (active.length === 0) return undefined;

  const played = new Set(playedIds);
  const unplayed = active.filter((puzzle) => !played.has(puzzle.id));

  if (unplayed.length > 0) {
    const ranked = [...active].sort((a, b) => a.rating - b.rating);
    const bandByPuzzleId = new Map(
      ranked.map((puzzle, rank) => [
        puzzle.id,
        Math.floor((rank * bandCount) / ranked.length),
      ]),
    );
    const lowestBand = Math.min(
      ...unplayed.map((puzzle) => bandByPuzzleId.get(puzzle.id) ?? 0),
    );
    const pool = unplayed.filter(
      (puzzle) => bandByPuzzleId.get(puzzle.id) === lowestBand,
    );
    return pool[Math.floor(random() * pool.length)].id;
  }

  const activeIds = new Set(active.map((puzzle) => puzzle.id));
  const orderedHistory = playedIds.filter((id) => activeIds.has(id));
  const mostRecent = orderedHistory[orderedHistory.length - 1];
  const leastRecent = orderedHistory.find((id) => id !== mostRecent);
  return leastRecent ?? mostRecent ?? active[0].id;
};
