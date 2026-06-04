/* Kill-switch service worker: unregisters itself and clears its own caches.
 * Replaces the previous app-shell SW that was causing offline/stale issues
 * in the Lovable preview and on installed clients.
 */
function isOwnCache(name) {
  return /^ligneo-(static|runtime)-/.test(name);
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.filter(isOwnCache).map((n) => caches.delete(n)));
      await self.clients.claim();
      const wins = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(wins.map((c) => c.navigate(c.url).catch(() => {})));
    } finally {
      await self.registration.unregister();
    }
  })());
});

// Keep push handler so any existing push subscriptions still surface a notification.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: 'Transports Ligneo', body: event.data.text() }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'Transports Ligneo', {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || { url: payload.url || '/' },
    tag: payload.tag,
  }));
});
