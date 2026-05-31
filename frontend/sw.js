const SW_VERSION = 'v2';
const STATIC_CACHE = `coppershores-static-${SW_VERSION}`;
const MAP_CACHE = `coppershores-maps-${SW_VERSION}`;
const RUNTIME_CACHE = `coppershores-runtime-${SW_VERSION}`;

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/gold.html',
  '/map.html',
  '/players.html',
  '/notes.html',
  '/styles.css',
  '/gold.css',
  '/map.css',
  '/script.js',
  '/gold.js',
  '/map.js',
  '/assets/jollyrogercoppershores.png',
  '/assets/fonts/cinzel-500-700-latin.woff2',
  '/assets/fonts/crimson-text-400-latin.woff2',
  '/assets/fonts/crimson-text-600-latin.woff2',
  '/assets/fonts/pirata-one-400-latin.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const allowedCaches = new Set([STATIC_CACHE, MAP_CACHE, RUNTIME_CACHE]);
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (!allowedCaches.has(key)) {
          return caches.delete(key);
        }
        return Promise.resolve();
      })
    ))
  );
  self.clients.claim();
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

async function networkFirstPage(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const home = await cache.match('/index.html');
    if (home) return home;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API calls in the service worker.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.startsWith('/allmaps/')) {
    event.respondWith(cacheFirst(request, MAP_CACHE));
    return;
  }

  if (url.pathname.startsWith('/assets/fonts/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (/\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico|woff2|woff|ttf)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});
