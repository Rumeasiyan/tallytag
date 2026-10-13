// Keeps the pages and scripts a phone has already opened, so the scan screen still opens with no signal.
// Data is never cached here: it lives in the phone's IndexedDB queue (see src/lib/offline.ts).
const CACHE = "tallytag-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function remember(req, res) {
  if (res && res.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  const isPage = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isPage) {
    e.respondWith(
      fetch(req)
        .then((res) => remember(req, res))
        .catch(async () => (await caches.match(req)) || (await caches.match("/scan")) || (await caches.match("/")) || Response.error()),
    );
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || /\.(svg|png|json|js|css|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => remember(req, res))));
  }
});
