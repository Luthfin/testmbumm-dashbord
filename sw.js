/**
 * ==============================================================================
 * MARCH FOR VICTORY - SERVICE WORKER (OFFLINE ENGINE)
 * File : sw.js
 * ==============================================================================
 */

const CACHE_NAME = 'mbumm-cache-v4'; // Naikkan versi jika melakukan update asset
const urlsToCache = [
  '/',
  '/index.html',
  '/scanner.html',
  '/portal.html',
  '/js/app.js',
  '/js/scanner.js',
  '/1.png',
  '/2.png',
  '/3.png',
  '/manifest.json'
];

// Instalasikan Service Worker & simpan file statis ke Cache Storage
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Bersihkan Cache lama jika versi CACHE_NAME dinaikkan
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intersepsi request jaringan: Utamakan Cache, baru fetch ke Jaringan
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
