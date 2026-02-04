const CACHE_NAME = 'vikings-v5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './clan.js',
    './territory_upgrade.js',
    './manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all: app shell and content');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
});

// Fetch Event (Network First, fall back to Cache)
self.addEventListener('fetch', (event) => {
    // Skip API requests/Server logic - we want them fresh or handled by app logic
    if (event.request.url.includes('/api/')) {
        return;
    }

    // STALE-WHILE-REVALIDATE STRATEGY (Instant Load + Background Update)
    // This fixes "Lie-fi" (connected but slow) by serving cache immediately
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        // Check if valid
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed? No problem, we (hopefully) returned cache already.
                        // If both fail, we might return fallback (handled below or by browser)
                        console.log('[SW] Background fetch failed for', event.request.url);
                    });

                // Return cached response right away if we have it, else wait for network
                return cachedResponse || fetchPromise;
            });
        }).catch(() => {
            // Fallback if cache open fails (rare) or both fail
            return new Response('Offline - Connect to Internet', { status: 503 });
        })
    );
});

