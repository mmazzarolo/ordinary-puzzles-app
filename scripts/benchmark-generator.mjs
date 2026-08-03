import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";

const rootDir = process.cwd();
const sourceDir = path.join(
  rootDir,
  "tools",
  "puzzle-generator",
  "ts-generator",
);
const sourceRoot = path.join("tools", "puzzle-generator", "ts-generator");
const outputDir = path.join(rootDir, "build", "generator-bench");

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const modes = (args.get("modes") || "small,medium,large")
  .split(",")
  .map((mode) => mode.trim())
  .filter(Boolean);
const defaultSamples = Number(args.get("samples") || 10);
const largeSamples = Number(args.get("large-samples") || 3);
const optimizeIterations = args.has("optimize-iterations")
  ? Number(args.get("optimize-iterations"))
  : undefined;
const requireAdvancedCandidate = args.has("require-advanced-candidate")
  ? args.get("require-advanced-candidate") !== "false"
  : undefined;

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
const { createGeneratePuzzleProfile, generatePuzzle, hashSeed } = require(
  path.join(outputDir, "index.js"),
);

const percentile = (values, position) => {
  const index = Math.min(
    values.length - 1,
    Math.floor(values.length * position),
  );
  return values[index];
};

const summarize = (results) => {
  const sorted = results.map((result) => result.ms).sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    avgMs: Math.round(sum / sorted.length),
    maxMs: Math.round(sorted[sorted.length - 1]),
    minMs: Math.round(sorted[0]),
    p50Ms: Math.round(percentile(sorted, 0.5)),
    p90Ms: Math.round(percentile(sorted, 0.9)),
  };
};

for (const mode of modes) {
  const sampleCount = mode === "large" ? largeSamples : defaultSamples;
  const results = [];

  for (let index = 0; index < sampleCount; index++) {
    const profile = createGeneratePuzzleProfile();
    const seed = hashSeed(`${mode}:${index}:0`);
    const start = performance.now();
    const puzzle = generatePuzzle({
      mode,
      seed,
      ...(optimizeIterations !== undefined ? { optimizeIterations } : {}),
      ...(requireAdvancedCandidate !== undefined
        ? { requireAdvancedCandidate }
        : {}),
      profile,
    });
    const ms = performance.now() - start;
    results.push({
      accepted: Boolean(puzzle),
      index,
      ms,
      profile,
      seed,
    });
  }

  const accepted = results.filter((result) => result.accepted).length;
  const profileTotals = results.reduce((totals, result) => {
    Object.entries(result.profile).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + value;
    });
    return totals;
  }, {});

  console.log(
    JSON.stringify(
      {
        accepted,
        failed: results.length - accepted,
        mode,
        samples: sampleCount,
        timings: summarize(results),
        profileTotals,
        slowest: results
          .slice()
          .sort((a, b) => b.ms - a.ms)
          .slice(0, 3)
          .map((result) => ({
            accepted: result.accepted,
            index: result.index,
            ms: Math.round(result.ms),
            profile: result.profile,
            seed: result.seed,
          })),
      },
      null,
      2,
    ),
  );
}
