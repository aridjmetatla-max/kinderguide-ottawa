/* KinderGuide service worker: network first (so updates always show), with a cached copy for offline use. */
const CACHE = 'kinderguide-v42';
const CORE = ['./', 'index.html', 'styles.css?v=42', 'icons.js?v=42', 'config.js?v=42', 'data/providers.js?v=42', 'data/inspections.js?v=42', 'data/transit.js?v=42', 'content.js?v=42', 'app.js?v=42', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // map tiles, fonts and search go straight to the network
  e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
    .catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
