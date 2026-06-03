/* Transports Ligneo — Service Worker
 * Strategy:
 *  - Navigation requests: NetworkFirst with 3s timeout, falls back to /offline.html
 *  - Static assets (script/style/image/font): StaleWhileRevalidate
 *  - API calls (/api/*, server fns _serverFn): always network, no cache
 *  - Push notifications: ready (no-op when no payload)
 */

const VERSION = 'v1.0.0';
const STATIC_CACHE = `ligneo-static-${VERSION}`;
const RUNTIME_CACHE = `ligneo-runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Allow page to trigger immediate update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

function isStaticAsset(request) {
  const dest = request.destination;
  return ['style', 'script', 'image', 'font'].includes(dest);
}

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/_serverFn/') || url.pathname.includes('/__l5e/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / server fn / supabase / lovable internals
  if (isApiRequest(url)) return;

  // Navigation: NetworkFirst with offline fallback
  if (isNavigationRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3500);
          const fresh = await fetch(request, { signal: controller.signal });
          clearTimeout(timeout);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  // Static assets: StaleWhileRevalidate
  if (isStaticAsset(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })()
    );
  }
});

// Push notifications (infra ready, no-op without payload)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Transports Ligneo', body: event.data.text() };
  }
  const title = payload.title || 'Transports Ligneo';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || { url: payload.url || '/' },
    tag: payload.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
