const CACHE = 'ad-cd79-v2';

// Toutes les ressources nécessaires au fonctionnement hors-ligne
const ASSETS_TO_CACHE = [
  // ── Fichiers locaux ──────────────────────────────────────────────────────
  './index.html',
  './manifest.json',
  './icon.svg',

  // ── React 18 (unpkg) ─────────────────────────────────────────────────────
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',

  // ── Babel standalone (transpilation JSX dans le navigateur) ──────────────
  'https://unpkg.com/@babel/standalone/babel.min.js',

  // ── Police Marianne — DSFR (jsdelivr) ────────────────────────────────────
  'https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@1.11.2/dist/fonts/Marianne-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@1.11.2/dist/fonts/Marianne-Medium.woff2',
  'https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@1.11.2/dist/fonts/Marianne-Bold.woff2',

  // ── Police Inter — Google Fonts (feuille CSS + fichiers woff2) ───────────
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// ── Installation : mise en cache exhaustive ───────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // On tente de cacher chaque ressource individuellement
      // pour qu'une erreur sur l'une ne bloque pas les autres
      await Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(new Request(url, { mode: 'cors', credentials: 'omit' }))
            .catch((err) => console.warn(`[SW] Échec mise en cache : ${url}`, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── Activation : purge les anciens caches ─────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch : cache-first strict ────────────────────────────────────────────
// 1. Cherche dans le cache
// 2. Si absent → réseau + mise en cache automatique pour les prochaines fois
// 3. Si hors-ligne et absent → renvoie index.html pour les navigations
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // Ressource absente du cache — on va chercher sur le réseau
      return fetch(event.request)
        .then((response) => {
          // On ne stocke que les réponses valides (y compris opaques CDN)
          if (response && (response.status === 200 || response.type === 'opaque')) {
            caches.open(CACHE).then((cache) =>
              cache.put(event.request, response.clone())
            );
          }
          return response;
        })
        .catch(() => {
          // Hors-ligne + absent du cache → fallback sur index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
