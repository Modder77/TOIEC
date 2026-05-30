// =====================================================================
// sw.js — Service worker de l'Atelier TOEIC
// ---------------------------------------------------------------------
// Stratégie : "stale-while-revalidate" pour les ressources statiques
// (l'app marche hors-ligne après la 1re visite). Les appels /api/ sont
// TOUJOURS laissés passer au réseau (jamais mis en cache : ce sont des
// requêtes POST dynamiques vers l'IA).
// =====================================================================
const CACHE = 'toeic-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1) Ne jamais intercepter l'API (POST dynamiques vers Anthropic)
  if (url.pathname.startsWith('/api/')) return;

  // 2) Ne gérer que les GET
  if (e.request.method !== 'GET') return;

  // 3) Stale-while-revalidate pour le reste
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const network = fetch(e.request)
          .then((resp) => {
            // On met en cache les réponses valides (statiques + Google Fonts)
            if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'cors')) {
              cache.put(e.request, resp.clone());
            }
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
