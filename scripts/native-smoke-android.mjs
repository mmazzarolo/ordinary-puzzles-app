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

if (!existsSync(apkPath)) {
  throw new Error(`Release APK not found: ${apkPath}`);
}

run("adb", ["get-state"]);
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
