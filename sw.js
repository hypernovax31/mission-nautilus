// Service worker minimal pour PWA Mission Nautilus
// Strategie : network-first pour les pages, cache-first pour assets statiques
const CACHE_NAME = 'nautilus-v287';
const PRECACHE = [
  './',
  './index.html',
  './palier1.html',
  './1721310619.html',
  './classement.html',
  './css/index.css?v=36',
  './css/classement.css?v=3',
  './css/hublots.css?v=13',
  './css/palier1.css?v=28',
  './css/palier2.css?v=22',
  './css/admin.css?v=4',
  './son-partage.js?v=2',
  './sonar-button.js?v=4',
  './admin-button.js?v=14',
  './palier-annonces.js?v=3',
  './journal-bord.js?v=2',
  './palier-sas.js?v=11',
  './palier-briefing.js?v=1',
  './matelot-blocages.js?v=2',
  './reserve-o2.js?v=2',
  './equipage-actif.js?v=2',
  './mots-croises.js?v=7',
  './victoire-palier.js?v=8',
  './records-palier.js?v=2',
  './install-promo.js?v=5',
  './assets/fond-nautilus.jpg',
  './assets/ambiance-sonar.mp3',
  './assets/Victoire.mp3',
  './assets/Submarine_alarm.mp3',
  './assets/hublot-click.wav',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
  /* skipWaiting : la nouvelle version prend la main tout de suite, sans
     attendre la fermeture de tous les onglets. Combine a l'ecoute de
     'controllerchange' dans index.html, qui affiche alors un bandeau
     « Nouvelle version prete — Actualiser » : PLUS JAMAIS de rechargement
     automatique (il causait le faux depart qui effacait la saisie du
     joueur). Les fichiers frais arrivent d'eux-memes a la prochaine
     navigation, servis par ce nouveau service worker. */
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Pour les requetes Firebase / API externes : network-first
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* Le service worker lui-meme n'est jamais servi depuis le cache : sinon
     il pourrait se re-servir sa propre version perimee et le jeu ne se
     mettrait plus jamais a jour. Le navigateur le recharge du reseau. */
  if (url.pathname.endsWith('/sw.js')) return;
  // Pages HTML : network-first, fallback cache
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  // Assets : cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      return res;
    }).catch(() => cached))
  );
});
