const CACHE_NAME = 'photostream-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './assets/favicon.svg',
    './assets/avatar.svg',
    './assets/thumb.avif',
    './js/main.js',
    './js/api.js',
    './js/ui.js',
    './js/utils.js',
    './js/state.js',
    './js/config.js',
    'https://unpkg.com/@phosphor-icons/web' // Cache the Phosphor icons script
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            if (event.request.url.startsWith('https://cdn.bsky.app/img/')) {
                                // For failed bsky images, try to return a placeholder or nothing
                                // For now, just let it fail or return the network error
                            }
                            return response;
                        }

                        // IMPORTANT: Clone the response. A response is a stream
                        // and because we want the browser to consume the response
                        // as well as the cache consuming the response, we need
                        // to clone it so we have two streams.
                        var responseToCache = response.clone();

                        // Don't cache API calls, only static assets and specific external resources if needed
                        if (!event.request.url.includes('xrpc') && !event.request.url.includes('bsky.app/img')) {
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return response;
                    }
                );
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});