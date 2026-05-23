const CACHE_NAME = 'gestionale-salone-v1';

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
