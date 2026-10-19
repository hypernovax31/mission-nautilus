/* =====================================================================
   TESTS D'INTERFACE DU PALIER 3 — le jeu rendu pour de vrai
   (tools/tests-artefact-interface.mjs)

       node tools/tests-artefact-interface.mjs

   Les tests de règles (tools/tests-artefact-palier3.mjs) vérifient le
   moteur et le service. Ceux-ci vérifient ce que le MATELOT VOIT : les
   écrans s'enchaînent, les boutons font ce qu'ils annoncent, la jauge de
   tentatives se vide, un code illisible ne coûte rien, l'indice exige un
   sacrifice confirmé — et surtout, à aucun moment le DOM n'affiche le
   titre, l'EAN ou le SKU de l'ouvrage.

   Dépendance FACULTATIVE : jsdom, installé dans tools/.deps (ignoré par
   git). Sans lui, ce fichier se contente d'afficher un avertissement et
   rend la main avec un code de retour nul : la suite principale du dépôt
   reste exécutable sans rien installer.

       npm install --prefix tools/.deps jsdom --no-audit --no-fund
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');
const lire = (nom) => fs.readFileSync(path.join(racine, nom), 'utf8');

let reussis = 0, echoues = 0;
const ok = (nom, condition) => {
  if (condition) { reussis++; console.log('  ✅ ' + nom); }
  else { echoues++; console.log('  ❌ ' + nom); }
};
const titre = (t) => console.log('\n' + t);

/* ------------------------------------------------------------------ */
let JSDOM = null;
for (const candidat of [
  path.join(ici, '.deps', 'node_modules', 'jsdom', 'lib', 'api.js'),
  'jsdom'
]) {
  try {
    const module = await import(candidat);
    JSDOM = module.JSDOM;
    if (JSDOM) break;
  } catch (e) { /* candidat suivant */ }
}
if (!JSDOM) {
  console.log('⚠️ jsdom absent : tests d’interface ignorés.');
  console.log('   Installe-le avec : npm install --prefix tools/.deps jsdom --no-audit --no-fund');
  console.log('RESULTAT_HEX=' + Buffer.from('0/0').toString('hex'));
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Le navigateur de test                                               */
/* ------------------------------------------------------------------ */
const dom = new JSDOM(
  '<!DOCTYPE html><html lang="fr"><body><div id="hote"></div><div id="magasin"></div></body></html>',
  { url: 'https://hypernovax31.github.io/mission-nautilus/1831411720.html', pretendToBeVisual: true }
);
const win = dom.window;

/* Node fournit un WebCrypto complet ; jsdom n'a pas toujours subtle. */
const { webcrypto } = await import('node:crypto');
Object.defineProperty(win, 'crypto', { value: webcrypto, configurable: true });

/* Aucune caméra dans un test : c'est précisément le repli « saisie des
   13 chiffres » qui doit fonctionner. */
Object.defineProperty(win.navigator, 'mediaDevices', { value: undefined, configurable: true });

/* La liste des magasins est servie ici depuis le dépôt (pas de réseau). */
const listeBrute = lire('data/magasins-fnac.json');
const requetes = [];
/* Les modules sont évalués dans le domaine global de Node (jsdom sans
   runScripts) : c'est donc `globalThis.fetch` qu'ils atteignent. On le
   remplace par un lecteur du dépôt — AUCUNE requête réseau n'est émise
   pendant les tests, et la liste reste servie en chemin RELATIF comme sur
   le site. */
const fetchLocal = (url) => {
  requetes.push(String(url));
  return Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(JSON.parse(listeBrute)),
    text: () => Promise.resolve(listeBrute)
  });
};
Object.defineProperty(globalThis, 'fetch', { value: fetchLocal, configurable: true, writable: true });
Object.defineProperty(win, 'fetch', { value: fetchLocal, configurable: true, writable: true });

/* Node 22 expose `navigator` en lecture seule : on redéfinit proprement. */
const exposer = (nom, valeur) => {
  Object.defineProperty(globalThis, nom, { value: valeur, configurable: true, writable: true });
};
exposer('window', win);
exposer('document', win.document);
exposer('navigator', win.navigator);
exposer('localStorage', win.localStorage);
exposer('HTMLElement', win.HTMLElement);
exposer('MouseEvent', win.MouseEvent);
exposer('Event', win.Event);
exposer('MutationObserver', win.MutationObserver);
exposer('FileReader', win.FileReader);
exposer('Blob', win.Blob);

/* Les modules du jeu sont évalués DANS la fenêtre, comme sur la page. */
['artefact-moteur.js', 'artefact-service.js', 'magasin-fnac.js', 'artefact-palier3.js'].forEach((f) => {
  win.eval(lire(f));
});
const M = win.NautilusArtefactMoteur;
const A = win.NautilusArtefact;
const MG = win.NautilusMagasin;
const JEU = win.NautilusArtefactJeu;

if (!M || !A || !MG || !JEU) { console.log('❌ modules non chargés dans la fenêtre'); process.exit(1); }

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const deboguer = async (etiqette) => {
  if (!process.env.ARTEFACT_DEBUG) return;
  const session = await A.lireSession(etiqette);
  console.log('   [debug ' + etiqette + '] dom = '
    + Buffer.from(texte().replace(/\s+/g, ' ').slice(0, 300)).toString('base64'));
  console.log('   [debug ' + etiqette + '] session = '
    + Buffer.from(JSON.stringify(session && {
        statut: session.statut, etape: session.etape, validees: session.etapesValidees,
        erreurs: session.erreurs, cartouche: session.cartoucheId
      })).toString('base64'));
};
const $ = (sel) => win.document.querySelector(sel);
const texte = () => ($('#hote') ? $('#hote').textContent : '');
const html = () => ($('#hote') ? $('#hote').innerHTML : '');
async function clic(sel) {
  const el = $(sel);
  if (!el) throw new Error('élément introuvable : ' + sel);
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await attendre(30);
  return el;
}
async function saisir(sel, valeur) {
  const el = $(sel);
  if (!el) throw new Error('champ introuvable : ' + sel);
  el.value = valeur;
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
  await attendre(10);
  return el;
}

/* ------------------------------------------------------------------ */
/* Préparation : un ouvrage FICTIF (EAN de la plage interne 200-299)   */
/* ------------------------------------------------------------------ */
function cleEan(douze) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(douze[i]) * (i % 2 === 0 ? 1 : 3);
  return douze + String((10 - (s % 10)) % 10);
}
const OUVRAGE = {
  id: 'test-atlas', titre: 'Atlas imaginaire des grandes profondeurs',
  auteur: 'Collectif', auteurType: 'collectif', editeur: 'Maison Test',
  edition: '3e édition', editionNumero: 3, annee: 2024,
  ean: cleEan('200000000100'), sku: 'TEST-1',
  categorieFnac: 'Atlas / carte (broché)', rayon: 'Géographie',
  type: 'atlas-mondial', liens: ['monde'],
  disponibilite: {
    cl57: { statut: 'disponible', delai: 'Retrait gratuit sous 1H',
            checkedAt: new Date().toISOString(), vendeur: 'fnac', magasin: 'cl57' }
  }
};
const SECRET_INTERDIT = [OUVRAGE.ean, OUVRAGE.titre, OUVRAGE.sku, 'Maison Test', OUVRAGE.rayon];

A.initialiser({ stockage: A.stockageMemoire() });
await A.ecrireConfig({ mode: 'operateur', fenetreMinutes: 15 });
const generation = await A.genererCartouchesPour('cl57', { livres: [OUVRAGE], sansCoffre: true });
const REPONSES = generation.faites[0].secret.reponses;

const appels = { victoires: [], remontees: [], sacrifices: [], erreurs: [], journal: [] };
const hote = $('#hote');
const jeu = JEU.init(hote, {
  equipe: 'NEMO',
  matelot: { name: 'JULES', teamCode: 'NEMO' },
  magasin: { id: 'cl57', nom: 'Labège', ville: 'Labège', cp: '31670' },
  service: A, magasins: MG,
  journal: (t, k) => appels.journal.push({ t, k }),
  signalerCapitaine: () => {},
  onErreurComptee: (n, max) => appels.erreurs.push({ n, max }),
  onSacrifice: (indice, aide) => { appels.sacrifices.push({ indice: indice.cle, aide }); return Promise.resolve({ heures: indice.heures, lockedUntil: Date.now() + 3600000, surfaceCount: 1 }); },
  onRemontee: (info) => appels.remontees.push(info),
  onVictoire: (d) => appels.victoires.push(d)
});

/* ===================================================================== */
titre('1. Premier écran : l’indice du Nautilus');
/* ===================================================================== */
await jeu.charger();
await attendre(120);
ok('l’écran de l’indice s’affiche', texte().includes('indice du Nautilus'));
ok('l’énigme de la famille est affichée', /Nautilus/.test(texte()) && texte().length > 200);
ok('le bouton « J’ai l’ouvrage en main » est présent', Boolean($('#afTrouve')));
ok('le pupitre affiche la jauge des 3 tentatives', win.document.querySelectorAll('.af-jauge-pt').length === 3);
ok('les trois indices payants sont proposés (1 h, 2 h, 4 h)',
  win.document.querySelectorAll('[data-indice]').length === 3
  && texte().includes('1 h de surface') && texte().includes('4 h de surface'));
ok('le bouton « Livre introuvable » est toujours accessible', Boolean($('#afIntrouvable')));
ok('aucune donnée de l’ouvrage n’est affichée', SECRET_INTERDIT.every((s) => !texte().includes(s) && !html().includes(s)));
ok('les aides de méthode ne sont PAS affichées avant le sacrifice',
  !texte().includes('volume qui mesure, classe et situe'));

/* ===================================================================== */
titre('2. Le sceau : scan refusé, code illisible, scan accepté');
/* ===================================================================== */
await clic('#afTrouve');
ok('l’écran du sceau s’affiche', Boolean($('#afCamBtn')) && Boolean($('#afEan')));
ok('la saisie manuelle est proposée quand la caméra est absente', Boolean($('#afManuelBtn')));

/* Un code invalide : le sceau ne l'examine pas, aucune erreur comptée. */
await saisir('#afEan', '12');
await clic('#afEanOk');
await attendre(60);
ok('un code-barres invalide n’est pas compté comme une erreur',
  appels.erreurs.length === 0 && /aucune erreur comptée/i.test(texte()));
ok('un code invalide ne déclenche aucune remontée', appels.remontees.length === 0);

/* Trois EAN valides mais différents : 3 erreurs → remontée. */
const mauvais = [cleEan('200000000200'), cleEan('200000000210'), cleEan('200000000220')]
  .filter((e) => M.eanValide(e) && e !== OUVRAGE.ean);
await saisir('#afEan', mauvais[0]);
await clic('#afEanOk');
await attendre(200);
ok('le sceau rejette un autre ouvrage avec un message épique',
  /sceau du Nautilus rejette|profondeurs gardent leur secret/i.test(texte()));
ok('une diode de la jauge est grillée', win.document.querySelectorAll('.af-jauge-pt.is-grille').length === 1);
ok('l’erreur est remontée à la page', appels.erreurs.length === 1 && appels.erreurs[0].n === 1);
ok('le rejet n’affiche jamais l’EAN attendu', SECRET_INTERDIT.every((s) => !texte().includes(s)));

await saisir('#afEan', mauvais[1]);
await clic('#afEanOk');
await attendre(200);
ok('deuxième refus : dernière tentative annoncée', /dernière tentative/i.test(texte()));

/* Le bon EAN : la mission avance. */
await saisir('#afEan', REPONSES.ean);
await clic('#afEanOk');
await attendre(300);
await deboguer('NEMO');
ok('le sceau reconnaît l’artefact', /reconnaît l['’]artefact/i.test(texte()));
await attendre(1700);                       // l'enchaînement d'écran est temporisé
ok('l’épreuve de la couverture suit le sceau', /couverture/i.test(texte()) && Boolean($('#afReponseChamp')));
ok('la consigne demande le premier mot SANS donner la réponse',
  /PREMIER MOT SIGNIFICATIF/i.test(texte()) && !texte().includes(REPONSES.premierMot));

/* ===================================================================== */
titre('3. Les épreuves saisies : couverture, signature, chambre forte');
/* ===================================================================== */
await saisir('#afReponseChamp', 'mauvaise réponse');
await clic('#afValider');
await attendre(250);
ok('une réponse fausse est refusée (et comptée)', /refuse cette réponse/i.test(texte()));
ok('le troisième refus déclenche la remontée en surface',
  appels.remontees.length === 1 && appels.remontees[0].motif === 'echec');
ok('l’écran de jeu laisse la place au bandeau de remontée', !$('#afReponseChamp') || appels.remontees.length === 1);

/* Nouvelle session pour la suite : on repart d'un équipage vierge. */
A.initialiser({ stockage: A.stockageMemoire() });
await A.ecrireConfig({ mode: 'operateur' });
const gen2 = await A.genererCartouchesPour('cl57', { livres: [OUVRAGE], sansCoffre: true });
const R2 = gen2.faites[0].secret.reponses;
appels.victoires.length = 0; appels.remontees.length = 0; appels.erreurs.length = 0;

const jeu2 = JEU.init($('#hote'), {
  equipe: 'ARONNAX', magasin: { id: 'cl57', nom: 'Labège' },
  service: A, magasins: MG, journal: () => {},
  onSacrifice: (indice, aide) => { appels.sacrifices.push({ indice: indice.cle, aide }); return Promise.resolve({ heures: indice.heures }); },
  onRemontee: (i) => appels.remontees.push(i),
  onVictoire: (d) => appels.victoires.push(d)
});
await jeu2.charger();
await attendre(120);
await clic('#afTrouve');
await saisir('#afEan', R2.ean);
await clic('#afEanOk');
await attendre(2000);
ok('le sceau validé mène à la couverture', Boolean($('#afReponseChamp')));

await saisir('#afReponseChamp', R2.premierMot.toLowerCase());
await clic('#afValider');
await attendre(1600);
ok('la couverture validée mène à la signature', /signature/i.test(texte()));
ok('la table de conversion des lettres est affichée', texte().includes('A=01') && texte().includes('Z=26'));
ok('la consigne de signature ne donne aucune valeur',
  !texte().includes(R2.signature) && !/lettre C/i.test(texte()));

await saisir('#afReponseChamp', R2.signature.replace(/^0/, ''));   // saisie non rembourrée
await clic('#afValider');
await attendre(1600);
ok('une signature saisie sans zéro de tête est acceptée', /chambre forte/i.test(texte()));
ok('l’ordre du voyage est annoncé à l’écran', /Ordre du voyage/i.test(texte()));
ok('le code final n’est pas affiché', !texte().includes(R2.codeFinal));

await saisir('#afReponseChamp', R2.codeFinal.toLowerCase().replace(/-/g, ' '));
await clic('#afValider');
await attendre(1800);                       // l'écran de victoire est temporisé
ok('la chambre forte s’ouvre avec un code saisi librement (espaces, minuscules)',
  appels.victoires.length === 1);
ok('la victoire remonte le temps, les erreurs et les indices',
  Boolean(appels.victoires[0]) && typeof appels.victoires[0].tempsSecondes === 'number'
  && appels.victoires[0].erreurs === 0
  && Array.isArray(appels.victoires[0].indices));
ok('aucune donnée de l’ouvrage n’a fui pendant toute la partie',
  SECRET_INTERDIT.every((s) => !html().includes(s)));

/* ===================================================================== */
titre('4. Indice payant : le sacrifice d’abord, l’indice ensuite');
/* ===================================================================== */
A.initialiser({ stockage: A.stockageMemoire() });
await A.ecrireConfig({ mode: 'operateur' });
const gen3 = await A.genererCartouchesPour('cl57', { livres: [OUVRAGE], sansCoffre: true });
appels.sacrifices.length = 0; appels.remontees.length = 0;
const jeu3 = JEU.init($('#hote'), {
  equipe: 'NEDLAND', magasin: { id: 'cl57', nom: 'Labège' },
  service: A, magasins: MG, journal: () => {},
  onSacrifice: (indice, aide) => { appels.sacrifices.push({ indice: indice.cle, aide }); return Promise.resolve({ heures: indice.heures }); },
  onRemontee: (i) => appels.remontees.push(i),
  onVictoire: () => {}
});
await jeu3.charger();
await attendre(120);
await clic('[data-indice="1"]');
ok('l’écran de sacrifice s’affiche avant toute révélation', /sacrifice/i.test(texte()) && Boolean($('#afSacrificeOui')));
ok('le sacrifice annonce la durée (1 h) et le relais', /1 heure/i.test(texte()) && /relais/i.test(texte()));
ok('rien n’est révélé avant la confirmation', !texte().includes('volume qui mesure, classe et situe'));
await clic('#afSacrificeNon');
ok('refuser le sacrifice ramène au jeu sans rien révéler',
  appels.sacrifices.length === 0 && !texte().includes('volume qui mesure, classe et situe'));

await clic('[data-indice="1"]');
await clic('#afSacrificeOui');
await attendre(200);
ok('accepter le sacrifice inscrit l’indice et déclenche la remontée',
  appels.sacrifices.length === 1 && appels.sacrifices[0].indice === 'rayon');
ok('la page reçoit l’aide de méthode à afficher avec la remontée',
  typeof appels.sacrifices[0].aide === 'string' && appels.sacrifices[0].aide.length > 20);
ok('la remontée pour indice est signalée à la page', appels.remontees.some((r) => r.motif === 'indice'));
const session3 = await A.lireSession('NEDLAND');
ok('l’indice reste acquis à l’équipage (session mise à jour)',
  session3.indicesUtilises.includes('rayon') && Boolean(session3.demandeIndice));

/* ===================================================================== */
titre('5. Livre introuvable : signalement sans pénalité');
/* ===================================================================== */
A.initialiser({ stockage: A.stockageMemoire() });
await A.ecrireConfig({ mode: 'operateur' });
await A.genererCartouchesPour('cl57', { livres: [OUVRAGE], sansCoffre: true });
const jeu4 = JEU.init($('#hote'), {
  equipe: 'NAUTILUS', magasin: { id: 'cl57', nom: 'Labège' },
  service: A, magasins: MG, journal: () => {},
  onSacrifice: () => Promise.resolve({}), onRemontee: () => {}, onVictoire: () => {}
});
await jeu4.charger();
await attendre(120);
await clic('#afIntrouvable');
ok('l’écran de signalement explique l’absence de pénalité', /aucune erreur/i.test(texte()) && Boolean($('#afSignaler')));
await clic('#afSignaler');
await attendre(250);
const session4 = await A.lireSession('NAUTILUS');
ok('le signalement suspend la mission', session4.statut === 'suspendue');
ok('le signalement n’ajoute aucune erreur', Number(session4.erreurs || 0) === 0);
await attendre(2400);
ok('l’écran de mission suspendue prend le relais', /suspendue|nouvelle piste/i.test(texte()));

/* ===================================================================== */
titre('6. Sélecteur de magasin (accueil et reprise en jeu)');
/* ===================================================================== */
await MG.monterSelecteur($('#magasin'), { suggereGeo: false, onConfirme: () => {} });
await attendre(250);
const zone = $('#magasin');
ok('le sélecteur affiche la liste officielle', zone.querySelectorAll('#magasinListe option').length > 100);
ok('la liste est lue en RELATIF (jamais une URL absolue vers un autre site)',
  requetes.length > 0 && requetes.every((u) => u.indexOf('data/magasins-fnac.json') === 0));
ok('le sélecteur n’appelle JAMAIS fnac.com',
  requetes.every((u) => !/fnac\.com/i.test(u)));
ok('le sélecteur propose la recherche', Boolean(zone.querySelector('#magasinRecherche')));
ok('le sélecteur propose la géolocalisation sur un geste', Boolean(zone.querySelector('#magasinGeo')));
ok('le sélecteur annonce la durée de conservation de la position (RGPD)',
  /ni enregistrée, ni transmise/i.test(zone.textContent));
await saisir('#magasinRecherche', 'Labège');
await attendre(60);
ok('la recherche filtre la liste', zone.querySelectorAll('#magasinListe option').length >= 2
  && zone.querySelectorAll('#magasinListe option').length < 20);
zone.querySelector('#magasinListe').value = 'cl57';
await clic('#magasinOk');
await attendre(60);
ok('la confirmation mémorise le magasin', MG.courant() && MG.courant().id === 'cl57');
ok('le magasin mémorisé ne contient AUCUNE coordonnée GPS',
  Boolean(MG.courant()) && !('lat' in MG.courant()) && !('lon' in MG.courant()));
MG.effacer();
ok('le choix peut être effacé', MG.courant() === null);

/* ===================================================================== */
console.log('\n' + '─'.repeat(60));
console.log(reussis + ' test(s) d’interface réussi(s), ' + echoues + ' échec(s).');
console.log('RESULTAT_HEX=' + Buffer.from(reussis + '/' + echoues).toString('hex'));
process.exit(echoues ? 1 : 0);
