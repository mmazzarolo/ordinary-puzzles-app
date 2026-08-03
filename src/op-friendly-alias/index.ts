export interface FriendlyAliasWordLists {
  adjectives: readonly string[];
  nouns: readonly string[];
}

export interface FriendlyAliasOptions {
  namespace?: string;
  words?: Partial<FriendlyAliasWordLists>;
}

const defaultAdjectives = [
  "amber",
  "arcane",
  "ashen",
  "aural",
  "brisk",
  "calm",
  "cedar",
  "clear",
  "clever",
  "cobalt",
  "coral",
  "crisp",
  "dapper",
  "deep",
  "dim",
  "distant",
  "dusky",
  "eager",
  "early",
  "even",
  "faint",
  "fair",
  "fleet",
  "fluent",
  "formal",
  "gentle",
  "glass",
  "golden",
  "hidden",
  "hollow",
  "humble",
  "ivory",
  "keen",
  "level",
  "lilac",
  "lively",
  "lucid",
  "lunar",
  "mellow",
  "mint",
  "narrow",
  "nimble",
  "noble",
  "opal",
  "open",
  "patient",
  "plain",
  "quiet",
  "rapid",
  "remote",
  "rosy",
  "sable",
  "silent",
  "silver",
  "simple",
  "solar",
  "steady",
  "subtle",
  "tidal",
  "tidy",
  "violet",
  "vivid",
  "warm",
  "witty",
] as const;

const defaultNouns = [
  "anchor",
  "angle",
  "arc",
  "atlas",
  "axis",
  "beacon",
  "bridge",
  "cairn",
  "canvas",
  "cipher",
  "circle",
  "clasp",
  "column",
  "corner",
  "crystal",
  "delta",
  "echo",
  "ember",
  "field",
  "figure",
  "filter",
  "flame",
  "fountain",
  "frame",
  "garden",
  "glade",
  "grid",
  "harbor",
  "hinge",
  "horizon",
  "index",
  "island",
  "kernel",
  "lantern",
  "lattice",
  "ledger",
  "line",
  "marker",
  "matrix",
  "meadow",
  "meridian",
  "mirror",
  "mosaic",
  "needle",
  "node",
  "notion",
  "orbit",
  "panel",
  "pattern",
  "pebble",
  "pillar",
  "plane",
  "portal",
  "prism",
  "quartz",
  "ribbon",
  "ridge",
  "ripple",
  "signal",
  "silver",
  "slate",
  "spark",
  "spindle",
  "spiral",
  "square",
  "stone",
  "summit",
  "thread",
  "tile",
  "token",
  "trace",
  "vector",
  "vertex",
  "vista",
  "window",
  "zenith",
] as const;

export const defaultFriendlyAliasWords: FriendlyAliasWordLists = {
  adjectives: defaultAdjectives,
  nouns: defaultNouns,
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pickWord = (words: readonly string[], seed: string) => {
  if (!words.length) {
    throw new Error("Friendly alias word lists must not be empty");
  }
  return words[hashString(seed) % words.length];
};

export const createFriendlyAlias = (
  seed: string | number,
  options: FriendlyAliasOptions = {},
) => {
  const namespace = options.namespace ?? "friendly-alias";
  const adjectives =
    options.words?.adjectives ?? defaultFriendlyAliasWords.adjectives;
  const nouns = options.words?.nouns ?? defaultFriendlyAliasWords.nouns;
  const key = `${namespace}:${seed}`;

  return `${pickWord(adjectives, `${key}:adjective`)}-${pickWord(
    nouns,
    `${key}:noun`,
  )}`;
};

export const formatFriendlyAlias = (alias: string) =>
  alias
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
