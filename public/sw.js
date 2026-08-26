/**
 * ============================================================================
 * SChat - Real-Time Messaging Platform
 * Copyright (c) 2026 Shreyash Dwivedi (@shreyashdwivedi36). All Rights Reserved.
 * ============================================================================
 */
const CACHE_NAME = 'schat-v150-hardened-ack-protocol';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/motion-fx.js',
  '/logo.png',
  '/maskable-logo.png',
  '/badge.png',
  '/favicon.ico',
  '/avatars/cosmic-astronaut.svg',
  '/avatars/cyber-samurai.svg',
  '/avatars/mecha-robot.svg',
  '/avatars/neon-wolf.svg',
  '/avatars/liquid-chrome.svg',
  '/avatars/phantom-ninja.svg',
  '/avatars/synthwave-sun.svg',
  '/avatars/phoenix-flame.svg'
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
      return Promise.all(keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : null));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.includes('ws')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }).catch(() => caches.match(event.request))
  );
});

// PURE ZERO-NETWORK HIGH-PRIORITY PUSH LISTENER
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : 'New message received' };
  }

  const title = data.title || 'SChat';
  const options = {
    body: data.body || 'New message received',
    icon: data.icon || '/logo.png',
    badge: '/badge.png',
    vibrate: [300, 150, 300, 150, 300],
    silent: false,
    renotify: true,
    requireInteraction: true,
    tag: data.message_id ? `msg-${data.message_id}` : `msg-${Date.now()}`,
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
