/* Minimal service worker — required for installability */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-only: no offline caching, keeps PWA simple
  event.respondWith(fetch(event.request));
});
