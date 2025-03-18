const CACHE_NAME = 'new-horizons-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/scripts/utils.js',
    '/scripts/ui.js',
    '/scripts/api.js',
    '/scripts/main.js',
    '/assets/logo.svg',
    '/assets/favicon.svg',
    'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap',
    'https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/style.css'
];

// Install service worker
self.addEventListener('install', event => {
    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch resources
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request because it's a one-time use stream
                const fetchRequest = event.request.clone();

                // For API requests, don't try to cache but allow them to go through
                if (fetchRequest.url.includes('public.api.bsky.app')) {
                    return fetch(fetchRequest);
                }

                return fetch(fetchRequest).then(
                    response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response because it's a one-time use stream
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
            .catch(() => {
                // If both the cache and network fail, show a fallback page or content
                if (event.request.url.includes('.html')) {
                    return caches.match('/index.html');
                }
            })
    );
});

// Activate and clean up old caches
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