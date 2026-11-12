const CACHE_NAME = 'tacsfiber-pwa-v1';

// Mga pangunahing files at CDN na kailangang i-save para gumana offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. INSTALL: I-download at i-save ang lahat ng files sa cache
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[TacsFiber SW] Caching offline assets...');
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Failed to cache:', url, err))
        )
      );
    })
  );
});

// 2. ACTIVATE: Linisin ang lumang cache kapag nag-update ka ng version (hal. v2)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[TacsFiber SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Sagutin ang requests kahit walang data/internet
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Huwag i-cache ang live API calls sa Supabase (dapat laging fresh o handle ng localStorage)
  if (url.hostname.includes('supabase.co') || event.request.method !== 'GET') {
    return;
  }

  // Para sa navigation (pag-open o pag-refresh ng index.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // I-update ang cache ng pinakabagong index.html kapag may internet
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
          return networkResponse;
        })
        .catch(() => {
          // Kapag OFFLINE at ni-refresh: ibigay ang naka-save na index.html!
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Para sa CSS, JS, Fonts, at Icons: kunin sa Cache muna, kung wala saka mag-internet
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});