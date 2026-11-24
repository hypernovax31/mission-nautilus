// Service worker minimal pour PWA Mission Nautilus
// Pages : network-first ; code et styles : cache avec revalidation en fond.
const CACHE_NAME = 'nautilus-v439';
const PRECACHE = [
  './',
  './index.html',
  './palier1.html',
  './1721310619.html',
  './1831411720.html',
  './1941512821.html',
  './2051613922.html',
  './21617141023.html',
  './22718151124.html',
  './23819161225.html',
  './classement.html',
  './css/index.css?v=86',
  './css/artefact.css?v=3',
  './css/animations-accueil.css?v=4',
  './css/classement.css?v=9',
  './css/hublots.css?v=15',
  './css/palier1.css?v=55',
  './css/palier2.css?v=26',
  './css/palier3.css?v=8',
  './css/palier4.css?v=3',
  './css/palier5.css?v=3',
  './css/palier6.css?v=2',
  './css/admin.css?v=13',
  './anti-zoom.js?v=2',
  './son-partage.js?v=2',
  './sonar-button.js?v=4',
  './admin-button.js?v=33',
  './palier-annonces.js?v=5',
  './journal-bord.js?v=6',
  './palier-sas.js?v=13',
  './palier-briefing.js?v=4',
  './matelot-blocages.js?v=3',
  './reserve-o2.js?v=7',
  './equipage-actif.js?v=10',
  './mots-croises.js?v=9',
  './puzzle-palier3.js?v=4',
  './photo-defi.js?v=5',
  './palier4-marqueurs.js?v=2',
  './palier4-bataille.js?v=2',
  './juste-prix.js?v=3',
  './quiz-palier6.js?v=3',
  './produits.json',
  './assets/produits/fnac-audio-01.svg',
  './assets/produits/fnac-audio-02.svg',
  './assets/produits/fnac-audio-03.svg',
  './assets/produits/fnac-audio-04.svg',
  './assets/produits/fnac-audio-05.svg',
  './assets/produits/fnac-audio-06.svg',
  './assets/produits/fnac-audio-07.svg',
  './assets/produits/fnac-audio-08.svg',
  './assets/produits/fnac-audio-09.svg',
  './assets/produits/fnac-audio-10.svg',
  './assets/produits/fnac-audio-11.svg',
  './assets/produits/fnac-audio-12.svg',
  './assets/produits/fnac-info-01.svg',
  './assets/produits/fnac-info-02.svg',
  './assets/produits/fnac-info-03.svg',
  './assets/produits/fnac-info-04.svg',
  './assets/produits/fnac-info-05.svg',
  './assets/produits/fnac-info-06.svg',
  './assets/produits/fnac-info-07.svg',
  './assets/produits/fnac-info-08.svg',
  './assets/produits/fnac-info-09.svg',
  './assets/produits/fnac-info-10.svg',
  './assets/produits/fnac-info-11.svg',
  './assets/produits/fnac-info-12.svg',
  './assets/produits/fnac-tel-01.svg',
  './assets/produits/fnac-tel-02.svg',
  './assets/produits/fnac-tel-03.svg',
  './assets/produits/fnac-tel-04.svg',
  './assets/produits/fnac-tel-05.svg',
  './assets/produits/fnac-tel-06.svg',
  './assets/produits/fnac-tel-07.svg',
  './assets/produits/fnac-tel-08.svg',
  './assets/produits/fnac-tel-09.svg',
  './assets/produits/fnac-tel-10.svg',
  './assets/produits/fnac-game-01.svg',
  './assets/produits/fnac-game-02.svg',
  './assets/produits/fnac-game-03.svg',
  './assets/produits/fnac-game-04.svg',
  './assets/produits/fnac-game-05.svg',
  './assets/produits/fnac-game-06.svg',
  './assets/produits/fnac-game-07.svg',
  './assets/produits/fnac-game-08.svg',
  './assets/produits/fnac-game-09.svg',
  './assets/produits/fnac-game-10.svg',
  './assets/produits/fnac-game-11.svg',
  './assets/produits/fnac-game-12.svg',
  './assets/produits/fnac-game-13.svg',
  './assets/produits/fnac-game-14.svg',
  './assets/produits/fnac-photo-01.svg',
  './assets/produits/fnac-photo-02.svg',
  './assets/produits/fnac-photo-03.svg',
  './assets/produits/fnac-photo-04.svg',
  './assets/produits/fnac-photo-05.svg',
  './assets/produits/fnac-photo-06.svg',
  './assets/produits/fnac-photo-07.svg',
  './assets/produits/fnac-photo-08.svg',
  './assets/produits/fnac-photo-09.svg',
  './assets/produits/fnac-photo-10.svg',
  './assets/produits/fnac-livre-01.svg',
  './assets/produits/fnac-livre-02.svg',
  './assets/produits/fnac-livre-03.svg',
  './assets/produits/fnac-livre-04.svg',
  './assets/produits/fnac-livre-05.svg',
  './assets/produits/fnac-livre-06.svg',
  './assets/produits/fnac-livre-07.svg',
  './assets/produits/fnac-livre-08.svg',
  './assets/produits/fnac-livre-09.svg',
  './assets/produits/fnac-livre-10.svg',
  './assets/produits/fnac-livre-11.svg',
  './assets/produits/fnac-livre-12.svg',
  './assets/produits/fnac-manga-01.svg',
  './assets/produits/fnac-manga-02.svg',
  './assets/produits/fnac-manga-03.svg',
  './assets/produits/fnac-manga-04.svg',
  './assets/produits/fnac-manga-05.svg',
  './assets/produits/fnac-manga-06.svg',
  './assets/produits/fnac-manga-07.svg',
  './assets/produits/fnac-manga-08.svg',
  './assets/produits/fnac-manga-09.svg',
  './assets/produits/fnac-manga-10.svg',
  './assets/produits/fnac-vinyle-01.svg',
  './assets/produits/fnac-vinyle-02.svg',
  './assets/produits/fnac-vinyle-03.svg',
  './assets/produits/fnac-vinyle-04.svg',
  './assets/produits/fnac-vinyle-05.svg',
  './assets/produits/fnac-vinyle-06.svg',
  './assets/produits/fnac-vinyle-07.svg',
  './assets/produits/fnac-vinyle-08.svg',
  './assets/produits/fnac-pape-01.svg',
  './assets/produits/fnac-pape-02.svg',
  './assets/produits/fnac-pape-03.svg',
  './assets/produits/fnac-pape-04.svg',
  './assets/produits/fnac-pape-05.svg',
  './assets/produits/fnac-pape-06.svg',
  './assets/produits/fnac-jeu-01.svg',
  './assets/produits/fnac-jeu-02.svg',
  './assets/produits/fnac-jeu-03.svg',
  './assets/produits/fnac-jeu-04.svg',
  './assets/produits/fnac-jeu-05.svg',
  './assets/produits/fnac-jeu-06.svg',
  './victoire-palier.js?v=16',
  './records-palier.js?v=2',
  './typewriter-secours.js?v=1',
  './install-promo.js?v=6',
  './install-promo-accueil.js?v=1',
  './animations-accueil.js?v=2',
  './ecoutille.js?v=46',
  './artefact-moteur.js?v=8',
  './artefact-service.js?v=8',
  './magasin-fnac.js?v=1',
  './magasin-fnac.js?v=3',
  './magasin-guard.js?v=3',
  './fnac-lecteur.js?v=1',
  './admin-artefact.js?v=33',
  './data/magasins-fnac.json',
  './data/magasins-fnac.json?v=1',
  './assets/fond-nautilus.jpg',
  './assets/film-nautilus-P.jpg?v=2',
  './assets/film-nautilus-L.jpg?v=2',
  './assets/mer/caustique-1.jpg?v=1',
  './assets/mer/caustique-2.jpg?v=1',
  './assets/palier3-lieu.jpg',
  './assets/palier4-lieu.jpg',
  './assets/ambiance-sonar.mp3',
  './assets/alerte-open.mp3?v=7',
  './assets/Victoire.mp3',
  './assets/Submarine_alarm.mp3',
  './assets/hublot-click.wav',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

/* Chaque ressource est precachee independamment : cache.addAll annule
   TOUT le lot si une seule reponse echoue (par exemple un son indisponible
   lors d'une coupure 4G). On essaie au besoin l'ancien cache pour ce meme
   fichier et cette meme version ; les autres ressources restent utilisables. */
async function remplirPrecache() {
  const cache = await caches.open(CACHE_NAME);
  let prochain = 0;
  async function charger() {
    while (prochain < PRECACHE.length) {
      const adresse = PRECACHE[prochain++];
      try {
        const reponse = await fetch(adresse, { cache: 'reload' });
        if (!reponse.ok) throw new Error('HTTP ' + reponse.status);
        await cache.put(adresse, reponse);
      } catch (_) {
        try {
          const copie = await caches.match(adresse);
          if (copie) await cache.put(adresse, copie);
        } catch (_) { /* stockage indisponible : les autres fichiers restent */ }
      }
    }
  }
  // Six telechargements en parallele : ne pas saturer une connexion mobile.
  await Promise.all(Array.from({ length: 6 }, () => charger()));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await remplirPrecache();
    // L'accueil affiche un bandeau de mise a jour, sans recharger le joueur.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Supprimer impérativement tous les anciens caches nautilus périmés
    await Promise.all(
      keys.filter((k) => k.startsWith('nautilus-v') && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* Safari demande parfois quelques octets avant de jouer le son. Comme ce
   signal est petit et précaché, on peut servir sa plage même hors ligne.
   Les vidéos et tous les autres médias conservent leur traitement habituel. */
async function plageAlerte(req) {
  const format = /^bytes=(\d*)-(\d*)$/i.exec(req.headers.get('range') || '');
  if (!format || (!format[1] && !format[2])) return fetch(req);
  const cache = await caches.match(req);
  if (!cache || !cache.ok) return fetch(req);
  const contenu = await cache.arrayBuffer();
  const taille = contenu.byteLength;
  let debut, fin;
  if (!format[1]) {
    const suffixe = Number(format[2]);
    debut = Math.max(0, taille - suffixe);
    fin = taille - 1;
  } else {
    debut = Number(format[1]);
    fin = format[2] ? Math.min(Number(format[2]), taille - 1) : taille - 1;
  }
  if (!Number.isSafeInteger(debut) || !Number.isSafeInteger(fin) || debut >= taille || debut > fin) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + taille } });
  }
  return new Response(contenu.slice(debut, fin + 1), {
    status: 206,
    headers: {
      'Content-Type': cache.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + debut + '-' + fin + '/' + taille,
      'Content-Length': String(fin - debut + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

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
  /* Les vidéos demandent souvent un fragment (Range), notamment sur iOS.
     Pour elles, le serveur gère la réponse 206 ; seule l'alerte courte
     précachée bénéficie du repli hors ligne ci-dessus. */
  if (req.headers.has('range')) {
    if (url.pathname.endsWith('/assets/alerte-open.mp3')) event.respondWith(plageAlerte(req));
    return;
  }
  // Pages HTML : network-first forcé (bypasse le cache local du navigateur), fallback cache
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.open(CACHE_NAME).then((c) => c.match(req)).then((r) => r || caches.open(CACHE_NAME).then((c) => c.match('./index.html'))))
    );
    return;
  }
  /* CSS et JS : cache immediat, puis revalidation en arriere-plan. Le
     waitUntil est indispensable : sans lui le navigateur peut terminer le
     service worker avant que la nouvelle version soit ecrite dans le cache. */
  const dest = req.destination;
  const estCodeOuStyle = dest === 'style' || dest === 'script'
    || url.pathname.endsWith('.css') || url.pathname.endsWith('.js');
  if (estCodeOuStyle) {
    const miseAJour = fetch(req).then(async (res) => {
      if (res && res.ok) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, res.clone());
        } catch (_) { /* une erreur de cache ne doit pas masquer la reponse */ }
      }
      return res;
    }).catch(() => null);
    event.waitUntil(miseAJour);
    event.respondWith(
      caches.open(CACHE_NAME).then((c) => c.match(req)).catch(() => null)
        .then((cached) => cached || miseAJour.then((res) => res || Response.error()))
    );
    return;
  }

  // Autres assets (images, sons, polices) : cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, copy));
      return res;
    }).catch(() => cached))
  );
});
