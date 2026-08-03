import packJson from "./puzzle-pack.json";

export const packModes = ["small", "medium", "large", "extraordinary"] as const;

export type PackMode = (typeof packModes)[number];

export interface PackRecord {
  id: string;
  name: string;
  rows: string[];
  // Ordering-only difficulty number, one weight scale across all tiers (see
  // scripts/pack-lib.mjs). Drives band serving; never shown to the player.
  rating: number;
  techniques: Record<string, number>;
  // Curated records carry the original catalog score; generated records carry
  // the generator's internal score instead.
  curated?: boolean;
  legacyScore?: number;
  generatorScore?: number;
  seed?: number;
  // A retired puzzle stays in the pack (its id may be referenced by player
  // progress) but is never served again.
  retired?: boolean;
}

interface PuzzlePack {
  id: string;
  format: string;
  modes: Record<PackMode, PackRecord[]>;
}

const pack = packJson as unknown as PuzzlePack;

export const packId = pack.id;

export const getPackRecords = (mode: PackMode): PackRecord[] =>
  pack.modes[mode];

export const isPackMode = (mode: string): mode is PackMode =>
  (packModes as readonly string[]).indexOf(mode) > -1;

// The score shown by the current UI. Curated puzzles keep their original
// values; generated puzzles fall back to the same formula family the catalog
// scores came from, floored at 1 so a score is always positive.
export const getPackRecordScore = (record: PackRecord): number =>
  record.legacyScore ?? Math.max(1, record.generatorScore ?? 1);
