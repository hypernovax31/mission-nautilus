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
     6. la page de garde (écoutille) : dessin simple et solide (coque
        opaque, un seul mouvement, aucune dépendance externe), sentinelle
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

const porte   = lire('ecoutille.js');
const sw      = lire('sw.js');
const corps   = accueil.slice(accueil.indexOf('<body>'));
const iSocle  = accueil.indexOf('SOCLE DE LA PAGE DE GARDE');
const socleCss = accueil.slice(accueil.indexOf('<style>', iSocle), accueil.indexOf('</style>', iSocle));
const socleJs  = accueil.slice(accueil.indexOf('SOCLE — LE CLIC'), accueil.indexOf('</script>', accueil.indexOf('SOCLE — LE CLIC')));
const bloc = (re) => (socleCss.match(re) || [''])[0];

/* --- Rien à charger : le dessin de la garde est écrit DANS la page --------
   Deux rapports « rien ne s'affiche » : la page de garde ne doit plus jamais
   pouvoir manquer à cause d'un fichier qui n'arrive pas. Le moindre risque
   pris ici, c'est un visiteur enfermé derrière une cloison.                 */
ok('la feuille externe de la garde a disparu (le dessin est dans la page)',
   !accueil.includes('ecoutille.css') && !sw.includes('ecoutille.css'));
ok('le moteur de la garde est chargé en différé (après le guetteur du 1er geste)',
   /<script src="ecoutille\.js\?v=\d+" defer><\/script>/.test(accueil));
ok('un repère de version dit quelle page de garde est chargée (garde v6)',
   /class="ec-version"/.test(accueil) && accueil.includes('garde v6'));
ok("l'écoutille est le TOUT PREMIER élément du <body> (avant les lecteurs <audio>)",
   corps.indexOf('id="ecoutille"') > 0 && corps.indexOf('id="ecoutille"') < corps.indexOf('id="ambianceAudio"'));
ok('sans JavaScript, aucune écoutille (personne ne reste enfermé)',
   accueil.includes('<noscript><style>#ecoutille{display:none !important}</style></noscript>'));

/* --- LE DESSIN SIMPLE : plus rien qui puisse déborder ---------------------
   Bug signalé sur iPhone : pendant l'ouverture, « le métal et la lumière
   partaient dans tous les sens hors du hublot ». La cause était le découpage
   de l'écoutille (masque radial et clip-path) posé sur des éléments ANIMÉS :
   WebKit leur donne une couche de composition et perd le découpage. La
   refonte ne corrige pas la cause, elle la SUPPRIME : plus de trou, donc
   plus rien à découper. Ces tests verrouillent ce choix — les remettre en
   cause, c'est ramener le bug.                                              */
ok('le socle ne découpe RIEN (ni clip-path, ni masque) et ne charge aucune image',
   !/clip-path|mask-image|-webkit-mask/.test(socleCss) && !/url\(/.test(socleCss));
ok('ceinture de sécurité : rien ne peut sortir du cadre de la garde (overflow:hidden)',
   /#ecoutille\{[\s\S]{0,420}overflow:hidden/.test(socleCss));

const blocCoque = bloc(/#ecoutille \.ec-coque\{[\s\S]*?\}/);
ok('la coque est OPAQUE : son dernier fond est un aplat plein écran',
   /radial-gradient\(125% 95% at 50% 34%, #46525c 0%, #2b353d 38%, #1a2228 66%, #0c1216 88%, #05080b 100%\)/.test(blocCoque));
ok('la coque ne comporte ni fond transparent ni demi-teinte (aucun trou possible)',
   !/background:\s*transparent/.test(blocCoque) && !/opacity/.test(blocCoque));
ok("l'ouverture est UN SEUL mouvement : translateY(-102 %) de la coque",
   /#ecoutille\.ec-levee \.ec-coque\{transform:translateY\(-102%\)\}/.test(socleCss) &&
   !/rotate\(|scale\(|skew|matrix/.test(blocCoque));

const blocLueur = bloc(/#ecoutille \.ec-lueur\{[\s\S]*?\}/);
ok('la lumière du sas est pleine page (absolute + inset:0) et déjà PLEINE',
   blocLueur.includes('position:absolute') && blocLueur.includes('inset:0') &&
   blocLueur.includes('opacity:1') &&
   /radial-gradient\([^)]*#ffffff/.test(blocLueur) && blocLueur.includes('rgba(28,104,178,.97)'));
ok('la lumière s’efface en UN SEUL fondu, et c’est lui qui révèle l’accueil',
   /#ecoutille\.ec-lumiere-sortie \.ec-lueur\{opacity:0\}/.test(socleCss));
ok('la coque est son propre empilement (le panneau du bas ne passe pas sous le métal)',
   blocCoque.includes('isolation:isolate'));
ok('la lumière est déclarée AVANT la coque : elle est donc dessous',
   accueil.indexOf('class="ec-lueur"') > 0 &&
   accueil.indexOf('class="ec-lueur"') < accueil.indexOf('class="ec-coque"'));

/* Ce qui s'anime doit rester dans transform / opacité / filtre : les seules
   propriétés que tous les moteurs animent sans recalcul de mise en page —
   donc sans à-coup, et sans surprise sur iPhone.                            */
const transitions = [...socleCss.matchAll(/transition:\s*([^;}]+)/g)].map(m => m[1].trim());
ok('aucune transition ne touche la mise en page (que transform, opacité, filtre)',
   transitions.length > 0 &&
   transitions.every(t => !/\b(top|left|right|bottom|width|height|inset|mask|clip-path|background)\b/.test(t)));
ok('moins d’animation est respecté (préférence système)',
   socleCss.includes('prefers-reduced-motion'));
ok('l’alerte du sas bat tant que la porte est fermée (.ec-alarme)',
   socleCss.includes('#ecoutille.ec-alarme .ec-alerte{opacity:1; animation:ecAlarme') &&
   socleCss.includes('@keyframes ecAlarme'));
ok('le bouton rouge est habillé dans la page (dôme + collier + libellé + halo)',
   socleCss.includes('.ec-dome') && socleCss.includes('.ec-start::before') &&
   socleCss.includes('.ec-start::after') && socleCss.includes('.ec-start-label'));
ok('déjà franchie : la garde ne s’affiche pas du tout',
   socleCss.includes('.ec-passee #ecoutille{display:none !important}'));
ok('le verrou de défilement est posé sur html et body',
   socleCss.includes('.ec-bloque, .ec-bloque body{overflow:hidden !important}'));
ok('le socle de la page de garde est écrit AVANT les feuilles de style',
   iSocle > 0 && accueil.search(/<link rel="stylesheet" href="css\//) > iSocle);
ok('le socle garde le fond transparent (la page du jeu reste intacte derrière)',
   /#ecoutille\{[\s\S]{0,400}background:transparent/.test(socleCss));

/* --- La sentinelle du <head> : écran en place, ou pas, dès la 1re image --- */
const _s0 = accueil.indexOf('  (function(){\n    try{\n      var racine = document.documentElement;');
const sentinelle = accueil.slice(_s0, accueil.indexOf('  })();', _s0) + 7);
ok('la décision est prise dans le <head>, avant le premier rendu', sentinelle.length > 200);
ok('la garde se joue à CHAQUE chargement (le son doit être redébloqué à chaque fois)',
   /var jouer = !passer \|\| forcer;/.test(sentinelle));
ok('elle ne dépend PLUS d’un marqueur de session (cause du « rien ne s’affiche »)',
   !/jouer = !deja/.test(sentinelle) && !/getItem\('nautilusEcoutille'\) === '1'/.test(sentinelle));
ok('la sentinelle est écrite AVANT les feuilles de style (décision la plus précoce possible)',
   accueil.indexOf('PAGE DE GARDE : DÉCISION') > 0 &&
   accueil.indexOf('PAGE DE GARDE : DÉCISION') < accueil.search(/<link rel="stylesheet" href="css\//));
ok('le titre de l’onglet témoigne que l’écoutille est chargée',
   sentinelle.includes('ÉCOUTILLE FERMÉE') && porte.includes('window.__ecoutilleTitre'));
ok('déjà ouverte : la classe ec-passee est posée avant tout dessin',
   sentinelle.includes("racine.classList.add('ec-passee')"));
ok('la garde verrouille le défilement de l’accueil (ec-bloque)',
   sentinelle.includes("racine.classList.add('ec-bloque')"));
ok('?ecoutille=1 / ?ecoutille=0 pilotent la garde',
   sentinelle.includes("ecoutille=(1|oui)") && sentinelle.includes("ecoutille=(0|non)"));
ok('la décision est prise UNE fois et posée sur window (le moteur la relit)',
   sentinelle.includes('window.__ecoutilleJouer = jouer') && porte.includes('window.__ecoutilleJouer'));
ok('le moteur ne recalcule PAS la décision quand la sentinelle l’a prise',
   /if\(typeof window\.__ecoutilleJouer === 'boolean'\)/.test(porte));
ok('ORDRE PAR LE CHEMIN : /ecoutille rejoue la garde, sans aucun paramètre',
   sentinelle.includes('/\\/ecoutille(\\/|$)/'));
ok('l’ancre aussi (/#ecoutille=1) : rien ne peut se perdre',
   sentinelle.includes('location.pathname + location.search + location.hash'));
ok('le bouton « Revoir l’écoutille » peut forcer la garde, sans adresse',
   sentinelle.includes("sessionStorage.getItem('nautilusEcoutilleForce')") &&
   porte.includes("sessionStorage.setItem(CLE_FORCE, '1')"));
ok('l’ordre exprès ne sert qu’une fois (pas de garde à chaque rechargement)',
   porte.includes('sessionStorage.removeItem(CLE_FORCE)'));
ok('l’accueil offre un bouton pour rejouer l’écoutille à tout moment',
   accueil.includes('id="ecRevoirBtn"'));
ok('ce bouton efface le marqueur de session avant de recharger',
   /ecRevoirBtn[\s\S]{0,700}removeItem\(CLE_SESSION\)/.test(porte));
ok('filet de sécurité : le site se rouvre si le moteur ne charge pas (20 s)',
   sentinelle.includes('__ecoutilleMinuteurSecours') && sentinelle.includes('20000'));
ok('le filet de sécurité rend aussi son titre à l’onglet',
   /__ecoutilleMinuteurSecours[\s\S]{0,400}document\.title = window\.__ecoutilleTitre/.test(sentinelle));

/* --- Le balisage de la garde --------------------------------------------- */
ok('la porte est annoncée comme une boîte de dialogue (lecteurs d’écran)',
   /id="ecoutille" role="dialog" aria-modal="true"/.test(corps));
ok('le clic sur START est un vrai geste (bouton réel, jamais un div)',
   /<button id="ecStart" class="ec-start" type="button"/.test(corps));
ok('le bouton porte le nom exigé : START', /<span class="ec-start-label">START<\/span>/.test(corps));
ok('une seule lumière, une seule coque, une seule alerte dans le balisage',
   (corps.match(/class="ec-lueur"/g) || []).length === 1 &&
   (corps.match(/class="ec-coque"/g) || []).length === 1 &&
   (corps.match(/class="ec-alerte"/g) || []).length === 1);
ok('un seul curseur clignotant dans le journal de départ',
   (corps.match(/class="ec-curseur"/g) || []).length === 1);

/* --- Le moteur : le geste, le journal, le son ---------------------------- */
ok('le moteur lit la préférence de sonar du site (nautilusSoundOn)',
   porte.includes("localStorage.getItem('nautilusSoundOn') === '0'"));
ok('silence respecté : aucun contexte audio n’est créé si le sonar est coupé',
   /function contexte\(\)\{\s*if\(_ctx\) return _ctx;\s*if\(silencieux\(\)\) return null;/.test(porte));
ok('silence respecté : l’alarme de bord ne joue pas non plus',
   /function alarmeDeBord\(dureeMs\)\{\s*if\(silencieux\(\)\) return;/.test(porte));
ok('l’alarme de bord réutilise le lecteur du site (puis le rend intact)',
   porte.includes("getElementById('alarmAudio')") && porte.includes('a.currentTime = 0'));
ok('le clic sur START déclenche l’ouverture', /start\?\.addEventListener\('click', ouvrir\)/.test(porte));
ok('le moteur ajoute la classe qui lève la coque', /classList\.add\('ec-levee'\)/.test(porte));
ok('puis la classe qui laisse passer la lumière', /classList\.add\('ec-lumiere-sortie'\)/.test(porte));
ok('l’ouverture est annoncée à la page (le sonar du site se débloque)',
   porte.includes("new CustomEvent('nautilus:ecoutille-ouverte')"));
ok('l’écoutille est retirée du DOM une fois ouverte (rien ne tourne en fond)',
   porte.includes('racine.remove()'));
ok('le journal se tape tout seul dans la liste déjà présente dans la page',
   porte.includes('journal.appendChild') && corps.includes('id="ecJournal"'));
ok('le curseur est DÉPLACÉ d’une ligne à l’autre (jamais semé)',
   porte.includes('function poserCurseur()') && porte.includes('if(_curseur) _curseur.remove()'));

/* --- Le socle de secours écrit dans la page ------------------------------ */
ok('socle : un mini-script ouvre l’écoutille sans aucun fichier externe',
   socleJs.includes("getElementById('ecStart')") && socleJs.includes('addEventListener'));
ok('socle : il fait la même ouverture (coque levée, lumière sortie, garde retirée)',
   socleJs.includes("classList.add('ec-levee')") &&
   socleJs.includes("classList.add('ec-lumiere-sortie')") &&
   socleJs.includes("classList.add('ec-passee')"));
ok('socle : il prévient le reste du site (même événement que le moteur)',
   socleJs.includes('nautilus:ecoutille-ouverte'));
ok('socle : il rend son titre à l’onglet et le défilement à l’accueil',
   socleJs.includes('document.title') && socleJs.includes("classList.remove('ec-bloque')"));
ok('socle : le moteur reprend la main (un seul gestionnaire actif)',
   socleJs.includes('__ecoutilleSecours = function') && porte.includes('window.__ecoutilleSecours'));
ok('socle : écriture tolérante au mode privé (try/catch)',
   /try\{[\s\S]{0,200}sessionStorage\.setItem\('nautilusEcoutille'/.test(socleJs));

/* --- Le service worker : page de garde disponible hors ligne -------------- */
ok('le moteur de la page de garde est précaché', sw.includes("'./ecoutille.js?v="));
/* Le moteur de la garde a CHANGÉ de fond en comble : le cache-first du
   service worker servirait l'ancienne version à jamais si le numéro de
   version ne bougeait pas. */
const versionJS = Number((/<script src="ecoutille\.js\?v=(\d+)" defer><\/script>/.exec(accueil) || [])[1]);
const versionCache = Number((/CACHE_NAME = 'nautilus-v(\d+)'/.exec(sw) || [])[1]);
ok('le moteur de la garde est en version 6 ou plus (v' + versionJS + ')', versionJS >= 6);
ok('le service worker précache EXACTEMENT cette version',
   sw.includes("'./ecoutille.js?v=" + versionJS + "'"));
ok('le cache du service worker a été relevé pour cette refonte (v' + versionCache + ')',
   versionCache >= 305);

/* =====================================================================
   7. LE GESTE DE LA PAGE DE GARDE DÉBLOQUE *TOUS* LES SONS DE L'ACCUEIL
   ---------------------------------------------------------------------
   Rappel du bug signalé : « le but de l'animation d'accueil est
   d'activer tous les sons de la page ; ça ne fonctionne pas ».
   Cause : le clic sur START ne débloquait que ce qui EXISTAIT déjà à cet
   instant (l'ambiance, le contexte des hublots). Tout le reste naissait
   ou se jouait PLUS TARD, hors du geste :
     · le contexte privé de la frappe, créé une seconde après la
       révélation — sur iOS, un contexte né hors geste reste suspendu et
       resume() n'est accepté que dans la pile de l'événement ;
     · les lecteurs <audio> des alarmes (mission, révélation d'équipage),
       jamais lancés dans un geste, donc verrouillés ;
     · l'ambiance elle-même, dont le play() était différé de 80 ms.
   Ces tests verrouillent les quatre règles qui réparent cela.
   ===================================================================== */
titre('7. Sons de l’accueil débloqués par le clic sur START (page de garde)');

ok('la frappe de l’ordre de mission vit sur le contexte audio PARTAGÉ',
   /function _openTypeAudio\(\)\{[\s\S]{0,400}sfxContext\(\)/.test(accueil),
   'c’est ce contexte-là qui est créé et réveillé dans le clic sur START');
ok('plus aucun contexte privé pour la frappe (né hors geste = suspendu sur iOS)',
   !/_typeCtx/.test(accueil));
ok('le bus de frappe est préparé dans le PREMIER geste, avec l’alarme de fin et Victoire',
   /surPremierGeste\(\(\) => \{ chargerSonAlarmeFin\(\); chargerSonVictoire\(\); \}, 3\);/.test(accueil));
ok('le contexte partagé n’est jamais fermé par la frappe (sinon retour au bug)',
   !/function _closeTypeAudio\(\)\{[\s\S]{0,400}\.close\(\)/.test(accueil));

ok('une veille réveille le contexte partagé DANS la pile du geste (règle iOS)',
   accueil.includes('function _veillerContextePartage()') &&
   /if\(_sfxCtx\.state === 'suspended'\) _sfxCtx\.resume\(\)/.test(accueil));
ok('la veille n’écoute que de VRAIS gestes (ni mousemove, ni scroll)',
   accueil.includes("const VRAIS_GESTES = ['pointerdown','touchstart','mousedown','keydown','click','touchend'];"));
ok('la veille se retire une fois le contexte en marche (aucun écouteur qui traîne)',
   /if\(_sfxCtx\.state === 'running'\)\{[\s\S]{0,300}removeEventListener/.test(accueil));

ok('l’ambiance est démasquée DANS le geste, sans attendre les 80 ms',
   /if\(a\.paused\) return _demasquerAmbiance\(a\);[\s\S]{0,400}setTimeout\(resolve, 80\)/.test(accueil),
   'sinon, sur iOS, le play() arrivait après la fenêtre du geste');
ok('le démasquage est écrit UNE fois (deux appels, même code)',
   (accueil.match(/return _demasquerAmbiance\(a\);/g) || []).length === 2 &&
   accueil.includes('function _demasquerAmbiance(a){'));

ok('l’alarme de mission essaie Web Audio AVANT le lecteur <audio>',
   accueil.indexOf('if(jouerAlarmeFinWebAudio(durationMs || 6300)) return;') > 0 &&
   accueil.indexOf('if(jouerAlarmeFinWebAudio(durationMs || 6300)) return;') <
     accueil.indexOf("const alarmAudio = document.getElementById('alarmAudio');",
       accueil.indexOf('function playSubmarineAlarm')), 'le <audio> reste le repli');
ok('la révélation d’un équipage joue Victoire.mp3 par Web Audio d’abord',
   /function playAlarmOnce\(\)\{[\s\S]{0,3000}if\(jouerVictoireWebAudio\(0, finish\)\)/.test(accueil));
ok('Victoire.mp3 est téléchargée et décodée dans le premier geste, sans être jouée',
   /function chargerSonVictoire\(\)\{[\s\S]{0,500}decodeAudioData/.test(accueil));
ok('sonar coupé : les deux lecteurs Web Audio refusent de jouer',
   /function jouerVictoireWebAudio\(offset, onEnded\)\{\s*if\(!isSoundEnabled\(\)\) return false;/.test(accueil) &&
   /function jouerAlarmeFinWebAudio\(dureeMs\)\{\s*if\(!isSoundEnabled\(\)\) return false;/.test(accueil));
ok('hors écran : la source Web Audio s’arrête et retient sa position',
   accueil.includes('_revealOffset = _positionVictoire();') &&
   accueil.includes('function _positionVictoire()') &&
   /_revealVoix\.arreter\(\)/.test(accueil));
ok('un arrêt volontaire ne passe pas pour une fin d’annonce',
   /src\.onended = \(\) => \{\s*if\(stoppe\) return;/.test(accueil));

/* --- Comportement RÉEL des nouveaux lecteurs, sur un faux contexte -------
   On extrait les deux fonctions du fichier et on les fait tourner avec un
   faux Web Audio : c'est le seul moyen de prouver, sans navigateur, que
   l'annonce se termine bien à la fin du son, qu'un arrêt volontaire (bloc
   sorti de l'écran) ne la termine PAS, et que la position de reprise est
   juste — y compris après une extinction qui fige l'horloge du contexte. */
const sourceVictoire = accueil.slice(
  accueil.indexOf('function jouerVictoireWebAudio(offset, onEnded){'),
  accueil.indexOf('/* Preparation au premier geste : TELECHARGEMENT + DECODAGE uniquement.')
);
if (!sourceVictoire) { console.log('  ❌ lecteurs Web Audio introuvables dans index.html'); process.exit(1); }

const fabriqueLecteurs = new Function(`
  let _revealVoix = null, _revealEnCours = false, _revealOffset = 0, _revealFin = null;
  let _victoireBuffer = { duration: 4.1 };
  let _son = true, _ctx = null;
  function isSoundEnabled(){ return _son; }
  function sfxContext(){ return _ctx; }
  ${sourceVictoire}
  return {
    jouerVictoireWebAudio, _positionVictoire,
    poserCtx: c => { _ctx = c; },
    couper: v => { _son = v; },
    voix: () => _revealVoix,
    buffer: () => { const b = _victoireBuffer; _victoireBuffer = null; return b; },
    rendre: b => { _victoireBuffer = b; }
  };
`);

function fauxContexte(){
  const ctx = {
    currentTime: 0,
    destination: {},
    derniereSource: null,
    createBufferSource(){
      const s = { buffer: null, onended: null, debut: null, arretee: false,
        connect(){ }, start(q, offset){ s.debut = [q, offset]; },
        stop(){ s.arretee = true; if (s.onended) s.onended(); } };
      ctx.derniereSource = s;
      return s;
    },
    createGain(){ return { gain: { value: 1 }, connect(){ } }; }
  };
  return ctx;
}

const L = fabriqueLecteurs();
const ctxA = fauxContexte();
L.poserCtx(ctxA);
let finsNaturelles = 0;
ok('Web Audio : le son part depuis le début et prévient à sa fin',
   L.jouerVictoireWebAudio(0, () => { finsNaturelles++; }) === true &&
   ctxA.derniereSource.debut.join(',') === '0,0');
ctxA.currentTime = 1.5;
ok('Web Audio : la position de reprise suit l’horloge du contexte (' + L._positionVictoire().toFixed(2) + ' s)',
   Math.abs(L._positionVictoire() - 1.5) < 0.001);
ctxA.derniereSource.onended();
ok('Web Audio : la fin naturelle termine l’annonce une seule fois',
   finsNaturelles === 1 && L.voix() === null);

/* Mise en pause du bloc : on arrête la source, et sa fin ne doit PAS
   compter comme une fin d'annonce (sinon la file des révélations
   s'enchaînerait pendant que le joueur regarde ailleurs). */
const ctxB = fauxContexte();
L.poserCtx(ctxB);
let finsPendantPause = 0;
L.jouerVictoireWebAudio(0, () => { finsPendantPause++; });
ctxB.currentTime = 2.0;
const position = L._positionVictoire();
L.voix().arreter();
ok('Web Audio : un arrêt volontaire ne termine pas l’annonce (position retenue ' + position.toFixed(2) + ' s)',
   finsPendantPause === 0 && Math.abs(position - 2.0) < 0.001);
ok('Web Audio : la reprise repart de la position retenue',
   L.jouerVictoireWebAudio(position, () => {}) === true &&
   ctxB.derniereSource.debut.join(',') === '0,2');

/* Sonar coupé : aucun chemin Web Audio ne joue (règle absolue du son). */
L.couper(false);
ok('Web Audio : sonar coupé = aucune lecture, même décodée',
   L.jouerVictoireWebAudio(0, () => {}) === false);
L.couper(true);
const garde = L.buffer();
ok('Web Audio : sans fichier décodé, on renvoie false (le <audio> prend le relais)',
   L.jouerVictoireWebAudio(0, () => {}) === false);
L.rendre(garde);

/* =====================================================================
   RÉSULTAT
   ===================================================================== */
console.log('\n' + (echoues ? '❌ ' : '✅ ') + reussis + ' test(s) réussi(s), ' + echoues + ' échec(s).');
process.exit(echoues ? 1 : 0);
