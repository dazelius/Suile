const CACHE_NAME = "suile-v1";
const PRECACHE = ["/", "/manifest.json", "/favicon.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // navigation 요청은 네트워크 우선, 실패 시 캐시 fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }
  // 나머지 정적 리소스: 캐시 우선
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
