// The single source of the content-id rule outside the app bundle. The unit
// test at src/op-core/puzzleIds.test.ts pins the same rule independently:
// progress is keyed by these ids, so the rule may never change.
import { createHash } from "node:crypto";

export const derivePuzzleId = (record) => {
  const content = Array.isArray(record.data ?? record.rows)
    ? `op-puzzle-v1\n${(record.data ?? record.rows).join("\n")}`
    : `op-message-v1\n${record.title ?? ""}\n${record.message ?? ""}`;
  return createHash("sha256")
    .update(content, "utf8")
    .digest("hex")
    .slice(0, 12);
};
