const CACHE_PREFIX = "ordinary-puzzles-app-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const LEGACY_CACHE_NAMES = new Set(["ordinary-puzzles-v1"]);
const PRECACHE_URLS = /* __PRECACHE_MANIFEST__ */ [];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) ||
                LEGACY_CACHE_NAMES.has(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(cachedAppShell());
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cachedAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response =
    (await cache.match(new URL("./index.html", self.registration.scope))) ||
    (await cache.match(self.registration.scope));
  return response || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const fetched = fetch(request)
    .then(async (response) => {
      await cacheSuccessfulResponse(cache, request, response);
      return response;
    })
    .catch(() => undefined);

  return (await fetched) || Response.error();
}

async function cacheSuccessfulResponse(cache, request, response) {
  if (!response.ok) return;
  try {
    await cache.put(request, response.clone());
  } catch {
    // Cache quota or browser policy should not break a successful response.
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
