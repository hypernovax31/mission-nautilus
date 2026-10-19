#!/usr/bin/env node
/* =====================================================================
   COLLECTE DU CATALOGUE D'ARTEFACTS DEPUIS LES FICHES PUBLIQUES FNAC
   (tools/sync-catalogue-artefacts.mjs)

       # une seule fiche, pour le magasin choisi par le joueur
       node tools/sync-catalogue-artefacts.mjs --magasin cl57 \
            --fiche https://www.fnac.com/a99000001

       # découverte depuis un rayon public, puis lecture des fiches
       node tools/sync-catalogue-artefacts.mjs --magasin cl57 --max 12 \
            --rayon https://www.fnac.com/Toulouse-Labege/Fnac-Labege/cl57/livre

       # HORS LIGNE : pages enregistrées par l'opérateur (recommandé)
       node tools/sync-catalogue-artefacts.mjs --magasin cl57 \
            --html ~/Bureau/atlas.html --html ~/Bureau/verne.html

       # contrôles
       node tools/sync-catalogue-artefacts.mjs --magasin cl57 --dry-run …
       node tools/sync-catalogue-artefacts.mjs --verifier
       node tools/sync-catalogue-artefacts.mjs --check data/catalogue-artefacts.local.json

   ---------------------------------------------------------------------
   POURQUOI ICI, ET JAMAIS DANS LE NAVIGATEUR
   ---------------------------------------------------------------------
   Le joueur ne contacte JAMAIS fnac.com : ce serait un appel CORS
   bloqué, une empreinte réseau au nom du joueur, et une lecture du site
   depuis un poste qui n'est pas le nôtre. La collecte se fait donc ici,
   par l'opérateur (ou en CI), puis le catalogue est chiffré et publié
   dans Firestore par le panneau admin.

   ---------------------------------------------------------------------
   CE QUE LE SITE PUBLIC DONNE RÉELLEMENT (observé le 19/10/2026)
   ---------------------------------------------------------------------
   Les fiches https://www.fnac.com/a<id> sont rendues côté serveur et
   affichent le bloc disponibilité du VISITEUR :

       En stock en magasin            → ouvrage déjà en rayon
       Fnac Toulouse - Labège         → magasin de la session
       Retrait gratuit sous 1H        → retrait sous 1 heure  ✅ EXPLOITABLE
       Livrable en magasin            → ouvrage à acheminer
       Retrait gratuit sous 1J        → retrait sous 1 jour    ⛔ REFUSÉ
       Indisponible en magasin        →                        ⛔ REFUSÉ

   Le magasin annoncé dépend de la SESSION du visiteur (cookie de choix
   de magasin, sinon géolocalisation IP) : la même URL a annoncé
   « Fnac Bordeaux » puis « Fnac Paris - Saint-Lazare » à deux requêtes
   d'intervalle, et une URL préfixée par le magasin (…/cl57/a99000002)
   retombe sur la fiche générique.

   D'où la règle centrale de cet outil :

       UNE DISPONIBILITÉ N'EST RETENUE QUE SI LA PAGE ANNONCE
       EXPLICITEMENT LE MAGASIN DEMANDÉ ET UN RETRAIT SOUS 1H.

   Sinon l'ouvrage est quand même enregistré (métadonnées utiles), mais
   SANS disponibilité attribuable : le moteur l'écarte de la sélection
   automatique, et l'opérateur peut confirmer à la main dans le panneau
   admin. Rien n'est inventé.

   ---------------------------------------------------------------------
   AUCUN CONTOURNEMENT
   ---------------------------------------------------------------------
   · robots.txt est respecté et VÉRIFIÉ avant chaque appel : les chemins
     interdits (/Account/, /OrderPipe/, /api/, /basket/) et la recherche
     filtrée (SearchResult/ResultList.aspx avec SFilt ou PageIndex) sont
     refusés par l'outil lui-même ;
   · aucun CAPTCHA, aucun défi anti-bot résolu, aucun jeton fabriqué :
     les jetons que le site ajoute à ses URL (« wanderlu= », « kerfu= »,
     « mumbo-j= ») sont seulement CONSTATÉS et signalés ;
   · si la page renvoie 403/503 ou un mur anti-bot, l'outil S'ARRÊTE et
     conserve ce qu'il a déjà lu ; il ne force jamais ;
   · cadence limitée (une requête toutes les --delai-ms, 3 s par défaut)
     et plafond de pages (--max) ;
   · l'unique façon de viser un magasin précis sans cookie est le mode
     --html : l'opérateur choisit son magasin dans SON navigateur,
     enregistre la page, et l'outil la lit hors ligne. C'est une visite
     normale, pas une effraction.

   ---------------------------------------------------------------------
   SORTIE : JAMAIS DE DONNÉES RÉELLES DANS LE DÉPÔT PUBLIÉ
   ---------------------------------------------------------------------
   GitHub Pages publie TOUT ce qui est commité. Le fichier produit
   (data/catalogue-artefacts.local.json par défaut) contient des titres,
   des EAN et des SKU réels : il est dans .gitignore, et l'outil REFUSE
   d'écrire vers un chemin non ignoré par git (sauf --autorise-public,
   explicite). Le rapport affiché est MASQUÉ par défaut (EAN tronqué) :
   --verbose ne sert que sur un poste d'opérateur.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');

/* Les modules du jeu sont chargés tels quels : une seule source de règles. */
globalThis.window = globalThis;
await import(path.join(racine, 'fnac-lecteur.js'));
await import(path.join(racine, 'artefact-moteur.js'));
const L = globalThis.NautilusFnacLecteur;
const M = globalThis.NautilusArtefactMoteur;

const CHEMIN_MAGASINS = path.join(racine, 'data', 'magasins-fnac.json');
const SORTIE_DEFAUT = path.join(racine, 'data', 'catalogue-artefacts.local.json');
const USER_AGENT_DEFAUT =
  'MissionNautilus/1.0 (collecte de disponibilité pour un jeu de piste associatif ; '
  + 'lecture de pages publiques, cadence limitée ; contact : hypernovax31@users.noreply.github.com)';

const MAX_FICHES_DEFAUT = 20;
const DELAI_DEFAUT_MS = 3000;
const PLAFOND_REQUETES = 60;          // garde-fou dur, toutes sources confondues

/* ------------------------------------------------------------------ */
/* Options                                                            */
/* ------------------------------------------------------------------ */

function lireOptions(argv) {
  const o = {
    magasin: '', fiches: [], rayons: [], html: [], liste: '',
    max: MAX_FICHES_DEFAUT, delaiMs: DELAI_DEFAUT_MS, cookieFile: '',
    userAgent: USER_AGENT_DEFAUT, sortie: SORTIE_DEFAUT,
    dryRun: false, verifier: false, check: '', strict: true,
    verbose: false, anonyme: false, autorisePublic: false, rapport: true
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const suivant = () => argv[++i];
    switch (a) {
      case '--magasin': o.magasin = suivant(); break;
      case '--fiche': o.fiches.push(suivant()); break;
      case '--rayon': o.rayons.push(suivant()); break;
      case '--html': o.html.push(suivant()); break;
      case '--liste': o.liste = suivant(); break;
      case '--max': o.max = Math.max(1, Math.min(PLAFOND_REQUETES, parseInt(suivant(), 10) || MAX_FICHES_DEFAUT)); break;
      case '--delai-ms': o.delaiMs = Math.max(500, parseInt(suivant(), 10) || DELAI_DEFAUT_MS); break;
      case '--cookie-file': o.cookieFile = suivant(); break;
      case '--user-agent': o.userAgent = suivant(); break;
      case '--sortie': o.sortie = path.resolve(suivant()); break;
      case '--dry-run': o.dryRun = true; break;
      case '--verifier': o.verifier = true; break;
      case '--check': o.check = suivant(); break;
      case '--strict': o.strict = true; break;
      case '--large': o.strict = false; break;
      case '--verbose': o.verbose = true; break;
      case '--anonyme': o.anonyme = true; o.verbose = false; break;
      case '--autorise-public': o.autorisePublic = true; break;
      case '--quiet': o.rapport = false; break;
      case '-h': case '--aide': o.aide = true; break;
      default:
        throw new Error('option inconnue : ' + a);
    }
  }
  return o;
}

function aide() {
  console.log(`
Collecte du catalogue d'artefacts depuis les fiches publiques fnac.com.

  --magasin <cl57|nom>   magasin choisi par le joueur (obligatoire sauf --check)
  --fiche <url|id|fichier>   fiche produit à lire (répétable)
  --rayon <url|fichier>      page de rayon/auteur/éditeur : y découvre des fiches
  --html <fichier>           page enregistrée par l'opérateur (hors ligne)
  --liste <fichier>          fichier texte, une URL ou un chemin par ligne
  --max <n>                  plafond de fiches lues (défaut ${MAX_FICHES_DEFAUT}, dur ${PLAFOND_REQUETES})
  --delai-ms <n>             pause entre deux requêtes (défaut ${DELAI_DEFAUT_MS})
  --cookie-file <fichier>    cookie de SESSION de l'opérateur (jamais commité)
  --sortie <chemin>          catalogue écrit (défaut data/catalogue-artefacts.local.json)
  --dry-run                  ne rien écrire
  --verifier                 contrôler le catalogue ET la sélection possible
  --check <chemin>           contrôler un catalogue existant, sans collecter
  --strict / --large         strict (défaut) : exiger une disponibilité confirmée
  --verbose                  rapport non masqué (poste d'opérateur seulement)
  --anonyme                  rapport sans AUCUNE donnée d'ouvrage : pour une
                             exécution en CI publique (les artefacts GitHub
                             sont téléchargeables par tout le monde)
  --autorise-public          autoriser l'écriture vers un chemin non gitignoré

Aucun contournement d'anti-bot, aucun chemin interdit par robots.txt.`);
}

/* ------------------------------------------------------------------ */
/* Petits utilitaires                                                 */
/* ------------------------------------------------------------------ */

const log = (m) => console.error(m);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function ecrireAtomique(chemin, contenu) {
  const tmp = chemin + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, contenu, 'utf8');
  fs.renameSync(tmp, chemin);
}

function lireMagasins() {
  if (!fs.existsSync(CHEMIN_MAGASINS)) {
    throw new Error('liste des magasins absente : ' + CHEMIN_MAGASINS
      + ' (lance tools/sync-magasins-fnac.mjs)');
  }
  const doc = JSON.parse(fs.readFileSync(CHEMIN_MAGASINS, 'utf8'));
  return doc.magasins || [];
}

function resoudreMagasinDemande(demande, magasins) {
  if (!demande) return null;
  const direct = M.trouverMagasin(magasins, demande);
  if (direct) return direct;
  const r = L.resoudreMagasin(String(demande).replace(/^Fnac\s+/i, ''), magasins);
  if (!r.id) return null;
  return magasins.find((m) => m.id === r.id) || null;
}

/* Le fichier est-il bien ignoré par git ? Garde-fou contre la fuite de
   données réelles sur GitHub Pages. */
function cheminProtege(chemin, opts) {
  const relatif = path.relative(racine, chemin);
  if (relatif.startsWith('..')) return { ok: true, motif: 'hors du dépôt' };
  try {
    execFileSync('git', ['check-ignore', '--quiet', relatif], { cwd: racine, stdio: 'ignore' });
    return { ok: true, motif: 'ignoré par git' };
  } catch (e) {
    if (opts.autorisePublic) return { ok: true, motif: 'chemin publié, autorisé explicitement' };
    return {
      ok: false,
      motif: '« ' + relatif + ' » n’est pas ignoré par git : il serait publié sur GitHub Pages '
           + '(titres et EAN réels). Ajoute-le à .gitignore ou utilise --sortie hors du dépôt.'
    };
  }
}

/* ------------------------------------------------------------------ */
/* Récupération réseau — polie, bornée, sans contournement             */
/* ------------------------------------------------------------------ */

function estMurAntiBot(statut, corps) {
  if (statut === 403 || statut === 429 || statut === 503) return true;
  const t = String(corps || '').slice(0, 4000).toLowerCase();
  return /(captcha|datadome|mumbo|mumb0|access denied|veuillez v[ée]rifier|pas un robot|are you a human|just a moment)/.test(t);
}

async function telecharger(url, opts, etat) {
  const permis = L.robotsAutorise(url);
  if (!permis.ok) return { ok: false, motif: 'refus robots.txt — ' + permis.motif, url };
  if (etat.requetes >= PLAFOND_REQUETES) {
    return { ok: false, motif: 'plafond de requêtes atteint (' + PLAFOND_REQUETES + ')', url };
  }
  if (etat.requetes > 0) await dormir(opts.delaiMs);
  etat.requetes++;

  const entetes = {
    'User-Agent': opts.userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9'
  };
  if (opts.cookie) {
    /* Cookie de l'OPÉRATEUR, lu depuis son propre fichier, jamais journalisé. */
    entetes.Cookie = opts.cookie;
  }
  try {
    const reponse = await fetch(url, { headers: entetes, redirect: 'follow' });
    const corps = await reponse.text();
    if (!reponse.ok) {
      if (estMurAntiBot(reponse.status, corps)) {
        etat.bloque = true;
        return { ok: false, mur: true, motif: 'mur anti-bot ou accès refusé (HTTP ' + reponse.status
          + ') : arrêt, aucun contournement', url };
      }
      return { ok: false, motif: 'HTTP ' + reponse.status, url };
    }
    if (estMurAntiBot(200, corps)) {
      etat.bloque = true;
      return { ok: false, mur: true, motif: 'page de vérification anti-bot à la place de la fiche : arrêt', url };
    }
    const jetons = L.jetonsAntiBot(reponse.url || url);
    return { ok: true, corps, urlFinale: reponse.url || url, jetons, statut: reponse.status };
  } catch (e) {
    return { ok: false, motif: 'erreur réseau : ' + (e && e.message ? e.message : e), url };
  }
}

function lireDepuisFichier(chemin) {
  if (!fs.existsSync(chemin)) throw new Error('fichier introuvable : ' + chemin);
  return fs.readFileSync(chemin, 'utf8');
}

/* ------------------------------------------------------------------ */
/* Construction du catalogue                                          */
/* ------------------------------------------------------------------ */

function masquer(s, n) {
  const t = String(s || '');
  if (!t) return '';
  return t.length <= n ? t : '…' + t.slice(-n);
}

/* Une entrée de catalogue doit TOUJOURS avoir un identifiant : sans lui,
   la fusion la perdrait silencieusement. Quand la fiche ne donne pas
   d'URL canonique (page enregistrée hors ligne), l'EAN sert de repli —
   il est unique par édition, ce qui est précisément ce qui identifie la
   mission. */
function entreeCatalogue(lecture) {
  const livre = Object.assign({}, lecture.livre);
  if (!livre.id) livre.id = 'fnac-' + (livre.ean || '');
  /* Le lecteur n'attribue la disponibilité QUE si la page annonçait le
     magasin demandé : sinon la clé reste absente et le moteur écarte
     l'ouvrage de la sélection automatique. */
  if (!livre.disponibilite || typeof livre.disponibilite !== 'object') livre.disponibilite = {};
  return livre;
}

function fusionnerCatalogue(existants, nouveaux) {
  const parId = new Map();
  const parEan = new Map();
  const ordre = [];
  const pousser = (l) => {
    if (!l || !l.id) return;
    if (parId.has(l.id)) {
      const avant = parId.get(l.id);
      /* La disponibilité la plus récente l'emporte. */
      avant.disponibilite = Object.assign({}, avant.disponibilite, l.disponibilite || {});
      Object.keys(l).forEach((k) => {
        if (k !== 'disponibilite' && (l[k] !== '' && l[k] != null)) avant[k] = l[k];
      });
      return;
    }
    if (l.ean && parEan.has(l.ean)) {
      const autre = parEan.get(l.ean);
      autre.disponibilite = Object.assign({}, autre.disponibilite, l.disponibilite || {});
      return;
    }
    parId.set(l.id, l);
    if (l.ean) parEan.set(l.ean, l);
    ordre.push(l.id);
  };
  (existants || []).forEach(pousser);
  (nouveaux || []).forEach(pousser);
  return ordre.map((id) => parId.get(id));
}

/* ------------------------------------------------------------------ */
/* Vérification d'un catalogue déjà écrit                             */
/* ------------------------------------------------------------------ */

function verifierCatalogue(livres, magasinId, opts) {
  const rapport = { magasin: magasinId, ouvrages: livres.length, problems: [], prets: 0,
                    aConfirmer: 0, selection: null };
  const vus = M.controlerCatalogue(livres, []);
  vus.forEach((p) => rapport.problems.push(p));

  let prets = 0;
  livres.forEach((l) => {
    const v = M.validerLivre(l);
    if (!v.livre) return;
    const dispo = (l.disponibilite || {})[magasinId];
    const d = dispo ? M.disponibiliteValide(dispo, magasinId, { maintenant: Date.now() })
                    : { ok: false, motif: 'aucune disponibilité enregistrée pour ce magasin' };
    if (d.ok && M.choisirFamille(v.livre)) prets++;
    else rapport.aConfirmer++;
  });
  rapport.prets = prets;

  /* Même fenêtre de fraîcheur que le jeu : une disponibilité vieille de
     plus de 15 minutes doit être reconfirmée, pas recyclée. */
  const fenetre = M.FENETRE_FRAICHEUR_MINUTES;
  const sel = M.candidats(livres, magasinId, { maintenant: Date.now(), fenetreMinutes: fenetre });
  rapport.selection = { retenus: sel.retenus.length, ecartes: sel.ecartes.length,
                        fenetreMinutes: fenetre };
  if (!sel.retenus.length) {
    rapport.problems.push('aucun ouvrage exploitable pour le magasin « ' + magasinId
      + ' » : la mission ne peut pas démarrer (disponibilité à confirmer ou catalogue vide)');
  }
  if (opts.strict && !rapport.prets) {
    rapport.problems.push('mode strict : aucune disponibilité « retrait sous 1 h » confirmée');
  }
  return rapport;
}

/* ------------------------------------------------------------------ */
/* Programme principal                                                */
/* ------------------------------------------------------------------ */

async function principal() {
  const opts = lireOptions(process.argv);
  if (opts.aide) { aide(); process.exit(0); }

  const magasins = lireMagasins();

  /* ---- mode contrôle d'un fichier existant ------------------------ */
  if (opts.check) {
    const doc = JSON.parse(lireDepuisFichier(path.resolve(opts.check)));
    const livres = doc.livres || [];
    let magasinId = opts.magasin;
    if (!magasinId && doc.magasinId) magasinId = doc.magasinId;
    const m = resoudreMagasinDemande(magasinId, magasins);
    if (!m) { log('⛔ Magasin illisible : ' + (magasinId || '(aucun)')); process.exit(2); }
    const r = verifierCatalogue(livres, m.id, opts);
    log(r.problems.length ? '⛔ ' + r.problems.length + ' problème(s)' : '✅ catalogue contrôlé');
    r.problems.forEach((p) => log('   · ' + p));
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.problems.length ? 2 : 0);
  }

  /* ---- magasin cible --------------------------------------------- */
  const magasin = resoudreMagasinDemande(opts.magasin, magasins);
  if (!magasin) {
    log('⛔ Magasin introuvable dans la liste officielle : « ' + (opts.magasin || '') + ' »');
    log('   (lance tools/sync-magasins-fnac.mjs, puis réessaie avec un identifiant cl<N>)');
    process.exit(2);
  }
  log('🎯 Magasin cible : ' + magasin.nom + ' (' + magasin.id + ') — ' + (magasin.ville || '') + ' ' + (magasin.cp || ''));

  const etat = { requetes: 0, bloque: false };
  if (opts.cookieFile) {
    opts.cookie = lireDepuisFichier(path.resolve(opts.cookieFile)).trim().replace(/^Cookie:\s*/i, '');
    log('🔑 Cookie d’opérateur chargé (' + opts.cookie.length + ' caractères, jamais affiché ni écrit)');
  }

  /* ---- sources ---------------------------------------------------- */
  const cibles = [];   // { type:'fiche'|'html', url?, corps?, origine }
  opts.html.forEach((h) => {
    const p = path.resolve(h);
    cibles.push({ type: 'html', corps: lireDepuisFichier(p), origine: p });
  });
  if (opts.liste) {
    lireDepuisFichier(path.resolve(opts.liste)).split(/\r?\n/)
      .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      .forEach((l) => {
        if (/^https?:\/\//i.test(l)) cibles.push({ type: 'url', url: l, origine: 'liste' });
        else cibles.push({ type: 'html', corps: lireDepuisFichier(path.resolve(l)), origine: l });
      });
  }
  opts.fiches.forEach((f) => {
    if (/^https?:\/\//i.test(f)) cibles.push({ type: 'url', url: f, origine: '--fiche' });
    else if (/^a?\d{5,10}$/i.test(f)) cibles.push({ type: 'url', url: L.urlFiche(f), origine: '--fiche' });
    else cibles.push({ type: 'html', corps: lireDepuisFichier(path.resolve(f)), origine: f });
  });

  /* Rayons : découverte de fiches, puis lecture (dans la limite de --max). */
  for (const r of opts.rayons) {
    let corps = null, url = null, origine = r;
    if (/^https?:\/\//i.test(r)) {
      const t = await telecharger(r, opts, etat);
      if (!t.ok) { log('   ⚠ rayon refusé : ' + t.motif); if (t.mur) break; continue; }
      corps = t.corps; url = t.urlFinale;
    } else {
      corps = lireDepuisFichier(path.resolve(r));
    }
    const liens = L.extraireLiensFiches(corps);
    log('🧭 ' + liens.length + ' fiche(s) découverte(s) dans ' + origine);
    for (const lien of liens) {
      if (cibles.filter((c) => c.type === 'url').length >= opts.max) break;
      if (cibles.some((c) => c.type === 'url' && c.url === lien.url)) continue;
      cibles.push({ type: 'url', url: lien.url, origine: 'rayon:' + origine });
    }
    if (url) void url;
  }

  if (!cibles.length) {
    log('⛔ Aucune source : passe --fiche, --rayon, --html ou --liste (voir --aide)');
    process.exit(2);
  }

  /* ---- lecture ---------------------------------------------------- */
  const maintenant = Date.now();
  const lus = [], recus = [], confirmes = [];
  for (const cible of cibles) {
    if (cible.type === 'url') {
      if (lus.length >= opts.max) { recus.push({ origine: cible.url, motif: 'plafond --max atteint' }); continue; }
      if (etat.bloque) { recus.push({ origine: cible.url, motif: 'collecte arrêtée (mur anti-bot)' }); continue; }
      const t = await telecharger(cible.url, opts, etat);
      if (!t.ok) {
        recus.push({ origine: cible.url, motif: t.motif });
        log('   ⛔ ' + t.motif);
        if (t.mur) { log('🛑 Mur anti-bot détecté : arrêt immédiat de la collecte réseau.'); break; }
        continue;
      }
      if (t.jetons && t.jetons.length) {
        log('   ℹ jetons de session constatés sur l’URL finale (' + t.jetons.join(', ')
          + ') : laissés tels quels, jamais fabriqués');
      }
      traiterLecture(L.lireFiche(t.corps, {
        url: t.urlFinale, magasinId: magasin.id, magasins, maintenant, strictMagasin: false
      }), t.urlFinale);
    } else {
      traiterLecture(L.lireFiche(cible.corps, {
        url: '', magasinId: magasin.id, magasins, maintenant, strictMagasin: false
      }), cible.origine);
    }
  }

  function traiterLecture(lecture, origine) {
    if (!lecture || !lecture.livre || !lecture.livre.titre) {
      recus.push({ origine, motif: 'fiche illisible (aucun titre trouvé)' });
      log('   ⚠ illisible : ' + origine);
      return;
    }
    const ligne = {
      origine,
      livre: entreeCatalogue(lecture),
      produitId: lecture.produitId,
      titre: lecture.titre,
      ean: lecture.livre.ean,
      sku: lecture.livre.sku,
      type: lecture.livre.type,
      magasinAnnonce: lecture.magasinAnnonce,
      magasinResolu: lecture.resolution ? lecture.resolution.id : null,
      etat: lecture.etat,
      delai: lecture.delai,
      statut: lecture.disponibilite.statut,
      exploitable: lecture.exploitable,
      motif: lecture.motif,
      alertes: lecture.alertes.map((a) => a.code)
    };
    lus.push(ligne);
    if (!lecture.livre.ean) {
      recus.push({ origine, motif: 'EAN absent ou invalide : ouvrage non utilisable' });
    } else if (lecture.exploitable) {
      confirmes.push(ligne);
    } else {
      recus.push({ origine, motif: lecture.motif || 'disponibilité non exploitable' });
    }
    log((lecture.exploitable ? '   ✅ ' : '   ⚠ ')
      + (opts.anonyme ? 'ouvrage ' + (lus.length) + ' [' + (lecture.livre.type || 'sans type') + ']'
        : opts.verbose ? lecture.titre + ' [' + lecture.livre.ean + ']'
        : masquer(lecture.titre, 18) + ' [EAN ' + masquer(lecture.livre.ean, 4) + ']')
      + ' — ' + (lecture.disponibilite.statut) + (lecture.delai ? ' / ' + lecture.delai : '')
      + (lecture.magasinAnnonce && !opts.anonyme ? ' @ ' + lecture.magasinAnnonce : '')
      + (lecture.exploitable ? '' : ' → ' + (lecture.motif || '')));
  }

  /* ---- assemblage ------------------------------------------------- */
  const livresCollectes = lus.filter((l) => l.livre && l.livre.ean).map((l) => l.livre);
  const sansIdentifiant = livresCollectes.filter((l) => !l.id);
  if (sansIdentifiant.length) {
    log('   ⛔ ' + sansIdentifiant.length + ' ouvrage(s) sans identifiant ni EAN : ignorés (rien n’est inventé)');
  }

  let existants = [];
  if (fs.existsSync(opts.sortie)) {
    try {
      const doc = JSON.parse(fs.readFileSync(opts.sortie, 'utf8'));
      existants = doc.livres || [];
    } catch (e) {
      log('   ⚠ catalogue existant illisible, ignoré : ' + e.message);
    }
  }
  const livres = fusionnerCatalogue(existants, livresCollectes);

  /* ---- contrôle moteur ------------------------------------------- */
  const verification = verifierCatalogue(livres, magasin.id, opts);
  const refus = [...verification.problems];

  /* Rien ne doit disparaître entre la lecture et l'écriture. */
  if (livres.length < livresCollectes.length && existants.length === 0) {
    refus.push('ouvrages perdus à l’assemblage (' + livres.length + ' écrits pour '
      + livresCollectes.length + ' lus) : identifiants ou EAN en double');
  }

  const protection = cheminProtege(opts.sortie, opts);
  if (!protection.ok) refus.push(protection.motif);

  /* ---- écriture --------------------------------------------------- */
  const rapport = {
    magasin: { id: magasin.id, nom: magasin.nom, ville: magasin.ville || '', cp: magasin.cp || '' },
    mode: opts.cookie ? 'session-operateur' : (cibles.some((c) => c.type === 'html') ? 'hors-ligne' : 'public'),
    sources: { fiches: opts.fiches.length, rayons: opts.rayons.length, html: opts.html.length,
               liste: opts.liste ? 1 : 0 },
    requetes: etat.requetes,
    bloqueParAntiBot: etat.bloque,
    lues: lus.length,
    ouvrages: livres.length,
    confirmesSous1H: confirmes.length,
    recus: recus.map((r, i) => ({
      origine: opts.anonyme ? 'source-' + (i + 1)
        : (opts.verbose ? r.origine : String(r.origine).replace(/https?:\/\/[^/]+/, 'fnac.com')),
      motif: r.motif
    })),
    /* Le rapport n'embarque JAMAIS les ouvrages : titres, EAN et SKU
       restent dans le fichier local ignoré par git. */
    /* --anonyme : aucun titre, aucun EAN, aucun identifiant produit, aucun
       nom de magasin annoncé. Ne restent que des compteurs et des motifs,
       publiables sans risque (artefact de CI sur dépôt public). */
    ouvragesLus: opts.anonyme ? lus.map((l) => ({
      type: l.type,
      etat: l.etat,
      delai: l.delai,
      statut: l.statut,
      exploitable: l.exploitable,
      motif: l.motif,
      alertes: l.alertes,
      magasinConforme: !!l.magasinResolu && l.magasinResolu === magasin.id
    })) : lus.map((l) => ({
      produitId: l.produitId,
      identifiant: opts.verbose ? l.titre : masquer(l.titre, 18),
      ean: opts.verbose ? l.ean : masquer(l.ean, 4),
      type: l.type,
      magasinAnnonce: l.magasinAnnonce,
      etat: l.etat,
      delai: l.delai,
      statut: l.statut,
      exploitable: l.exploitable,
      motif: l.motif,
      alertes: l.alertes
    })),
    verification,
    refus,
    sortie: opts.dryRun ? null : path.relative(racine, opts.sortie),
    publication: false,
    genereLe: new Date(maintenant).toISOString(),
    lecteur: L.VERSION_LECTEUR,
    moteur: M.VERSION_MOTEUR,
    avertissement: 'Disponibilité DÉCLARATIVE : aucune API de stock Fnac n’existe publiquement. '
                 + 'Le magasin annoncé dépend de la session du visiteur ; une confirmation humaine '
                 + 'dans le panneau admin reste la référence.'
  };

  if (refus.length) {
    log('⛔ Collecte REFUSÉE (' + refus.length + ' motif(s)) :');
    refus.forEach((r) => log('   · ' + r));
  } else if (opts.dryRun) {
    log('🧪 Dry-run : ' + livres.length + ' ouvrage(s) assemblé(s), '
      + confirmes.length + ' disponibilité(s) « retrait sous 1 h » confirmée(s), rien d’écrit.');
  } else {
    const doc = {
      _lire: 'Catalogue d’artefacts collecté depuis les fiches publiques fnac.com. '
           + 'DONNÉES RÉELLES : ce fichier est ignoré par git et ne doit jamais être commité '
           + '(GitHub Pages publie tout le dépôt). À importer depuis le panneau admin, '
           + 'onglet « 📖 Artefact », qui le chiffre avec la phrase secrète avant publication.',
      version: 'v' + new Date(maintenant).toISOString().slice(0, 10).replace(/-/g, ''),
      genereLe: new Date(maintenant).toISOString(),
      magasinId: magasin.id,
      magasinNom: magasin.nom,
      source: 'fnac.com — fiches publiques',
      sourceType: 'fnac-fiche-publique',
      mode: rapport.mode,
      lecteur: L.VERSION_LECTEUR,
      moteur: M.VERSION_MOTEUR,
      count: livres.length,
      confirmesSous1H: confirmes.length,
      note: rapport.avertissement,
      livres
    };
    ecrireAtomique(opts.sortie, JSON.stringify(doc, null, 2) + '\n');
    rapport.publication = true;
    log('✅ Catalogue écrit : ' + path.relative(racine, opts.sortie) + ' (' + livres.length
      + ' ouvrage(s), dont ' + confirmes.length + ' confirmé(s) « retrait sous 1 h » à '
      + magasin.nom + ')');
    log('   → importe-le depuis le panneau admin (onglet 📖 Artefact) pour le chiffrer et le publier.');
  }

  if (opts.rapport) console.log(JSON.stringify(rapport, null, 2));
  process.exit(refus.length ? 2 : 0);
}

/* Export pour les tests. */
export { lireOptions, verifierCatalogue, fusionnerCatalogue, cheminProtege, estMurAntiBot, masquer };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error('❌ ' + ((e && e.stack) || e)); process.exit(3); });
}
