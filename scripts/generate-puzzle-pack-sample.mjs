import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { derivePuzzleId } from "./puzzle-id.mjs";

const rootDir = process.cwd();
const sourceFile = path.join(
  rootDir,
  "tools",
  "puzzle-generator",
  "native_generator.cpp",
);
const outputDir = path.join(rootDir, "build", "native-generator");
const outputFile = path.join(outputDir, "native_generator");
const samplePackDir = path.join(
  rootDir,
  "tools",
  "puzzle-generator",
  "samples",
);

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const defaultCounts = {
  expert: 10,
  large: 20,
  medium: 50,
  small: 50,
};

const parseCounts = (value) => {
  if (!value) return defaultCounts;

  return value.split(",").reduce((counts, part) => {
    const [mode, count] = part.split(":");
    if (!mode || !count) {
      throw new Error(`Invalid count entry: ${part}`);
    }
    return {
      ...counts,
      [mode]: Number(count),
    };
  }, {});
};

const counts = parseCounts(args.get("counts"));
const outputPath =
  args.get("output") ||
  path.join(samplePackDir, `sample-pack-${Date.now().toString(36)}.json`);
const maxSeedSalts = Number(args.get("max-seed-salts") || 100);

mkdirSync(outputDir, { recursive: true });
mkdirSync(path.dirname(outputPath), { recursive: true });

const compile = spawnSync(
  "clang++",
  ["-std=c++20", "-O3", "-DNDEBUG", sourceFile, "-o", outputFile],
  {
    cwd: rootDir,
    stdio: "inherit",
  },
);

if (compile.status !== 0) {
  process.exit(compile.status || 1);
}

// The TS reference generator classifies each emitted puzzle (the C++ binary
// emits only rows+score), and op-friendly-alias assigns display names. Both
// are TypeScript with extensionless imports, so compile them with the repo's
// own tsc before requiring them.
const tsBuildDir = path.join(rootDir, "build", "pack-tools");
const compileTsTooling = () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsc",
      "tools/puzzle-generator/ts-generator/index.ts",
      "src/op-friendly-alias/index.ts",
      "--outDir",
      tsBuildDir,
      "--module",
      "nodenext",
      "--target",
      "es2022",
      "--moduleResolution",
      "nodenext",
      "--esModuleInterop",
      "--skipLibCheck",
      "--ignoreConfig",
    ],
    { cwd: rootDir, stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

compileTsTooling();
const requireCompiled = createRequire(import.meta.url);
const { classifyRows } = requireCompiled(
  path.join(tsBuildDir, "tools/puzzle-generator/ts-generator/index.js"),
);
const { createFriendlyAlias } = requireCompiled(
  path.join(tsBuildDir, "src/op-friendly-alias/index.js"),
);

// Display names are cosmetic (identity is the content id), but they must be
// unique per tier for player-facing quality. On a collision, reroll through a
// derived namespace.
const assignName = (mode, seed, usedNames) => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const namespace =
      attempt === 0
        ? `ordinary-puzzles:${mode}`
        : `ordinary-puzzles:${mode}:${attempt}`;
    const name = createFriendlyAlias(seed, { namespace }).replace(/-/g, " ");
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  throw new Error(`Could not find a unique name in mode "${mode}"`);
};

const toTechniques = (classification) => ({
  cover: classification.cover.depth,
  cantFit: classification.cantFit.depth,
  square: classification.square.depth,
  dep: classification.dep.depth,
  oneOf: classification.oneOf.depth,
  uncontestedNoCover: classification.uncontestedNoCover.depth,
  singleSolution: classification.singleSolution.depth,
  maxWidth: classification.all.maxWidth,
});

const runGenerator = (mode, count) => {
  const run = spawnSync(
    outputFile,
    [
      "--emit-puzzles",
      `--modes=${mode}`,
      `--samples=${count}`,
      `--large-samples=${count}`,
      `--max-seed-salts=${maxSeedSalts}`,
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );

  if (run.status !== 0) {
    process.exit(run.status || 1);
  }

  return run.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

const packContents = {
  format: "ordinary-puzzles-pack-v1",
  generatedBy: "tools/puzzle-generator/native_generator.cpp",
  modes: {},
  seedStrategy: "fnv1a(mode:index:salt)",
};

const failures = [];

for (const [mode, count] of Object.entries(counts)) {
  const records = runGenerator(mode, count);
  const usedNames = new Set();
  const usedIds = new Set();
  packContents.modes[mode] = [];

  for (const record of records) {
    if (record.error) {
      failures.push(record);
      continue;
    }
    const classification = classifyRows(record.puzzle.rows);
    if (!classification.solved) {
      // The generator must never emit an unsolvable board; treat it as a
      // failure instead of shipping it.
      failures.push({ ...record, error: "classified_unsolved" });
      continue;
    }
    const id = derivePuzzleId({ rows: record.puzzle.rows });
    if (usedIds.has(id)) {
      failures.push({ ...record, error: "duplicate_content" });
      continue;
    }
    usedIds.add(id);
    packContents.modes[mode].push({
      id,
      name: assignName(mode, record.seed, usedNames),
      index: record.index,
      rows: record.puzzle.rows,
      // The generator's internal optimization score (can be negative). The
      // player-facing difficulty rating is computed at pack build (plan
      // §10.4), on one weight scale across all tiers.
      generatorScore: record.puzzle.score,
      seed: record.seed,
      techniques: toTechniques(classification),
    });
  }
}

const pack = {
  id: `sha256:${createHash("sha256")
    .update(JSON.stringify(packContents))
    .digest("hex")}`,
  ...packContents,
};

const json = `${JSON.stringify(pack)}\n`;
writeFileSync(outputPath, json);

const rawBytes = Buffer.byteLength(json);
const gzipBytes = gzipSync(json, { level: 9 }).byteLength;
const brotliBytes = brotliCompressSync(json).byteLength;
const puzzleCount = Object.values(pack.modes).reduce(
  (total, puzzles) => total + puzzles.length,
  0,
);

const estimate = (bytesPerPuzzle, targetBytes) =>
  Math.floor(targetBytes / bytesPerPuzzle);

const perPuzzle = {
  brotliBytes: Math.round(brotliBytes / puzzleCount),
  gzipBytes: Math.round(gzipBytes / puzzleCount),
  rawBytes: Math.round(rawBytes / puzzleCount),
};

console.log(
  JSON.stringify(
    {
      counts: Object.fromEntries(
        Object.entries(pack.modes).map(([mode, puzzles]) => [
          mode,
          puzzles.length,
        ]),
      ),
      estimateAt4MiB: {
        brotliPuzzles: estimate(perPuzzle.brotliBytes, 4 * 1024 * 1024),
        gzipPuzzles: estimate(perPuzzle.gzipBytes, 4 * 1024 * 1024),
        rawPuzzles: estimate(perPuzzle.rawBytes, 4 * 1024 * 1024),
      },
      failures,
      outputPath,
      perPuzzle,
      sizeBytes: {
        brotli: brotliBytes,
        gzip: gzipBytes,
        raw: rawBytes,
      },
      totalPuzzles: puzzleCount,
    },
    null,
    2,
  ),
);
