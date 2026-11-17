// Service worker minimal pour PWA Mission Nautilus
// Pages : network-first ; code et styles : cache avec revalidation en fond.
const CACHE_NAME = 'nautilus-v406';
const PRECACHE = [
  './',
  './index.html',
  './palier1.html',
  './1721310619.html',
  './1831411720.html',
  './1941512821.html',
  './2051613922.html',
  './classement.html',
  './css/index.css?v=80',
  './css/artefact.css?v=1',
  './css/animations-accueil.css?v=2',
  './css/classement.css?v=9',
  './css/hublots.css?v=15',
  './css/palier1.css?v=49',
  './css/palier2.css?v=26',
  './css/palier3.css?v=3',
  './css/palier4.css?v=1',
  './css/admin.css?v=10',
  './anti-zoom.js?v=1',
  './son-partage.js?v=2',
  './sonar-button.js?v=4',
  './admin-button.js?v=26',
  './palier-annonces.js?v=3',
  './journal-bord.js?v=6',
  './palier-sas.js?v=13',
  './palier-briefing.js?v=3',
  './matelot-blocages.js?v=2',
  './reserve-o2.js?v=4',
  './equipage-actif.js?v=10',
  './mots-croises.js?v=9',
  './puzzle-palier3.js?v=3',
  './palier4-marqueurs.js?v=1',
  './victoire-palier.js?v=13',
  './records-palier.js?v=2',
  './typewriter-secours.js?v=1',
  './install-promo.js?v=6',
  './install-promo-accueil.js?v=1',
  './animations-accueil.js?v=2',
  './ecoutille.js?v=46',
  './artefact-moteur.js?v=8',
  './artefact-service.js?v=8',
  './magasin-fnac.js?v=1',
  './magasin-guard.js?v=3',
  './fnac-lecteur.js?v=1',
  './admin-artefact.js?v=27',
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
    const cache = await caches.open(CACHE_NAME);
    const presents = await Promise.all(PRECACHE.map((adresse) => cache.match(adresse)));
    if (presents.every(Boolean)) {
      const keys = await caches.keys();
      // Ne jamais supprimer les caches d'une autre application du domaine.
      await Promise.all(keys.filter((k) => k.startsWith('nautilus-v') && k !== CACHE_NAME)
        .map((k) => caches.delete(k)));
    }
    // Si le precache est incomplet, l'ancien reste disponible hors connexion.
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
