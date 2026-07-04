// Service worker for NutriLens PWA installation support
const CACHE_NAME = 'nutrilens-cache-v1';

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
