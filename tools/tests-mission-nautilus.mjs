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
     4. la cohérence des écrans qui ANNONCENT ces durées.

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
   RÉSULTAT
   ===================================================================== */
console.log('\n' + (echoues ? '❌ ' : '✅ ') + reussis + ' test(s) réussi(s), ' + echoues + ' échec(s).');
process.exit(echoues ? 1 : 0);
