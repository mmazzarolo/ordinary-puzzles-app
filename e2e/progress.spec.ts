import {
  chooseMode,
  expect,
  openHome,
  openStatistics,
  seedStorage,
  test,
} from "./fixtures";

const emptyHistory = {
  tutorial: [],
  small: [],
  medium: [],
  large: [],
};

test("loads legacy progress without rewriting its storage schema", async ({
  page,
}) => {
  const legacyPlayed = JSON.stringify({
    ...emptyHistory,
    small: [0],
    medium: [0],
    large: [0],
  });
  const legacyCompleted = legacyPlayed;
  await seedStorage(page, {
    playedPuzzles: legacyPlayed,
    completedPuzzles: legacyCompleted,
  });

  await openHome(page);
  await expect(page.getByText("68", { exact: true })).toBeVisible();
  await openStatistics(page, 68);
  await expect(page.getByText("small: 1", { exact: true })).toBeVisible();
  await expect(page.getByText("medium: 1", { exact: true })).toBeVisible();
  await expect(page.getByText("large: 1", { exact: true })).toBeVisible();
  await expect(
    page.getByText("extraordinary: 0", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("score: 68", { exact: true })).toBeVisible();

  const stored = await page.evaluate(() => ({
    current: window.localStorage.getItem("puzzleProgress"),
    played: window.localStorage.getItem("playedPuzzles"),
    completed: window.localStorage.getItem("completedPuzzles"),
  }));
  expect(stored.current).toBeNull();
  expect(stored.played).toBe(legacyPlayed);
  expect(stored.completed).toBe(legacyCompleted);
});

test("deals a fresh puzzle on top of migrated legacy history", async ({
  page,
}) => {
  await seedStorage(page, {
    playedPuzzles: JSON.stringify({ ...emptyHistory, small: [0, 1] }),
    completedPuzzles: JSON.stringify({ ...emptyHistory, small: [0] }),
  });

  await openHome(page);
  await chooseMode(page, "small");
  await expect(page.getByText("Completed", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  const progress = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("puzzleProgress") ?? "null"),
  );
  expect(progress.version).toBe(2);
  // The migrated history (content ids of quire and placket) stays intact, and
  // the dealt puzzle is a new third entry chosen by the difficulty bands.
  expect(progress.played.small.slice(0, 2)).toEqual([
    "e9c2882a25e2",
    "93467cd1f2c0",
  ]);
  expect(progress.played.small).toHaveLength(3);
  expect(progress.completed.small).toEqual([
    "e9c2882a25e2",
    progress.played.small[2],
  ]);
});

test("recovers from malformed and partial legacy history", async ({ page }) => {
  await seedStorage(page, {
    playedPuzzles: JSON.stringify({ small: [0, 0, -1, 999] }),
    completedPuzzles: "{malformed-json",
  });

  await openHome(page);
  await chooseMode(page, "small");
  await expect(page.getByText("Completed", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  const progress = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("puzzleProgress") ?? "null"),
  );
  // The one valid legacy entry (content id of quire) survives the recovery,
  // and exactly one freshly dealt puzzle was completed.
  expect(progress.played.small[0]).toBe("e9c2882a25e2");
  expect(progress.played.small).toHaveLength(2);
  expect(progress.completed.small).toEqual([progress.played.small[1]]);
});
