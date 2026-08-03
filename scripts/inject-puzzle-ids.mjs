// Assigns a stable content-derived id to every puzzle record in
// src/op-core/puzzles.json. The id is the puzzle's identity for progress
// tracking: names are display-only and free to change, the id never does.
//
// id = first 12 hex chars of sha256 over the normalized content:
//   - board records:   "op-puzzle-v1\n" + rows joined with "\n"
//   - message records: "op-message-v1\n" + title + "\n" + message
//
// Idempotent: recomputes ids from content on every run. A unit test
// re-derives the ids and fails if a record's id and content disagree.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { derivePuzzleId } from "./puzzle-id.mjs";

const puzzlesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/op-core/puzzles.json",
);

const puzzles = JSON.parse(readFileSync(puzzlesPath, "utf8"));

for (const [mode, records] of Object.entries(puzzles)) {
  const seen = new Map();
  puzzles[mode] = records.map((record) => {
    const { id: _oldId, ...rest } = record;
    const id = derivePuzzleId(record);
    if (seen.has(id)) {
      throw new Error(
        `Duplicate content in mode "${mode}": records ${seen.get(id)} and "${record.name}" share id ${id}`,
      );
    }
    seen.set(id, `"${record.name}"`);
    return { id, ...rest };
  });
}

writeFileSync(puzzlesPath, JSON.stringify(puzzles, null, 2) + "\n");
console.log("Injected content ids into", puzzlesPath);
