const CACHE = 'shilu-v5';
const STATIC = ['/','/index.html','/style.css','/js/app.js','/js/router.js','/js/state.js','/js/hash-search.js','/js/i18n.js','/js/home.js','/js/timelines.js','/js/map-view.js','/js/map-libs.js','/js/maplibre-gl-dates.js','/js/share-card.js','/js/game-center.js','/js/quiz.js','/js/game-map.js','/js/game-sort.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname !== self.location.hostname) return;
  const p = u.pathname;

  // Data files: stale-while-revalidate
  if (p.endsWith('.json') && (p.startsWith('/zh/') || p.startsWith('/en/') || p === '/content-years.json')) {
    e.respondWith(staleWhileRevalidate(e.request)); return;
  }

  // Navigation: stale-while-revalidate via index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(staleWhileRevalidate(e.request)); return;
  }

  // Static assets: cache-first
  if (p.endsWith('.js') || p.endsWith('.css') || p === '/') {
    e.respondWith(cacheFirst(e.request)); return;
  }
});

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then(c => c.match(req).then(cached => {
    const fetchP = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => cached);
    return cached || fetchP;
  }));
}

function cacheFirst(req) {
  return caches.match(req).then(cached => {
    const fetchP = fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(req, c)); } return r; });
    return cached || fetchP;
  });
}