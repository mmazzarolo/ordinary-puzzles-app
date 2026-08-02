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
  await expect(page.getByText("small: 1/99", { exact: true })).toBeVisible();
  await expect(page.getByText("medium: 1/99", { exact: true })).toBeVisible();
  await expect(page.getByText("large: 1/99", { exact: true })).toBeVisible();
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

test("selects the next unplayed legacy puzzle without losing history", async ({
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
  await expect(page.getByText("bumfuzzle", { exact: true })).toBeVisible();

  const progress = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("puzzleProgress") ?? "null"),
  );
  expect(progress.version).toBe(2);
  expect(progress.played.small).toEqual(["quire", "placket", "bumfuzzle"]);
  expect(progress.completed.small).toEqual(["quire", "bumfuzzle"]);
});

test("recovers from malformed and partial legacy history", async ({ page }) => {
  await seedStorage(page, {
    playedPuzzles: JSON.stringify({ small: [0, 0, -1, 999] }),
    completedPuzzles: "{malformed-json",
  });

  await openHome(page);
  await chooseMode(page, "small");
  await expect(page.getByText("placket", { exact: true })).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  const progress = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("puzzleProgress") ?? "null"),
  );
  expect(progress.completed.small).toEqual(["placket"]);
});
