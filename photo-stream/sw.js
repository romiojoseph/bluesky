const CACHE_NAME = 'photostream-cache-v2'; // Increment version for update
const APP_SHELL_URLS = [
    './index.html',
    './styles.css',
    './main.js',
    './api.js',
    './ui.js',
    './assets/favicon.svg', // Keep the SVG icon
    './assets/default-avatar.png',
    './assets/social-image.png', // Optional, for sharing consistency
    'https://unpkg.com/@phosphor-icons/web', // Cache Phosphor icons CSS
    'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Rancho&display=swap', // Cache Google Font CSS request
    // Removed PNG icon paths
    './manifest.json' // Cache the manifest itself
];

// --- Installation: Cache App Shell ---
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE_NAME);
            console.log('[Service Worker] Caching app shell');
            // Use addAll for atomic caching. If one fails, none are cached.
            // Use individual add requests in a loop with catch for non-critical assets
            const promises = APP_SHELL_URLS.map(url => {
                return cache.add(url).catch(err => {
                    console.warn(`[Service Worker] Failed to cache ${url}:`, err);
                });
            });
            await Promise.all(promises);
            console.log('[Service Worker] App shell caching complete.');
            // Skip waiting and activate immediately after install succeeds
            self.skipWaiting();
        } catch (error) {
            console.error('[Service Worker] App shell caching failed:', error);
        }
    })());
});

// --- Activation: Clean Up Old Caches ---
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate');
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map((cacheName) => {
                if (cacheName !== CACHE_NAME) {
                    console.log('[Service Worker] Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                }
            })
        );
        // Force the SW to take control of uncontrolled clients immediately
        await self.clients.claim();
        console.log('[Service Worker] Activated and claimed clients.');
    })());
});

// --- Fetch: Intercept Requests ---
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strategy 1: API Requests (Network Only)
    // The app needs fresh data, so always go to the network for the API.
    if (url.origin === 'https://public.api.bsky.app') {
        // Respond with Network request
        event.respondWith(fetch(event.request).catch(error => {
            console.warn('[Service Worker] Network fetch failed for API:', event.request.url, error);
            // Optionally return a custom offline response for API calls
            return new Response(JSON.stringify({ error: "Offline", message: "Cannot fetch data while offline." }), {
                status: 503, // Service Unavailable
                headers: { 'Content-Type': 'application/json' }
            });
        }));
        return; // Don't process further
    }

    // Strategy 2: Image Assets from Bluesky CDN (Cache First after Network Fetch)
    // Example check - adjust origin/path if Bluesky CDN changes
    // Check specifically for image paths, potentially from different CDNs ATProto might use
    if (event.request.destination === 'image' && (url.hostname.endsWith('bsky.social') || url.hostname.endsWith('cdn.bsky.app') /* Add other potential CDN hosts */)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    // console.log('[Service Worker] Serving image from cache:', event.request.url);
                    return cachedResponse;
                }

                // console.log('[Service Worker] Fetching image from network:', event.request.url);
                try {
                    const networkResponse = await fetch(event.request);
                    // Check if response is valid before caching
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
                        // console.log('[Service Worker] Caching new image:', event.request.url);
                        // Clone the response stream as it can only be consumed once
                        await cache.put(event.request, networkResponse.clone());
                    } else if (networkResponse && networkResponse.status !== 200) {
                        console.warn(`[Service Worker] Failed to fetch image (Status: ${networkResponse.status}):`, event.request.url);
                    }
                    return networkResponse;
                } catch (error) {
                    console.warn('[Service Worker] Network fetch failed for image:', event.request.url, error);
                    // Optionally return a placeholder image from cache here
                    // return cache.match('./assets/placeholder-image.png');
                    // Or just let the fetch failure propagate
                    throw error;
                }
            })
        );
        return; // Don't process further
    }

    // Strategy 3: App Shell & Other Assets (Cache First)
    // For local files, fonts, icons etc. specified in APP_SHELL_URLS or matching same-origin requests.
    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                // console.log('[Service Worker] Serving asset from cache:', event.request.url);
                return cachedResponse;
            }

            // console.log('[Service Worker] Asset not in cache, fetching from network:', event.request.url);
            // Important: Only cache successful responses and be careful with opaque responses
            try {
                const networkResponse = await fetch(event.request);
                // Cache same-origin 'basic' responses and explicit cross-origin resources if needed
                // Ensure request.url is used for matching APP_SHELL_URLS check
                if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || APP_SHELL_URLS.includes(event.request.url))) {
                    // console.log('[Service Worker] Caching new asset:', event.request.url);
                    await cache.put(event.request, networkResponse.clone());
                } else if (networkResponse && networkResponse.status !== 200) {
                    console.warn(`[Service Worker] Failed to fetch asset (Status: ${networkResponse.status}):`, event.request.url);
                }
                return networkResponse;
            } catch (error) {
                console.error('[Service Worker] Network fetch failed for asset:', event.request.url, error);
                // For HTML requests, maybe return an offline fallback page?
                // if (event.request.destination === 'document') {
                //     return caches.match('./offline.html'); // You would need to create and cache offline.html
                // }
                throw error; // Let the browser handle the failed fetch
            }
        })
    );
});