import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceFile = path.join(
  rootDir,
  "tools",
  "puzzle-generator",
  "native_generator.cpp",
);
const outputDir = path.join(rootDir, "build", "native-generator");
const outputFile = path.join(outputDir, "native_generator");

mkdirSync(outputDir, { recursive: true });

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

const run = spawnSync(outputFile, process.argv.slice(2), {
  cwd: rootDir,
  stdio: "inherit",
});

process.exit(run.status || 0);
