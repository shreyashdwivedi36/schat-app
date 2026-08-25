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
const CACHE_NAME = 'schat-v111-contact-cancel-fix';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/logo.png',
  '/badge.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
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


self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SChat';
  const options = {
    body: data.body || 'New message received',
    icon: '/badge.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    tag: data.message_id ? `message-${data.message_id}` : `msg-${Date.now()}`,
    data: data.url || '/'
  };

  const promiseChain = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    let isVisible = false;
    for (let i = 0; i < windowClients.length; i++) {
      if (windowClients[i].visibilityState === 'visible') {
        isVisible = true;
        break;
      }
    }

    if (isVisible) {
      // App is open! Do not show notification, just mark delivered.
      return data.message_id ? fetch('/api/messages/mark-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message_id: data.message_id })
      }).catch(e => console.error(e)) : Promise.resolve();
    }

    // App is in background! Show notification and mark delivered.
    return Promise.all([
      self.registration.showNotification(title, options),
      data.message_id ? fetch('/api/messages/mark-delivered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message_id: data.message_id })
      }).catch(e => console.error(e)) : Promise.resolve()
    ]);
  });

  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
