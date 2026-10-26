#!/usr/bin/env node
/* =====================================================================
   SYNCHRONISATION DE LA LISTE DES MAGASINS FNAC
   (tools/sync-magasins-fnac.mjs)

       node tools/sync-magasins-fnac.mjs                 # synchronise
       node tools/sync-magasins-fnac.mjs --dry-run       # sans écrire
       node tools/sync-magasins-fnac.mjs --check         # contrôle le fichier
       node tools/sync-magasins-fnac.mjs --source-md F   # adaptateur markdown
       node tools/sync-magasins-fnac.mjs --url U         # autre page

   ---------------------------------------------------------------------
   POURQUOI UN OUTIL CÔTÉ SERVEUR / CI, JAMAIS LE NAVIGATEUR
   ---------------------------------------------------------------------
   La liste des magasins est extraite du LOCALISEUR OFFICIEL Fnac
   (https://www.fnac.com/localiser-magasin-fnac/w-4). Ce travail est fait
   ICI (Node, en CI ou à la main), puis publié dans le dépôt et dans
   Firestore :

     · le navigateur du joueur ne contacte JAMAIS fnac.com (CORS,
       empreinte réseau, et surtout respect des conditions d'utilisation
       du site) ;
     · aucun contournement d'authentification, de CAPTCHA ou d'anti-bot :
       si la page n'est pas joignable, l'outil REFUSE et conserve la
       liste précédente ;
     · la liste publiée est un fichier JSON statique, vérifié, versionné,
       dont chaque modification passe par une pull request.

   ---------------------------------------------------------------------
   GARDE-FOUS (tous bloquants)
   ---------------------------------------------------------------------
   La publication est refusée si :
     · la source est injoignable, vide, ou ne ressemble plus au format
       attendu (structure changée) ;
     · moins de MIN_MAGASINS (100) magasins sont extraits ;
     · moins de RATIO_MINIMUM (80 %) de la liste précédente subsiste
       (une fermeture massive est un signal d'erreur de lecture, pas de
       réalité) ;
     · des identifiants manquent ou sont dupliqués ;
     · plus de SEUIL_CHUTE (20 %) des magasins perdent leurs coordonnées.

   ---------------------------------------------------------------------
   COORDONNÉES
   ---------------------------------------------------------------------
   Le localiseur ne publie AUCUNE latitude/longitude. L'outil ne les
   INVENTE JAMAIS : il reporte celles du fichier courant (centroïdes de
   commune, vérifiés à la main) vers les identifiants connus, et marque
   les nouveaux magasins « precision: "inconnue" » sans coordonnées. Un
   magasin sans coordonnées reste sélectionnable ; il n'apparaît
   simplement pas dans les suggestions « le plus proche de toi ».

   Sortie : data/magasins-fnac.json (+ .previous.json conservé) et un
   rapport JSON sur la sortie standard. Code de retour non nul si la
   synchronisation est refusée.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');

const URL_SOURCE = 'https://www.fnac.com/localiser-magasin-fnac/w-4';
const CHEMIN_SORTIE = path.join(racine, 'data', 'magasins-fnac.json');
const CHEMIN_PRECEDENT = path.join(racine, 'data', 'magasins-fnac.previous.json');

const MIN_MAGASINS = 100;          // le localiseur en annonce 191 (2026)
const RATIO_MINIMUM = 0.8;         // au moins 80 % de la liste précédente
const SEUIL_CHUTE_COORD = 0.2;     // au plus 20 % de coordonnées perdues
const DELAI_REQUETE_MS = 25000;

/* ------------------------------------------------------------------ */
/* Arguments                                                           */
/* ------------------------------------------------------------------ */
const args = process.argv.slice(2);
function valeur(nom, defaut) {
  const i = args.indexOf('--' + nom);
  return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
}
const drapeau = (nom) => args.includes('--' + nom);
const OPTS = {
  url: valeur('url', URL_SOURCE),
  sourceMd: valeur('source-md', ''),
  sortie: path.resolve(racine, valeur('out', 'data/magasins-fnac.json')),
  dryRun: drapeau('dry-run'),
  check: drapeau('check'),
  quiet: drapeau('quiet')
};

const log = (...a) => { if (!OPTS.quiet) console.log(...a); };

/* ------------------------------------------------------------------ */
/* Nettoyage / normalisation — AUCUN champ n'entre tel quel dans le jeu */
/* ------------------------------------------------------------------ */
function nettoyerTexte(s, max) {
  return String(s == null ? '' : s)
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
    .slice(0, max || 200);
}
function nettoyerId(s) {
  return nettoyerTexte(s, 20).replace(/[^A-Za-z0-9-]/g, '');
}
function nettoyerCp(s) {
  const cp = nettoyerTexte(s, 10).replace(/[^0-9]/g, '');
  return /^\d{5}$/.test(cp) ? cp : '';
}
function nettoyerNombre(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
}
function decamelize(slug) {
  return nettoyerTexte(String(slug || '').replace(/-/g, ' '), 120);
}

/* ------------------------------------------------------------------ */
/* ADAPTATEUR HTML — le localiseur officiel                            */
/* ---------------------------------------------------------------------
   Structure observée (octobre 2026) : chaque magasin est une carte
   contenant un lien /<Ville-slug>/Fnac-<slug>/cl<N>/w-4, le nom, une à
   trois lignes d'adresse, puis le code postal et la ville.
   Quatre fiches n'ont AUCUN lien (Guadeloupe 97100, La Réunion 97420,
   Paris Gare Saint-Lazare 75008, et un magasin fermé) : elles sont
   conservées avec actif:false plutôt que d'inventer un identifiant. */
function extraireDeHtml(html) {
  const brut = String(html || '');
  if (!brut.length) return { magasins: [], erreur: 'source vide' };

  /* 1) Les fiches : on découpe sur les liens de magasin, qui portent
        l'identifiant stable cl<N>. */
  const reLien = /<a[^>]+href="\/([^"/]+\/[^"/]+)\/(cl\d+)\/w-4"[^>]*>([\s\S]*?)<\/a>/gi;
  const parId = new Map();
  let m;
  while ((m = reLien.exec(brut)) !== null) {
    const slug = nettoyerTexte(m[1], 200).replace(/^\/+|\/+$/g, '');
    const id = nettoyerId(m[2]);
    if (!id || !slug) continue;
    if (!parId.has(id)) parId.set(id, { id, slug, htmlInterne: m[3] });
  }

  /* 2) Pour chaque fiche, on cherche le bloc de texte qui suit le lien :
        nom + adresse + « CP Ville ». On prend une fenêtre bornée après la
        position du lien pour éviter de lire la fiche suivante. */
  const magasins = [];
  for (const fiche of parId.values()) {
    const idx = brut.indexOf('/' + fiche.slug + '/' + fiche.id + '/w-4');
    if (idx < 0) continue;
    const fenetre = brut.slice(idx, idx + 3000);
    const texte = nettoyerTexte(fenetre.replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n'), 1200);
    const lignes = texte.split('\n').map((l) => l.trim()).filter(Boolean);

    /* « 31670 Labège » (ou « 75008 Paris ») : première ligne qui commence
       par 5 chiffres. Tout ce qui précède est le nom puis l'adresse. */
    let iCp = -1;
    for (let i = 0; i < Math.min(lignes.length, 12); i++) {
      if (/^\d{5}\b/.test(lignes[i])) { iCp = i; break; }
    }
    if (iCp < 0) continue;                       // format non reconnu : on saute
    const cpVille = lignes[iCp];
    const cp = nettoyerCp(cpVille);
    const ville = nettoyerTexte(cpVille.replace(/^\d{5}\s*/, ''), 120);
    const avant = lignes.slice(0, iCp);
    /* Le nom est la première ligne qui n'est pas déjà le slug de l'URL. */
    const nomCandidat = avant.find((l) => l.length > 1 && !/^FNAC$/i.test(l)) || '';
    const nom = nettoyerTexte(nomCandidat.replace(/^FNAC\s*/i, ''), 120)
      || decamelize(fiche.slug.split('/').pop() || '').replace(/^Fnac\s*/i, '');
    const adresse = avant.slice(avant.indexOf(nomCandidat) + 1).join(', ').slice(0, 200);

    if (!nom || !ville || !cp) continue;
    magasins.push({ id: fiche.id, nom, ville, cp, slug: fiche.slug, adresse: adresse || undefined });
  }

  /* 3) Les fiches SANS lien : on les conserve marquées inactives, pour
        que leur disparition ne passe pas inaperçue à la revue humaine. */
  const reSansLien = /FNAC\s+([^<\n]{2,80})[\s\S]{0,600}?(\d{5})\s+([A-Za-zÀ-ÿ'’\- ]{2,60})/g;
  const dejaVus = new Set(magasins.map((x) => x.id));
  let s;
  while ((s = reSansLien.exec(brut)) !== null) {
    const nom = nettoyerTexte(s[1], 120);
    const cp = nettoyerCp(s[2]);
    const ville = nettoyerTexte(s[3], 120);
    if (!nom || !cp || !ville) continue;
    const cle = nom + '|' + cp;
    if (dejaVus.has(cle)) continue;
    dejaVus.add(cle);
    /* Aucun identifiant fiable : on n'en invente PAS (un id inventé
       casserait les sessions en cours et les cartouches du magasin). */
    magasins.push({ id: '', nom, ville, cp, slug: '', actif: false,
                    motif: 'fiche sans lien ni identifiant cl<N> dans le localiseur' });
  }

  if (!magasins.length) return { magasins: [], erreur: 'aucune fiche reconnue (format changé ?)' };
  return { magasins };
}

/* ------------------------------------------------------------------ */
/* ADAPTATEUR MARKDOWN — pour les fixtures et les tests hors ligne     */
/* (même contenu que la page, tel que le rend un lecteur de page)      */
/* ---------------------------------------------------------------------
   [FNAC Aéroport Lyon St-Exupéry T1](https://www.fnac.com/Aeroport-Lyon-St-Exupery-T1/Fnac-Aeroport-Lyon-St-Exupery-T1/cl296/w-4)
   Aéroport Lyon St-Exupéry T1
   69125 Lyon */
function extraireDeMarkdown(md) {
  const lignes = String(md || '').split('\n').map((l) => l.trim());
  const magasins = [];
  const reLien = /\]\((?:https?:\/\/www\.fnac\.com)?\/([^)]*?)\/(cl\d+)\/w-4\)/;
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(reLien);
    if (!m) continue;
    const slug = nettoyerTexte(m[1], 200);
    const id = nettoyerId(m[2]);
    /* Le nom est soit dans le libellé du lien, soit sur la ligne suivante. */
    const libelle = nettoyerTexte((lignes[i].match(/\[([^\]]+)\]/) || [, ''])[1], 120)
      .replace(/^FNAC\s*/i, '');
    let nom = libelle;
    let j = i + 1;
    if (!nom && lignes[j]) { nom = nettoyerTexte(lignes[j].replace(/^FNAC\s*/i, ''), 120); j++; }
    /* Adresse puis « CP Ville ». */
    let cp = '', ville = '', adresse = [];
    for (; j < Math.min(lignes.length, i + 8); j++) {
      const l = lignes[j];
      if (!l || reLien.test(l)) break;
      const cpVille = l.match(/^(\d{5})\s+(.+)$/);
      if (cpVille) { cp = nettoyerCp(cpVille[1]); ville = nettoyerTexte(cpVille[2], 120); break; }
      adresse.push(nettoyerTexte(l, 120));
    }
    if (!id || !nom || !cp || !ville) continue;
    magasins.push({ id, nom, ville, cp, slug, adresse: adresse.join(', ').slice(0, 200) || undefined });
  }
  if (!magasins.length) return { magasins: [], erreur: 'aucune fiche reconnue dans le markdown' };
  return { magasins };
}

/* ------------------------------------------------------------------ */
/* Validation de la liste extraite                                     */
/* ------------------------------------------------------------------ */
function valider(magasins, precedente) {
  const problemes = [];
  const ids = new Set();
  magasins.forEach((m) => {
    if (m.actif === false) return;
    if (!m.id) { problemes.push('magasin sans identifiant : ' + m.nom); return; }
    if (ids.has(m.id)) problemes.push('identifiant dupliqué : ' + m.id);
    ids.add(m.id);
    if (!m.nom || !m.ville || !/^\d{5}$/.test(m.cp || '')) {
      problemes.push('fiche incomplète : ' + (m.id || m.nom));
    }
  });

  const actifs = magasins.filter((m) => m.actif !== false);
  if (actifs.length < MIN_MAGASINS) {
    problemes.push('nombre de magasins trop faible : ' + actifs.length + ' < ' + MIN_MAGASINS);
  }
  if (precedente && precedente.length) {
    const avant = precedente.filter((m) => m.actif !== false);
    const conserves = avant.filter((m) => ids.has(m.id)).length;
    const ratio = avant.length ? conserves / avant.length : 1;
    if (ratio < RATIO_MINIMUM) {
      problemes.push('perte anormale de magasins : ' + conserves + '/' + avant.length
        + ' (' + Math.round(ratio * 100) + ' % < ' + Math.round(RATIO_MINIMUM * 100) + ' %)');
    }
    const coordsAvant = avant.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon)).length;
    const coordsApres = actifs.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon)).length;
    if (coordsAvant && (coordsAvant - coordsApres) / coordsAvant > SEUIL_CHUTE_COORD) {
      problemes.push('perte anormale de coordonnées : ' + coordsApres + '/' + coordsAvant
        + ' (seuil ' + Math.round(SEUIL_CHUTE_COORD * 100) + ' %)');
    }
  }
  return problemes;
}

/* Reporte les coordonnées connues (centroïdes vérifiés à la main) et
   signale les nouveaux magasins sans géométrie. */
function reporterCoordonnees(magasins, precedente) {
  const parId = new Map((precedente || []).map((m) => [m.id, m]));
  let reports = 0, nouveaux = 0, perdus = 0;
  magasins.forEach((m) => {
    const ancien = parId.get(m.id);
    if (ancien && Number.isFinite(ancien.lat) && Number.isFinite(ancien.lon)) {
      m.lat = ancien.lat; m.lon = ancien.lon;
      m.precision = ancien.precision || 'commune';
      if (ancien.note) m.note = ancien.note;
      reports++;
      return;
    }
    if (ancien) { perdus++; return; }
    nouveaux++;
    m.precision = 'inconnue';
    m.note = 'nouveau magasin : coordonnées à compléter à la main '
      + '(centroïde de la commune) avant publication';
  });
  return { reports, nouveaux, perdus };
}

/* ------------------------------------------------------------------ */
/* Lecture / écriture                                                  */
/* ------------------------------------------------------------------ */
function lirePrecedent(chemin) {
  try {
    const doc = JSON.parse(fs.readFileSync(chemin, 'utf8'));
    return Array.isArray(doc.magasins) ? doc.magasins : [];
  } catch (e) { return []; }
}

function ecrireAtomique(chemin, contenu) {
  const tmp = chemin + '.tmp-' + process.pid;
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(tmp, contenu, 'utf8');
  fs.renameSync(tmp, chemin);
}

async function telecharger(url) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_REQUETE_MS);
  try {
    const reponse = await fetch(url, {
      signal: controleur.signal,
      headers: {
        /* Un en-tête honnête : pas d'imitation de navigateur, pas de
           contournement. Si le site refuse, l'outil s'arrête là. */
        'User-Agent': 'MissionNautilus-storelist-sync/1.0 (+https://github.com/hypernovax31/mission-nautilus)',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });
    if (!reponse.ok) throw new Error('HTTP ' + reponse.status);
    return await reponse.text();
  } finally {
    clearTimeout(minuteur);
  }
}

/* ------------------------------------------------------------------ */
/* Programme                                                           */
/* ------------------------------------------------------------------ */
async function principal() {
  const rapport = {
    outil: 'sync-magasins-fnac', lanceLe: new Date().toISOString(),
    source: OPTS.sourceMd ? 'markdown:' + OPTS.sourceMd : OPTS.url,
    refus: [], coordonnees: {}, publication: false
  };

  const precedente = lirePrecedent(OPTS.sortie);
  rapport.listePrecedente = precedente.length;

  /* --- mode contrôle : on ne vérifie QUE le fichier existant --- */
  if (OPTS.check) {
    const problemes = valider(precedente, []);
    rapport.problemes = problemes;
    rapport.publication = false;
    log(problemes.length ? '❌ ' + problemes.join('\n❌ ') : '✅ liste existante cohérente ('
      + precedente.length + ' magasins)');
    console.log(JSON.stringify(rapport, null, 2));
    process.exit(problemes.length ? 1 : 0);
  }

  /* --- extraction --- */
  let extraite;
  if (OPTS.sourceMd) {
    extraite = extraireDeMarkdown(fs.readFileSync(OPTS.sourceMd, 'utf8'));
  } else {
    try {
      const html = await telecharger(OPTS.url);
      extraite = extraireDeHtml(html);
      rapport.octetsSource = html.length;
    } catch (e) {
      extraite = { magasins: [], erreur: 'source injoignable : ' + (e && e.message || e) };
    }
  }
  if (extraite.erreur) rapport.refus.push(extraite.erreur);

  const coord = reporterCoordonnees(extraite.magasins, precedente);
  rapport.coordonnees = coord;
  rapport.extraits = extraite.magasins.length;
  rapport.actifs = extraite.magasins.filter((m) => m.actif !== false).length;

  const problemes = valider(extraite.magasins, precedente);
  rapport.problemes = problemes;
  if (problemes.length) rapport.refus.push(...problemes);

  /* --- publication --- */
  if (!rapport.refus.length && !OPTS.dryRun) {
    const doc = {
      version: 'v' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      source: OPTS.url,
      sourceType: 'fnac-official-locator',
      mode: 'sync-automatique-verifie',
      syncedAt: new Date().toISOString(),
      count: extraite.magasins.length,
      precisionDefaut: 'commune',
      magasins: extraite.magasins
    };
    /* Écriture ATOMIQUE + conservation de la liste précédente : un
       retour arrière reste possible sans git. */
    if (fs.existsSync(OPTS.sortie)) {
      fs.copyFileSync(OPTS.sortie, CHEMIN_PRECEDENT === OPTS.sortie ? OPTS.sortie + '.bak' : CHEMIN_PRECEDENT);
    }
    ecrireAtomique(OPTS.sortie, JSON.stringify(doc, null, 2) + '\n');
    rapport.publication = true;
    rapport.version = doc.version;
    log('✅ Liste publiée : ' + doc.count + ' magasins (' + doc.version + ') — '
      + coord.reports + ' coordonnées reportées, ' + coord.nouveaux + ' nouveau(x).');
  } else if (rapport.refus.length) {
    log('⛔ Synchronisation REFUSÉE (la liste en place est conservée) :');
    rapport.refus.forEach((r) => log('   · ' + r));
  } else {
    log('🧪 Dry-run : ' + rapport.actifs + ' magasins actifs extraits, '
      + coord.nouveaux + ' nouveau(x), aucun fichier écrit.');
  }

  console.log(JSON.stringify(rapport, null, 2));
  process.exit(rapport.refus.length ? 2 : 0);
}

/* Export pour les tests (tools/tests-artefact-palier3.mjs). */
export {
  extraireDeHtml, extraireDeMarkdown, valider, reporterCoordonnees, nettoyerTexte,
  nettoyerId, nettoyerCp, MIN_MAGASINS, RATIO_MINIMUM, SEUIL_CHUTE_COORD
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error('❌ ' + (e && e.stack || e)); process.exit(3); });
}
