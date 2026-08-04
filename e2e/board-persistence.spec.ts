import { chooseMode, expect, openHome, seedStorage, test } from "./fixtures";

// Content id of "quire", the first small catalog puzzle (6x9). Deterministic
// geometry for the drags below:
//   the "4" at (0,1) completes downward through cells 0:1..3:1
//   the "2" at (0,4) completes leftward over the dot at (0,3)
const quireId = "e9c2882a25e2";

const savedBoard = {
  puzzleId: quireId,
  mode: "small",
  lines: [{ origin: "0:1", cells: ["0:1", "1:1", "2:1", "3:1"] }],
  elapsedMs: 60_000,
  savedAt: 1,
};

test("a saved board survives the process and continues", async ({ page }) => {
  await seedStorage(page, {
    __ordinaryPuzzlesE2EDisableAutoSolve: "1",
    boardState: JSON.stringify(savedBoard),
  });

  await openHome(page);
  // The restored board is the reason continue exists at all on a cold start.
  await chooseMode(page, "continue" as never);
  await expect(page.getByText("quire", { exact: true })).toBeVisible();
});

test("a committed line is persisted and restored after a reload", async ({
  page,
}) => {
  // Seed with a one-time write, not seedStorage: its init script re-runs on
  // every navigation and would stomp the app's own writes after the reload.
  await openHome(page);
  await page.evaluate((board) => {
    window.localStorage.setItem("__ordinaryPuzzlesE2EDisableAutoSolve", "1");
    window.localStorage.setItem("boardState", board);
  }, JSON.stringify(savedBoard));

  await openHome(page);
  await chooseMode(page, "continue" as never);
  await expect(page.getByText("quire", { exact: true })).toBeVisible();

  // Drag the "2" at (0,4) one cell left, over the dot at (0,3).
  const board = page.getByTestId("puzzle-board");
  await expect(board).toBeVisible();
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  const rowY = box!.y + box!.height * (0.5 / 9);
  await page.mouse.move(box!.x + box!.width * (4.5 / 6), rowY);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * (3.5 / 6), rowY, { steps: 8 });
  await page.mouse.up();

  // The commit flushes the snapshot: two lines are now stored.
  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        window.localStorage.getItem("boardState"),
      );
      return stored ? JSON.parse(stored).lines.length : 0;
    })
    .toBe(2);

  // A full reload restores both lines and the elapsed time base.
  await page.reload();
  await openHome(page);
  await chooseMode(page, "continue" as never);
  await expect(page.getByText("quire", { exact: true })).toBeVisible();
  const restored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("boardState") ?? "null"),
  );
  expect(restored.lines).toHaveLength(2);
  expect(restored.savedAt).toBeGreaterThan(1);
});

test("undo reverts a restored-and-committed line and persists it", async ({
  page,
}) => {
  await seedStorage(page, {
    __ordinaryPuzzlesE2EDisableAutoSolve: "1",
    boardState: JSON.stringify(savedBoard),
  });

  await openHome(page);
  await chooseMode(page, "continue" as never);
  const board = page.getByTestId("puzzle-board");
  await expect(board).toBeVisible();
  const box = await board.boundingBox();
  const rowY = box!.y + box!.height * (0.5 / 9);
  await page.mouse.move(box!.x + box!.width * (4.5 / 6), rowY);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * (3.5 / 6), rowY, { steps: 8 });
  await page.mouse.up();

  await page.getByText("undo", { exact: true }).click();

  // The undo is itself persisted: back to the single restored line.
  await expect
    .poll(async () => {
      const stored = await page.evaluate(() =>
        window.localStorage.getItem("boardState"),
      );
      return stored ? JSON.parse(stored).lines.length : 0;
    })
    .toBe(1);
});

test("completing a puzzle records a solve event and clears the board", async ({
  page,
}) => {
  await openHome(page);
  await chooseMode(page, "small");
  await expect(page.getByText("Completed", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  const progress = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("puzzleProgress") ?? "null"),
  );
  expect(progress.solves).toHaveLength(1);
  expect(progress.solves[0].mode).toBe("small");
  expect(progress.solves[0].id).toBe(progress.completed.small[0]);
  expect(typeof progress.solves[0].at).toBe("number");

  const boardState = await page.evaluate(() =>
    window.localStorage.getItem("boardState"),
  );
  expect(boardState).toBeNull();
});
