const CACHE_NAME = 'schat-v8-motion-engine';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.includes('ws')) {
    return;
  }
  // Network-first for HTML pages
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
