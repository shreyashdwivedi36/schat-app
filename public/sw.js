/**
 * ============================================================================
 * SChat - Real-Time Messaging Platform
 * Copyright (c) 2026 Shreyash Dwivedi (@shreyashdwivedi36). All Rights Reserved.
 *
 * This software and its associated documentation are the exclusive proprietary
 * property of Shreyash Dwivedi. Unauthorized copying, modification, distribution,
 * sublicensing, or commercial use is strictly prohibited.
 * ============================================================================
 */
const CACHE_NAME = 'schat-v29-live-update';

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
  
  // Force network fetch and bypass the stale HTTP cache
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).catch(() => caches.match(event.request))
  );
});
