import {
  expect,
  test as base,
  type Page,
  type Request,
} from "@playwright/test";

interface Diagnostics {
  allowConsoleError: (pattern: RegExp) => void;
  allowFailedResponse: (pattern: RegExp) => void;
  allowOfflineFailures: () => void;
  generatorRequests: string[];
  pageErrors: string[];
}

const isLocalRequest = (request: Request) =>
  new URL(request.url()).origin === "http://127.0.0.1:8098";

export const test = base.extend<{ diagnostics: Diagnostics }>({
  diagnostics: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedResponses: string[] = [];
    const failedRequests: string[] = [];
    const generatorRequests: string[] = [];
    const allowedConsoleErrors: RegExp[] = [];
    const allowedFailedResponses: RegExp[] = [];
    let offlineFailuresAllowed = false;

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) =>
      pageErrors.push(error.stack || `${error.name}: ${error.message}`),
    );
    page.on("response", (response) => {
      if (response.status() >= 400 && isLocalRequest(response.request())) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on("requestfailed", (request) => {
      if (isLocalRequest(request)) {
        failedRequests.push(
          `${request.failure()?.errorText ?? "request failed"} ${request.url()}`,
        );
      }
    });

    await page.route("https://stats.ordinarypuzzles.com/**", async (route) => {
      await route.fulfill({
        body: "",
        contentType: "application/javascript",
        status: 200,
      });
    });
    await page.route("**/puzzleGenerator-*.js", async (route) => {
      generatorRequests.push(route.request().url());
      await route.abort();
    });

    await use({
      allowConsoleError: (pattern) => allowedConsoleErrors.push(pattern),
      allowFailedResponse: (pattern) => allowedFailedResponses.push(pattern),
      allowOfflineFailures: () => {
        offlineFailuresAllowed = true;
      },
      generatorRequests,
      pageErrors,
    });

    const unexpectedConsoleErrors = consoleErrors.filter(
      (message) =>
        !allowedConsoleErrors.some((pattern) => pattern.test(message)),
    );
    expect(
      unexpectedConsoleErrors,
      "unexpected browser console errors",
    ).toEqual([]);
    expect(pageErrors, "uncaught page errors").toEqual([]);
    const unexpectedFailedResponses = failedResponses.filter(
      (response) =>
        !allowedFailedResponses.some((pattern) => pattern.test(response)),
    );
    expect(
      unexpectedFailedResponses,
      "unexpected failed same-origin responses",
    ).toEqual([]);
    if (!offlineFailuresAllowed) {
      expect(failedRequests, "failed same-origin requests").toEqual([]);
    }
    expect(generatorRequests, "legacy runtime generator requests").toEqual([]);
  },
});

export { expect };

export const waitForHome = async (page: Page) => {
  await expect(page.getByText("small", { exact: true })).toBeVisible();
  await expect(page.getByText("large", { exact: true })).toBeVisible();
};

export const openHome = async (page: Page) => {
  await page.goto("/play/");
  await waitForHome(page);
};

export const chooseMode = async (
  page: Page,
  mode: "small" | "medium" | "large" | "tutorial",
) => {
  await expect(page.getByText(mode, { exact: true })).toBeVisible();
  // The first-launch menu intentionally animates before accepting input.
  await page.waitForTimeout(1_000);
  await page.getByText(mode, { exact: true }).click();
};

export const openStatistics = async (page: Page, score: number) => {
  // Home paints the score before its route-transition interaction gate opens.
  await page.waitForTimeout(1_100);
  await page.getByText(String(score), { exact: true }).click();
  await expect(page.getByText("Statistics", { exact: true })).toBeVisible();
};

export const seedStorage = async (
  page: Page,
  entries: Record<string, string>,
) => {
  await page.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) {
      window.localStorage.setItem(key, value);
    }
  }, entries);
};
