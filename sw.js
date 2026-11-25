var CACHE = 'dw-app-v1';
var ASSETS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'config.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'photo-hinge.jpg',
  'photo-drawer-slide.jpg',
  'photo-handle.jpg',
  'photo-gas-strut.jpg',
  'photo-leg.jpg',
  'photo-led-strip.jpg',
  'photo-alu-profile.jpg',
  'photo-roller.jpg',
  'photo-lock.jpg',
  'photo-epdm.jpg',
  'photo-mesh.jpg',
  'photo-upvc-handle.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      });
    })
  );
});
