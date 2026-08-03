// Shared helpers for building and verifying puzzle packs. Used by
// generate-puzzle-pack-sample.mjs, build-puzzle-pack.mjs, and
// verify-puzzle-pack.mjs.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { derivePuzzleId } from "./puzzle-id.mjs";

// One weight set across every tier, applied to the solver-classification
// depths. The rating is an ORDERING number: it drives the serving order and
// difficulty bands, is never displayed to the player, and does not need to be
// comparable across weight revisions. Advanced deductions dominate chain
// length on purpose — a puzzle needing one "dep" chain is harder than a long
// chain of simple covers.
export const ratingWeights = {
  cover: 1,
  cantFit: 3,
  uncontestedNoCover: 2,
  square: 15,
  oneOf: 25,
  dep: 40,
  singleSolution: 20,
  maxWidth: 1,
};

export const computeRating = (techniques) =>
  Object.entries(ratingWeights).reduce(
    (total, [technique, weight]) =>
      total + (techniques[technique] || 0) * weight,
    0,
  );

export const toTechniques = (classification) => ({
  cover: classification.cover.depth,
  cantFit: classification.cantFit.depth,
  square: classification.square.depth,
  dep: classification.dep.depth,
  oneOf: classification.oneOf.depth,
  uncontestedNoCover: classification.uncontestedNoCover.depth,
  singleSolution: classification.singleSolution.depth,
  maxWidth: classification.all.maxWidth,
});

// The TS reference generator (solver/classifier) and op-friendly-alias are
// TypeScript with extensionless imports, so compile them with the repo's own
// tsc before requiring them.
export const loadTsTooling = (rootDir) => {
  const tsBuildDir = path.join(rootDir, "build", "pack-tools");
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
  const requireCompiled = createRequire(import.meta.url);
  const generator = requireCompiled(
    path.join(tsBuildDir, "tools/puzzle-generator/ts-generator/index.js"),
  );
  const friendlyAlias = requireCompiled(
    path.join(tsBuildDir, "src/op-friendly-alias/index.js"),
  );
  return { classifyRows: generator.classifyRows, ...friendlyAlias };
};

// Display names are cosmetic (identity is the content id), but they must be
// unique per tier for player-facing quality. On a collision, reroll through a
// derived namespace.
export const createNameAssigner = (createFriendlyAlias) => {
  return (mode, seed, usedNames) => {
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
};

export { derivePuzzleId };
