import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const destinationDirectory = path.join(projectRoot, "assets", "fonts");
const privateAssetsDirectory = path.resolve(
  projectRoot,
  process.env.ORDINARY_PUZZLES_ASSETS_DIR || "../ordinary-puzzles-assets",
);
const privateFontsDirectory = path.join(privateAssetsDirectory, "fonts");
const fallbackFontPath = path.join(destinationDirectory, "Inter-SemiBold.otf");
const allowFallback = process.env.ALLOW_FONT_FALLBACK === "1";

const fonts = [
  ["Averta Bold.otf", "Averta-Bold.otf"],
  ["Averta.otf", "Averta-Regular.otf"],
  ["Averta Semibold.otf", "Averta-Semibold.otf"],
];

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

await mkdir(destinationDirectory, { recursive: true });

for (const [sourceName, destinationName] of fonts) {
  const privateFontPath = path.join(privateFontsDirectory, sourceName);
  const destinationPath = path.join(destinationDirectory, destinationName);
  if (await exists(privateFontPath)) {
    await copyFile(privateFontPath, destinationPath);
    continue;
  }
  if (allowFallback) {
    await copyFile(fallbackFontPath, destinationPath);
    continue;
  }
  throw new Error(
    `Missing ${privateFontPath}. Set ORDINARY_PUZZLES_ASSETS_DIR to the private assets project, or ALLOW_FONT_FALLBACK=1 for non-release behavioral tests.`,
  );
}

console.log(
  allowFallback &&
    !(await exists(path.join(privateFontsDirectory, fonts[0][0])))
    ? "Provisioned explicit Inter fallbacks for behavioral testing."
    : `Provisioned Averta fonts from ${privateFontsDirectory}.`,
);
