/* =====================================================================
   TESTS DE LA MISSION NAUTILUS — à lancer avec Node, SANS aucune
   dépendance à installer :

       node tools/tests-mission-nautilus.mjs

   Pourquoi ces tests ? Deux bugs signalés en jeu venaient de règles
   recopiées à la main dans plusieurs fichiers (accueil, Palier 1,
   paliers ≥ 2). Une copie oubliait de suivre l'autre, et le jeu
   annonçait une durée fausse au joueur.

   Ce fichier vérifie donc, en lisant les VRAIS fichiers du jeu :
     1. le barème des remontées en surface (le cran se compte en
        remontées — échecs + indices — et non en échecs seuls) ;
     2. le blocage déclenché par une demande d'indice ;
     3. le module partagé des paliers ≥ 2 (matelot-blocages.js) ;
     4. la cohérence des écrans qui ANNONCENT ces durées ;
     5. l'écran de blocage de l'accueil, rendu pour de vrai ;
     6. la page de garde (écoutille) : géométrie des pales, sentinelle
        du <head>, silence respecté, mise en cache.

   Aucune écriture, aucun accès réseau : Firebase est remplacé par une
   fausse base en mémoire.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const lire = (nom) => fs.readFileSync(path.join(ici, '..', nom), 'utf8');

let reussis = 0, echoues = 0;
const ok = (nom, condition) => {
  if (condition) { reussis++; console.log('  ✅ ' + nom); }
  else { echoues++; console.log('  ❌ ' + nom); }
};
const titre = (t) => console.log('\n' + t);

const palier1 = lire('palier1.html');
const accueil = lire('index.html');
const commun  = lire('matelot-blocages.js');

/* =====================================================================
   1. LE BARÈME DES REMONTÉES EN SURFACE
   ===================================================================== */
titre('1. Barème des remontées (helpers du Palier 1)');

const sourceHelpers = palier1.slice(
  palier1.indexOf('const LOCK_HOURS = [1, 2, 4, 8, 12];'),
  palier1.indexOf("/* Blocage de tout l'equipage")
);
if (!sourceHelpers) { console.log('  ❌ helpers introuvables dans palier1.html'); process.exit(1); }
const H = new Function(
  sourceHelpers + '\n return { getLockHours, getLockedUntilISO, remonteesDe, prochainePeineH };'
)();

ok('le barème donne 1 h, 2 h, 4 h, 8 h, 12 h puis 24 h',
   [1, 2, 3, 4, 5, 6, 7].map(n => H.getLockHours(n)).join(',') === '1,2,4,8,12,24,24');
ok('fiche ancienne (sans surfaceCount) : repli sur le compteur d’échecs',
   H.remonteesDe({ failCount: 2 }) === 2);
ok('fiche ancienne d’un indice (0 échec) : aucune remontée comptée',
   H.remonteesDe({ failCount: 0 }) === 0);
ok('fiche récente : le rang de remontée prime sur le compteur d’échecs',
   H.remonteesDe({ failCount: 0, surfaceCount: 1 }) === 1);

/* LE BUG SIGNALÉ : « Pour seulement 1 h après un blocage de 1 h ?? » */
ok('après une remontée d’1 h (échec) : la suivante coûte 2 h',
   H.prochainePeineH({ failCount: 1, surfaceCount: 1 }) === 2);
ok('après une remontée d’1 h (INDICE, 0 échec) : la suivante coûte 2 h',
   H.prochainePeineH({ failCount: 0, surfaceCount: 1 }) === 2);
ok('matelot jamais remonté : sa prochaine remontée coûte 1 h',
   H.prochainePeineH({ failCount: 0, surfaceCount: 0 }) === 1);
ok('4 remontées subies : la prochaine coûte 12 h',
   H.prochainePeineH({ failCount: 3, surfaceCount: 4 }) === 12);

/* =====================================================================
   2. LE BLOCAGE PAR DEMANDE D'INDICE (Palier 1)
   ===================================================================== */
titre('2. Demande d’indice : 1 h pour soi, et le barème avance d’un cran');

/* On prend toute la section « indice » : elle porte la constante
   HINT_LOCK_HOURS dont dépend le blocage. requestHint, présent dans la
   même section, n'est pas appelé ici (son popup a ses propres tests). */
const sourceIndice = palier1.slice(
  palier1.indexOf('const HINT_LOCK_HOURS = 1;'),
  palier1.indexOf('function buildHintContent(idx)')
);
if (!sourceIndice) { console.log('  ❌ blockMatelotForHint introuvable'); process.exit(1); }

const messages = [];
const state = {
  isTest: false, teamCode: 'NEMO',
  me: { name: 'PILOU', memberKey: 'PILOU' },
  team: { failCount: 3, matelotLocks: {} }
};
const Njeu = {
  getLockHours: H.getLockHours, remonteesDe: H.remonteesDe, prochainePeineH: H.prochainePeineH,
  formatDate: () => 'demain 10:00',
  showToast: (m) => messages.push(m),
  saveTeam: async (t, patch) => ({ ...t, ...patch })
};
const fenetre = { NautilusAnnonces: null };
const poserBlocageIndice = new Function('state', 'N', 'window',
  sourceIndice + '\n return blockMatelotForHint;')(state, Njeu, fenetre);

await poserBlocageIndice();
const apres1 = state.team.matelotLocks.PILOU;
ok('l’indice N’EST PAS compté comme un échec (compteur intact)', apres1.failCount === 0);
ok('le rang de remontée monte à 1', apres1.surfaceCount === 1);
ok('la remontée est facturée 1 h', apres1.lastLockHours === 1);
ok('le motif « indice_demande » est enregistré', apres1.reason === 'indice_demande');
ok('la remontée dure bien une heure, pas un instant',
   new Date(apres1.lockedUntil).getTime() - Date.now() > 59 * 60 * 1000);
ok('les avaries de l’équipage ne montent pas', state.team.failCount === 3);
ok('la peine suivante annoncée est 2 h', H.prochainePeineH(apres1) === 2);
ok('le message au joueur annonce 1 h maintenant ET 2 h ensuite',
   messages[0].includes('1 h') && messages[0].includes('2 h'));

state.team.matelotLocks.PILOU = { ...apres1 };
await poserBlocageIndice();
const apres2 = state.team.matelotLocks.PILOU;
ok('2e indice : rang 2, toujours facturé 1 h', apres2.surfaceCount === 2 && apres2.lastLockHours === 1);
ok('2e indice : la peine suivante passe à 4 h', H.prochainePeineH(apres2) === 4);

state.isTest = true;
state.team.matelotLocks.PILOU = { ...apres2 };
messages.length = 0;
await poserBlocageIndice();
const apresEssai = state.team.matelotLocks.PILOU;
ok('partie d’essai : le blocage expire aussitôt',
   new Date(apresEssai.lockedUntil).getTime() <= Date.now() + 1000);
ok('partie d’essai : aucun barème annoncé au testeur', !messages[0].includes('2 h'));
state.isTest = false;

/* =====================================================================
   3. LE MODULE PARTAGÉ DES PALIERS ≥ 2
   ===================================================================== */
titre('3. Paliers ≥ 2 (matelot-blocages.js) : même règle, fausse base en mémoire');

const base = { 'teams/NEMO': { failCount: 0, matelotLocks: {} } };
const fsFictif = {
  getFirestore: () => ({}),
  doc: (_db, ...chemin) => ({ chemin: chemin.join('/') }),
  getDoc: async (ref) => ({ exists: () => !!base[ref.chemin], data: () => base[ref.chemin] }),
  updateDoc: async (ref, patch) => {
    const d = base[ref.chemin] || (base[ref.chemin] = {});
    Object.entries(patch).forEach(([cle, valeur]) => {
      if (cle.startsWith('matelotLocks.')) {
        d.matelotLocks = { ...(d.matelotLocks || {}), [cle.split('.')[1]]: valeur };
      } else d[cle] = valeur;
    });
  }
};
const fenetre2 = { NautilusBlocagesImport: (kind) => kind === 'app' ? { getApps: () => [{}], getApp: () => ({}) } : fsFictif };
new Function('window', commun)(fenetre2);
const B = fenetre2.NautilusBlocages;
if (!B) { console.log('  ❌ NautilusBlocages non exposé'); process.exit(1); }
const ident = { code: 'AAAA-1111', name: 'PILOU', memberKey: 'PILOU', teamCode: 'NEMO', isTest: false };

const r1 = await B.poserBlocage(ident, 'mots_croises_too_many_errors');
ok('1er échec : 1 h', r1.hours === 1 && r1.surfaceCount === 1);
base['teams/NEMO'].matelotLocks.PILOU = { name: 'PILOU', failCount: 1, surfaceCount: 1, lastLockHours: 1 };
const r2 = await B.poserBlocage(ident, 'puzzle_too_many_reveals');
ok('après une remontée d’1 h : l’échec suivant coûte 2 h', r2.hours === 2 && r2.surfaceCount === 2);
ok('le compteur d’échecs reste un compteur d’échecs', r2.failCount === 2);
base['teams/NEMO'].matelotLocks.PILOU = { name: 'PILOU', failCount: 3, lastLockHours: 8 };
const r3 = await B.poserBlocage(ident, 'raison');
ok('fiche ancienne : ancien calcul conservé (3 échecs → 8 h)', r3.hours === 8);
ok('remonteesDe est exposé par le module', typeof B.remonteesDe === 'function');

/* =====================================================================
   4. LES ÉCRANS QUI ANNONCENT LES DURÉES
   ===================================================================== */
titre('4. Cohérence des écrans et du popup de confirmation');

ok('accueil : l’indice n’est plus présenté comme un échec',
   accueil.includes("monLock.reason === 'indice_demande'"));
ok('accueil : la peine suivante se calcule sur le rang de remontée',
   accueil.includes('getLockHours(remonteesDe(monLock) + 1)'));
ok('accueil : plus aucune promesse « au prochain échec, ce sera »',
   !accueil.includes('Au prochain échec, ce sera'));
ok('accueil : le mot « échec » ne décrit plus un blocage pour indice',
   accueil.includes('Cette remontée ne bloque que <b>toi</b>'));
ok('accueil : remonteesDe est bien défini dans le module',
   accueil.includes('function remonteesDe(lock)'));

ok('Palier 1 : le popup annonce la peine suivante AVANT de confirmer',
   palier1.includes('id="sacrificeEscalade"')
   && palier1.includes('N.prochainePeineH(monLock)'));
ok('Palier 1 : les lignes de blocage parlent de la remontée suivante',
   palier1.includes('Prochaine remontée, échec ou indice'));
ok('Palier 1 : la peine suivante y est calculée sur le rang de remontée',
   palier1.includes('N.prochainePeineH(l)'));
ok('Palier 1 : le relais compare les rangs de remontée, pas les échecs',
   palier1.includes('m.remontees + 1) < suivante'));
ok('Palier 1 : plus aucune annonce « Prochain échec : »',
   !palier1.includes('Prochain échec : <b>'));
ok('Palier 1 : le popup reste ouvert sur « Non » (aucun sacrifice par réflexe)',
   palier1.includes("requestAnimationFrame(() => { try { btnNon.focus(); }"));
ok('Palier 1 : la session est relue APRÈS la confirmation du popup',
   palier1.indexOf('const confirmer = await demanderConfirmationSacrifice') <
   palier1.indexOf("N.showToast('La partie n’est plus en cours"));

/* =====================================================================
   5. L'ÉCRAN « STATUT PERSONNEL » DE L'ACCUEIL, RENDU POUR DE VRAI
   C'est l'écran que voit le matelot bloqué : on évalue le VRAI texte
   source, avec un blocage d'indice puis un blocage pour échec.
   ===================================================================== */
titre('5. Écran « Statut personnel » (accueil) : ce que lit le matelot');

const debutEcr = accueil.indexOf('\'<div class="ck-screen-value">REMONTÉE FORCÉE</div>\'');
const finEcr   = accueil.indexOf("getLockHours(remonteesDe(monLock) + 1) + ' h</b>.</p>'");
if (debutEcr < 0 || finEcr < 0) {
  console.log('  ❌ bloc « REMONTÉE FORCÉE » introuvable dans index.html');
  echoues++;
} else {
  const gabarit = accueil.slice(debutEcr, finEcr + "getLockHours(remonteesDe(monLock) + 1) + ' h</b>.</p>'".length);
  const rendre = new Function('monLock', 'esc', 'formatDate', 'getLockHours', 'remonteesDe', 'return ' + gabarit + ';');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vueIndice = rendre(
    { reason: 'indice_demande', failCount: 0, surfaceCount: 1, lastLockHours: 1,
      lockedUntil: new Date(Date.now() + 3600e3).toISOString() },
    esc, () => 'demain 10:00', H.getLockHours, H.remonteesDe);
  ok('indice : l’écran dit que l’indice reste acquis à l’équipage',
     vueIndice.includes('reste acquis à <b>tout l’équipage</b>'));
  ok('indice : l’écran ne parle PLUS d’un échec', !vueIndice.includes('Ton échec ne bloque que'));
  ok('indice : la prochaine remontée est annoncée à 2 h', vueIndice.includes('coûtera <b class="ck-risque-h">2 h'));
  ok('indice : la durée subie est bien affichée (1 h en surface)', vueIndice.includes('1 h en surface'));

  const vueEchec = rendre(
    { reason: 'morse_too_many_errors', failCount: 1, surfaceCount: 1, lastLockHours: 1,
      lockedUntil: new Date(Date.now() + 3600e3).toISOString() },
    esc, () => 'demain 10:00', H.getLockHours, H.remonteesDe);
  ok('échec : l’écran parle bien de l’échec', vueEchec.includes('Ton échec ne bloque que'));
  ok('échec : la prochaine remontée est annoncée à 2 h', vueEchec.includes('coûtera <b class="ck-risque-h">2 h'));

  /* Le scénario exact du bug signalé : 1er échec (1 h), puis un indice. */
  const apresEchec = { reason: 'morse_too_many_errors', failCount: 1, surfaceCount: 1, lastLockHours: 1,
                       lockedUntil: new Date(Date.now() + 3600e3).toISOString() };
  const vueSuite = rendre(apresEchec, esc, () => 'demain 10:00', H.getLockHours, H.remonteesDe);
  ok('scénario signalé : après un blocage de 1 h, ce n’est plus « ce sera 1 h »',
     !vueSuite.includes('>1 h</b>') && vueSuite.includes('>2 h</b>'));
}

/* =====================================================================
   6. LA PAGE DE GARDE (ÉCOUTILLE DU PREMIER CHARGEMENT)
   ===================================================================== */
titre('6. Page de garde — écoutille du premier chargement');

const porte = lire('ecoutille.js');
const porteCss = lire('css/ecoutille.css');
const sw = lire('sw.js');

ok('la feuille de la page de garde existe et est liée avec sa version',
   /<link rel="stylesheet" href="css\/ecoutille\.css\?v=\d+">/.test(accueil));
ok('le moteur de la page de garde est chargé en différé (après les modules du site)',
   /<script src="ecoutille\.js\?v=\d+" defer><\/script>/.test(accueil));

const corps = accueil.slice(accueil.indexOf('<body>'));
ok('l\'écoutille est le TOUT PREMIER élément du <body> (avant les lecteurs <audio>)',
   corps.indexOf('id="ecoutille"') > 0 && corps.indexOf('id="ecoutille"') < corps.indexOf('id="ambianceAudio"'));

/* --- La sentinelle du <head> : écran en place, ou pas, dès la 1re image --- */
const sentinelle = accueil.slice(
  accueil.indexOf('  (function(){\n    try{\n      var racine = document.documentElement;'),
  accueil.indexOf('  })();', accueil.indexOf('  (function(){\n    try{\n      var racine = document.documentElement;')) + 7);
ok('la décision est prise dans le <head>, avant le premier rendu', sentinelle.length > 200);
ok('nouvelle visite : la garde est jouée (aucun marqueur de session)',
   sentinelle.includes("sessionStorage.getItem('nautilusEcoutille')"));
ok('déjà ouverte : la classe ec-passee est posée avant tout dessin',
   sentinelle.includes("racine.classList.add('ec-passee')"));
ok('la garde verrouille le défilement de l\'accueil (ec-bloque)',
   sentinelle.includes("racine.classList.add('ec-bloque')"));
ok('?ecoutille=1 / ?ecoutille=0 pilotent la garde',
   sentinelle.includes("d === '1'") && sentinelle.includes("d === '0'"));
ok('filet de sécurité : le site se rouvre si le moteur ne charge pas (20 s)',
   sentinelle.includes('__ecoutilleMinuteurSecours') && sentinelle.includes('20000'));
ok('sans JavaScript, aucune écoutille (personne ne reste enfermé)',
   accueil.includes('<noscript><style>#ecoutille{display:none !important}</style></noscript>'));

/* --- Les huit pales : géométrie vérifiée par calcul de couverture ------- */
const nbPales = (corps.match(/class="ec-pale-bascule"/g) || []).length;
ok('huit pales dans le diaphragme', nbPales === 8);
const rotations = [...corps.matchAll(/class="ec-pale" transform="rotate\((\d+) 500 500\)"/g)].map(m => Number(m[1]));
ok('les pales sont posées tous les 45° (0 à 315)',
   rotations.length === 8 && rotations.every((r, i) => r === i * 45));

const corpsPale = /<circle class="ec-pale-corps" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/.exec(corps);
ok('chaque pale est un disque (rayon et centre définis)', Boolean(corpsPale));
const [cxPale, cyPale, rPale] = corpsPale ? [Number(corpsPale[1]), Number(corpsPale[2]), Number(corpsPale[3])] : [500, 210, 290];
/* Deux nombres portent toute la mécanique : la pale est un disque de rayon
   rPale dont le centre est à cyPale du pivot — autrement dit le bord de la
   pale passe EXACTEMENT par le centre de l'écoutille (500). C'est ce qui
   rend l'écoutille parfaitement étanche une fois fermée, et c'est aussi ce
   qu'un diaphragme d'optique fait : les lamelles s'appuient au centre. */
const cyPaleC = cyPale;
ok('l\'arc de la pale passe par le centre de l\'écoutille (cy + rayon = 500)',
   cyPale + rPale === 500, cyPale + ' + ' + rPale);
ok('le pivot des pales est bien le bord de l\'écoutille (rotate … 500 0)',
   corps.includes('rotate(0 500 0)'));

const rotMax = Number((/const PALE_ROTATION\s*=\s*([\d.]+)/.exec(porte) || [])[1]);
const glisseMax = Number((/const PALE_GLISSE\s*=\s*([\d.]+)/.exec(porte) || [])[1]);
ok('les constantes d\'ouverture sont lisibles dans le moteur', rotMax > 0 && glisseMax > 0);

/* On REFAIT le calcul du jeu : disques de pale placés sur la couronne,
   chacun pivotant autour de son point du bord. Fermé, l'ensemble doit
   couvrir tout le disque de l'écoutille ; ouvert, il doit le libérer. */
function couverture(angleDeg, glisse, pas = 8){
  const R = 500, N = 8;
  const pivot = i => { const t = i * Math.PI / 4; return [500 + R * Math.sin(t), 500 - R * Math.cos(t)]; };
  const tourner = (p, c, deg) => { const t = deg * Math.PI / 180, s = Math.sin(t), k = Math.cos(t);
    const x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * k - y * s, c[1] + x * s + y * k]; };
  const centres = [];
  for(let i = 0; i < N; i++){
    const P = pivot(i);
    const vx = 500 - P[0], vy = 500 - P[1], n = Math.hypot(vx, vy);
    const Q = tourner([P[0] + vx / n * cyPaleC, P[1] + vy / n * cyPaleC], P, angleDeg);
    centres.push([Q[0] - vx / n * glisse, Q[1] - vy / n * glisse]);
  }
  let dedans = 0, total = 0;
  for(let y = 0; y <= 1000; y += pas) for(let x = 0; x <= 1000; x += pas){
    const dx = x - 500, dy = y - 500;
    if(dx * dx + dy * dy > R * R) continue;
    total++;
    if(centres.some(c => (x - c[0]) ** 2 + (y - c[1]) ** 2 <= rPale * rPale)) dedans++;
  }
  return 100 * dedans / total;
}
const couvertFerme = couverture(0, 0);
const couvertOuvert = couverture(rotMax, glisseMax);
ok('écoutille fermée : les pales couvrent la totalité du disque (' + couvertFerme.toFixed(2) + ' %)',
   couvertFerme >= 99.9);
ok('écoutille ouverte : les pales libèrent le passage (' + couvertOuvert.toFixed(1) + ' % restant)',
   couvertOuvert <= 12);
ok('l\'ouverture est bien plus large que la fermeture', couvertFerme - couvertOuvert > 85);

/* --- Le son : la garde est le geste qui débloque le sonar du site -------- */
ok('le moteur lit la préférence de sonar du site (nautilusSoundOn)',
   porte.includes("localStorage.getItem('nautilusSoundOn') === '0'"));
ok('silence respecté : aucun contexte audio n\'est créé si le sonar est coupé',
   /function contexte\(\)\{\s*\n\s*if\(_ctx\) return _ctx;\s*\n\s*if\(silencieux\(\)\) return null;/.test(porte));
ok('silence respecté : l\'alarme de bord ne joue pas non plus',
   /function alarmeDeBord\(dureeMs\)\{\s*\n\s*if\(silencieux\(\)\) return;/.test(porte));
ok('le clic sur START est un vrai geste (bouton réel, jamais un div)',
   /<button id="ecStart" class="ec-start" type="button"/.test(corps));
ok('le bouton porte le nom exigé : START', /<span class="ec-start-label">START<\/span>/.test(corps));
ok('l\'écoutille est retirée du DOM une fois ouverte (rien ne tourne en fond)',
   porte.includes('racine.remove()') && porte.includes('nautilus:ecoutille-ouverte'));

/* --- La feuille de style -------------------------------------------------- */
ok('la page de garde passe au-dessus de tout, panneau d\'administration compris',
   /#ecoutille\{[\s\S]{0,900}z-index:13000 !important/.test(porteCss));
ok('déjà franchie : la garde ne s\'affiche pas du tout',
   porteCss.includes('.ec-passee #ecoutille{display:none !important}'));
ok('le verrou de défilement est posé sur html et body',
   porteCss.includes('.ec-bloque, .ec-bloque body{overflow:hidden !important}'));
ok('moins d\'animation est respecté (pas de stroboscope)',
   porteCss.includes('prefers-reduced-motion'));
ok('repli prévu pour un navigateur sans masque CSS',
   porteCss.includes('.ec-sans-masque .ec-voile'));

/* --- Le service worker : page de garde disponible hors ligne -------------- */
ok('la feuille de la page de garde est précachée', sw.includes("'./css/ecoutille.css?v="));
ok('le moteur de la page de garde est précaché', sw.includes("'./ecoutille.js?v="));
const versionCache = Number((/CACHE_NAME = 'nautilus-v(\d+)'/.exec(sw) || [])[1]);
ok('le cache du service worker a été versionné pour cette nouveauté', versionCache >= 299);

/* =====================================================================
   RÉSULTAT
   ===================================================================== */
console.log('\n' + (echoues ? '❌ ' : '✅ ') + reussis + ' test(s) réussi(s), ' + echoues + ' échec(s).');
process.exit(echoues ? 1 : 0);
