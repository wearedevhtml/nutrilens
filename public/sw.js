// Service worker for BioLens PWA installation support
const CACHE_NAME = 'biolens-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through service worker for installation criteria
  event.respondWith(fetch(event.request));
});
