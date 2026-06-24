const CACHE = 'tax-navi-v1';
const ASSETS = [
  '/tax_calculator/',
  '/tax_calculator/index.html',
  '/tax_calculator/app.js',
  '/tax_calculator/tax-calculator.js',
  '/tax_calculator/optimizer.js',
  '/tax_calculator/advisor.js',
  '/tax_calculator/styles.css',
  '/tax_calculator/manifest.json',
  '/tax_calculator/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res.ok && request.url.startsWith(self.location.origin + '/tax_calculator/')) {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
      }
      return res;
    }))
  );
});
