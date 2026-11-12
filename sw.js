const CACHE_NAME = 'tacsfiber-pwa-v2';

// Mga pangunahing files at CDN na kailangang i-save para gumana offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// 1. INSTALL: I-download at i-save ang lahat ng files sa cache
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[TacsFiber SW] Caching offline assets (v2)...');
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Failed to cache:', url, err))
        )
      );
    })
  );
});

// 2. ACTIVATE: Linisin ang lumang cache kapag nag-update ka ng version
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

  // Huwag i-cache ang live API calls sa Supabase (handle ng localStorage queue)
  if (url.hostname.includes('supabase.co') || event.request.method !== 'GET') {
    return;
  }

  // Para sa navigation (pag-open o pag-refresh ng app)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', responseClone));
          return networkResponse;
        })
        .catch(async () => {
          // ⭐ Mas matatag na offline fallback: hanapin ang mismong request, root, o index.html sa cache
          const cachedResponse = await caches.match(event.request) 
                              || await caches.match('/') 
                              || await caches.match('/index.html');
          
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return new Response('Offline ka at hindi pa naka-cache ang pahinang ito.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Para sa CSS, JS, Fonts, at Icons: Cache muna, bago network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});
