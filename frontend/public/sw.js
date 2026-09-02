const CACHE_NAME = 'sharether-pwa-v7';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/pwa-192.png',
  '/pwa-512.png',
  '/sharether-logo.webp',
];

const HASHED_ASSET = /\/assets\/[^/]+\.[a-f0-9]{8,}\.(js|css|woff2?)$/i;
const STATIC_IMAGE = /\.(jpg|jpeg|png|webp|gif|svg|ico)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .catch(() => undefined),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const origin = self.location.origin;
  const reqUrl = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/').then((cached) => cached || new Response('Offline', { status: 503 })),
      ),
    );
    return;
  }

  if (reqUrl.origin !== origin) return;
  const path = reqUrl.pathname;

  // Never answer an API request with the cached SPA document.
  if (path.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (HASHED_ASSET.test(path)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (STATIC_IMAGE.test(path)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response);
          }).catch(() => {});
          return cached;
        }
        const response = await fetch(event.request).catch(() => null);
        if (response?.ok) cache.put(event.request, response.clone());
        return response || new Response('', { status: 404 });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || new Response('Offline', { status: 503 })),
    ),
  );
});
