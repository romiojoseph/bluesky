// Service Worker for Bluesky Advanced Search PWA
const CACHE_NAME = 'bluesky-advanced-search-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './js/script.js',
    './js/userSearch.js',
    './manifest.json'
    // Removed assets that might not exist yet or could cause issues
];

// Install event - cache assets with improved error handling
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // Use a more resilient approach to caching
                return Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => 
                        fetch(url)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`Failed to fetch ${url}`);
                                }
                                return cache.put(url, response);
                            })
                            .catch(error => {
                                console.warn(`Caching failed for ${url}:`, error);
                                // Continue despite this error
                            })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
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
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // For API requests, use network first
    if (event.request.url.includes('/xrpc/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(
                    response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            })
                            .catch(error => {
                                console.warn('Cache put error:', error);
                            });

                        return response;
                    }
                ).catch(error => {
                    console.warn('Fetch error:', error);
                    // You could return a custom offline page here
                });
            })
    );
});
