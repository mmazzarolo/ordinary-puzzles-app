// Builds the committed puzzle pack: the curated catalog becomes the head of
// each tier (so every existing player's progress ids stay valid), and the
// native generator fills each tier up to its target count. The pack is
// append-only once committed: verify-puzzle-pack.mjs enforces that a new
// build only ever appends records.
//
//   pnpm run build:puzzle-pack -- --counts=small:300,medium:300,large:300,extraordinary:150
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  computeRating,
  createNameAssigner,
  derivePuzzleId,
  loadTsTooling,
  ratingWeights,
  toTechniques,
} from "./pack-lib.mjs";

const rootDir = process.cwd();
const sourceFile = path.join(
  rootDir,
  "tools",
  "puzzle-generator",
  "native_generator.cpp",
);
const generatorBinary = path.join(
  rootDir,
  "build",
  "native-generator",
  "native_generator",
);
const catalogPath = path.join(rootDir, "src", "op-core", "puzzles.json");
const defaultOutputPath = path.join(
  rootDir,
  "src",
  "op-puzzle-pack",
  "puzzle-pack.json",
);

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const defaultCounts = {
  small: 300,
  medium: 300,
  large: 300,
  extraordinary: 300,
};

const parseCounts = (value) => {
  if (!value) return defaultCounts;
  return value.split(",").reduce((counts, part) => {
    const [mode, count] = part.split(":");
    if (!mode || !count) throw new Error(`Invalid count entry: ${part}`);
    return { ...counts, [mode]: Number(count) };
  }, {});
};

const counts = parseCounts(args.get("counts"));
const outputPath = args.get("output") || defaultOutputPath;
const maxSeedSalts = Number(args.get("max-seed-salts") || 100);

mkdirSync(path.dirname(generatorBinary), { recursive: true });
mkdirSync(path.dirname(outputPath), { recursive: true });

const compile = spawnSync(
  "clang++",
  ["-std=c++20", "-O3", "-DNDEBUG", sourceFile, "-o", generatorBinary],
  { cwd: rootDir, stdio: "inherit" },
);
if (compile.status !== 0) process.exit(compile.status || 1);

const { classifyRows, createFriendlyAlias } = loadTsTooling(rootDir);
const assignName = createNameAssigner(createFriendlyAlias);

const runGenerator = (mode, count, indexOffset) => {
  const run = spawnSync(
    generatorBinary,
    [
      "--emit-puzzles",
      `--modes=${mode}`,
      `--samples=${count}`,
      `--large-samples=${count}`,
      `--max-seed-salts=${maxSeedSalts}`,
      `--index-offset=${indexOffset}`,
    ],
    { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  if (run.status !== 0) process.exit(run.status || 1);
  return run.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const failures = [];
const modes = {};

for (const [mode, target] of Object.entries(counts)) {
  const usedNames = new Set();
  const usedIds = new Set();
  const records = [];

  // The curated catalog is the head of the tier, verbatim: same ids, same
  // names, same order. Existing progress points at these records.
  for (const curated of catalog[mode] ?? []) {
    const id = derivePuzzleId({ rows: curated.data });
    if (id !== curated.id) {
      throw new Error(`Catalog id mismatch for "${curated.name}" in ${mode}`);
    }
    const classification = classifyRows(curated.data);
    if (!classification.solved) {
      throw new Error(`Catalog puzzle "${curated.name}" failed the solver`);
    }
    const techniques = toTechniques(classification);
    usedIds.add(id);
    usedNames.add(curated.name);
    records.push({
      id,
      name: curated.name,
      rows: curated.data,
      rating: computeRating(techniques),
      curated: true,
      legacyScore: curated.score,
      techniques,
    });
  }

  // Generated fill, continuing past failures until the tier reaches its
  // target (bounded, so a bad configuration cannot loop forever).
  let indexOffset = 0;
  while (records.length < target && indexOffset < target * 10) {
    const needed = target - records.length;
    const emitted = runGenerator(mode, needed, indexOffset);
    indexOffset += needed;
    for (const record of emitted) {
      if (record.error) {
        failures.push(record);
        continue;
      }
      const classification = classifyRows(record.puzzle.rows);
      if (!classification.solved) {
        failures.push({ ...record, error: "classified_unsolved" });
        continue;
      }
      const id = derivePuzzleId({ rows: record.puzzle.rows });
      if (usedIds.has(id)) {
        failures.push({ ...record, error: "duplicate_content" });
        continue;
      }
      const techniques = toTechniques(classification);
      usedIds.add(id);
      records.push({
        id,
        name: assignName(mode, record.seed, usedNames),
        rows: record.puzzle.rows,
        rating: computeRating(techniques),
        seed: record.seed,
        generatorScore: record.puzzle.score,
        techniques,
      });
    }
  }

  if (records.length < target) {
    throw new Error(
      `Mode "${mode}" reached ${records.length}/${target} records`,
    );
  }
  modes[mode] = records;
}

const packContents = {
  format: "ordinary-puzzles-pack-v1",
  generatedBy: "scripts/build-puzzle-pack.mjs",
  seedStrategy: "fnv1a(mode:index:salt)",
  ratingWeights,
  modes,
};

const pack = {
  id: `sha256:${createHash("sha256")
    .update(JSON.stringify(packContents))
    .digest("hex")}`,
  ...packContents,
};

// Indented output so append-only growth reviews as a clean additive diff,
// then normalized through the repo formatter so CI's format check stays green.
writeFileSync(outputPath, `${JSON.stringify(pack, null, 1)}\n`);
spawnSync("pnpm", ["exec", "oxfmt", outputPath], {
  cwd: rootDir,
  stdio: "inherit",
});

console.log(
  JSON.stringify(
    {
      counts: Object.fromEntries(
        Object.entries(modes).map(([mode, records]) => [
          mode,
          {
            total: records.length,
            curated: records.filter((record) => record.curated).length,
            ratingRange: [
              Math.min(...records.map((record) => record.rating)),
              Math.max(...records.map((record) => record.rating)),
            ],
          },
        ]),
      ),
      failures: failures.length,
      outputPath,
    },
    null,
    2,
  ),
);
