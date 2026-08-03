import {
  chooseMode,
  expect,
  openHome,
  openStatistics,
  seedStorage,
  test,
  waitForHome,
} from "./fixtures";

const packModes = ["small", "medium", "large", "extraordinary"] as const;

for (const mode of packModes) {
  test(`${mode} opens a pack puzzle and completes it`, async ({
    diagnostics,
    page,
  }) => {
    await openHome(page);
    await chooseMode(page, mode);
    await page.waitForTimeout(100);
    expect(diagnostics.pageErrors, "errors after choosing a mode").toEqual([]);

    await expect(
      page.getByText("Generating", { exact: true }),
    ).not.toBeVisible();
    await expect(page.getByText("Unable to generate")).not.toBeVisible();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    expect(diagnostics.generatorRequests).toEqual([]);
  });
}

test("first launch enters the tutorial and can return to the menu", async ({
  page,
}) => {
  await openHome(page);
  await chooseMode(page, "tutorial");

  await expect(page.getByText("Welcome to Ordinary Puzzle.")).toBeVisible();
  await expect(
    page.getByText('Create a line by dragging the "4" to the left.'),
  ).toBeVisible();
  await page.getByText("menu", { exact: true }).click();
  await waitForHome(page);
});

test("completes the full tutorial and persists its completion", async ({
  page,
}) => {
  test.slow();
  await openHome(page);
  await chooseMode(page, "tutorial");

  const tutorialTitles = [
    "Welcome to Ordinary Puzzle.",
    "To be valid, lines must have the length indicated on their numbers.",
    "Lines can be vertical or horizontal, but they can't overlap.",
    "Every dot of a puzzle must be covered with a line.",
    "Lines can extend in both orientations.",
    "All together now.",
    "Here's a real puzzle.",
    "That's it!",
  ];
  for (const title of tutorialTitles) {
    await expect(page.getByText(title, { exact: true })).toBeVisible({
      timeout: 8_000,
    });
  }

  await page.getByText("menu", { exact: true }).click({ force: true });
  await waitForHome(page);

  const progress = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("puzzleProgress") ?? "null"),
  );
  // Content id of the first tutorial puzzle
  expect(progress.completed.tutorial).toEqual(["c59272a8a41f"]);
});

test("solves the first tutorial board with a real pointer drag", async ({
  page,
}) => {
  await seedStorage(page, {
    __ordinaryPuzzlesE2EDisableAutoSolve: "1",
  });
  await openHome(page);
  await chooseMode(page, "tutorial");

  const board = page.getByTestId("puzzle-board");
  await expect(board).toBeVisible();
  const box = await board.boundingBox();
  expect(box).not.toBeNull();

  const row = 1.5 / 3;
  const start = {
    x: box!.x + box!.width * (3.5 / 4),
    y: box!.y + box!.height * row,
  };
  const end = {
    x: box!.x + box!.width * (0.5 / 4),
    y: start.y,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();

  await expect(
    page.getByText(
      "To be valid, lines must have the length indicated on their numbers.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 5_000 });
  await page.getByText("menu", { exact: true }).click();
  await waitForHome(page);
});

test("completion updates statistics and survives a reload", async ({
  page,
}) => {
  await openHome(page);
  await chooseMode(page, "small");
  await expect(page.getByText("Completed", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByText("menu", { exact: true }).click();
  await waitForHome(page);
  // The dealt puzzle is band-random, so read the earned score off the screen
  // instead of asserting a fixed value.
  const scoreText = await page.getByTestId("button-score").textContent();
  const score = Number((scoreText ?? "").replace(/[^0-9]/g, ""));
  expect(score).toBeGreaterThan(0);

  await openStatistics(page, score);
  await expect(page.getByText("small: 1", { exact: true })).toBeVisible();
  await expect(
    page.getByText(`score: ${score}`, { exact: true }),
  ).toBeVisible();

  await page.reload();
  await waitForHome(page);
  await expect(page.getByText(String(score), { exact: true })).toBeVisible();
});

test("menu and reset remain usable during a puzzle", async ({ page }) => {
  await seedStorage(page, {
    __ordinaryPuzzlesE2EDisableAutoSolve: "1",
  });
  await openHome(page);
  await chooseMode(page, "medium");
  await expect(page.getByText("reset", { exact: true })).toBeVisible();
  await page.getByText("reset", { exact: true }).click();
  await page.getByText("menu", { exact: true }).click();
  await waitForHome(page);
  await expect(page.getByText("continue", { exact: true })).toBeVisible();
});
