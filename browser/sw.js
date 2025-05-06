const CACHE_NAME = 'bsky-viewer-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './assets/favicon.svg',
    './assets/placeholder.svg',
    './js/utils.js',
    './js/parser.js',
    './js/api.js',
    './js/renderer.js',
    './js/config.js',
    './js/storage.js', // Add new storage file
    './js/main.js',
    'https://unpkg.com/@phosphor-icons/web', // Cache external script
    'https://cdn.jsdelivr.net/npm/hls.js@latest' // Cache external script
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // Use addAll for atomic caching
                return cache.addAll(urlsToCache).catch(error => {
                    console.error('Failed to cache one or more resources:', error);
                    // Decide if install should fail or continue
                });
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request because it's a stream and can only be consumed once.
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(
                    response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            // Don't cache opaque responses or errors
                            return response;
                        }

                        // Clone the response because it's also a stream.
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                ).catch(error => {
                    console.error('Fetch failed; returning offline page instead.', error);
                    // Optional: return a fallback offline page if specific assets fail
                    // e.g., return caches.match('/offline.html');
                });
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
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});