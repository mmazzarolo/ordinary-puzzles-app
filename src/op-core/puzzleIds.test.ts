import { createHash } from "crypto";
import puzzles from "./puzzles.json";

// Mirrors scripts/inject-puzzle-ids.mjs. Progress is keyed by these ids, so a
// record whose id and content disagree would corrupt user history: run
// `node scripts/inject-puzzle-ids.mjs` after any content change.
const derivePuzzleId = (record: {
  data?: string[] | null;
  title?: string;
  message?: string;
}) => {
  const content = Array.isArray(record.data)
    ? `op-puzzle-v1\n${record.data.join("\n")}`
    : `op-message-v1\n${record.title ?? ""}\n${record.message ?? ""}`;
  return createHash("sha256")
    .update(content, "utf8")
    .digest("hex")
    .slice(0, 12);
};

const modes = ["tutorial", "small", "medium", "large"] as const;

describe("puzzle content ids", () => {
  modes.forEach((mode) => {
    it(`${mode}: every id matches its content`, () => {
      puzzles[mode].forEach((record) => {
        expect(record.id).toBe(derivePuzzleId(record));
      });
    });

    it(`${mode}: ids are unique`, () => {
      const ids = puzzles[mode].map((record) => record.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
