// Service worker: guarda la "cáscara" de la app para que abra rápido. Los datos siempre vienen de Supabase.
const CACHE = 'edition-crm-v2.0.1';
const SHELL = ['./', './index.html', './styles.css', './app.js', './data.js', './logic.js', './seeds.js', './config.js',
  './vendor/supabase-2.119.0.js', './logo.png', './icons/icon-192.png', './manifest.webmanifest',
  './fonts/geist-latin-400-normal.woff2', './fonts/geist-latin-500-normal.woff2', './fonts/geist-latin-600-normal.woff2', './fonts/geist-latin-700-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase y otros: siempre a la red
  // Red primero (para recibir las actualizaciones); si no hay internet, la copia guardada
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
