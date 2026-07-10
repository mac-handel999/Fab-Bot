const CACHE_NAME = 'fabbot-cache-v1';

// List the static assets your app actually serves. Adjust paths to match
// your real file names/locations (e.g. if styles.css lives in a /css folder).
const ASSETS_TO_CACHE = [
    '/',
    'Fab-Bot/index.html',
    'Fab-Bot/Chat-room/Chat-room.html',
    'Fab-Bot/chat-room.css',
    'Fab-Bot/styles.css',
    'Fab-Bot/chat-room.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .catch((err) => console.error('Service worker cache install failed:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Never intercept API calls — those must always hit the network live,
    // not be served from cache.
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});