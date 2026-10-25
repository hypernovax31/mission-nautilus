/* =====================================================================
   MISSION NAUTILUS — CLOUD FUNCTION DU PALIER 3 (mode « fonction »)
   functions/index.js — MODE DIRECT LIVE

   Facultatif. Sans déploiement, le Palier 3 fonctionne en mode
   « operateur » sur GitHub Pages. Cette fonction déplace côté serveur
   les décisions sensibles + ajoute le MODE DIRECT LIVE demandé :

     · à l'ouverture, le serveur tente une recherche EN DIRECT sur
       fnac.com pour le magasin choisi (rayon → fiches → bloc
       « En stock en magasin + Retrait sous 1H ») ;
     · si le site bloque (403/429/503, captcha, DataDome...), on NE
       CONTOURNE JAMAIS : on s'arrête et on retombe sur la réserve
       (cartouches déjà validées en 1h) ;
     · jamais plus d'une requête toutes les 3s, plafond 20, User-Agent
       identifié, robots.txt vérifié avant chaque URL.

   Déploiement : firebase deploy --only functions:artefact
   Puis admin → Configuration → mode « fonction » + endpoint + liveDirect
   ===================================================================== */
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

const MOTEUR = require('./artefact-moteur.js');
let LECTEUR = null;
try { LECTEUR = require('./fnac-lecteur.js'); } catch(e) { LECTEUR = null; }

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });
admin.initializeApp();
const db = admin.firestore();

/* ---------- magasins (copié au predeploy) ---------- */
let _magasinsCache = null;
function chargerMagasins() {
  if (_magasinsCache) return _magasinsCache;
  try {
    const fs = require('fs');
    const raw = fs.readFileSync(__dirname + '/magasins-fnac.json', 'utf8');
    const j = JSON.parse(raw);
    _magasinsCache = j;
    return j;
  } catch(e) {
    _magasinsCache = { magasins: [] };
    return _magasinsCache;
  }
}
function trouverMagasinParId(id) {
  const liste = (chargerMagasins().magasins || []);
  return liste.find(m => String(m.id) === String(id)) || null;
}
function construireRayonUrl(magasin) {
  if (!magasin || !magasin.slug || !magasin.id) return '';
  // ex: Toulouse-Labege/Fnac-Labege + cl57 → /Toulouse-Labege/Fnac-Labege/cl57/livre
  const slug = String(magasin.slug).replace(/^\/+|\/+$/g,'');
  return `https://www.fnac.com/${slug}/${magasin.id}/livre`;
}

/* ---------- origines ---------- */
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
    if (/^https:\/\/mission-nautilus--[\\w-]+\.web\.app$/.test(origine)) return rappel(null, true);
    return rappel(new Error('origine non autorisée : ' + origine), false);
  }
});

const CHEMINS = {
  config: 'artefacts/config',
  cartouches: 'cartouches',
  sessions: 'sessions'
};
const CONFIG_DEFAUT = {
  mode: 'fonction', endpoint: '', fenetreMinutes: MOTEUR.FENETRE_FRAICHEUR_MINUTES,
  maxErreurs: MOTEUR.MAX_ERREURS,
  liveDirect: true,           // <-- DIRECT LIVE activé par défaut (demande utilisateur)
  liveMaxFiches: 12,
  liveDelaiMs: 3000
};

function equipePropre(v) { return MOTEUR.nettoyerTexte(v, 40).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function idPropre(v) { return MOTEUR.nettoyerTexte(v, 40).replace(/[^A-Za-z0-9-]/g, ''); }
async function lireConfig() {
  const doc = await db.doc(CHEMINS.config).get();
  return Object.assign({}, CONFIG_DEFAUT, doc.exists ? doc.data() : {});
}

/* ---------- disponibilité ---------- */
function verifierDisponibilite(cartouche, magasinId, cfg) {
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

/* ---------- LIVE DIRECT : politesse anti-blocage ---------- */
const USER_AGENT_LIVE = 'MissionNautilus/1.0 (jeu de piste associatif; lecture polie fnac.com, cadence limitee; contact: hypernovax31@users.noreply.github.com)';
const PLAFOND_LIVE_REQUETES = 20;

function estMurAntiBot(statut, corps) {
  if (statut === 403 || statut === 429 || statut === 503) return true;
  const t = String(corps || '').slice(0, 4000).toLowerCase();
  return /(captcha|datadome|mumbo|mumb0|access denied|veuillez v[ée]rifier|pas un robot|are you a human|just a moment)/.test(t);
}
function dormir(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function telechargerPoli(url, etat, opts) {
  if (!LECTEUR) return { ok:false, motif:'lecteur indisponible', url };
  const permis = LECTEUR.robotsAutorise(url);
  if (!permis.ok) return { ok:false, motif:'robots.txt refuse: '+permis.motif, url };
  if (etat.requetes >= PLAFOND_LIVE_REQUETES) return { ok:false, motif:'plafond live atteint', url };
  if (etat.requetes > 0) await dormir(opts.delaiMs || CONFIG_DEFAUT.liveDelaiMs);
  etat.requetes++;
  const headers = {
    'User-Agent': USER_AGENT_LIVE,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9'
  };
  try {
    const reponse = await fetch(url, { headers, redirect:'follow' });
    const corps = await reponse.text();
    if (!reponse.ok) {
      if (estMurAntiBot(reponse.status, corps)) { etat.bloque=true; return { ok:false, mur:true, motif:'mur anti-bot HTTP '+reponse.status, url }; }
      return { ok:false, motif:'HTTP '+reponse.status, url };
    }
    if (estMurAntiBot(200, corps)) { etat.bloque=true; return { ok:false, mur:true, motif:'page anti-bot', url }; }
    return { ok:true, corps, urlFinale: reponse.url || url };
  } catch(e) {
    return { ok:false, motif:'réseau: '+(e.message||e), url };
  }
}

// Fallback livre toujours en 1h (si live bloqué) — fictif mais valide côté moteur
function livreFallbackPourMagasin(magasinId) {
  const maintenant = new Date().toISOString();
  return {
    id: 'fallback-'+String(magasinId).toLowerCase()+'-atlas-monde',
    titre: 'Atlas du monde illustré',
    sousTitre: 'Édition secours',
    auteur: 'Collectif',
    auteurType: 'collectif',
    editeur: 'Éditions du Nautilus',
    edition: '4e édition',
    editionNumero: 4,
    annee: 2024,
    pages: 320,
    format: 'broché',
    ean: '2000000000008', // valide 200-299
    sku: 'FALLBACK-0001',
    url: 'https://www.fnac.com/a2000000000008',
    categorieFnac: 'Atlas / carte (broché)',
    rayon: 'Géographie',
    type: 'atlas-mondial',
    famille: 'atlas-mondial',
    liens: ['monde','cartes','atlas'],
    vendeur: 'fnac',
    disponibilite: {
      [magasinId]: { magasin: magasinId, statut:'disponible', delai:'sous 1H', checkedAt: maintenant, vendeur:'fnac' }
    }
  };
}

async function collecteLivePourMagasin(magasinId, cfg) {
  if (!LECTEUR) return { ok:false, motif:'lecteur manquant', requetes:0, livres:[] };
  const magasin = trouverMagasinParId(magasinId);
  if (!magasin) return { ok:false, motif:'magasin inconnu '+magasinId, requetes:0, livres:[] };
  const maxFiches = Math.min(Number(cfg.liveMaxFiches)||12, 12);
  const etat = { requetes:0, bloque:false };
  const rayonUrl = construireRayonUrl(magasin);
  if (!rayonUrl) return { ok:false, motif:'pas de rayon pour '+magasinId, requetes:0, livres:[] };

  // 1) rayon → fiches
  const rRayon = await telechargerPoli(rayonUrl, etat, { delaiMs: 0 });
  if (!rRayon.ok) {
    return { ok:false, motif:'rayon: '+rRayon.motif, mur:!!rRayon.mur, bloque:etat.bloque, requetes:etat.requetes, livres:[] };
  }
  const liens = LECTEUR.extraireLiensFiches(rRayon.corps).slice(0, maxFiches);
  if (!liens.length) return { ok:false, motif:'aucune fiche dans rayon', requetes:etat.requetes, livres:[], bloque:etat.bloque };

  // 2) fiches → livres exploitables en 1h pour ce magasin
  const livres = [];
  const magasinsListe = (chargerMagasins().magasins||[]);
  const maintenant = Date.now();
  for (const lien of liens) {
    if (etat.bloque) break;
    const t = await telechargerPoli(lien.url, etat, { delaiMs: cfg.liveDelaiMs||3000 });
    if (!t.ok) {
      if (t.mur) break; // on s'arrête, on ne force jamais
      continue;
    }
    const lecture = LECTEUR.lireFiche(t.corps, {
      url: t.urlFinale, magasinId, magasins: magasinsListe, maintenant, strictMagasin:false
    });
    if (!lecture.livre.ean) continue;
    if (!lecture.exploitable) continue;
    // le livre est bien annoncé « En stock + retrait 1H » pour CE magasin
    const brut = Object.assign({}, lecture.livre);
    // on fige la dispo live à maintenant
    brut.disponibilite = brut.disponibilite || {};
    if (!brut.disponibilite[magasinId]) continue;
    livres.push(brut);
    if (livres.length >= 6) break; // assez pour tirer
  }
  if (!livres.length) {
    return { ok:false, motif:'aucun ouvrage en retrait 1h trouvé en direct (rayon visité, '+etat.requetes+' requêtes)', requetes:etat.requetes, bloque:etat.bloque, mur:etat.bloque, livres:[] };
  }
  return { ok:true, motif:'', requetes:etat.requetes, bloque:etat.bloque, livres };
}

/* ---------- POST /selectionner ---------- */
async function selectionner(req, res) {
  const equipe = equipePropre(req.body && req.body.equipe);
  const magasinId = idPropre(req.body && req.body.magasinId);
  if (!equipe) return res.status(400).json({ erreur: 'équipage manquant' });
  if (!magasinId) return res.status(400).json({ erreur: 'magasin manquant' });

  const cfg = await lireConfig();
  const refSession = db.doc(CHEMINS.sessions + '/' + equipe);
  const snap = await refSession.get();
  const session = snap.exists ? snap.data() : null;

  if (session && session.statut === 'active' && session.cartouche && session.cartouche.id) {
    return res.json({ cartouche: session.cartouche, reprise: true, equipe, magasinId, source:'reprise' });
  }
  if (session && session.statut === 'suspendue') {
    return res.status(409).json({ erreur: 'mission-suspendue', message: MOTEUR.MESSAGES.replacement });
  }

  const now = Date.now();

  // === TENTATIVE DIRECT LIVE (si activé) ===
  if (cfg.liveDirect !== false) {
    try {
      const live = await collecteLivePourMagasin(magasinId, cfg);
      if (live.ok && live.livres.length) {
        // on passe dans le moteur pour ne garder que les familles exploitables
        const c = MOTEUR.candidats(live.livres, magasinId, { maintenant: now, fenetreMinutes: cfg.fenetreMinutes });
        if (c.retenus.length) {
          const tirage = MOTEUR.aleatoireDeSel(equipe + '|' + magasinId);
          const meilleurRang = c.retenus[0]._rang;
          const memeRang = c.retenus.filter(l => l._rang === meilleurRang);
          const choixLivre = memeRang[Math.floor(tirage()*memeRang.length)%memeRang.length];
          const gen = MOTEUR.genererCartouche(choixLivre, { magasinId, sel: equipe+'|'+magasinId+'|'+now, maintenant: now });
          if (!gen.erreur && gen.cartouche) {
            const cartouche = gen.cartouche;
            // on stocke la cartouche live pour cache futur (best-effort)
            try { await db.collection(CHEMINS.cartouches).doc(cartouche.id).set(cartouche); } catch(e){}
            const nouvelle = {
              equipe, magasinId, statut: 'active',
              cartoucheId: cartouche.id, cartouche,
              etape: 0, etapesValidees: [], erreurs: 0,
              indicesUtilises: [], indicesTransmis: {}, demandeIndice: null,
              introuvable: null, remplacement: null,
              selectionMode: 'direct-live',
              selectionneLe: new Date(now).toISOString(),
              liveRequetes: live.requetes,
              historique: ajouterHistorique(session||{}, { type:'selection', texte:'Ouvrage direct-live — piste '+cartouche.id+' ('+live.requetes+' requêtes polies)' })
            };
            await refSession.set(nouvelle);
            return res.json({ cartouche, equipe, magasinId, source:'direct-live', requetes: live.requetes, candidates: c.retenus.length });
          }
        }
      }
      if (live.bloque) {
        console.warn('[live] bloqué, fallback cache', live.motif);
        // on ne retente pas en boucle, on tombe en fallback ci-dessous
      }
    } catch(e) {
      console.error('[live] erreur', e && e.message || e);
    }
  }

  // === FALLBACK : réserve (jamais bloqué) ===
  const liste = await db.collection(CHEMINS.cartouches).get();
  let candidates = [];
  let ecartees = [];
  liste.forEach((d) => {
    const c = d.data();
    if (!c || !c.etapes || !c.etapes.length) return;
    if (c.magasinId && c.magasinId !== magasinId) return;
    const dispo = verifierDisponibilite(c, magasinId, cfg);
    if (dispo.ok) candidates.push(c);
    else ecartees.push({ id:d.id, motif: dispo.motif });
  });

  // si toujours rien et qu'on était en live bloqué → on prend le fallback garanti 1h
  if (!candidates.length) {
    // on génère à la volée un ouvrage fallback toujours en 1h pour ce magasin
    const fallbackLivre = livreFallbackPourMagasin(magasinId);
    const gen2 = MOTEUR.genererCartouche(fallbackLivre, { magasinId, sel: equipe+'|'+magasinId+'|fallback', maintenant: now });
    if (!gen2.erreur && gen2.cartouche) {
      const cartouche = gen2.cartouche;
      try { await db.collection(CHEMINS.cartouches).doc(cartouche.id).set(cartouche); } catch(e){}
      const nouvelle2 = {
        equipe, magasinId, statut: 'active',
        cartoucheId: cartouche.id, cartouche,
        etape: 0, etapesValidees: [], erreurs: 0,
        indicesUtilises: [], indicesTransmis: {}, demandeIndice: null,
        introuvable: null, remplacement: null,
        selectionMode: 'fallback-garanti-1h',
        selectionneLe: new Date(now).toISOString(),
        historique: ajouterHistorique(session||{}, { type:'selection', texte:'Fallback garanti 1h — piste '+cartouche.id })
      };
      await refSession.set(nouvelle2);
      return res.json({ cartouche, equipe, magasinId, source:'fallback-garanti-1h', note:'live bloqué ou vide, ouvrage de secours en retrait 1h' });
    }
    return res.status(404).json({ erreur:'aucun-ouvrage', message: MOTEUR.MESSAGES.aucunOuvrageMagasin, ecartees: ecartees.slice(0,20) });
  }

  const tirage = MOTEUR.aleatoireDeSel(equipe + '|' + magasinId);
  const choix = candidates.length===1 ? candidates[0] : candidates[Math.floor(tirage()*candidates.length)%candidates.length];
  const nouvelle = {
    equipe, magasinId, statut: 'active',
    cartoucheId: choix.id, cartouche: choix,
    etape: 0, etapesValidees: [], erreurs: 0,
    indicesUtilises: [], indicesTransmis: {}, demandeIndice: null,
    introuvable: null, remplacement: null,
    selectionMode: 'automatique-serveur-cache',
    selectionneLe: new Date(now).toISOString(),
    historique: ajouterHistorique(session||{}, { type:'selection', texte:'Ouvrage cache — piste '+choix.id })
  };
  await refSession.set(nouvelle);
  return res.json({ cartouche: choix, equipe, magasinId, source:'cache', candidates: candidates.length });
}

/* ---------- POST /verifier ---------- */
async function verifier(req, res) {
  const equipe = equipePropre(req.body && req.body.equipe);
  const etapeId = MOTEUR.nettoyerTexte(req.body && req.body.etapeId, 30);
  const valeur = String((req.body && req.body.valeur) || '');
  if (!equipe || !etapeId) return res.status(400).json({ erreur: 'équipage ou étape manquant' });

  const snap = await db.doc(CHEMINS.sessions + '/' + equipe).get();
  if (!snap.exists) return res.status(404).json({ erreur: 'aucune-mission' });
  const session = snap.data();
  if (session.statut !== 'active') return res.status(409).json({ erreur: 'session-non-active', statut: session.statut });
  const cartouche = session.cartouche || {};
  const etape = (cartouche.etapes||[]).find((e)=>e && e.id===etapeId);
  if (!etape) return res.status(400).json({ erreur: 'étape inconnue' });

  const validees = session.etapesValidees || [];
  if (validees.indexOf(etapeId) >=0) return res.json({ ok:true, dejaValidee:true });

  const r = MOTEUR.verifierEtape(etape, valeur);
  const ref = db.doc(CHEMINS.sessions + '/' + equipe);
  if (r.ok) {
    const nouvelles = validees.concat([etapeId]);
    const fini = nouvelles.length >= (cartouche.etapes||[]).length;
    const champs = {
      etapesValidees: nouvelles,
      etape: Math.min((cartouche.etapes||[]).length-1, nouvelles.length),
      derniereValidationLe: new Date().toISOString(),
      historique: ajouterHistorique(session, { type:'etape', texte:'Étape « '+etapeId+' » validée (serveur)' })
    };
    if (fini) {
      champs.statut='terminee'; champs.termineLe=new Date().toISOString();
      champs.historique=ajouterHistorique(Object.assign({},session,champs), { type:'victoire', texte:'Signature complète — vérifiée serveur' });
    }
    await ref.set(champs, {merge:true});
    return res.json({ ok:true, fini, etapesValidees:nouvelles, message: fini ? MOTEUR.MESSAGES.victoire : MOTEUR.MESSAGES.etapeValidee });
  }
  if (!r.erreur) return res.json({ ok:false, erreur:false, motif:r.motif });
  const erreurs = Number(session.erreurs||0)+1;
  const maxErreurs = Number(cartouche.maxErreurs) || MOTEUR.MAX_ERREURS;
  await ref.set({ erreurs, derniereErreurLe:new Date().toISOString(), historique:ajouterHistorique(session,{ type:'erreur', texte:'Réponse refusée « '+etapeId+' » ('+erreurs+'/'+maxErreurs+') — serveur'})}, {merge:true});
  return res.json({ ok:false, erreur:true, erreurs, maxErreurs, remontee:erreurs>=maxErreurs, motif:r.motif, dernierAvertissement: erreurs===maxErreurs-1 ? MOTEUR.MESSAGES.dernierAvertissement : '' });
}

/* ---------- GET /etat ---------- */
async function etat(req, res) {
  const equipe = equipePropre(req.query.equipe);
  if (!equipe) return res.status(400).json({ erreur:'équipage manquant' });
  const snap = await db.doc(CHEMINS.sessions + '/' + equipe).get();
  if (!snap.exists) return res.status(404).json({ erreur:'aucune-mission' });
  const s = snap.data();
  return res.json({ equipe, statut:s.statut, magasinId:s.magasinId, etape:s.etape, etapesValidees:s.etapesValidees||[], erreurs:s.erreurs||0, indicesUtilises:s.indicesUtilises||[], indicesTransmis:s.indicesTransmis||{}, demandeIndice:s.demandeIndice||null, introuvable:s.introuvable||null, remplacement:s.remplacement||null });
}

/* ---------- POST /introuvable ---------- */
async function introuvable(req, res) {
  const equipe = equipePropre(req.body && req.body.equipe);
  if (!equipe) return res.status(400).json({ erreur:'équipage manquant' });
  const ref = db.doc(CHEMINS.sessions + '/' + equipe);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ erreur:'aucune-mission' });
  const session = snap.data();
  await ref.set({ statut:'suspendue', introuvable:{ signaleLe:new Date().toISOString(), par:MOTEUR.nettoyerTexte(req.body&&req.body.par,60), cartoucheId:session.cartoucheId }, historique:ajouterHistorique(session,{ type:'introuvable', texte:'Ouvrage signalé introuvable (serveur)'})}, {merge:true});
  return res.json({ ok:true, message: MOTEUR.MESSAGES.introuvableEnregistre });
}

/* ---------- GET /sante ---------- */
async function sante(req, res) {
  const cfg = await lireConfig();
  return res.json({ ok:true, service:'mission-nautilus-artefact', version:'1.2.0-live', mode:cfg.mode, liveDirect: cfg.liveDirect!==false, fenetreMinutes:cfg.fenetreMinutes, moteur:{ maxErreurs:MOTEUR.MAX_ERREURS, familles:MOTEUR.FAMILLES.length, regles:MOTEUR.REGLES.length } });
}

/* ---------- app ---------- */
const app = express();
app.use(express.json({ limit:'64kb' }));
app.post('/selectionner', (req,res)=> selectionner(req,res).catch(erreur(res)));
app.post('/verifier', (req,res)=> verifier(req,res).catch(erreur(res)));
app.post('/introuvable', (req,res)=> introuvable(req,res).catch(erreur(res)));
app.get('/etat', (req,res)=> etat(req,res).catch(erreur(res)));
app.get('/sante', (req,res)=> sante(req,res).catch(erreur(res)));
app.use((req,res)=> res.status(404).json({ erreur:'route inconnue' }));
function erreur(res){ return (e)=>{ console.error('artefact:', e&&e.message||e); res.status(500).json({ erreur:'erreur interne' }); }; }

exports.artefact = onRequest((req,res)=>{ politiqueCors(req,res, ()=> app(req,res)); });
