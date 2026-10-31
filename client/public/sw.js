// RuralCare Connect - Service Worker with Web Background Sync Support
// Enables offline asset availability and background sync processing

const CACHE_NAME = 'ruralcare-connect-shell-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

// Install: Precache application shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[ServiceWorker] Shell precache warning:', err);
      });
    })
  );
});

// Activate: Claim clients and purge stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      }),
    ])
  );
});

// Web Background Sync API Handler
// Triggered by the browser when connectivity returns, even if tab is in the background
self.addEventListener('sync', (event) => {
  if (event.tag === 'ruralcare-sync-queue') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  console.log('[ServiceWorker] Background Sync event triggered for tag: ruralcare-sync-queue');
  try {
    // Check if any application window is active and notify it to sync immediately
    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    if (windowClients && windowClients.length > 0) {
      for (const client of windowClients) {
        client.postMessage({
          type: 'BACKGROUND_SYNC_TRIGGER',
          tag: 'ruralcare-sync-queue',
          timestamp: Date.now(),
        });
      }
    } else {
      console.log('[ServiceWorker] No open window clients found. Foreground sync will process on application launch.');
    }
  } catch (err) {
    console.error('[ServiceWorker] Background sync dispatch error:', err);
  }
}

// Client messaging handler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING') {
    event.ports[0]?.postMessage({
      status: 'PONG',
      backgroundSyncSupported: 'sync' in self.registration,
    });
  }
});
