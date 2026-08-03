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

// These exact ids shipped inside players' progress documents. They may NEVER
// change: a different value silently orphans real progress. If this test
// fails, the fix is to revert the content change, never to update this list.
const shippedIds: Record<string, string> = {
  "tutorial[0]": "c59272a8a41f",
  "tutorial[last]": "dab4dd35c3ca",
  "small[0]": "e9c2882a25e2",
  "medium[0]": "36aab10b5bd4",
  "large[0]": "e653beb422ba",
};

describe("shipped puzzle ids are frozen", () => {
  it("first records and the tutorial end card keep their shipped ids", () => {
    expect(puzzles.tutorial[0].id).toBe(shippedIds["tutorial[0]"]);
    expect(puzzles.tutorial[puzzles.tutorial.length - 1].id).toBe(
      shippedIds["tutorial[last]"],
    );
    expect(puzzles.small[0].id).toBe(shippedIds["small[0]"]);
    expect(puzzles.medium[0].id).toBe(shippedIds["medium[0]"]);
    expect(puzzles.large[0].id).toBe(shippedIds["large[0]"]);
  });
});

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
