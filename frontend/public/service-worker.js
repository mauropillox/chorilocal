const CACHE_NAME = 'chorilocal-static-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    // Only handle GET requests for caching
    if (req.method !== 'GET') return;

    // Only cache same-origin http(s) requests to avoid chrome-extension:// and other schemes
    let url;
    try {
        url = new URL(req.url);
    } catch (e) {
        return; // malformed URL
    }
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (url.origin !== self.location.origin) {
        // skip cross-origin resources (CDNs, extensions)
        return;
    }

    event.respondWith(
        fetch(req).then(res => {
            // Update cache in background, but guard against cache.put errors
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(async (cache) => {
                try {
                    await cache.put(req, resClone);
                } catch (err) {
                    // Some requests (e.g., opaque responses, bad schemes) may fail to cache
                    console.warn('ServiceWorker cache.put failed for', req.url, err);
                }
            });
            return res;
        }).catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
});
