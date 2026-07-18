import { expect, openHome, test } from "./fixtures";

const viewports = [
  { name: "small phone", width: 320, height: 568 },
  { name: "common phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "wide desktop", width: 1440, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`home fits a ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: "light" });
    await openHome(page);

    for (const label of ["tutorial", "small", "medium", "large"]) {
      const box = await page.getByText(label, { exact: true }).boundingBox();
      expect(box, `${label} should have a layout box`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(page.getByText("about", { exact: true })).toBeInViewport();
    await page.waitForTimeout(1_100);
    await expect(page).toHaveScreenshot(
      `home-${viewport.name.replaceAll(" ", "-")}.png`,
      {
        animations: "disabled",
        caret: "hide",
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      },
    );
  });
}

test("reacts to light and dark color-scheme changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openHome(page);
  const lightBackground = await page
    .locator("body > div")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      page
        .locator("body > div")
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(lightBackground);
});
