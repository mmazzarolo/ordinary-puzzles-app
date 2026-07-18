import assert from "node:assert/strict";
import path from "node:path";
import { _electron as electron } from "@playwright/test";

const executablePath = process.env.ELECTRON_EXECUTABLE_PATH;
const electronApp = await electron.launch(
  executablePath
    ? { executablePath: path.resolve(executablePath) }
    : { args: [path.resolve("public/electron.js")] },
);

try {
  const window = await electronApp.firstWindow();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  window.on("pageerror", (error) => pageErrors.push(error.message));
  window.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  window.on("requestfailed", (request) => {
    failedRequests.push(`${request.failure()?.errorText}: ${request.url()}`);
  });
  await window.route("https://stats.ordinarypuzzles.com/**", (route) =>
    route.fulfill({ body: "", contentType: "application/javascript" }),
  );

  try {
    await window.reload({ waitUntil: "domcontentloaded" });
    await window.getByText("small", { exact: true }).waitFor();
  } catch (error) {
    const body = await window.locator("body").innerText().catch(() => "");
    throw new Error(
      `Electron home did not load. URL: ${window.url()}\nBody: ${body}\nPage errors: ${pageErrors.join(" | ")}\nConsole errors: ${consoleErrors.join(" | ")}\nFailed requests: ${failedRequests.join(" | ")}`,
      { cause: error },
    );
  }
  await window.getByText("large", { exact: true }).waitFor();

  assert.equal(new URL(window.url()).protocol, "file:");
  assert.equal(await window.getByText("expert", { exact: true }).count(), 0);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
} finally {
  await electronApp.close();
}
