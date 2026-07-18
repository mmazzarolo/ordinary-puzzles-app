import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const outputDir = path.resolve(process.argv[2] || "dist-web");
const port = Number(process.argv[3] || 8098);
const publicPath = normalizePublicPath(process.env.WEB_PUBLIC_PATH);
// Playwright uses this per-context cookie to emulate a same-URL deployment.
const serviceWorkerVersionCookie = "ordinary-puzzles-e2e-sw-version";
// This one drops the origin connection so every engine exercises SW fallback.
const networkFailureCookie = "ordinary-puzzles-e2e-network-failure";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".otf", "font/otf"],
  [".png", "image/png"],
  [".wav", "audio/wav"],
]);

function normalizePublicPath(value) {
  if (!value || value === "/") return "";
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.endsWith("/") ? prefixed.slice(0, -1) : prefixed;
}

function stripPublicPath(pathname) {
  if (!publicPath) return pathname;
  if (pathname === publicPath) return "/";
  if (pathname.startsWith(`${publicPath}/`)) {
    return pathname.slice(publicPath.length);
  }
  return undefined;
}

function resolveRequestPath(localPathname) {
  const pathname = localPathname === "/" ? "/index.html" : localPathname;
  const decodedPath = decodeURIComponent(pathname);
  const filePath = path.resolve(outputDir, `.${decodedPath}`);
  if (
    filePath !== outputDir &&
    !filePath.startsWith(`${outputDir}${path.sep}`)
  ) {
    return undefined;
  }
  return filePath;
}

async function fileExists(filePath) {
  try {
    const fileStats = await stat(filePath);
    return fileStats.isFile();
  } catch {
    return false;
  }
}

function writeNotFound(response) {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

async function writeFile(response, filePath) {
  const extension = path.extname(filePath);
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": MIME_TYPES.get(extension) || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return undefined;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

async function writeServiceWorkerVariant(response, filePath, version) {
  const source = await readFile(filePath, "utf8");
  const updatedSource = source.replace(
    "const CACHE_NAME = `${CACHE_PREFIX}v2`;",
    `const CACHE_NAME = \`\${CACHE_PREFIX}${version}\`;`,
  );
  if (updatedSource === source) {
    throw new Error("Unable to create the service-worker test payload");
  }
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "application/javascript; charset=utf-8",
  });
  response.end(updatedSource);
}

const server = createServer(async (request, response) => {
  if (!request.url || request.method !== "GET") {
    writeNotFound(response);
    return;
  }

  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const localPathname = stripPublicPath(url.pathname);
  if (!localPathname) {
    writeNotFound(response);
    return;
  }

  if (readCookie(request.headers.cookie, networkFailureCookie) === "1") {
    request.socket.destroy();
    return;
  }

  const requestedFilePath = resolveRequestPath(localPathname);
  if (requestedFilePath && (await fileExists(requestedFilePath))) {
    const serviceWorkerVersion = readCookie(
      request.headers.cookie,
      serviceWorkerVersionCookie,
    );
    if (
      localPathname === "/service-worker.js" &&
      serviceWorkerVersion === "v3"
    ) {
      await writeServiceWorkerVariant(
        response,
        requestedFilePath,
        serviceWorkerVersion,
      );
      return;
    }
    await writeFile(response, requestedFilePath);
    return;
  }

  const acceptHeader = request.headers.accept || "";
  if (acceptHeader.includes("text/html")) {
    await writeFile(response, path.join(outputDir, "index.html"));
    return;
  }

  writeNotFound(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `Serving ${outputDir} at http://127.0.0.1:${port}${publicPath || "/"}`,
  );
});
