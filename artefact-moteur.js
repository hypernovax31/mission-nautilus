/* =====================================================================
   ARTEFACT DU NAUTILUS — MOTEUR PUR DU PALIER 3  (artefact-moteur.js)

   Ce fichier est le CŒUR DE RÈGLES du nouveau Palier 3 (« Les escales
   secrètes du Nautilus »). Il ne touche ni au DOM, ni au réseau, ni à
   Firebase : il ne calcule rien d'autre que des textes, des empreintes
   et des classements. C'est volontaire — le même fichier sert :

     · au jeu, dans le navigateur (1831411720.html) ;
     · au panneau admin (admin-artefact.js) ;
     · aux Cloud Functions facultatives (functions/) ;
     · aux tests Node (tools/tests-artefact-palier3.mjs).

   Une règle écrite deux fois finit toujours par se contredire : c'est
   la leçon des blocages (voir tools/tests-mission-nautilus.mjs). Ici,
   il n'y a donc QU'UNE source.

   ---------------------------------------------------------------------
   POURQUOI DES EMPREINTES ET JAMAIS DE RÉPONSE EN CLAIR
   ---------------------------------------------------------------------
   Le jeu est servi en statique (GitHub Pages / Firebase Hosting) : tout
   ce qui est lu par le navigateur est public. Or la demande est nette :
   le joueur ne doit JAMAIS recevoir l'EAN attendu, le SKU, le titre
   enregistré, la catégorie Fnac, ni aucune solution.

   Réponse du moteur : la cartouche de mission (ce que le joueur lit) ne
   contient que des EMPREINTES — sha256 itéré, salé par session. Le
   navigateur calcule l'empreinte de ce que le joueur propose et la
   compare. Rien de déchiffrable ne transite.

   Le verrou réel est l'ÉTAPE DU SCEAU (l'EAN) : son empreinte utilise
   ITERATIONS_EAN itérations, ce qui rend une recherche exhaustive sur
   l'espace des EAN-13 (≈ 10⁹ codes valides) inutilisable pendant une
   partie. Les étapes suivantes portent sur des valeurs que le joueur
   lit SUR LE LIVRE QU'IL A EN MAIN : les deviner ne lui donnerait que
   ce qu'il peut déjà lire.

   Pour une vérification réellement côté serveur (aucun calcul chez le
   joueur), déploie functions/ et passe artefacts/config.mode à
   « fonction » : le moteur est le même, seul le transport change.
   ===================================================================== */
(function (racine, usine) {
  'use strict';
  var paquet = usine();
  if (typeof module !== 'undefined' && module.exports) { module.exports = paquet.api; }
  if (racine) { racine.NautilusArtefactMoteur = paquet.api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var VERSION_MOTEUR = '1.2.0';   // vocabulaire de disponibilité réel (fnac-lecteur.js)

  /* ==================================================================
     1. SHA-256 PUR JS — identique dans le navigateur, Node et une
        Cloud Function. Aucune dépendance, aucun WebCrypto (donc aucun
        écart possible entre deux environnements : une empreinte
        produite par l'admin est vérifiable par n'importe quel appareil).
     ================================================================== */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8(texte) {
    var s = String(texte == null ? '' : texte), out = [], i, c, c2, cp;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
        c2 = s.charCodeAt(++i);
        cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
                 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return out;
  }

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  /* sha256 sur un tableau d'octets → 32 octets. */
  function sha256Octets(msg) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = msg.length, avecUn = msg.concat([0x80]);
    while (avecUn.length % 64 !== 56) avecUn.push(0);
    var bits = l * 8;
    avecUn.push(0, 0, 0, 0);
    avecUn.push((bits >>> 24) & 0xff, (bits >>> 16) & 0xff, (bits >>> 8) & 0xff, bits & 0xff);

    var w = new Array(64), i, j;
    for (i = 0; i < avecUn.length; i += 64) {
      for (j = 0; j < 16; j++) {
        w[j] = (avecUn[i + j * 4] << 24) | (avecUn[i + j * 4 + 1] << 16) |
               (avecUn[i + j * 4 + 2] << 8) | avecUn[i + j * 4 + 3];
      }
      for (j = 16; j < 64; j++) {
        var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (j = 0; j < 64; j++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (hh + S1 + ch + K[j] + w[j]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) out.push((h[i] >>> 24) & 0xff, (h[i] >>> 16) & 0xff,
                                     (h[i] >>> 8) & 0xff, h[i] & 0xff);
    return out;
  }

  function hex(octets) {
    var s = '', i;
    for (i = 0; i < octets.length; i++) s += ('0' + octets[i].toString(16)).slice(-2);
    return s;
  }

  function sha256Hex(texte) { return hex(sha256Octets(utf8(texte))); }

  /* ==================================================================
     2. EMPREINTES — le seul « secret » que le joueur peut manipuler.
        empreinte(valeur, sel, iterations) :
          h = sha256("nautilus-artefact-v1|" + sel + "|" + valeurNormalisee)
          puis (iterations - 1) fois : h = sha256(h)
        Le sel est ALÉATOIRE PAR CARTOUCHE : une empreinte ne se rejoue
        pas d'une partie à l'autre, aucun dictionnaire précalculé n'est
        réutilisable.
     ================================================================== */
  var PREFIXE_EMPREINTE = 'nautilus-artefact-v1';
  /* COÛT DES EMPREINTES — le compromis assumé.
     Une empreinte est calculée dans le navigateur du matelot à chaque
     réponse : trop d'itérations et le jeu rame sur téléphone ; pas assez
     et la cartouche publique se brute-force vite hors ligne.
     Valeurs retenues (mesurées) : ~30 ms par réponse texte et ~120 ms par
     scan d'EAN sur un ordinateur récent, environ 4× plus sur mobile.
     La protection RÉELLE contre l'énumération hors ligne n'est pas ce
     compteur (un attaquant motivé utilise du code natif) : c'est le mode
     « fonction », où la vérification se fait côté serveur et où aucune
     empreinte n'est publiée. Voir docs/PALIER3-ARTEFACT.md. */
  var ITERATIONS_DEFAUT = 6000;      // étapes lues sur le livre (espace petit)
  /* 120 000 itérations : ≈ 0,6 s sur un ordinateur, 1 à 3 s sur un
     téléphone (l'écran affiche « le sceau examine l'ouvrage »). Face à
     une recherche exhaustive sur l'espace des EAN-13 (≈ 10⁹ codes à clé
     valide), cela représente ~10¹⁴ hachages : plusieurs heures de GPU,
     donc inutilisable pendant une partie. */
  /* EAN : une seule vérification par scan, on peut se permettre un coût
     plus élevé que pour les réponses texte (espace de réponses bien plus
     grand : tous les EAN de livres publiés). */
  var ITERATIONS_EAN = 24000;        // sceau : espace ≈ 10⁹ → dissuasif

  function empreinte(valeur, sel, iterations) {
    var it = Math.max(1, Number(iterations) || ITERATIONS_DEFAUT);
    var h = sha256Hex(PREFIXE_EMPREINTE + '|' + String(sel || '') + '|' + valeur);
    for (var i = 1; i < it; i++) h = sha256Hex(h);
    return h;
  }

  function empreintes(valeurs, sel, iterations) {
    var vues = {}, out = [];
    (valeurs || []).forEach(function (v) {
      if (v == null || v === '') return;
      var e = empreinte(v, sel, iterations);
      if (!vues[e]) { vues[e] = true; out.push(e); }
    });
    return out;
  }

  /* Comparaison à temps constant (autant de comparaisons que d'empreintes
     acceptées : la réponse ne fuit pas par la durée). */
  function verifier(valeurCalculee, acceptees) {
    var cible = String(valeurCalculee || '');
    var liste = Array.isArray(acceptees) ? acceptees : [];
    var trouve = 0, i;
    for (i = 0; i < liste.length; i++) {
      var a = String(liste[i] || ''), egal = 1;
      if (a.length !== cible.length) egal = 0;
      for (var j = 0; j < Math.max(a.length, cible.length); j++) {
        if (a.charCodeAt(j) !== cible.charCodeAt(j)) egal = 0;
      }
      trouve |= egal;
    }
    return liste.length > 0 && trouve === 1;
  }

  /* ==================================================================
     3. NORMALISATION — la validation doit être STRICTE sur le fond et
        TOLÉRANTE sur la forme (accents, casse, séparateurs, majuscules
        oubliées). Jamais l'inverse.
     ================================================================== */
  function sansAccents(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normaliser(valeur, type) {
    var s = sansAccents(valeur).replace(/\s+/g, ' ').trim();
    if (type === 'ean') return s.replace(/[^0-9]/g, '');
    if (type === 'nombre') return s.replace(/[^0-9]/g, '');
    if (type === 'lettre') return s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
    if (type === 'code') return canonicaliserCode(s);
    /* texte : mots en majuscules, ponctuation ignorée */
    return s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  /* Variantes acceptées d'une réponse : la forme peut varier, le fond
     non. Exemple « 5-c-7 » / « 05-C-07 » / « 5C07 » → même réponse. */
  function variantes(valeur, type) {
    var base = normaliser(valeur, type);
    if (!base) return [];
    var out = [base];
    function pousser(v) { if (v && out.indexOf(v) < 0) out.push(v); }

    if (type === 'ean' || type === 'nombre') {
      pousser(base.replace(/^0+(?=\d)/, ''));            // sans zéros de tête
      if (/^[0-9]$/.test(base)) pousser('0' + base);     // sur deux chiffres
      return out;
    }
    if (type === 'lettre') return out;

    if (type === 'code') {
      /* La forme canonique calculée par normaliser() couvre déjà toutes les
         écritures (séparateurs, casse, zéros de tête) : une seule empreinte
         par réponse, au lieu de cinq. */
      return out;
    }

    return out;
  }

  function empreintesAcceptees(valeur, sel, iterations, type) {
    return empreintes(variantes(valeur, type), sel, iterations);
  }

  /* ==================================================================
     4. EAN-13 — contrôle de la clé. Un code scanné dont la clé est
        fausse n'est jamais envoyé : on économise une erreur au matelot
        (un scan à moitié lu ne doit pas coûter une tentative).
     ================================================================== */
  function eanValide(code) {
    var s = normaliser(code, 'ean');
    if (s.length === 12) s = '0' + s;         // UPC-A → EAN-13
    if (!/^[0-9]{13}$/.test(s)) return false;
    var somme = 0, i;
    for (i = 0; i < 12; i++) somme += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    var cle = (10 - (somme % 10)) % 10;
    return cle === Number(s[12]);
  }

  function eanNormalise(code) {
    var s = normaliser(code, 'ean');
    if (s.length === 12) s = '0' + s;
    return /^[0-9]{13}$/.test(s) ? s : '';
  }

  /* ==================================================================
     5. SÉCURISATION DE TOUTE DONNÉE VENUE DU WEB
        Même circuit que la liste des magasins : rien de brut n'entre
        dans le jeu. Toute chaîne extérieure passe par nettoyerTexte()
        avant stockage ou affichage ; les objets par sanitiser().
     ================================================================== */
  function nettoyerTexte(s, max) {
    var t = String(s == null ? '' : s)
      .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, ' ')   // blocs de script
      .replace(/<[^>]*>/g, ' ')                                    // toute balise
      .replace(/javascript:/gi, '')
      .replace(/on[a-z]+\s*=/gi, '')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    var limite = Math.max(1, Number(max) || 200);
    return t.length > limite ? t.slice(0, limite).trim() : t;
  }

  /* Échappement pour injection dans du HTML (jamais innerHTML brut). */
  function echapper(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var LONGUEURS_MAX = {
    id: 64, titre: 220, sousTitre: 220, auteur: 160, editeur: 120,
    edition: 80, format: 60, categorie: 120, rayon: 80, ean: 13,
    sku: 40, url: 600, nom: 120, ville: 120, adresse: 260, cp: 12,
    slug: 200, motif: 200, famille: 40, type: 40
  };

  function champ(objet, cle, defaut) {
    var v = objet && objet[cle] != null ? objet[cle] : defaut;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    return nettoyerTexte(v, LONGUEURS_MAX[cle] || 160);
  }

  /* Livre « tel qu'il doit exister » : champs bornés, types vérifiés.
     Renvoie { livre, erreurs } — un livre refusé n'entre JAMAIS dans le
     catalogue. */
  function validerLivre(brut) {
    var erreurs = [];
    if (!brut || typeof brut !== 'object') return { livre: null, erreurs: ['entrée invalide'] };
    var livre = {
      id: champ(brut, 'id', '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
      titre: champ(brut, 'titre', ''),
      sousTitre: champ(brut, 'sousTitre', ''),
      auteur: champ(brut, 'auteur', ''),
      auteurType: ['unique', 'plusieurs', 'collectif'].indexOf(String(brut.auteurType)) >= 0
        ? String(brut.auteurType) : '',
      editeur: champ(brut, 'editeur', ''),
      edition: champ(brut, 'edition', ''),
      editionNumero: Number(brut.editionNumero) > 0 ? Math.min(99, Math.round(Number(brut.editionNumero))) : 0,
      annee: Number(brut.annee) >= 1000 && Number(brut.annee) <= 2999 ? Math.round(Number(brut.annee)) : 0,
      pages: Number(brut.pages) > 0 ? Math.min(9999, Math.round(Number(brut.pages))) : 0,
      format: champ(brut, 'format', ''),
      ean: eanNormalise(brut.ean),
      sku: champ(brut, 'sku', '').replace(/[^A-Za-z0-9-]/g, ''),
      url: champ(brut, 'url', ''),
      categorieFnac: champ(brut, 'categorieFnac', ''),
      etiquetteFnac: champ(brut, 'etiquetteFnac', ''),
      rayon: champ(brut, 'rayon', ''),
      type: champ(brut, 'type', '').toLowerCase(),
      famille: champ(brut, 'famille', '').toLowerCase(),
      liens: (Array.isArray(brut.liens) ? brut.liens : [])
        .map(function (l) { return nettoyerTexte(l, 40).toLowerCase(); })
        .filter(Boolean).slice(0, 12),
      priorite: Number(brut.priorite) > 0 ? Math.min(9, Math.round(Number(brut.priorite))) : 0,
      vendeur: brut.vendeurPartenaire === true || String(brut.vendeur || '').toLowerCase() === 'partenaire'
        ? 'partenaire' : 'fnac',
      disponibilite: (brut.disponibilite && typeof brut.disponibilite === 'object')
        ? brut.disponibilite : {}
    };
    if (/^https:\/\//i.test(String(brut.url || ''))) livre.url = String(brut.url).slice(0, 600);
    else livre.url = '';

    if (!livre.id) erreurs.push('identifiant manquant');
    if (!livre.titre) erreurs.push('titre manquant');
    if (!livre.ean) erreurs.push('EAN absent ou invalide (13 chiffres, clé contrôlée)');
    if (!livre.edition && !livre.editionNumero && !livre.annee) {
      erreurs.push('édition non identifiée : titre, édition et année ne peuvent pas être tous absents');
    }
    if (!livre.auteur && !livre.auteurType) erreurs.push('auteur ou collectif manquant');
    if (!livre.famille && !livre.type && !livre.categorieFnac) {
      erreurs.push('aucun lien exploitable avec l’aventure (famille, type ou catégorie requis)');
    }
    /* Une offre de vendeur PARTENAIRE n'invalide pas la fiche : elle
       l'exclut seulement de la SÉLECTION AUTOMATIQUE (voir candidats()).
       L'admin reste libre de l'affecter manuellement, en connaissance de
       cause — le magasin ne garantit alors pas le retrait sous 1 h. */
    return { livre: erreurs.length ? null : livre, erreurs: erreurs };
  }

  /* ==================================================================
     6. DISPONIBILITÉ — la règle des 15 minutes
        La fraîcheur ne porte QUE sur la disponibilité en magasin, au
        moment de PRÉPARER la mission. Elle ne chronomètre jamais le
        matelot : une fois l'ouvrage affecté à la session, il peut le
        chercher aussi longtemps qu'il faut.
     ================================================================== */
  var FENETRE_FRAICHEUR_MINUTES = 15;

  /* Affirmations EXPLICITES que l'ouvrage est déjà en rayon : elles
     valent « sous 1 h ». Le lecteur de fiche (fnac-lecteur.js) ne produit
     jamais ces mots par déduction — il ne recopie que ce que la page
     écrit — et l'opérateur ne les saisit que s'il les a constatés. */
  var DELAIS_EN_RAYON = ['en rayon', 'immediat', 'immediate', 'sur place',
                         'aujourd hui', 'deja en magasin', 'en stock en magasin',
                         'en stock magasin', '0 h', '0h'];

  /* « Retrait gratuit sous 1H », « retrait en magasin sous 1 heure »,
     « 60 min », « en rayon » → ACCEPTÉS.
     « sous 1J », « 24 h », « 2 h », « 1 h 30 », « demain », ou un délai
     illisible → REFUSÉS. On ne devine jamais : un délai qu'on ne sait
     pas lire vaut un délai trop long. */
  function delaiAccepte(delai) {
    var d = nettoyerTexte(delai, 60).toLowerCase().replace(/[\u2019']/g, '');
    if (!d) return false;
    /* Les mots « déjà en rayon » d'abord : « retrait immédiat » ne porte
       aucun chiffre, le motif numérique ci-dessous ne le verrait pas. */
    /* Comparaison sans espaces : « aujourd'hui » perd son apostrophe au
       nettoyage, « aujourd hui » et « aujourdhui » doivent tomber juste. */
    var plat = sansAccents(d).replace(/[^a-z0-9]+/g, '').trim();
    for (var k = 0; k < DELAIS_EN_RAYON.length; k++) {
      if (plat.indexOf(sansAccents(DELAIS_EN_RAYON[k]).replace(/[^a-z0-9]+/g, '')) >= 0) return true;
    }
    /* « 1 h 30 » : les minutes comptent, ce n'est plus « sous 1 h ». */
    var hm = d.match(/(\d+)\s*(?:h|heure|heures)\s*(\d{1,2})/);
    if (hm && Number(hm[2]) > 0) return false;
    var m = d.match(/(\d+)\s*(heures|heure|h|min|minutes|minute|jours|jour|j|d)\b/);
    if (!m) return false;
    var n = Number(m[1]), unite = m[2];
    if (unite === 'j' || unite === 'd' || unite === 'jour' || unite === 'jours') return false;
    if (unite.charAt(0) === 'm') return n <= 60;
    return n <= 1;
  }

  /* { statut, delai, checkedAt, vendeur, magasin } → exploitable ? */
  function disponibiliteValide(dispo, magasinId, opts) {
    var o = opts || {};
    var fenetre = Number(o.fenetreMinutes) > 0 ? Number(o.fenetreMinutes) : FENETRE_FRAICHEUR_MINUTES;
    var maintenant = Number(o.maintenant) || Date.now();
    if (!dispo || typeof dispo !== 'object') return { ok: false, motif: 'aucune disponibilité enregistrée' };
    if (String(dispo.statut || '').toLowerCase() !== 'disponible') {
      return { ok: false, motif: 'ouvrage annoncé indisponible' };
    }
    if (magasinId && dispo.magasin && String(dispo.magasin) !== String(magasinId)) {
      return { ok: false, motif: 'disponibilité confirmée pour un autre magasin' };
    }
    /* Une disponibilité ANNONCÉE pour un magasin (nom lu sur la fiche
       Fnac) mais non rattachée à un identifiant officiel ne vaut rien :
       le lecteur refuse déjà de l'attribuer, on le revérifie ici. */
    if (magasinId && !dispo.magasin && dispo.magasinAnnonce) {
      return { ok: false, motif: 'disponibilité annoncée pour « ' + nettoyerTexte(dispo.magasinAnnonce, 60)
        + ' » sans magasin identifié dans la liste officielle' };
    }
    if (String(dispo.vendeur || 'fnac').toLowerCase() === 'partenaire') {
      return { ok: false, motif: 'offre d’un vendeur partenaire (hors Fnac)' };
    }
    if (!delaiAccepte(dispo.delai)) {
      return { ok: false, motif: 'délai annoncé supérieur à une heure (retrait sous 1 h exigé)' };
    }
    var t = Date.parse(dispo.checkedAt || '');
    if (!t) return { ok: false, motif: 'vérification non horodatée' };
    var age = maintenant - t;
    if (age < 0) return { ok: false, motif: 'horodatage dans le futur (horloge à corriger)' };
    if (age > fenetre * 60000) {
      return { ok: false, motif: 'vérification trop ancienne (' + Math.round(age / 60000)
        + ' min > ' + fenetre + ' min) : à reconfirmer' };
    }
    return { ok: true, ageMinutes: Math.round(age / 60000), motif: '' };
  }

  /* ==================================================================
     7. SÉLECTION AUTOMATIQUE — « le premier ouvrage compatible trouvé »
        Un ouvrage n'est retenu que si TOUT est cohérent :
          disponibilité 1 h fraîche + EAN connu et vérifiable + édition
          identifiée + lien thématique exploitable avec le Nautilus.
        Puis on classe : type d'ouvrage, richesse des données visibles,
        netteté de l'édition. À priorité égale, tirage déterministe
        (le sel de session) : deux équipages ne suivent pas la même
        route, mais une même session rejoue la même sélection.
     ================================================================== */
  var PRIORITES = [
    { rang: 1, types: ['atlas-mondial', 'atlas-geographique', 'atlas'] },
    { rang: 2, types: ['atlas-maritime', 'oceans', 'mers'] },
    { rang: 3, types: ['guide-voyage', 'guide-general', 'voyage'] },
    { rang: 4, types: ['guide-specialise', 'cartes-index', 'cartographie'] },
    { rang: 5, types: ['exploration', 'histoire', 'sciences', 'oceanographie',
                       'litterature', 'aventure', 'nature', 'technique',
                       'technologie', 'jeunesse', 'beaux-arts', 'etude'] }
  ];

  function rangPriorite(livre) {
    var cibles = [String(livre.type || '').toLowerCase(), String(livre.famille || '').toLowerCase()];
    if (livre.priorite > 0) return Math.min(9, livre.priorite);
    for (var i = 0; i < PRIORITES.length; i++) {
      for (var j = 0; j < PRIORITES[i].types.length; j++) {
        if (cibles.indexOf(PRIORITES[i].types[j]) >= 0) return PRIORITES[i].rang;
      }
    }
    return 9;
  }

  /* Richesse des informations VISIBLES (celles dont les énigmes se
     servent) : plus il y en a, plus la mission peut être variée. */
  function scoreRichesse(livre) {
    var n = 0;
    if (livre.titre) n += 2;
    if (livre.auteur) n += 2;
    if (livre.editeur) n += 2;
    if (livre.edition || livre.editionNumero) n += 2;
    if (livre.annee) n += 1;
    if (livre.pages) n += 1;
    if (livre.format) n += 1;
    if (livre.categorieFnac || livre.etiquetteFnac) n += 1;
    if (livre.rayon) n += 1;
    n += Math.min(3, (livre.liens || []).length);
    return n;
  }

  /* Générateur pseudo-aléatoire déterministe (mulberry32) : la sélection
     « aléatoire parmi les compatibles » doit être REJOUABLE à partir du
     sel de session, sinon un rafraîchissement changerait l'ouvrage en
     cours de partie — exactement ce que la règle interdit. */
  function aleatoireDeSel(sel) {
    var h = 2166136261 >>> 0, s = String(sel || 'nautilus');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    var a = h >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Candidats EXPLOITABLES pour un magasin, à un instant donné.
     Renvoie les ouvrages retenus (triés) ET les motifs d'écart : le
     panneau admin doit pouvoir dire POURQUOI rien n'a été trouvé, sans
     jamais montrer ces motifs au joueur. */
  function candidats(livres, magasinId, opts) {
    var o = opts || {}, maintenant = Number(o.maintenant) || Date.now();
    var fenetre = Number(o.fenetreMinutes) > 0 ? o.fenetreMinutes : FENETRE_FRAICHEUR_MINUTES;
    var exclus = o.exclus || [];
    var ok = [], ecartes = [];

    (livres || []).forEach(function (brut) {
      var v = validerLivre(brut);
      if (!v.livre) {
        ecartes.push({ id: (brut && brut.id) || '?', motif: v.erreurs.join(' ; ') });
        return;
      }
      var l = v.livre;
      if (exclus.indexOf(l.id) >= 0 || exclus.indexOf(l.ean) >= 0) {
        ecartes.push({ id: l.id, motif: 'exclu de cette sélection (ouvrage déjà remplacé)' });
        return;
      }
      if (l.vendeur === 'partenaire' && !o.inclurePartenaires) {
        ecartes.push({ id: l.id, motif: 'offre d’un vendeur partenaire : hors sélection automatique' });
        return;
      }
      var dispo = (l.disponibilite || {})[magasinId] || null;
      var d = disponibiliteValide(dispo, magasinId, { fenetreMinutes: fenetre, maintenant: maintenant });
      if (!d.ok) { ecartes.push({ id: l.id, motif: d.motif }); return; }
      if (!choisirFamille(l)) {
        ecartes.push({ id: l.id, motif: 'aucun lien thématique exploitable avec le Nautilus' });
        return;
      }
      l._rang = rangPriorite(l);
      l._richesse = scoreRichesse(l);
      l._disponibilite = { magasin: magasinId, statut: 'disponible', delai: dispo.delai,
                           checkedAt: dispo.checkedAt, ageMinutes: d.ageMinutes };
      ok.push(l);
    });

    ok.sort(function (a, b) {
      if (a._rang !== b._rang) return a._rang - b._rang;
      if (b._richesse !== a._richesse) return b._richesse - a._richesse;
      var ea = a.editionNumero || 0, eb = b.editionNumero || 0;
      if (eb !== ea) return eb - ea;                     // édition la plus nette d'abord
      return String(a.id).localeCompare(String(b.id));
    });
    return { retenus: ok, ecartes: ecartes };
  }

  function choisirLivre(livres, magasinId, opts) {
    var o = opts || {};
    var c = candidats(livres, magasinId, o);
    if (!c.retenus.length) return { livre: null, ecartes: c.ecartes };
    var meilleurRang = c.retenus[0]._rang;
    var memeRang = c.retenus.filter(function (l) { return l._rang === meilleurRang; });
    var tirage = aleatoireDeSel(o.sel || o.sessionId || magasinId || 'nautilus');
    var choix = memeRang.length === 1
      ? memeRang[0]
      : memeRang[Math.floor(tirage() * memeRang.length) % memeRang.length];
    return { livre: choix, ecartes: c.ecartes, candidats: c.retenus.length };
  }

  /* ==================================================================
     8. FAMILLES D'INDICES — le texte qui mène au rayon SANS le nommer.
        Aucune de ces chaînes ne contient un titre, un EAN, un SKU, une
        catégorie Fnac en clair, ni un nom de rayon : elles sont donc
        publiques sans risque (elles sont, par construction, l'indice).
        Chaque famille fournit :
          indice   : l'énigme de départ (précise, jamais explicite)
          resserre : aide de niveau 1 (méthode, pas de réponse)
          edition  : aide de niveau 2 (méthode, pas de numéro)
          auteur   : aide de niveau 3 (nature de la signature, pas de nom)
          motif    : pourquoi le Nautilus a choisi CET ouvrage (récit)
     ================================================================== */
  var FAMILLES = [
    {
      id: 'atlas-mondial', types: ['atlas-mondial', 'atlas-geographique', 'atlas', 'cartographie'],
      indice: "Le Nautilus n'a pas plongé dans une seule mer : il a longé toutes les terres à la fois.\n"
            + "Cherche l'ouvrage qui embrasse le monde entier sans quitter le magasin,\n"
            + "celui où chaque pays tient dans une page et chaque ville dans un point.",
      resserre: "Ce n'est ni un récit, ni un carnet de route : c'est un volume qui mesure, classe et situe.\n"
              + "Son format est plus large que haut, et il s'ouvre à plat.",
      edition: "La mention d'édition est imprimée sur la couverture ou sur l'étiquette du rayon.\n"
             + "Ce n'est pas la première : le Nautilus a connu plusieurs refontes de ses cartes.",
      auteur: "Aucun navigateur solitaire ne l'a signé : regarde au-dessus du titre,\n"
            + "tu n'y trouveras pas un nom de personne mais la trace d'un travail à plusieurs.",
      motif: "Le Nautilus a choisi cet ouvrage parce qu'il ne raconte rien : il situe tout."
    },
    {
      id: 'atlas-maritime', types: ['atlas-maritime', 'oceans', 'mers'],
      indice: "Là où la terre s'efface, le Nautilus garde ses repères.\n"
            + "Cherche l'ouvrage qui ne parle que d'eau : océans, détroits, courants et profondeurs,\n"
            + "là où les cartes deviennent bleues et où les noms se comptent en lieues.",
      resserre: "Le volume que tu cherches est consacré aux étendues d'eau, pas aux pays.\n"
              + "On y parle de passages, de routes maritimes et de fosses.",
      edition: "La mention d'édition figure sur la couverture ou l'étiquette du rayon.\n"
             + "Plusieurs refontes ont existé : ce n'est pas la toute première.",
      auteur: "La signature tient en un nom de personne, ou en un collectif :\n"
            + "observe la ligne placée au-dessus du titre, elle ne ment jamais.",
      motif: "Le Nautilus a choisi cet ouvrage parce qu'il décrit son propre domaine : l'eau sous la coque."
    },
    {
      id: 'guide-voyage', types: ['guide-voyage', 'guide-general', 'voyage'],
      indice: "Le Nautilus prépare une escale, pas une légende.\n"
            + "Cherche l'ouvrage qui dit comment partir : où dormir, où accoster,\n"
            + "quel chemin prendre et ce qu'il en coûte.",
      resserre: "C'est un volume pratique, pensé pour être emporté : conseils, plans et adresses.",
      edition: "L'édition ou l'année figure sur la couverture ou l'étiquette du rayon.",
      auteur: "La signature est un nom d'auteur, parfois deux, parfois un collectif d'éditeurs.",
      motif: "Le Nautilus a choisi cet ouvrage parce qu'il prépare le départ mieux qu'aucune carte."
    },
    {
      id: 'exploration-histoire', types: ['exploration', 'histoire'],
      indice: "Le Nautilus n'est pas le premier à être descendu si bas.\n"
            + "Cherche l'ouvrage qui raconte ceux d'avant : les départs, les navires,\n"
            + "les dates et les noms que l'on a gravés ensuite sur des cartes.",
      resserre: "Le volume que tu cherches raconte des expéditions réelles, avec des hommes et des années.",
      edition: "La mention d'édition figure sur la couverture ou l'étiquette du rayon.",
      auteur: "Un historien ou un marin l'a signé : la ligne au-dessus du titre porte un nom de personne.",
      motif: "Le Nautilus a choisi cet ouvrage parce qu'il appartient à la même lignée que lui."
    },
    {
      id: 'sciences-pressions', types: ['sciences', 'oceanographie', 'physique'],
      indice: "Le Nautilus descend là où la lumière disparaît.\n"
            + "Sa coque doit résister à une force invisible qui écrase tout ce qui est faible.\n"
            + "Cherche parmi les ouvrages qui expliquent les lois de la matière et les secrets des profondeurs.",
      resserre: "Ni récit, ni carte : un ouvrage qui explique, mesure et démontre.",
      edition: "La mention d'édition figure sur la couverture ou l'étiquette du rayon.",
      auteur: "Regarde la ligne au-dessus du titre : un nom de chercheur, ou plusieurs.",
      motif: "Le Nautilus a choisi cet ouvrage parce qu'il explique pourquoi les profondeurs écrasent les faibles."
    },
    {
      id: 'litterature-aventure', types: ['litterature', 'aventure', 'roman'],
      indice: "Le Nautilus n'est pas seulement une machine : il est né de l'imagination d'un homme\n"
            + "qui écrivait des voyages sans toujours les accomplir.\n"
            + "Cherche les ouvrages où les expéditions deviennent des récits\n"
            + "et où la mer cache encore des mondes inventés.",
      resserre: "C'est un récit, une fiction : on y lit des phrases, pas des coordonnées.",
      edition: "La mention d'édition ou de collection figure sur la couverture ou la tranche.",
      auteur: "Un écrivain l'a signé : son nom est écrit plus gros que le titre.",
      motif: "Le Nautilus a choisi cet ouvrage parce que c'est là qu'on lui a donné naissance."
    },
    {
      id: 'nature-marine', types: ['nature', 'faune', 'biologie'],
      indice: "Le Nautilus ne transporte pas que des hommes : il croise des vivants.\n"
            + "Cherche l'ouvrage qui nomme ce qui nage, ce qui rampe sur les fonds\n"
            + "et ce qui brille dans le noir des grandes profondeurs.",
      resserre: "Un volume de nature ou d'animaux, riche en photographies et en noms d'espèces.",
      edition: "La mention d'édition figure sur la couverture ou l'étiquette du rayon.",
      auteur: "Un naturaliste, un photographe ou un collectif : la ligne au-dessus du titre tranche.",
      motif: "Le Nautilus a choisi cet ouvrage parce qu'il recense ceux qu'il croise sans les chasser."
    },
    {
      id: 'technique-inventions', types: ['technique', 'technologie', 'inventions'],
      indice: "Le Nautilus est une machine avant d'être un mythe : une coque, un moteur, des commandes.\n"
            + "Cherche l'ouvrage qui explique ce que l'homme fabrique\n"
            + "pour aller là où son corps ne survivrait pas.",
      resserre: "On y parle de mécanismes, d'engins et d'inventions, pas d'histoires.",
      edition: "La mention d'édition figure sur la couverture ou l'étiquette du rayon.",
      auteur: "Un ingénieur ou un collectif technique l'a signé.",
      motif: "Le Nautilus a choisi cet ouvrage parce qu'on y comprend comment il tient."
    },
    {
      id: 'jeunesse-aventure', types: ['jeunesse'],
      indice: "Le Nautilus a été raconté mille fois, et d'abord aux plus jeunes.\n"
            + "Cherche l'ouvrage où la plongée se lit en images et en phrases courtes,\n"
            + "là où l'on range les premiers récits d'aventure.",
      resserre: "Un volume illustré, destiné aux jeunes lecteurs : le rayon est le plus coloré du magasin.",
      edition: "La mention d'édition figure sur la couverture ou la tranche.",
      auteur: "Un auteur et souvent un illustrateur : deux noms au-dessus du titre.",
      motif: "Le Nautilus a choisi cet ouvrage parce que c'est par lui que la légende continue."
    },
    {
      id: 'images-illustration', types: ['beaux-arts', 'illustration', 'gravure'],
      indice: "Le Nautilus a été dessiné avant d'être cru.\n"
            + "Cherche l'ouvrage où les pages sont des planches : gravures, dessins,\n"
            + "cartes anciennes et figures qui valent plus que les mots.",
      resserre: "Un beau livre : grand format, papier épais, illustrations pleine page.",
      edition: "La mention d'édition figure sur la couverture ou la page de titre.",
      auteur: "Un illustrateur, un graveur ou un musée l'a signé.",
      motif: "Le Nautilus a choisi cet ouvrage parce qu'on y garde son visage."
    },
    {
      id: 'etude-analyse', types: ['etude', 'essai', 'reference'],
      indice: "Le Nautilus ne cherche pas un récit d'aventure.\n"
            + "Il cherche l'ouvrage qui observe, explique et analyse,\n"
            + "conçu pour approfondir un sujet plutôt que pour le raconter.",
      resserre: "Ce n'est ni une fiction, ni un guide : c'est un travail de référence.",
      edition: "La mention d'édition figure sur la couverture ou l'étiquette du rayon.",
      auteur: "La ligne au-dessus du titre porte un nom d'auteur ou la mention d'un travail collectif.",
      motif: "Le Nautilus a choisi cet ouvrage pour la manière dont il observe le monde."
    }
  ];

  function familleParId(id) {
    for (var i = 0; i < FAMILLES.length; i++) if (FAMILLES[i].id === id) return FAMILLES[i];
    return null;
  }

  /* Choix de la famille : type du livre d'abord, puis ses liens
     thématiques, puis sa catégorie Fnac. Un livre sans lien exploitable
     n'est PAS sélectionnable automatiquement (règle de cohérence). */
  function choisirFamille(livre) {
    var cibles = [String(livre.famille || '').toLowerCase(), String(livre.type || '').toLowerCase()];
    var i, j;
    for (i = 0; i < FAMILLES.length; i++) {
      for (j = 0; j < FAMILLES[i].types.length; j++) {
        if (cibles.indexOf(FAMILLES[i].types[j]) >= 0) return FAMILLES[i];
      }
    }
    var liens = (livre.liens || []).join(' ');
    var texte = (liens + ' ' + String(livre.categorieFnac || '') + ' ' + String(livre.etiquetteFnac || '')).toLowerCase();
    var MOTS = {
      'atlas-mondial': ['atlas', 'monde', 'géographie', 'geographie', 'carte', 'pays'],
      'atlas-maritime': ['mer', 'mers', 'océan', 'ocean', 'maritime', 'navigation'],
      'guide-voyage': ['guide', 'voyage', 'tourisme', 'escale'],
      'exploration-histoire': ['exploration', 'histoire', 'expedition', 'explorateur', 'navigateur'],
      'sciences-pressions': ['science', 'physique', 'océanographie', 'oceanographie', 'profondeur'],
      'litterature-aventure': ['roman', 'littérature', 'litterature', 'verne', 'aventure', 'fiction'],
      'nature-marine': ['nature', 'animal', 'faune', 'marine', 'espèce', 'espece'],
      'technique-inventions': ['technique', 'technologie', 'invention', 'ingénieur', 'ingenieur', 'machine'],
      'jeunesse-aventure': ['jeunesse', 'enfant', 'illustré', 'illustre'],
      'images-illustration': ['beaux-arts', 'beaux arts', 'gravure', 'illustration', 'planche'],
      'etude-analyse': ['étude', 'etude', 'essai', 'référence', 'reference', 'dictionnaire']
    };
    var meilleur = null, meilleurScore = 0;
    Object.keys(MOTS).forEach(function (idFamille) {
      var score = MOTS[idFamille].reduce(function (n, mot) {
        return n + (texte.indexOf(mot) >= 0 ? 1 : 0);
      }, 0);
      if (score > meilleurScore) { meilleurScore = score; meilleur = idFamille; }
    });
    return meilleur ? familleParId(meilleur) : null;
  }

  /* ==================================================================
     9. RÈGLES DE SIGNATURE — trois variantes tirées au sort par
        cartouche. Elles n'utilisent QUE ce qui se voit SANS ouvrir le
        livre (couverture, tranche, étiquette) : jamais une page, jamais
        une carte, jamais un index — l'édition pourrait changer.
     ================================================================== */
  var REGLES = [
    {
      id: 'r1', nom: 'le premier mot, la signature, l’édition',
      consigne: "Le Nautilus exige la signature de l'ouvrage.\n"
              + "Prends le PREMIER MOT SIGNIFICATIF du titre (sans l'article initial) et compte ses lettres.\n"
              + "Ajoute l'INITIALE du signataire : le nom de la personne, ou la mention qui en tient lieu.\n"
              + "Termine par le NUMÉRO de l'édition, sur deux chiffres.\n"
              + "Assemble les trois fragments avec des tirets : NOMBRE-LETTRE-ÉDITION.",
      format: 'NN-L-NN',
      calcul: function (l) {
        var mot = premierMot(l.titre);
        var init = initialeSignature(l);
        var ed = deuxChiffres(l.editionNumero || editionDevinee(l.edition));
        return mot && init && ed ? deuxChiffres(mot.length) + '-' + init + '-' + ed : '';
      }
    },
    {
      id: 'r2', nom: 'le premier mot, la maison, l’édition',
      consigne: "Le Nautilus exige la signature de l'ouvrage.\n"
              + "Prends le PREMIER MOT SIGNIFICATIF du titre (sans l'article initial) et compte ses lettres.\n"
              + "Ajoute la DERNIÈRE LETTRE du nom de la maison qui l'a imprimé.\n"
              + "Termine par le NUMÉRO de l'édition, sur deux chiffres.\n"
              + "Assemble les trois fragments avec des tirets : NOMBRE-LETTRE-ÉDITION.",
      format: 'NN-L-NN',
      calcul: function (l) {
        var mot = premierMot(l.titre);
        var fin = derniereLettre(l.editeur);
        var ed = deuxChiffres(l.editionNumero || editionDevinee(l.edition));
        return mot && fin && ed ? deuxChiffres(mot.length) + '-' + fin + '-' + ed : '';
      }
    },
    {
      id: 'r3', nom: 'le titre entier, la signature, l’année',
      consigne: "Le Nautilus exige la signature de l'ouvrage.\n"
              + "Compte les MOTS du titre complet (les petits mots comptent, la ponctuation non).\n"
              + "Ajoute l'INITIALE du signataire : le nom de la personne, ou la mention qui en tient lieu.\n"
              + "Termine par les DEUX DERNIERS CHIFFRES de l'année imprimée.\n"
              + "Assemble les trois fragments avec des tirets : NOMBRE-LETTRE-ANNÉE.",
      format: 'NN-L-NN',
      calcul: function (l) {
        var mots = motsDuTitre(l.titre).length;
        var init = initialeSignature(l);
        var an = deuxChiffres(l.annee ? Number(String(l.annee).slice(-2)) : 0);
        return mots && init && an ? deuxChiffres(mots) + '-' + init + '-' + an : '';
      }
    }
  ];

  function motsDuTitre(titre) {
    return normaliser(titre, 'texte').split(' ').filter(function (m) { return m.length > 0; });
  }
  /* Les articles initiaux ne sont JAMAIS le mot demandé : « Le Nouvel
     atlas… » commence par LE, et demander « LE » donnerait un nombre de
     lettres sans intérêt — et une signature ambiguë. Le mot retenu est
     donc le premier mot SIGNIFICATIF, et la consigne le dit clairement :
     un matelot devant le rayon n'a pas à deviner la règle. */
  var ARTICLES_INITIAUX = ['LE', 'LA', 'LES', 'L', 'UN', 'UNE', 'DES', 'DU', 'DE', 'D',
                           'AU', 'AUX', 'A', 'THE', 'EN', 'ET'];
  function premierMot(titre) {
    var m = motsDuTitre(titre), i = 0;
    while (i < m.length - 1 && ARTICLES_INITIAUX.indexOf(m[i]) >= 0) i++;
    return m.length ? m[i] : '';
  }
  function initialeSignature(l) {
    if (!l.auteur || l.auteurType === 'collectif') return 'C';
    var a = normaliser(l.auteur, 'texte').split(' ').filter(Boolean);
    return a.length ? a[0].charAt(0) : '';
  }
  function derniereLettre(s) {
    var t = normaliser(s, 'texte').replace(/[^A-Z]/g, '');
    return t ? t.charAt(t.length - 1) : '';
  }
  /* Forme CANONIQUE d'un code (signature, chambre forte) :
       « 6c07 », « 06-C-07 », « 06 C 07 », « 6-C-7 », « 06C07 » → « 06-C-07 ».
     On découpe en groupes de chiffres et de lettres (même sans séparateur),
     puis chaque groupe numérique passe sur deux chiffres (6 → 06, 007 → 07,
     2026 → 26). Une seule empreinte suffit donc par réponse : la
     vérification reste rapide sur téléphone et le matelot n'est jamais
     piégé par la FORME de sa saisie — seulement par le fond. */
  function canonicaliserCode(valeur) {
    var brut = sansAccents(valeur).toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!brut) return '';
    var groupes = [];
    brut.split('-').forEach(function (bloc) {
      var morceaux = bloc.match(/[0-9]+|[A-Z]+/g) || [];
      morceaux.forEach(function (m) { groupes.push(m); });
    });
    return groupes.map(function (g) {
      return /^[0-9]+$/.test(g) ? deuxChiffres(g) : g;
    }).join('-');
  }

  function deuxChiffres(n) {
    n = Math.abs(Math.round(Number(n) || 0));
    return ('0' + (n % 100)).slice(-2);
  }
  function editionDevinee(edition) {
    var m = String(edition || '').match(/([0-9]+)\s*(?:e|er|ère|eme|ème)?\s*(?:éd|ed|edition)?/i);
    return m ? Number(m[1]) : 0;
  }
  function regleParId(id) {
    for (var i = 0; i < REGLES.length; i++) if (REGLES[i].id === id) return REGLES[i];
    return null;
  }

  /* Le code de la chambre forte : quatre fragments, dans un ordre tiré
     par la cartouche (l'ordre n'est jamais le même d'une partie à
     l'autre, mais il est TOUJOURS annoncé par le journal de bord). */
  var FRAGMENTS = [
    { id: 'A', cle: 'lettresPremierMot', annonce: "le nombre de lettres du premier mot significatif du titre (sans l'article initial), sur deux chiffres" },
    { id: 'B', cle: 'initialeSignature', annonce: "l'initiale du signataire : le nom de la personne, ou la mention qui en tient lieu" },
    { id: 'C', cle: 'editionNumero', annonce: "le numéro de l'édition, sur deux chiffres" },
    { id: 'D', cle: 'derniereLettreEditeur', annonce: "la dernière lettre du nom de la maison qui a imprimé" }
  ];

  function fragmentsDuLivre(l) {
    var mot = premierMot(l.titre);
    return {
      lettresPremierMot: mot ? deuxChiffres(mot.length) : '',
      initialeSignature: initialeSignature(l),
      editionNumero: deuxChiffres(l.editionNumero || editionDevinee(l.edition)),
      derniereLettreEditeur: derniereLettre(l.editeur)
    };
  }

  /* ==================================================================
     10. TEXTES DU JEU — tous au même endroit : le ton, le vocabulaire
         (« matelot », « équipier », jamais « balise », jamais « rayon
         Voyage »), et les durées. Les tests vérifient ces chaînes mot à
         mot : un écran ne doit jamais promettre autre chose que ce que
         le moteur applique.
     ================================================================== */
  var MESSAGES = {
    lancement: "Le Nautilus a caché un artefact. Retrouve-le et passe-le au hublot.",
    artefactTrouve: "Passe l'artefact au hublot d'identification.",
    scanInvite: "Vise le code-barres au dos du livre.",
    scanAccepte: "Artefact reconnu. Le journal s'ouvre.",
    scanRejete: "Le sceau rejette cet ouvrage. Réessaie.",
    scanRejeteCourt: "Livre rejeté. Route scellée.",
    scanIllisible: "Lecture impossible. Approche le code-barres ou saisis les chiffres.",
    eanInvalide: "Code invalide : aucune erreur comptée.",
    dernierAvertissement: "Le Nautilus te laisse une dernière tentative avant la remontée.",
    remontee1: "Remontée 1h\n3 erreurs. Un coéquipier peut prendre le relais.",
    remontee2: "Remontée 2h\nUn autre membre peut prendre le relais.",
    remontee3: "Remontée 4h\nPoste libre pour l'équipage.",
    remonteeSuite: "Remontée {heures}h\nRelais possible jusqu'à ton retour.",
    relais: "Poste libre\nUn matelot est en surface — prends le relais.",
    retour: "Retour à bord\nLe temps est écoulé. Tu reprends ta place.",
    sacrificePropose: "Cet indice coûte {duree} en surface. Un autre peut prendre le relais.",
    sacrificeAccepte: "Sacrifice accepté. Indice transmis.",
    sacrificeRefuse: "Aucun indice transmis.",
    indiceTransmis: "Indice transmis à l'équipage.",
    indiceCapitaine: "Sacrifice enregistré. Le capitaine transmet l'indice.",
    introuvable: "Ouvrage introuvable.\nPeut-être plus en rayon. Préviens le capitaine.",
    introuvableEnregistre: "Signalé au capitaine.\nAucune erreur comptée.",
    remplacement: "Ouvrage indisponible.\nNouvelle piste en préparation. Progression conservée.",
    remplacementSilencieux: "Piste changée. Aucune erreur comptée.",
    aucunOuvrage: "Aucun ouvrage dispo.\nMission suspendue. Progression conservée. Préviens le capitaine.",
    aucunOuvrageMagasin: "Aucun ouvrage ici.\nChange de magasin ou préviens le capitaine.",
    magasinRequis: "Choisis ton magasin Fnac.",
    victoire: "Signature complète. Escale suivante déverrouillée.",
    chambreForte: "Assemble les 4 fragments dans l'ordre indiqué.",
    etapeValidee: "Fragment enregistré."
  };

  /* Les trois indices payants : le sacrifice est une remontée en surface
     (même barème que les échecs, même module matelot-blocages). */
  var INDICES = [
    { rang: 1, cle: 'rayon', titre: 'Le rayon', aide: 'resserre', heures: 1 },
    { rang: 2, cle: 'edition', titre: 'L’édition', aide: 'edition', heures: 2 },
    { rang: 3, cle: 'auteur', titre: 'L’auteur', aide: 'auteur', heures: 4 }
  ];

  var MAX_ERREURS = 3;                 // le 3ᵉ raté remonte en surface
  var BARREME_HEURES = [1, 2, 4, 8, 12, 24];

  function messageRemontee(rang) {
    if (rang === 1) return MESSAGES.remontee1;
    if (rang === 2) return MESSAGES.remontee2;
    if (rang === 3) return MESSAGES.remontee3;
    return MESSAGES.remonteeSuite.replace('{heures}', String(heuresDeRemontee(rang)));
  }
  function heuresDeRemontee(rang) {
    var n = Math.max(1, Number(rang) || 1);
    return n <= BARREME_HEURES.length ? BARREME_HEURES[n - 1] : 24;
  }

  /* ==================================================================
     11. GÉNÉRATION D'UNE CARTOUCHE
         Une cartouche est une mission ANONYMISÉE, prête à servir :
         elle contient les textes (publics par nature, ce sont les
         indices) et les EMPREINTES des réponses. Ni titre, ni EAN, ni
         SKU, ni catégorie, ni nom de rayon.
         Le retour sépare donc :
           cartouche → lisible par le joueur
           secret    → lisible par l'admin seul (à chiffrer)
     ================================================================== */
  function genererCartouche(livreBrut, opts) {
    var o = opts || {};
    var v = validerLivre(livreBrut);
    if (!v.livre) return { erreur: v.erreurs.join(' ; ') };
    var l = v.livre;
    var famille = familleParId(l.famille) || choisirFamille(l);
    if (!famille) return { erreur: 'aucun lien exploitable avec l’aventure : attribue une famille à cet ouvrage' };
    var tirage = aleatoireDeSel(o.sel || (l.ean + '|' + (o.sessionId || '')));
    var regle = REGLES[Math.floor(tirage() * REGLES.length) % REGLES.length];
    var ordre = [0, 1, 2, 3];
    for (var i = ordre.length - 1; i > 0; i--) {           // mélange déterministe
      var j = Math.floor(tirage() * (i + 1));
      var t = ordre[i]; ordre[i] = ordre[j]; ordre[j] = t;
    }
    var fragments = fragmentsDuLivre(l);
    /* Les itérations peuvent venir de la configuration du service : une
       cartouche garde SON coût, donc une modification de configuration ne
       casse jamais une mission déjà lancée. */
    var iterEan = Number(o.iterations && o.iterations.ean) || ITERATIONS_EAN;
    var iterTexte = Number(o.iterations && o.iterations.texte) || ITERATIONS_DEFAUT;
    var sel = o.sel || selAleatoire();
    var signature = regle.calcul(l);
    if (!signature) return { erreur: 'données visibles insuffisantes pour cette règle de signature (titre, auteur, éditeur, édition)' };

    var valeurs = {
      ean: l.ean,
      premierMot: premierMot(l.titre),
      auteurType: l.auteurType || (l.auteur ? 'unique' : 'collectif'),
      signature: signature,
      codeFinal: ordre.map(function (k) { return fragments[FRAGMENTS[k].cle]; }).join('-')
    };
    /* Le sel est recopié dans chaque étape : la vérification doit pouvoir
       se faire sans relire la cartouche entière (et sans jamais exiger le
       secret, qui lui reste chez l'admin). */
    var etapes = [
      { id: 'sceau', type: 'ean', libelle: 'Le hublot d\'identification',
        consigne: MESSAGES.scanInvite, sel: sel,
        iterations: iterEan,
        empreintes: empreintesAcceptees(valeurs.ean, sel, iterEan, 'ean') },
      { id: 'couverture', type: 'texte', libelle: 'La couverture',
        consigne: "Sans ouvrir l'ouvrage, observe seulement sa couverture.\n"
                + "Quel est le PREMIER MOT SIGNIFICATIF de son titre ?\n"
                + "(Ignore l'article initial : le, la, les, l', un, une, des, du, de.)",
        sel: sel, iterations: iterTexte,
        empreintes: empreintesAcceptees(valeurs.premierMot, sel, iterTexte, 'texte') },
      { id: 'signature', type: 'code', libelle: 'La signature de l’ouvrage',
        consigne: regle.consigne, regle: regle.id, format: regle.format,
        sel: sel, iterations: iterTexte,
        empreintes: empreintesAcceptees(valeurs.signature, sel, iterTexte, 'code') },
      { id: 'chambreForte', type: 'code', libelle: 'La chambre forte',
        consigne: MESSAGES.chambreForte + '\n' + ordreAnnonce(ordre),
        ordre: ordre.map(function (k) { return FRAGMENTS[k].id; }).join(''),
        format: ordre.map(function () { return 'XX'; }).join('-'),
        sel: sel, iterations: iterTexte,
        empreintes: empreintesAcceptees(valeurs.codeFinal, sel, iterTexte, 'code') }
    ];

    var cartouche = {
      version: VERSION_MOTEUR,
      id: 'car-' + sha256Hex(sel + l.ean).slice(0, 12),
      sel: sel,
      iterations: { ean: iterEan, texte: iterTexte },
      famille: famille.id,                       // identifiant technique, pas un nom de rayon
      indice: famille.indice,
      aides: { resserre: famille.resserre, edition: famille.edition, auteur: famille.auteur },
      motif: famille.motif,
      etapes: etapes,
      maxErreurs: MAX_ERREURS,
      indicesPayants: INDICES.map(function (i) {
        return { rang: i.rang, cle: i.cle, titre: i.titre, heures: i.heures };
      }),
      genereLe: new Date(Number(o.maintenant) || Date.now()).toISOString(),
      magasinId: o.magasinId || '',
      /* La disponibilité retenue est celle du MAGASIN CIBLE, normalisée :
         elle provient soit du tri préalable (candidats()), soit de la
         fiche de l'ouvrage, soit de l'appelant (Cloud Function). Sans
         elle, la cartouche n'est pas sélectionnable — c'est voulu. */
      /* La cartouche est PUBLIQUE : elle ne porte que ce dont le joueur a
         besoin (son magasin, l'état, le délai, l'heure de contrôle). Les
         champs de preuve relevés sur la fiche Fnac (nom du magasin
         annoncé, libellés bruts, motif de refus) restent dans le coffre
         chiffré, à l'usage de l'organisateur. */
      disponibilite: disponibilitePublique(l._disponibilite
        || o.disponibilite
        || ((l.disponibilite || {})[o.magasinId]) || null, o.magasinId),
      empreinteLivre: sha256Hex(sel + '|' + l.ean + '|' + l.titre).slice(0, 16)
    };

    /* Le secret : ce que l'admin garde (chiffré avant tout stockage). */
    var secret = {
      cartoucheId: cartouche.id,
      livre: {
        id: l.id, titre: l.titre, sousTitre: l.sousTitre, auteur: l.auteur,
        auteurType: valeurs.auteurType, editeur: l.editeur, edition: l.edition,
        editionNumero: l.editionNumero, annee: l.annee, pages: l.pages, format: l.format,
        categorieFnac: l.categorieFnac, etiquetteFnac: l.etiquetteFnac, rayon: l.rayon,
        ean: l.ean, sku: l.sku, url: l.url
      },
      reponses: valeurs,
      fragments: fragments,
      regle: regle.id,
      ordre: ordre.map(function (k) { return FRAGMENTS[k].id; }).join(''),
      genereLe: cartouche.genereLe
    };
    return { cartouche: cartouche, secret: secret, regle: regle, famille: famille, valeurs: valeurs };
  }

  function normaliserDisponibilite(dispo, magasinId) {
    if (!dispo || typeof dispo !== 'object') return null;
    var n = {
      magasin: String(dispo.magasin || magasinId || ''),
      statut: String(dispo.statut || 'disponible'),
      delai: nettoyerTexte(dispo.delai, 60),
      checkedAt: nettoyerTexte(dispo.checkedAt, 40),
      vendeur: String(dispo.vendeur || 'fnac')
    };
    /* Preuve lisible de l'origine : le nom du magasin tel que la fiche
       publique l'annonçait, et le libellé brut du délai. Ces deux champs
       ne sont JAMAIS montrés au joueur (la cartouche n'en contient rien),
       ils servent à l'opérateur pour trancher. */
    if (dispo.magasinAnnonce) n.magasinAnnonce = nettoyerTexte(dispo.magasinAnnonce, 80);
    if (dispo.etatBrut) n.etatBrut = nettoyerTexte(dispo.etatBrut, 40);
    if (dispo.delaiBrut) n.delaiBrut = nettoyerTexte(dispo.delaiBrut, 20);
    if (dispo.source) n.source = nettoyerTexte(dispo.source, 40);
    if (dispo.motif) n.motif = nettoyerTexte(dispo.motif, 200);
    return n;
  }

  /* Version publique de la disponibilité : cinq champs, rien d'autre. */
  function disponibilitePublique(dispo, magasinId) {
    var n = normaliserDisponibilite(dispo, magasinId);
    if (!n) return null;
    return {
      magasin: n.magasin,
      statut: n.statut,
      delai: n.delai,
      checkedAt: n.checkedAt,
      vendeur: n.vendeur
    };
  }

  function ordreAnnonce(ordre) {
    return "Ordre du voyage : " + ordre.map(function (k, i) {
      return (i + 1) + ". " + FRAGMENTS[k].annonce;
    }).join('\n');
  }

  function selAleatoire(longueur) {
    var n = Math.max(8, Number(longueur) || 16), s = '', i;
    var alea = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? function (k) { var a = new Uint8Array(k); crypto.getRandomValues(a); return a; }
      : function (k) { var a = []; for (var x = 0; x < k; x++) a.push(Math.floor(Math.random() * 256)); return a; };
    var octets = alea(n);
    for (i = 0; i < octets.length; i++) s += ('0' + octets[i].toString(16)).slice(-2);
    return s;
  }

  /* Vérification d'une réponse de matelot contre une étape.
     `sel` est celui de la cartouche (il est aussi recopié dans chaque
     étape à la génération, d'où la double lecture). */
  function verifierEtape(etape, valeurProposee, sel) {
    if (!etape) return { ok: false, motif: 'étape inconnue', erreur: false };
    var s = String(etape.sel || sel || '');
    var type = etape.type || 'texte';
    if (type === 'ean') {
      var ean = eanNormalise(valeurProposee);
      if (!ean) return { ok: false, motif: MESSAGES.eanInvalide, erreur: false };
      if (!eanValide(ean)) return { ok: false, motif: MESSAGES.eanInvalide, erreur: false };
      var e = empreinte(ean, s, etape.iterations || ITERATIONS_EAN);
      return verifier(e, etape.empreintes)
        ? { ok: true } : { ok: false, motif: MESSAGES.scanRejete, erreur: true };
    }
    var n = normaliser(valeurProposee, type);
    if (!n) return { ok: false, motif: 'réponse vide', erreur: false };
    var emp = empreinte(n, s, etape.iterations || ITERATIONS_DEFAUT);
    return verifier(emp, etape.empreintes)
      ? { ok: true } : { ok: false, motif: 'réponse refusée', erreur: true };
  }

  /* ==================================================================
     12. MAGASINS — distance et suggestions. Les coordonnées sont des
         centroïdes de commune : elles SUGGÈRENT, elles ne prouvent rien.
     ================================================================== */
  function distanceKm(lat1, lon1, lat2, lon2) {
    var R = 6371, dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }
  function rad(d) { return d * Math.PI / 180; }

  function magasinsUtilisables(liste) {
    return (liste || []).filter(function (m) {
      return m && m.id && m.nom && m.actif !== false;
    });
  }

  function plusProche(lat, lon, liste, nb) {
    if (typeof lat !== 'number' || typeof lon !== 'number') return [];
    var avecDistance = magasinsUtilisables(liste)
      .filter(function (m) { return typeof m.lat === 'number' && typeof m.lon === 'number'; })
      .map(function (m) {
        return { magasin: m, distanceKm: distanceKm(lat, lon, m.lat, m.lon) };
      })
      .sort(function (a, b) { return a.distanceKm - b.distanceKm; });
    return avecDistance.slice(0, Math.max(1, Number(nb) || 3));
  }

  function trouverMagasin(liste, idOuNom) {
    var cible = nettoyerTexte(idOuNom, 120).toLowerCase();
    if (!cible) return null;
    var m = magasinsUtilisables(liste).filter(function (x) {
      return String(x.id).toLowerCase() === cible || nettoyerTexte(x.nom, 120).toLowerCase() === cible;
    });
    return m.length ? m[0] : null;
  }

  /* ==================================================================
     13. CONTRÔLES D'IMPORT — les mêmes règles que pour la liste des
         magasins : une donnée qui change trop d'un coup n'est JAMAIS
         publiée, elle repart en vérification humaine.
     ================================================================== */
  var SEUIL_CHUTE_LISTE = 0.8;         // publication refusée sous 80 %

  function controlerCatalogue(nouveau, precedent) {
    var problemes = [];
    var prec = precedent || [];
    var nouv = nouveau || [];
    if (!nouv.length) problemes.push('catalogue vide : rien à publier');
    var ids = {}, eans = {};
    nouv.forEach(function (l) {
      var v = validerLivre(l);
      if (!v.livre) { problemes.push('ouvrage « ' + (l && (l.titre || l.id)) + ' » refusé : ' + v.erreurs.join(' ; ')); return; }
      if (ids[v.livre.id]) problemes.push('identifiant en double : ' + v.livre.id);
      ids[v.livre.id] = true;
      /* Deux ÉDITIONS d'un même titre sont deux ouvrages distincts :
         l'EAN tranche. Un EAN déjà vu = un doublon, pas une édition. */
      if (eans[v.livre.ean]) problemes.push('EAN en double : ' + v.livre.ean + ' (édition déjà présente)');
      eans[v.livre.ean] = v.livre.id;
    });
    if (prec.length && nouv.length < prec.length * SEUIL_CHUTE_LISTE) {
      problemes.push('chute anormale du catalogue (' + nouv.length + ' après ' + prec.length
        + ') : publication refusée, vérification humaine requise');
    }
    return problemes;
  }

  function controlerMagasins(nouveau, precedent) {
    var problemes = [];
    var nouv = nouveau || [], prec = precedent || [];
    if (!nouv.length) problemes.push('liste vide : publication refusée');
    var ids = {};
    nouv.forEach(function (m) {
      if (!m) { problemes.push('fiche de magasin vide'); return; }
      /* Une fiche marquée INACTIVE peut légitimement n'avoir ni identifiant
         ni coordonnées : le localiseur officiel ne publie aucun lien cl<N>
         pour quelques magasins (dont des DOM-TOM), et l'outil de
         synchronisation n'invente JAMAIS d'identifiant. On la conserve pour
         mémoire, sans la contrôler ni la proposer aux joueurs. */
      if (!m.id) {
        if (m.actif === false) return;
        problemes.push('magasin sans identifiant : ' + nettoyerTexte(m.nom, 60));
        return;
      }
      if (ids[m.id]) problemes.push('identifiant magasin en double : ' + m.id);
      ids[m.id] = true;
      if (!nettoyerTexte(m.nom, 120)) problemes.push('magasin sans nom : ' + m.id);
      if (!/^[0-9]{5}$/.test(String(m.cp || ''))) problemes.push('code postal invalide : ' + m.id);
      if (m.actif === false) return;
      if (typeof m.lat !== 'number' || m.lat < -90 || m.lat > 90) problemes.push('latitude invalide : ' + m.id);
      if (typeof m.lon !== 'number' || m.lon < -180 || m.lon > 180) problemes.push('longitude invalide : ' + m.id);
    });
    if (prec.length && nouv.length < prec.length * SEUIL_CHUTE_LISTE) {
      problemes.push('chute anormale de la liste (' + nouv.length + ' magasins après ' + prec.length
        + ') : publication refusée, la dernière liste valide reste active');
    }
    return problemes;
  }

  /* ==================================================================
     14. API PUBLIQUE
     ================================================================== */
  return {
    api: {
      VERSION_MOTEUR: VERSION_MOTEUR,
      /* hachage et empreintes */
      sha256Hex: sha256Hex, utf8: utf8,
      empreinte: empreinte, empreintes: empreintes,
      empreintesAcceptees: empreintesAcceptees, verifier: verifier,
      ITERATIONS_DEFAUT: ITERATIONS_DEFAUT, ITERATIONS_EAN: ITERATIONS_EAN,
      PREFIXE_EMPREINTE: PREFIXE_EMPREINTE,
      /* normalisation */
      normaliser: normaliser, variantes: variantes, sansAccents: sansAccents,
      eanValide: eanValide, eanNormalise: eanNormalise,
      /* sécurisation des données externes */
      nettoyerTexte: nettoyerTexte, echapper: echapper, champ: champ,
      validerLivre: validerLivre, controlerCatalogue: controlerCatalogue,
      controlerMagasins: controlerMagasins, SEUIL_CHUTE_LISTE: SEUIL_CHUTE_LISTE,
      /* disponibilité */
      disponibiliteValide: disponibiliteValide, delaiAccepte: delaiAccepte,
      normaliserDisponibilite: normaliserDisponibilite, disponibilitePublique: disponibilitePublique,
      DELAIS_EN_RAYON: DELAIS_EN_RAYON,
      FENETRE_FRAICHEUR_MINUTES: FENETRE_FRAICHEUR_MINUTES,
      /* sélection */
      candidats: candidats, choisirLivre: choisirLivre, rangPriorite: rangPriorite,
      scoreRichesse: scoreRichesse, PRIORITES: PRIORITES, aleatoireDeSel: aleatoireDeSel,
      /* indices et règles */
      FAMILLES: FAMILLES, familleParId: familleParId, choisirFamille: choisirFamille,
      REGLES: REGLES, regleParId: regleParId, FRAGMENTS: FRAGMENTS,
      fragmentsDuLivre: fragmentsDuLivre, premierMot: premierMot, motsDuTitre: motsDuTitre,
      initialeSignature: initialeSignature, derniereLettre: derniereLettre,
      /* cartouches et vérification */
      genererCartouche: genererCartouche, verifierEtape: verifierEtape, selAleatoire: selAleatoire,
      /* règles de jeu */
      MESSAGES: MESSAGES, INDICES: INDICES, MAX_ERREURS: MAX_ERREURS,
      BARREME_HEURES: BARREME_HEURES, heuresDeRemontee: heuresDeRemontee,
      messageRemontee: messageRemontee,
      /* magasins */
      distanceKm: distanceKm, magasinsUtilisables: magasinsUtilisables,
      plusProche: plusProche, trouverMagasin: trouverMagasin
    }
  };
});
