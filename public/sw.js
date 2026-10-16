const CACHE_NAME = 'qr-pay-v4';
const APP_SHELL = [
  './manifest.webmanifest',
  './icons/qr-pay-192.png',
  './icons/qr-pay-512.png',
];

async function cacheDocumentAssets(cache, path) {
  const documentUrl = new URL(path, self.registration.scope).toString();
  const response = await fetch(documentUrl, { cache: 'reload' });
  if (!response.ok) throw new Error(`Unable to cache ${documentUrl}`);

  await cache.put(documentUrl, response.clone());
  const html = await response.text();
  const assets = new Set();

  for (const attribute of ['src', 'href']) {
    const pattern = new RegExp(`${attribute}="([^"]+)"`, 'g');
    for (const match of html.matchAll(pattern)) {
      const assetUrl = new URL(match[1], documentUrl);
      if (assetUrl.origin === self.location.origin) assets.add(assetUrl.toString());
    }
  }

  await Promise.all([...assets].map((assetUrl) => cache.add(assetUrl)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL);
        await Promise.all([
          cacheDocumentAssets(cache, './'),
          cacheDocumentAssets(cache, './pay/'),
        ]);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('qr-pay-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const exact = await caches.match(request, { ignoreSearch: true });
          if (exact) return exact;
          const fallback = requestUrl.pathname.includes('/pay/') ? './pay/' : './';
          return caches.match(fallback);
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }),
  );
});
