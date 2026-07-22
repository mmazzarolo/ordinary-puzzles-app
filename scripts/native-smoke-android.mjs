import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const packageName = "com.mmazzarolo.ordinarypuzzles";
const activityName = `${packageName}/.MainActivity`;
const remoteHierarchyPath = "/sdcard/ordinary-puzzles-smoke.xml";
const apkPath = path.resolve(
  process.env.ANDROID_APK ||
    "android/app/build/outputs/apk/release/app-release.apk",
);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      [`${command} ${args.join(" ")} failed`, result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout.trim();
};

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForAndroidBoot = async (timeoutMilliseconds = 90_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const bootCompleted = spawnSync(
      "adb",
      ["shell", "getprop", "sys.boot_completed"],
      { encoding: "utf8" },
    );
    const packageManagerReady = spawnSync(
      "adb",
      ["shell", "cmd", "package", "list", "packages", packageName],
      { encoding: "utf8" },
    );
    if (
      bootCompleted.status === 0 &&
      bootCompleted.stdout.trim() === "1" &&
      packageManagerReady.status === 0
    ) {
      return;
    }
    await delay(1_000);
  }
  throw new Error("Timed out waiting for Android to finish booting");
};

const dumpHierarchy = () => {
  run("adb", ["shell", "uiautomator", "dump", remoteHierarchyPath]);
  return run("adb", ["exec-out", "cat", remoteHierarchyPath]);
};

const findNode = (hierarchy, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const node = hierarchy.match(
    new RegExp(
      `<node[^>]*(?:text|content-desc)="${escapedLabel}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*/>`,
    ),
  );
  if (!node) return undefined;
  return {
    x: Math.round((Number(node[1]) + Number(node[3])) / 2),
    y: Math.round((Number(node[2]) + Number(node[4])) / 2),
  };
};

const findResourceNode = (hierarchy, resourceId) => {
  const escapedResourceId = resourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const node = hierarchy.match(
    new RegExp(
      `<node[^>]*resource-id="${escapedResourceId}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*>`,
    ),
  );
  if (!node) return undefined;
  return {
    left: Number(node[1]),
    top: Number(node[2]),
    right: Number(node[3]),
    bottom: Number(node[4]),
  };
};

const waitForNode = async (label, timeoutMilliseconds = 15_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const hierarchy = dumpHierarchy();
    const blockingDialog = hierarchy.match(
      /text="([^"]*(?:isn't responding|keeps stopping)[^"]*)"/i,
    )?.[1];
    if (blockingDialog) {
      throw new Error(
        `Android system dialog blocked native smoke: ${blockingDialog}`,
      );
    }
    const node = findNode(hierarchy, label);
    if (node) return node;
    await delay(300);
  }
  throw new Error(`Timed out waiting for native node: ${label}`);
};

const tapNode = async (label) => {
  const node = await waitForNode(label);
  run("adb", ["shell", "input", "tap", String(node.x), String(node.y)]);
};

const waitForResourceNode = async (
  resourceId,
  timeoutMilliseconds = 15_000,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    const node = findResourceNode(dumpHierarchy(), resourceId);
    if (node) return node;
    await delay(300);
  }
  throw new Error(`Timed out waiting for native resource: ${resourceId}`);
};

const solveFirstSmallPuzzle = async () => {
  const board = await waitForResourceNode("puzzle-board");
  const rows = 9;
  const cols = 6;
  const center = (row, col) => ({
    x: Math.round(
      board.left + ((col + 0.5) / cols) * (board.right - board.left),
    ),
    y: Math.round(
      board.top + ((row + 0.5) / rows) * (board.bottom - board.top),
    ),
  });
  const swipe = async (fromRow, fromCol, toRow, toCol) => {
    const from = center(fromRow, fromCol);
    const to = center(toRow, toCol);
    run("adb", [
      "shell",
      "input",
      "swipe",
      String(from.x),
      String(from.y),
      String(to.x),
      String(to.y),
      "250",
    ]);
    await delay(100);
  };

  // Unique solution for the first small puzzle ("quire"). Lines whose
  // numbered origin is in the middle are extended in both directions.
  await swipe(0, 1, 0, 3);
  await swipe(0, 1, 0, 0);
  await swipe(0, 4, 0, 5);
  await swipe(1, 4, 1, 3);
  await swipe(3, 3, 3, 1);
  await swipe(3, 5, 1, 5);
  await swipe(3, 5, 5, 5);
  await swipe(7, 5, 6, 5);
  await swipe(7, 5, 8, 5);
  await swipe(8, 3, 6, 3);
};

if (!existsSync(apkPath)) {
  throw new Error(`Release APK not found: ${apkPath}`);
}

run("adb", ["wait-for-device"]);
await waitForAndroidBoot();
const sdk = Number(run("adb", ["shell", "getprop", "ro.build.version.sdk"]));
if (!Number.isInteger(sdk) || sdk < 24) {
  throw new Error(
    `Android API 24+ is required; connected device reports ${sdk}`,
  );
}

// Fresh emulators otherwise show a one-time system-owned full-screen prompt that
// hides the app's accessibility tree from UI Automator.
run("adb", [
  "shell",
  "settings",
  "put",
  "secure",
  "immersive_mode_confirmations",
  "confirmed",
]);

run("adb", ["install", "-r", apkPath]);
run("adb", ["shell", "pm", "clear", packageName]);
run("adb", ["logcat", "-c"]);
const launchOutput = run("adb", [
  "shell",
  "am",
  "start",
  "-W",
  "-n",
  activityName,
]);

await tapNode("small");
await solveFirstSmallPuzzle();
await waitForNode("Completed");
await tapNode("menu");
await waitForNode("small");
await waitForNode("8");

const processId = run("adb", ["shell", "pidof", packageName]);
const errorLog = processId
  ? run("adb", ["logcat", "-d", "--pid", processId, "*:E"])
  : "";
if (/FATAL EXCEPTION|AndroidRuntime/.test(errorLog)) {
  throw new Error(`Fatal Android log detected:\n${errorLog}`);
}

const launchTime = launchOutput.match(/TotalTime: (\d+)/)?.[1] ?? "unknown";
console.log(
  `Android native smoke passed on API ${sdk}; cold launch ${launchTime} ms; completion persisted.`,
);
