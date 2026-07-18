import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve("dist-web");
const publicPath = normalizePublicPath(process.env.WEB_PUBLIC_PATH);

function normalizePublicPath(value) {
  if (!value || value === "/") return "";
  if (value === ".") return ".";
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.endsWith("/") ? prefixed.slice(0, -1) : prefixed;
}

function prefixRootAssetReferences(html) {
  if (!publicPath) return html;
  return html
    .replaceAll('href="/', `href="${publicPath}/`)
    .replaceAll('src="/', `src="${publicPath}/`);
}

function prefixBundleAssetReferences(source) {
  if (!publicPath) return source;
  return source
    .replaceAll('"/assets/', `"${publicPath}/assets/`)
    .replaceAll("'/assets/", `'${publicPath}/assets/`);
}

async function findFiles(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findFiles(entryPath, extension);
      return entry.name.endsWith(extension) ? [entryPath] : [];
    }),
  );
  return files.flat();
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return files.flat();
}

const indexPath = path.join(outputDir, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
await writeFile(indexPath, prefixRootAssetReferences(indexHtml));

const jsFiles = await findFiles(path.join(outputDir, "_expo"), ".js");
await Promise.all(
  jsFiles.map(async (filePath) => {
    const source = await readFile(filePath, "utf8");
    await writeFile(filePath, prefixBundleAssetReferences(source));
  }),
);

const serviceWorkerPath = path.join(outputDir, "service-worker.js");
const serviceWorkerSource = await readFile(serviceWorkerPath, "utf8");
const precachePaths = (await listFiles(outputDir))
  .filter((filePath) => filePath !== serviceWorkerPath)
  .map(
    (filePath) =>
      `./${path.relative(outputDir, filePath).split(path.sep).join("/")}`,
  )
  .sort();
precachePaths.unshift("./");

const patchedServiceWorker = serviceWorkerSource.replace(
  "/* __PRECACHE_MANIFEST__ */ []",
  JSON.stringify(precachePaths, null, 2),
);
if (patchedServiceWorker === serviceWorkerSource) {
  throw new Error("Unable to inject the service-worker precache manifest");
}
await writeFile(serviceWorkerPath, patchedServiceWorker);
