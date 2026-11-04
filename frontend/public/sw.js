/**
 * Makes the app installable and quick to open. It stores only the app itself
 * (code, styles, icons). Financial data under /api is never cached: on a shared
 * or lost device there is nothing to read here.
 */
const CACHE = 'smarthome-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg'];
const MAX_ENTRIES = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

const trim = async (cache) => {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(keys.length - MAX_ENTRIES, 0)).map((key) => cache.delete(key)));
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: always the newest from the network; the stored shell only when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match('/')) || Response.error())
    );
    return;
  }

  // Built files have a hash in their name, so a stored copy is never out of date
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then(async (response) => {
            if (response.ok) {
              const cache = await caches.open(CACHE);
              await cache.put(request, response.clone());
              trim(cache);
            }
            return response;
          })
      )
    );
  }
});
