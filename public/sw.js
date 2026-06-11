const CACHE_NAME = 'gestionale-salone-v5';

// Asset statici da mettere in cache
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ── Push notification handler ──────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Nuova prenotazione!', body: 'Una cliente ha richiesto un appuntamento.', data: {} };
  try {
    if (event.data) data = event.data.json();
  } catch (_) { /* keep defaults */ }

  const options = {
    body: data.body ?? data.message ?? '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    tag: 'richiesta-prenotazione',
    renotify: true,
    requireInteraction: true,
    data: data.data ?? {},
    actions: [
      { action: 'apri', title: 'Apri agenda' },
      { action: 'ignora', title: 'Ignora' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Nuova prenotazione!', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'ignora') return;

  // Focus or open the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          // Tell the app to navigate to agenda
          client.postMessage({ type: 'OPEN_AGENDA' });
          return;
        }
      }
      // No open window — open a new one
      if (clients.openWindow) {
        return clients.openWindow('/?apri=agenda');
      }
    })
  );
});

// ── Fetch handler ──────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Le chiamate Supabase vanno sempre alla rete (dati live)
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Strategia Network First: prova la rete, fallback alla cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Se la risposta e' valida, salva una copia in cache
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: restituisci dalla cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Per le navigazioni, restituisci la homepage
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
