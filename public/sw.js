/* Minimal service worker — required for installability.
 * Do NOT intercept /api or auth: iOS Safari PWA breaks session cookies
 * when every request is re-fetched through respondWith(fetch(...)).
 * Version: v2-no-api-intercept
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      // Drop any old caches from earlier SW versions
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Let the browser handle API + NextAuth natively (critical on iPhone)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigations and static assets: network only, no caching
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});
