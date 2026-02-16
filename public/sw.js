// TeO Hub Service Worker
// Version: 1.0.0 (Gorgoo Init)

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing TeO Hub Worker...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] TeO Hub Worker Active.');
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Placeholder for caching strategy
    // For now, simple passthrough to allow online-first behavior
    // event.respondWith(fetch(event.request));
});