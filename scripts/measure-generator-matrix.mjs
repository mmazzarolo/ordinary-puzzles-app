import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const rootDir = process.cwd();
const sourceDir = path.join(
  rootDir,
  "tools",
  "puzzle-generator",
  "ts-generator",
);
const sourceRoot = path.join("tools", "puzzle-generator", "ts-generator");
const outputDir = path.join(rootDir, "build", "generator-matrix");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const samples = Number(args.get("samples") || 2);
const attemptLimit = Number(args.get("attempt-limit") || 30);
const candidateAttemptLimit = Number(
  args.get("candidate-attempt-limit") || 500,
);

const sourceFiles = readdirSync(sourceDir)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .map((name) => path.join(sourceRoot, name));

rmSync(outputDir, { force: true, recursive: true });

const compile = spawnSync(
  "pnpm",
  [
    "exec",
    "tsc",
    "--ignoreConfig",
    "--module",
    "commonjs",
    "--target",
    "es2020",
    "--esModuleInterop",
    "--skipLibCheck",
    "--outDir",
    outputDir,
    ...sourceFiles,
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
  },
);

if (compile.status !== 0) {
  process.exit(compile.status || 1);
}

const require = createRequire(import.meta.url);
const {
  createGeneratePuzzleProfile,
  difficulties,
  generatePuzzle,
  hashSeed,
} = require(path.join(outputDir, "index.js"));

const range = (start, end) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const baseVariant = (variant) => ({
  scoreSingleSolution: -50,
  scoreUncontestedNoCover: -1,
  ...variant,
});

const sizeProfiles = {
  small: {
    height: 9,
    pieces: range(7, 10),
    width: 6,
  },
  medium: {
    height: 10,
    pieces: range(15, 20),
    width: 7,
  },
  large: {
    height: 11,
    pieces: range(19, 22),
    width: 8,
  },
  xlarge: {
    height: 13,
    pieces: range(23, 26),
    width: 9,
  },
};

const noAdvanced = (classification) =>
  classification.square.depth === 0 &&
  classification.dep.depth === 0 &&
  classification.oneOf.depth === 0;

const complexityProfiles = {
  easy: {
    accepts: (classification) =>
      classification.solved &&
      classification.cover.depth > 1 &&
      noAdvanced(classification),
    optimizeIterations: 0,
    requireAdvancedCandidate: false,
    scores: {
      scoreCantFit: 1,
      scoreCover: 1,
      scoreDep: 0,
      scoreMaxWidth: -1,
      scoreOneOf: 0,
      scoreSquare: 0,
    },
  },
  normal: {
    accepts: (classification) =>
      classification.solved &&
      classification.cover.depth > 5 &&
      noAdvanced(classification),
    optimizeIterations: 25,
    requireAdvancedCandidate: false,
    scores: {
      scoreCantFit: 3,
      scoreCover: 1,
      scoreDep: 0,
      scoreMaxWidth: -1,
      scoreOneOf: 0,
      scoreSquare: 0,
    },
  },
  hard: {
    accepts: (classification) =>
      classification.solved &&
      classification.square.depth > 0 &&
      classification.dep.depth === 0 &&
      classification.oneOf.depth === 0,
    optimizeIterations: 50,
    requireAdvancedCandidate: true,
    scores: {
      scoreCantFit: 3,
      scoreCover: 1,
      scoreDep: 0,
      scoreMaxWidth: -2,
      scoreOneOf: 0,
      scoreSquare: 50,
    },
  },
  expert: {
    accepts: (classification) =>
      classification.solved &&
      (classification.dep.depth > 0 || classification.oneOf.depth > 0),
    optimizeIterations: 75,
    requireAdvancedCandidate: true,
    scores: {
      scoreCantFit: 3,
      scoreCover: 1,
      scoreDep: 100,
      scoreMaxWidth: -2,
      scoreOneOf: 60,
      scoreSquare: 50,
    },
  },
};

const createSpec = (sizeName, complexityName) => {
  const size = sizeProfiles[sizeName];
  const complexity = complexityProfiles[complexityName];

  return {
    accepts: complexity.accepts,
    mode: `${sizeName}-${complexityName}`,
    requireAdvancedCandidate: complexity.requireAdvancedCandidate,
    variants: size.pieces.map((pieces) =>
      baseVariant({
        height: size.height,
        optimizeIterations: complexity.optimizeIterations,
        pieces,
        width: size.width,
        ...complexity.scores,
      }),
    ),
  };
};

const summarizeTimings = (timings) => {
  if (!timings.length) {
    return {
      avgMs: 0,
      maxMs: 0,
      minMs: 0,
    };
  }
  const sum = timings.reduce((total, value) => total + value, 0);
  return {
    avgMs: Math.round(sum / timings.length),
    maxMs: Math.round(Math.max(...timings)),
    minMs: Math.round(Math.min(...timings)),
  };
};

const results = [];

for (const sizeName of Object.keys(sizeProfiles)) {
  for (const complexityName of Object.keys(complexityProfiles)) {
    const mode = `${sizeName}-${complexityName}`;
    difficulties[mode] = createSpec(sizeName, complexityName);

    const attempts = [];
    for (let index = 0; index < samples; index++) {
      const profile = createGeneratePuzzleProfile();
      const seed = hashSeed(`${mode}:${index}:0`);
      const start = performance.now();
      const puzzle = generatePuzzle({
        attemptLimit,
        candidateAttemptLimit,
        mode,
        profile,
        seed,
      });
      const ms = performance.now() - start;

      attempts.push({
        accepted: Boolean(puzzle),
        classification: puzzle?.classification,
        ms,
        profile,
        seed,
      });
    }

    const accepted = attempts.filter((attempt) => attempt.accepted);
    results.push({
      accepted: accepted.length,
      complexity: complexityName,
      failed: attempts.length - accepted.length,
      mode,
      samples,
      size: sizeName,
      timings: summarizeTimings(attempts.map((attempt) => attempt.ms)),
      acceptedTimings: summarizeTimings(accepted.map((attempt) => attempt.ms)),
      profileTotals: attempts.reduce((totals, attempt) => {
        Object.entries(attempt.profile).forEach(([key, value]) => {
          totals[key] = (totals[key] || 0) + value;
        });
        return totals;
      }, {}),
    });
  }
}

console.log(
  JSON.stringify({ attemptLimit, candidateAttemptLimit, results }, null, 2),
);
