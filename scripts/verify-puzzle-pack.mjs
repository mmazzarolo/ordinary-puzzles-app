// Verifies the committed puzzle pack. Run by CI on every push and locally
// after any pack rebuild:
//
//   pnpm run verify:puzzle-pack
//
// Checks, in order:
//  1. Every record's id equals the content hash of its rows (ids are the
//     progress keys on player devices and may never drift).
//  2. Ids are unique across the whole pack; names are unique per tier.
//  3. Every board passes the solver (single deducible solution).
//  4. Stored techniques and rating match a fresh classification.
//  5. Append-only: against the pack committed at HEAD, existing records are
//     byte-identical — the only permitted change is adding `retired: true`.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  computeRating,
  derivePuzzleId,
  loadTsTooling,
  toTechniques,
} from "./pack-lib.mjs";

const rootDir = process.cwd();
const packRelativePath = path.join("src", "op-puzzle-pack", "puzzle-pack.json");
const packPath =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? path.resolve(process.argv[2])
    : path.join(rootDir, packRelativePath);

if (!existsSync(packPath)) {
  console.log(`No pack at ${packPath}; nothing to verify.`);
  process.exit(0);
}

const pack = JSON.parse(readFileSync(packPath, "utf8"));
const { classifyRows } = loadTsTooling(rootDir);

const problems = [];
const globalIds = new Map();

for (const [mode, records] of Object.entries(pack.modes)) {
  const names = new Set();
  records.forEach((record, position) => {
    const label = `${mode}[${position}] "${record.name}"`;

    const expectedId = derivePuzzleId({ rows: record.rows });
    if (record.id !== expectedId) {
      problems.push(`${label}: id ${record.id} != content hash ${expectedId}`);
    }
    if (globalIds.has(record.id)) {
      problems.push(`${label}: id also used by ${globalIds.get(record.id)}`);
    }
    globalIds.set(record.id, label);

    if (names.has(record.name)) {
      problems.push(`${label}: duplicate name in ${mode}`);
    }
    names.add(record.name);

    const classification = classifyRows(record.rows);
    if (!classification.solved) {
      problems.push(`${label}: board is not solvable by the solver`);
      return;
    }
    const techniques = toTechniques(classification);
    if (JSON.stringify(techniques) !== JSON.stringify(record.techniques)) {
      problems.push(`${label}: stored techniques do not match classification`);
    }
    if (record.rating !== computeRating(techniques)) {
      problems.push(`${label}: stored rating does not match the weights`);
    }
  });
}

// Append-only check against the version committed at HEAD (skipped when the
// pack is new or git is unavailable).
const previousShow = spawnSync("git", ["show", `HEAD:${packRelativePath}`], {
  cwd: rootDir,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (previousShow.status === 0) {
  const previous = JSON.parse(previousShow.stdout);
  for (const [mode, previousRecords] of Object.entries(previous.modes ?? {})) {
    const currentRecords = pack.modes[mode] ?? [];
    if (currentRecords.length < previousRecords.length) {
      problems.push(
        `${mode}: shrank from ${previousRecords.length} to ${currentRecords.length} records`,
      );
      continue;
    }
    previousRecords.forEach((previousRecord, position) => {
      const currentRecord = { ...currentRecords[position] };
      // The single permitted in-place change: retiring a puzzle hides it from
      // the picker while keeping its id and completions.
      if (
        currentRecord.retired === true &&
        previousRecord.retired === undefined
      ) {
        delete currentRecord.retired;
      }
      if (JSON.stringify(currentRecord) !== JSON.stringify(previousRecord)) {
        problems.push(
          `${mode}[${position}] "${previousRecord.name}": committed record was modified (append-only)`,
        );
      }
    });
  }
}

if (problems.length > 0) {
  console.error(`Pack verification failed with ${problems.length} problem(s):`);
  problems.slice(0, 20).forEach((problem) => console.error(`- ${problem}`));
  if (problems.length > 20) console.error(`… and ${problems.length - 20} more`);
  process.exit(1);
}

const total = Object.values(pack.modes).reduce(
  (sum, records) => sum + records.length,
  0,
);
console.log(
  `Pack OK: ${total} puzzles across ${Object.keys(pack.modes).length} tiers.`,
);
