/* =====================================================================
   MISSION NAUTILUS — CLOUD FUNCTION DU PALIER 3 (mode « fonction »)
   functions/index.js

   Facultatif. Sans déploiement, le Palier 3 fonctionne entièrement en
   mode « operateur » sur un simple hébergement statique (voir
   docs/PALIER3-ARTEFACT.md). Cette fonction existe pour déplacer côté
   serveur les deux décisions qu'un client pourrait trafiquer :

     1. le CHOIX de l'ouvrage (POST /selectionner) ;
     2. la VÉRIFICATION des réponses (POST /verifier).

   ---------------------------------------------------------------------
   CE QUE CETTE FONCTION NE FAIT PAS
   ---------------------------------------------------------------------
   · Elle n'interroge JAMAIS fnac.com. Aucune donnée de stock n'est
     aspirée, aucun formulaire d'authentification, CAPTCHA ou anti-bot
     n'est contourné. La disponibilité est CONFIRMÉE PAR L'ORGANISATEUR
     (panneau admin, mode « operateur ») ou fournie par un flux
     officiel/partenaire si la Fnac en ouvre un — dans ce cas, le brancher
     dans `verifierDisponibilite()` ci-dessous, et nulle part ailleurs.
   · Elle ne stocke ni ne renvoie un titre, un EAN ou un SKU : la réponse
     d'un appel est exactement la cartouche publique (empreintes salées),
     la même que celle déjà lisible par le client.

   ---------------------------------------------------------------------
   DÉPLOIEMENT
   ---------------------------------------------------------------------
   1. Plan Blaze requis (fonctions HTTPS sortantes).
   2. `firebase deploy --only functions:artefact`
   3. Copier l'URL dans le panneau admin → Configuration du service →
      mode « fonction » + endpoint.
   4. Passer aux règles Firestore STRICTES (bloc commenté à la fin de
      firestore.rules) : les sessions ne sont plus écrites par le client.

   `artefact-moteur.js` est COPIÉ dans functions/ au prédeploy
   (voir firebase.json) : le moteur est pur, sans dépendance, identique
   côté client et côté serveur — une seule source de vérité pour les
   règles du jeu.
   ===================================================================== */
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

/* Le moteur du Palier 3 : même fichier que celui servi au navigateur. */
const MOTEUR = require('./artefact-moteur.js');

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });
admin.initializeApp();
const db = admin.firestore();

/* Origines autorisées : le site publié, l'aperçu Firebase, et le
   développement local. Rien d'autre. */
const ORIGINES_AUTORISEES = [
  'https://hypernovax31.github.io',
  'https://mission-nautilus.firebaseapp.com',
  'https://mission-nautilus.web.app',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];
const politiqueCors = cors({
  origin: (origine, rappel) => {
    if (!origine || ORIGINES_AUTORISEES.includes(origine)) return rappel(null, true);
    /* Sous-domaine de preview Firebase Hosting (project--host). */
    if (/^https:\/\/mission-nautilus--[\w-]+\.web\.app$/.test(origine)) return rappel(null, true);
    return rappel(new Error('origine non autorisée : ' + origine), false);
  }
});

const CHEMINS = {
  config: 'artefacts/config',
  cartouches: 'artefacts/cartouches',
  sessions: 'artefacts/sessions'
};
const CONFIG_DEFAUT = {
  mode: 'fonction', endpoint: '', fenetreMinutes: MOTEUR.FENETRE_FRAICHEUR_MINUTES,
  maxErreurs: MOTEUR.MAX_ERREURS
};

function equipePropre(v) {
  return MOTEUR.nettoyerTexte(v, 40).toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function idPropre(v) {
  return MOTEUR.nettoyerTexte(v, 40).replace(/[^A-Za-z0-9-]/g, '');
}

async function lireConfig() {
  const doc = await db.doc(CHEMINS.config).get();
  return Object.assign({}, CONFIG_DEFAUT, doc.exists ? doc.data() : {});
}

/* ------------------------------------------------------------------ */
/* Disponibilité : mode « operateur » = on lit ce que l'organisateur a  */
/* confirmé (horodaté), et on applique la fenêtre de fraîcheur.         */
/* ------------------------------------------------------------------ */
function verifierDisponibilite(cartouche, magasinId, cfg) {
  /* Brancher ICI un éventuel flux officiel Fnac (partenaire, API
     contractuelle) : renvoyer { statut, delai, checkedAt }. En attendant,
     la seule source est la confirmation de l'organisateur — jamais une
     requête vers fnac.com depuis cette fonction. */
  return MOTEUR.disponibiliteValide(cartouche.disponibilite, magasinId, {
    fenetreMinutes: Number(cfg.fenetreMinutes) || MOTEUR.FENETRE_FRAICHEUR_MINUTES
  });
}

function ajouterHistorique(session, entree) {
  const h = Array.isArray(session.historique) ? session.historique.slice() : [];
  h.push(Object.assign({ le: new Date().toISOString() }, entree));
  while (h.length > 40) h.shift();
  return h;
}

/* ------------------------------------------------------------------ */
/* POST /selectionner — choisit l'ouvrage d'un équipage                 */
/* ------------------------------------------------------------------ */
async function selectionner(req, res) {
  const equipe = equipePropre(req.body && req.body.equipe);
  const magasinId = idPropre(req.body && req.body.magasinId);
  if (!equipe) return res.status(400).json({ erreur: 'équipage manquant' });
  if (!magasinId) return res.status(400).json({ erreur: 'magasin manquant' });

  const cfg = await lireConfig();
  const refSession = db.doc(CHEMINS.sessions + '/' + equipe);
  const snap = await refSession.get();
  const session = snap.exists ? snap.data() : null;

  /* Une session active ne change JAMAIS d'ouvrage : le tirage est fait
     une fois, au lancement. C'est ce qui rend la partie stable même si le
     stock bouge pendant la recherche en magasin. */
  if (session && session.statut === 'active' && session.cartouche && session.cartouche.id) {
    return res.json({ cartouche: session.cartouche, reprise: true, equipe, magasinId });
  }
  if (session && session.statut === 'suspendue') {
    return res.status(409).json({ erreur: 'mission-suspendue', message: MOTEUR.MESSAGES.replacement });
  }

  const now = Date.now();
  const liste = await db.collection(CHEMINS.cartouches).get();
  const candidates = [];
  const ecartees = [];
  liste.forEach((d) => {
    const c = d.data();
    if (!c || !c.etapes || !c.etapes.length) return;
    if (c.magasinId && c.magasinId !== magasinId) return;
    const dispo = verifierDisponibilite(c, magasinId, cfg);
    if (dispo.ok) candidates.push(c);
    else ecartees.push({ id: d.id, motif: dispo.motif });
  });

  if (!candidates.length) {
    return res.status(404).json({
      erreur: 'aucun-ouvrage', message: MOTEUR.MESSAGES.aucunOuvrageMagasin,
      ecartees: ecartees.slice(0, 20)
    });
  }

  /* Tirage déterministe : même équipage + même magasin = même piste, donc
     un rechargement ne fait pas changer d'ouvrage en cours de partie. */
  const tirage = MOTEUR.aleatoireDeSel(equipe + '|' + magasinId);
  const choix = candidates.length === 1
    ? candidates[0]
    : candidates[Math.floor(tirage() * candidates.length) % candidates.length];

  const nouvelle = {
    equipe, magasinId, statut: 'active',
    cartoucheId: choix.id, cartouche: choix,
    etape: 0, etapesValidees: [], erreurs: 0,
    indicesUtilises: [], indicesTransmis: {}, demandeIndice: null,
    introuvable: null, remplacement: null,
    selectionMode: 'automatique-serveur',
    selectionneLe: new Date(now).toISOString(),
    historique: ajouterHistorique(session || {}, {
      type: 'selection', texte: 'Ouvrage affecté par le service serveur — piste ' + choix.id
    })
  };
  await refSession.set(nouvelle);
  return res.json({ cartouche: choix, equipe, magasinId, candidates: candidates.length });
}

/* ------------------------------------------------------------------ */
/* POST /verifier — vérifie une réponse (serveur)                       */
/* ------------------------------------------------------------------ */
async function verifier(req, res) {
  const equipe = equipePropre(req.body && req.body.equipe);
  const etapeId = MOTEUR.nettoyerTexte(req.body && req.body.etapeId, 30);
  const valeur = String((req.body && req.body.valeur) || '');
  if (!equipe || !etapeId) return res.status(400).json({ erreur: 'équipage ou étape manquant' });

  const snap = await db.doc(CHEMINS.sessions + '/' + equipe).get();
  if (!snap.exists) return res.status(404).json({ erreur: 'aucune-mission' });
  const session = snap.data();
  if (session.statut !== 'active') {
    return res.status(409).json({ erreur: 'session-non-active', statut: session.statut });
  }
  const cartouche = session.cartouche || {};
  const etape = (cartouche.etapes || []).find((e) => e && e.id === etapeId);
  if (!etape) return res.status(400).json({ erreur: 'étape inconnue' });

  const validees = session.etapesValidees || [];
  if (validees.indexOf(etapeId) >= 0) return res.json({ ok: true, dejaValidee: true });

  /* La vérification porte sur l'EMPREINTE salée : le serveur ne conserve
     aucune réponse en clair non plus (le coffre chiffré reste du côté de
     l'organisateur). */
  const r = MOTEUR.verifierEtape(etape, valeur);
  const ref = db.doc(CHEMINS.sessions + '/' + equipe);

  if (r.ok) {
    const nouvelles = validees.concat([etapeId]);
    const fini = nouvelles.length >= (cartouche.etapes || []).length;
    const champs = {
      etapesValidees: nouvelles,
      etape: Math.min((cartouche.etapes || []).length - 1, nouvelles.length),
      derniereValidationLe: new Date().toISOString(),
      historique: ajouterHistorique(session, { type: 'etape', texte: 'Étape « ' + etapeId + ' » validée (serveur)' })
    };
    if (fini) {
      champs.statut = 'terminee';
      champs.termineLe = new Date().toISOString();
      champs.historique = ajouterHistorique(Object.assign({}, session, champs),
        { type: 'victoire', texte: 'Signature complète — vérifiée par le service serveur' });
    }
    await ref.set(champs, { merge: true });
    return res.json({ ok: true, fini, etapesValidees: nouvelles,
                      message: fini ? MOTEUR.MESSAGES.victoire : MOTEUR.MESSAGES.etapeValidee });
  }

  /* Réponse non examinable (code-barres illisible, champ vide) : aucune
     erreur comptée — on ne punit pas la caméra d'un téléphone. */
  if (!r.erreur) return res.json({ ok: false, erreur: false, motif: r.motif });

  const erreurs = Number(session.erreurs || 0) + 1;
  const maxErreurs = Number(cartouche.maxErreurs) || MOTEUR.MAX_ERREURS;
  await ref.set({
    erreurs, derniereErreurLe: new Date().toISOString(),
    historique: ajouterHistorique(session, {
      type: 'erreur', texte: 'Réponse refusée à l’étape « ' + etapeId + ' » (' + erreurs + '/' + maxErreurs + ') — serveur'
    })
  }, { merge: true });
  return res.json({
    ok: false, erreur: true, erreurs, maxErreurs,
    remontee: erreurs >= maxErreurs,
    motif: r.motif,
    dernierAvertissement: erreurs === maxErreurs - 1 ? MOTEUR.MESSAGES.dernierAvertissement : ''
  });
}

/* ------------------------------------------------------------------ */
/* GET /etat?equipe=XXX — progression publique d'une session            */
/* ------------------------------------------------------------------ */
async function etat(req, res) {
  const equipe = equipePropre(req.query.equipe);
  if (!equipe) return res.status(400).json({ erreur: 'équipage manquant' });
  const snap = await db.doc(CHEMINS.sessions + '/' + equipe).get();
  if (!snap.exists) return res.status(404).json({ erreur: 'aucune-mission' });
  const s = snap.data();
  /* Réponse volontairement partielle : jamais de titre, d'EAN ni de SKU. */
  return res.json({
    equipe, statut: s.statut, magasinId: s.magasinId, etape: s.etape,
    etapesValidees: s.etapesValidees || [], erreurs: s.erreurs || 0,
    indicesUtilises: s.indicesUtilises || [],
    indicesTransmis: s.indicesTransmis || {},
    demandeIndice: s.demandeIndice || null,
    introuvable: s.introuvable || null,
    remplacement: s.remplacement || null
  });
}

/* ------------------------------------------------------------------ */
/* POST /introuvable — signalement du matelot (aucune erreur comptée)   */
/* ------------------------------------------------------------------ */
async function introuvable(req, res) {
  const equipe = equipePropre(req.body && req.body.equipe);
  if (!equipe) return res.status(400).json({ erreur: 'équipage manquant' });
  const ref = db.doc(CHEMINS.sessions + '/' + equipe);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ erreur: 'aucune-mission' });
  const session = snap.data();
  await ref.set({
    statut: 'suspendue',
    introuvable: {
      signaleLe: new Date().toISOString(),
      par: MOTEUR.nettoyerTexte(req.body && req.body.par, 60),
      cartoucheId: session.cartoucheId
    },
    historique: ajouterHistorique(session, {
      type: 'introuvable', texte: 'Ouvrage signalé introuvable (serveur) — aucune erreur comptée'
    })
  }, { merge: true });
  return res.json({ ok: true, message: MOTEUR.MESSAGES.introuvableEnregistre });
}

/* ------------------------------------------------------------------ */
/* GET /sante                                                          */
/* ------------------------------------------------------------------ */
async function sante(req, res) {
  const cfg = await lireConfig();
  return res.json({
    ok: true, service: 'mission-nautilus-artefact', version: '1.0.0',
    mode: cfg.mode, fenetreMinutes: cfg.fenetreMinutes,
    moteur: { maxErreurs: MOTEUR.MAX_ERREURS, familles: MOTEUR.FAMILLES.length, regles: MOTEUR.REGLES.length }
  });
}

/* ------------------------------------------------------------------ */
const app = express();
app.use(express.json({ limit: '64kb' }));
app.post('/selectionner', (req, res) => selectionner(req, res).catch(erreur(res)));
app.post('/verifier', (req, res) => verifier(req, res).catch(erreur(res)));
app.post('/introuvable', (req, res) => introuvable(req, res).catch(erreur(res)));
app.get('/etat', (req, res) => etat(req, res).catch(erreur(res)));
app.get('/sante', (req, res) => sante(req, res).catch(erreur(res)));
app.use((req, res) => res.status(404).json({ erreur: 'route inconnue' }));

function erreur(res) {
  return (e) => {
    console.error('artefact:', e && e.message || e);
    res.status(500).json({ erreur: 'erreur interne' });
  };
}

exports.artefact = onRequest((req, res) => {
  politiqueCors(req, res, () => app(req, res));
});
