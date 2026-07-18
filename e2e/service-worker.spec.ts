import { expect, test, waitForHome } from "./fixtures";

const activateAndFillCache = async (page: import("@playwright/test").Page) => {
  await page.goto("/play/");
  await waitForHome(page);

  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return {
      scope: ready.scope,
      scriptURL: (ready.active ?? ready.waiting ?? ready.installing)?.scriptURL,
    };
  });

  if (
    !(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
  ) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHome(page);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForHome(page);
  return registration;
};

test("registers under /play and owns its cache", async ({ page }) => {
  const registration = await activateAndFillCache(page);

  expect(registration.scope).toBe("http://127.0.0.1:8098/play/");
  expect(registration.scriptURL).toBe(
    "http://127.0.0.1:8098/play/service-worker.js",
  );
  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .toContain("ordinary-puzzles-app-v2");
});

test("activation removes only owned legacy caches", async ({ page }) => {
  await page.goto("/play/");
  await waitForHome(page);
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
    await Promise.all([
      caches.open("ordinary-puzzles-app-v1"),
      caches.open("ordinary-puzzles-v1"),
      caches.open("unrelated-app-cache"),
    ]);

    const registration = await navigator.serviceWorker.register(
      "/play/service-worker.js?cache-cleanup-test",
      { scope: "/play/" },
    );
    const worker =
      registration.installing ?? registration.waiting ?? registration.active;
    if (worker && worker.state !== "activated") {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("service worker activation timed out")),
          10_000,
        );
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated") {
            window.clearTimeout(timeout);
            resolve();
          }
        });
      });
    }
  });

  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).sort()))
    .toEqual(["ordinary-puzzles-app-v2", "unrelated-app-cache"]);
});

test("does not cache failed asset responses", async ({ diagnostics, page }) => {
  diagnostics.allowConsoleError(/^Failed to load resource:/);
  diagnostics.allowFailedResponse(/404 .*\/play\/missing-e2e-asset\.png/);
  await activateAndFillCache(page);

  const result = await page.evaluate(async () => {
    const url = new URL("missing-e2e-asset.png", window.location.href).href;
    const response = await fetch(url);
    const cache = await caches.open("ordinary-puzzles-app-v2");
    return {
      cached: Boolean(await cache.match(url)),
      status: response.status,
    };
  });
  expect(result).toEqual({ cached: false, status: 404 });
});

test("activates a changed payload and retires the previous owned cache", async ({
  context,
  page,
}) => {
  await activateAndFillCache(page);
  await page.evaluate(() => caches.open("unrelated-app-cache"));
  await context.addCookies([
    {
      name: "ordinary-puzzles-e2e-sw-version",
      value: "v3",
      domain: "127.0.0.1",
      path: "/play",
    },
  ]);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const controllerChanged = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("updated service worker did not take control")),
        10_000,
      );
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });

    await registration.update();
    const waitingWorker = await new Promise<ServiceWorker>(
      (resolve, reject) => {
        const timeout = window.setTimeout(
          () =>
            reject(new Error("updated service worker did not start waiting")),
          10_000,
        );
        const check = () => {
          if (registration.waiting) {
            window.clearTimeout(timeout);
            resolve(registration.waiting);
            return;
          }
          window.setTimeout(check, 50);
        };
        check();
      },
    );
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    await controllerChanged;
  });

  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).sort()))
    .toEqual(["ordinary-puzzles-app-v3", "unrelated-app-cache"]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForHome(page);
  await expect
    .poll(() =>
      page.evaluate(async () => ({
        controlled: Boolean(navigator.serviceWorker.controller),
        keys: (await caches.keys()).sort(),
      })),
    )
    .toEqual({
      controlled: true,
      keys: ["ordinary-puzzles-app-v3", "unrelated-app-cache"],
    });
});

test("reloads from cache when the origin connection fails", async ({
  context,
  diagnostics,
  page,
}) => {
  diagnostics.allowOfflineFailures();
  diagnostics.allowConsoleError(/^Failed to load resource:/);
  await activateAndFillCache(page);
  await context.addCookies([
    {
      name: "ordinary-puzzles-e2e-network-failure",
      value: "1",
      domain: "127.0.0.1",
      path: "/play",
    },
  ]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForHome(page);
});

test("reloads offline from its service-worker cache", async ({
  context,
  diagnostics,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Playwright Firefox/WebKit reject top-level navigation before the service worker can answer while protocol-level offline emulation is active.",
  );
  diagnostics.allowOfflineFailures();
  await activateAndFillCache(page);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHome(page);
  } finally {
    await context.setOffline(false);
  }
});
