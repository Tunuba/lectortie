/* lectortie, service worker. Guarda la app para que abra rapido y sin red muestre al menos
   la pagina. La API siempre va a la red, nunca se sirve vieja. */
const VERSION = 'lectortie-v3';
const BASE = ['/', '/manifest.webmanifest', '/favicon.svg', '/iconos/icono-any-192.png', '/iconos/icono-any-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/entrar') || u.pathname.startsWith('/ir/')) return;
  if (u.pathname.startsWith('/assets/') || u.pathname.startsWith('/fuentes/') || u.pathname.startsWith('/portadas/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); }
      return res;
    })));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok && res.type === 'basic') { const copia = res.clone(); caches.open(VERSION).then(c => c.put('/', copia)); }
      return res;
    }).catch(() => caches.match('/')));
  }
});
