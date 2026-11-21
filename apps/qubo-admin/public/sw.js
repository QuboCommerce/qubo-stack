// Qubo admin service worker. Deliberately small: the panel is live data behind a session,
// so pages are never cached. Hashed build assets are cached forever, and a navigation
// that fails because the device is offline gets the offline page instead of the browser error.
const VERSION = "qb-1";
const STATIC = `${VERSION}-static`;
const SHELL = `${VERSION}-shell`;
const OFFLINE = "/offline.html";
const SHELL_ASSETS = [OFFLINE, "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // The offline page's own assets (its icon): fresh when online, cached copy when not.
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(fetch(req).catch(() => caches.match(url.pathname, { cacheName: SHELL })));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE, { cacheName: SHELL })));
  }
});
