const CACHE_NAME = "orion-pos-v3";
const PRECACHE_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png"
];

// Install Event: Pre-cache static shell fallback assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Pre-caching offline fallback shell assets");
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Sweep away stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log("Service Worker: Purging outdated cache store:", name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Proxy and cache requests selectively
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. STRICT NETWORK ONLY BYPASS:
  // Non-GET requests (POST, PUT, DELETE), auth, login/logout, API routes, or cross-origin backend calls
  // MUST NOT be intercepted or served from SW cache. Returning early lets browser execute native network fetch.
  const isAuthOrApi =
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes("/auth") ||
    url.pathname.includes("/login") ||
    url.pathname.includes("/logout") ||
    url.pathname.includes("/products") ||
    url.pathname.includes("/customers") ||
    url.pathname.includes("/checkout") ||
    url.pathname.includes("/sales") ||
    url.pathname.includes("/dashboard") ||
    url.pathname.includes("/reports") ||
    url.pathname.includes("/settings") ||
    url.pathname.includes("/sync") ||
    url.pathname.includes("/printer") ||
    url.pathname.includes("/health");

  if (isAuthOrApi && !url.pathname.startsWith("/assets")) {
    return; // Native browser network request
  }

  // 2. PAGE NAVIGATION: Return network response first, fallback to cached offline screen on disconnect
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If network response is valid and non-redirected, return directly
          if (response && response.status === 200 && !response.redirected) {
            return response;
          }
          // On network redirect or non-200 status when navigating, serve cached offline shell directly
          return caches.match("/offline.html").then((offlineRes) => offlineRes || response);
        })
        .catch(() => {
          console.warn("Service Worker: Network offline. Serving offline fallback screen.");
          return caches.match("/offline.html");
        })
    );
    return;
  }

  // 3. STATIC ASSETS: Cache-First with background sync/Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.includes("/assets/") ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Asynchronously update asset in cache in the background
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            })
            .catch(() => {
              // Ignore background network errors gracefully
            });
          return cachedResponse;
        }

        // Cache miss: retrieve from network and put in cache store
        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
