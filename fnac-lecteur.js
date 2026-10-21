/* =====================================================================
   FNAC — LECTEUR DE FICHE PUBLIQUE  (fnac-lecteur.js)

   Ce module LIT une fiche produit fnac.com (ou une page de rayon) et en
   tire deux choses : les MÉTADONNÉES bibliographiques de l'ouvrage, et
   le BLOC DISPONIBILITÉ MAGASIN que le site affiche lui-même.

   Il ne touche JAMAIS au réseau, jamais au DOM, jamais à Firebase : il
   ne fait que lire du texte. C'est volontaire, pour la même raison que
   artefact-moteur.js — une règle écrite deux fois finit par se
   contredire. Le même lecteur sert donc :

     · à l'outil de collecte Node (tools/sync-catalogue-artefacts.mjs),
       qui va chercher les pages côté serveur ;
     · au panneau admin (admin-artefact.js), où l'opérateur COLLE une
       fiche enregistrée depuis son propre navigateur — aucun appel
       réseau depuis le poste du joueur, jamais ;
     · aux Cloud Functions facultatives (functions/) ;
     · aux tests Node (tools/tests-fnac-lecteur.mjs).

   ---------------------------------------------------------------------
   CE QUI A ÉTÉ OBSERVÉ SUR LE SITE PUBLIC (octobre 2026)
   ---------------------------------------------------------------------
   Les fiches produit https://www.fnac.com/a<id> sont rendues CÔTÉ
   SERVEUR et portent, en clair, deux gabarits différents selon le
   visiteur. Le bloc disponibilité y apparaît ainsi :

     Gabarit bureau, ouvrage DÉJÀ EN RAYON (retrait sous 1 h) :
         En stock en magasin
         Fnac Paris - Saint-Lazare
         Retrait gratuit sous 1H
         Retrait 1H en magasin

     Gabarit bureau, ouvrage À ACHEMINER (retrait sous 1 jour) :
         Livrable en magasin
         Fnac Bordeaux
         Retrait gratuit sous 1J
         Retirer en 1J en magasin

     Gabarit sans magasin choisi (session anonyme) :
         En stock en magasin
         Retrait gratuit
         Retirer en magasin

   Les caractéristiques sont rendues en paires libellé/valeur :
   « EAN 2000000001005 », « ISBN 2000001000 », « SKU EXEMPLE-1005 »
   (valeurs fictives : les EAN et SKU réels ne sont écrits NULLE PART ici),
   « Éditeur Glénat », « Collection Reference », « Date de parution
   10/09/2026 », « Nombre de pages 368 », « Format 21,10 x 29,30 cm ».
   Le LIBELLÉ DÉFILANT qui alimente les énigmes est collé à la date de
   parution, en tête de fiche : « Paru le 10 septembre 2026 » suivi de
   « Atlas / carte (broché) », ou « Paru en août 2025Roman (Poche) ».

   ---------------------------------------------------------------------
   LA LIMITE HONNÊTE : ON NE PEUT PAS IMPOSER UN MAGASIN PAR L'URL
   ---------------------------------------------------------------------
   Le magasin annoncé dans ce bloc dépend de la SESSION du visiteur
   (cookie de choix de magasin, à défaut géolocalisation IP). La même
   URL, demandée deux fois, a annoncé « Fnac Bordeaux » puis
   « Fnac Paris - Saint-Lazare ». Une URL préfixée par le magasin
   (…/cl57/a99000002) retombe sur la fiche générique.

   Conséquence assumée : ce lecteur NE DEVINE JAMAIS. Il rapporte le
   magasin ANNONCÉ par la page, et le rapproche de la liste officielle
   (data/magasins-fnac.json). Si l'annonce ne correspond pas au magasin
   choisi par le joueur, ou si elle est ambiguë, ou si elle est absente,
   la disponibilité est marquée NON EXPLOITABLE et la mission retombe
   sur la validation humaine dans le panneau admin. Rien n'est inventé :
   ni identifiant magasin, ni délai, ni stock.

   Il n'y a par ailleurs AUCUN contournement : pas de CAPTCHA résolu,
   pas de jeton anti-bot rejoué, pas de session volée. Les jetons de
   type « wanderlu= », « kerfu= », « mumbo-j= » que le site ajoute à
   certaines URL sont laissés tels quels et ne sont jamais fabriqués.
   ===================================================================== */
(function (racine, usine) {
  'use strict';
  var paquet = usine();
  if (typeof module !== 'undefined' && module.exports) { module.exports = paquet.api; }
  if (racine) { racine.NautilusFnacLecteur = paquet.api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var VERSION_LECTEUR = '1.0.0';

  /* ------------------------------------------------------------------ */
  /* Petits outils texte                                                 */
  /* ------------------------------------------------------------------ */

  var ACCENTS = /[\u0300-\u036f]/g;

  function sansAccents(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(ACCENTS, '');
  }

  function nettoyer(s, max) {
    var t = String(s == null ? '' : s)
      .replace(/[\u00a0\u2000-\u200b\u202f\u205f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (max && t.length > max) t = t.slice(0, max).trim();
    return t;
  }

  var ENTITES_NOMMEES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â',
    icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', ucirc: 'û', ugrave: 'ù',
    ccedil: 'ç', aelig: 'æ', oelig: 'œ', Eacute: 'É', deg: '°', euro: '€',
    times: '×', middot: '·', laquo: '«', raquo: '»', hellip: '…', rsquo: '’',
    lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', shy: ''
  };

  function decoderEntites(s) {
    return String(s == null ? '' : s)
      .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return codePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (m, d) { return codePoint(parseInt(d, 10)); })
      .replace(/&([A-Za-z]+);/g, function (m, nom) {
        /* La casse compte : &Eacute; = « É » majuscule, &eacute; = « é ». */
        if (Object.prototype.hasOwnProperty.call(ENTITES_NOMMEES, nom)) return ENTITES_NOMMEES[nom];
        var k = nom.toLowerCase();
        return Object.prototype.hasOwnProperty.call(ENTITES_NOMMEES, k) ? ENTITES_NOMMEES[k] : m;
      });
  }

  function codePoint(n) {
    if (!isFinite(n) || n < 32 || n > 0x10ffff) return ' ';
    try { return String.fromCodePoint(n); } catch (e) { return ' '; }
  }

  function estHtml(s) {
    return /<[a-z!/][^>]*>/i.test(String(s || ''));
  }

  /* ------------------------------------------------------------------ */
  /* HTML → texte : on garde L'ORDRE, on jette le balisage                */
  /* ------------------------------------------------------------------ */

  /* Les gabarits Fnac mettent les valeurs dans des tableaux ou des
     blocs ; ici, tout séparateur devient un retour à la ligne pour que
     « EAN » et « 2000000001005 » se suivent toujours. */
  function htmlVersLignes(brut) {
    var s = String(brut == null ? '' : brut);

    /* 1. Les blocs JSON-LD sont mis de côté AVANT nettoyage : ils
          portent gtin13 / sku / name de façon bien plus fiable. */
    var jsonLd = extraireJsonLd(s);

    if (!estHtml(s)) {
      /* Ce n'est pas du HTML : texte brut ou markdown collé par
         l'opérateur. On enlève la décoration markdown, pas le contenu. */
      s = s
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '\n')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
        .replace(/\*\*/g, '')
        .replace(/^\|[ \t]*-+/gm, '');
    } else {
      s = s
        .replace(/<!--[\s\S]*?-->/g, '\n')
        .replace(/<script[\s\S]*?<\/script>/gi, '\n')
        .replace(/<style[\s\S]*?<\/style>/gi, '\n')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '\n')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '\n')
        .replace(/<head[\s\S]*?<\/head>/gi, '\n');
      s = s.replace(/<br\s*\/?>/gi, '\n');
      s = s.replace(/<\/(p|div|li|ul|ol|tr|td|th|h[1-6]|section|article|header|footer|span|dt|dd|figcaption|button|label|blockquote|table|thead|tbody)>/gi, '\n');
      s = s.replace(/<[^>]+>/g, ' ');
    }

    s = decoderEntites(s);
    /* Les séparateurs visuels deviennent des sauts de ligne. */
    s = s.replace(/[\u00b7\u2022\u2013\u2014|]/g, '\n');

    var lignes = s.split('\n').map(function (l) { return nettoyer(l, 4000); })
      .filter(function (l) { return l.length > 0; });

    return { lignes: lignes, texte: lignes.join('\n'), jsonLd: jsonLd };
  }

  /* JSON-LD : tolérant aux tableaux, à @graph et aux blocs invalides. */
  function extraireJsonLd(brut) {
    var s = String(brut == null ? '' : brut);
    var out = [];
    var re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    var m;
    while ((m = re.exec(s)) !== null) {
      var bloc = decoderEntites(m[1]).replace(/^\uFEFF/, '').trim();
      if (!bloc) continue;
      try {
        var j = JSON.parse(bloc);
        aplatisJsonLd(j, out);
      } catch (e) {
        /* Un bloc illisible ne casse pas la lecture : on continue. */
      }
      if (out.length > 40) break;
    }
    return out;
  }

  function aplatisJsonLd(noeud, out) {
    if (!noeud) return;
    if (Array.isArray(noeud)) { noeud.forEach(function (n) { aplatisJsonLd(n, out); }); return; }
    if (typeof noeud !== 'object') return;
    if (noeud['@graph']) aplatisJsonLd(noeud['@graph'], out);
    if (noeud['@type']) out.push(noeud);
    Object.keys(noeud).forEach(function (k) {
      if (k === '@graph') return;
      var v = noeud[k];
      if (v && typeof v === 'object' && v['@type']) aplatisJsonLd(v, out);
    });
  }

  function jsonLdParType(jsonLd, types) {
    var i;
    for (i = 0; i < jsonLd.length; i++) {
      var t = jsonLd[i]['@type'];
      var liste = Array.isArray(t) ? t : [t];
      for (var j = 0; j < liste.length; j++) {
        if (types.indexOf(String(liste[j]).toLowerCase()) >= 0) return jsonLd[i];
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* EAN : contrôle de clé interne (le module reste autonome)            */
  /* ------------------------------------------------------------------ */

  function eanValide(v) {
    var d = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    if (d.length !== 13) return false;
    var somme = 0, i;
    for (i = 0; i < 12; i++) somme += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
    var cle = (10 - (somme % 10)) % 10;
    return cle === Number(d[12]);
  }

  /* ------------------------------------------------------------------ */
  /* Libellés observés sur le site                                       */
  /* ------------------------------------------------------------------ */

  /* Chaque entrée est un libellé VU sur fnac.com. Rien d'inventé : si un
     libellé n'est pas reconnu, la disponibilité reste « inconnue ». */
  var LIBELLES = {
    enStockMagasin: ['En stock en magasin', 'En stock en magasin'],
    livrableMagasin: ['Livrable en magasin'],
    indisponibleMagasin: ['Indisponible en magasin', 'Indisponible en magasin'],
    epuiseEnLigne: ['Stock en ligne épuisé', 'Stock en ligne epuise', 'Épuisé'],
    retraitGratuit: ['Retrait gratuit'],
    retirerEnMagasin: ['Retirer en magasin', 'Retrait en magasin']
  };

  var ETATS = {
    EN_STOCK: 'en-stock-magasin',
    LIVRABLE: 'livrable-magasin',
    INDISPONIBLE: 'indisponible-magasin',
    EPUISE: 'epuise-en-ligne',
    INCONNU: 'inconnu'
  };

  /* Faux amis : « Fnac Billetterie », « Fnac+ », « Prix Fnac » ne sont
     pas des noms de magasin. */
  var FAUX_MAGASINS = [
    'billetterie', 'spectacles', 'live', 'tv', 'pro', 'plus', 'jeux', 'conseils',
    'darty', 'voyages', 'festival', 'evenement', 'secondlife', 'occasion',
    'leclaireur', 'magasin', 'magasins', 'direct', 'service', 'aide', 'carte',
    'fnac', 'com', 'www', 'espace'
  ];

  /* Mots génériques qui n'aident pas à trancher entre deux magasins. */
  var MOTS_MAGASIN_IGNORES = ['fnac', 'magasin', 'centre', 'commercial', 'cc', 'zac', 'gare', 'aeroport'];

  /* ------------------------------------------------------------------ */
  /* Rapprochement du magasin ANNONCÉ avec la liste officielle           */
  /* ------------------------------------------------------------------ */

  function normaliserNomMagasin(nom) {
    return sansAccents(String(nom || '')).toLowerCase()
      .replace(/\bfnac\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\bsaint\b/g, 'st')
      .replace(/\bsainte\b/g, 'ste')
      .split(' ')
      /* Les lettres isolées (« Jeanne d'Arc ») ne discriminent rien :
         elles sont écartées des DEUX côtés pour rester comparable. */
      .filter(function (m) { return m && m.length > 1 && MOTS_MAGASIN_IGNORES.indexOf(m) < 0; });
  }

  function jetonsFiche(m) {
    var bruts = [m.nom, m.ville, m.slug, m.adresse].filter(Boolean).join(' ');
    /* Le slug porte souvent le nom d'usage : Toulouse-Labege/Fnac-Labege */
    var jetons = sansAccents(bruts).toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\bsaint\b/g, 'st')
      .replace(/\bsainte\b/g, 'ste')
      .split(' ')
      .filter(function (t) {
        return t && t.length > 1 && MOTS_MAGASIN_IGNORES.indexOf(t) < 0;
      });
    var uniq = {};
    return jetons.filter(function (t) { if (uniq[t]) return false; uniq[t] = true; return true; });
  }

  /* Retourne { id, nom, score, couverts, candidats, ambigu, motif }.
     Règle absolue : en cas de doute, on ne tranche pas. */
  function resoudreMagasin(nomAnnonce, liste) {
    var jetons = normaliserNomMagasin(nomAnnonce);
    if (!jetons.length) {
      return { id: null, nom: nettoyer(nomAnnonce, 80), score: 0, couverts: 0,
               candidats: [], ambigu: false, inactif: false,
               motif: 'aucun nom de magasin lisible' };
    }
    var scores = [];
    var inactifs = [];
    (liste || []).forEach(function (m) {
      if (!m) return;
      var fiche = jetonsFiche(m);
      if (!fiche.length) return;
      var couverts = jetons.filter(function (j) { return fiche.indexOf(j) >= 0; }).length;
      if (!couverts) return;
      var ligne = { id: m.id || null, nom: m.nom || '', ville: m.ville || '',
                    score: couverts / jetons.length + (couverts / (fiche.length || 1)) * 0.15,
                    couverts: couverts, total: jetons.length,
                    actif: m.actif !== false };
      if (ligne.actif) scores.push(ligne); else inactifs.push(ligne);
    });
    scores.sort(function (a, b) { return b.score - a.score || String(a.id).localeCompare(String(b.id)); });
    /* Un magasin fermé (ou sans identifiant dans la liste officielle)
       n'est JAMAIS retenu, mais on le DIT au lieu de faire semblant de ne
       pas le reconnaître : l'opérateur comprend alors pourquoi. */
    var morts = inactifs.filter(function (s) { return s.couverts === s.total; });
    morts.sort(function (a, b) { return b.score - a.score; });
    if (!scores.length) {
      if (morts.length) {
        return { id: null, nom: nettoyer(nomAnnonce, 80), score: morts[0].score, couverts: 0,
                 candidats: morts.slice(0, 4), ambigu: false, inactif: true,
                 motif: 'magasin annoncé « ' + morts[0].nom + ' » fermé ou sans identifiant officiel' };
      }
      return { id: null, nom: nettoyer(nomAnnonce, 80), score: 0, couverts: 0, candidats: [],
               ambigu: false, inactif: false,
               motif: 'magasin annoncé absent de la liste officielle' };
    }
    var tousCouverts = scores.filter(function (s) { return s.couverts === s.total; });
    if (!tousCouverts.length) {
      if (morts.length) {
        return { id: null, nom: nettoyer(nomAnnonce, 80), score: morts[0].score, couverts: 0,
                 candidats: morts.slice(0, 4), ambigu: false, inactif: true,
                 motif: 'magasin annoncé « ' + morts[0].nom + ' » fermé ou sans identifiant officiel' };
      }
      return { id: null, nom: nettoyer(nomAnnonce, 80), score: scores[0].score, couverts: 0,
               candidats: scores.slice(0, 4), ambigu: false, inactif: false,
               motif: 'le nom annoncé ne recoupe aucune fiche officielle en entier' };
    }
    if (tousCouverts.length > 1) {
      var ecart = tousCouverts[0].score - tousCouverts[1].score;
      if (ecart < 0.02) {
        return { id: null, nom: nettoyer(nomAnnonce, 80), score: tousCouverts[0].score,
                 couverts: tousCouverts[0].total, candidats: tousCouverts.slice(0, 4),
                 ambigu: true, inactif: false,
                 motif: 'plusieurs magasins officiels correspondent au nom annoncé' };
      }
    }
    return { id: tousCouverts[0].id, nom: tousCouverts[0].nom, score: tousCouverts[0].score,
             couverts: tousCouverts[0].total, candidats: tousCouverts.slice(0, 4),
             ambigu: false, inactif: false, motif: '' };
  }

  /* ------------------------------------------------------------------ */
  /* Lecture du bloc disponibilité                                       */
  /* ------------------------------------------------------------------ */

  function premierLibelle(texte, libelles) {
    var bas = sansAccents(texte).toLowerCase();
    var meilleur = -1, trouve = '';
    libelles.forEach(function (l) {
      var i = bas.indexOf(sansAccents(l).toLowerCase());
      if (i >= 0 && (meilleur < 0 || i < meilleur)) { meilleur = i; trouve = l; }
    });
    return { index: meilleur, libelle: trouve };
  }

  /* « Retrait gratuit sous 1H » → { brut:'sous 1H', delai:'sous 1H' }
     « Retrait 1J en magasin »   → { brut:'1J',        delai:'sous 1J' }
     « Retrait gratuit » seul    → { brut:'',          delai:'' } (inconnu) */
  function lireDelai(texte) {
    var t = String(texte || '');
    var m = t.match(/retrait(?:\s+gratuit)?\s+sous\s+(\d{1,2}\s*[hjd]\b)/i)
         || t.match(/retrait\s+(\d{1,2}\s*[hjd])\s+en\s+magasin/i)
         || t.match(/retirer?\s+en\s+(\d{1,2}\s*[hjd])\s+en\s+magasin/i)
         || t.match(/disponible\s+sous\s+(\d{1,2}\s*[hjd]\b)/i);
    if (!m) return { brut: '', delai: '', unite: '' };
    var brut = nettoyer(m[1], 10);
    var n = brut.match(/(\d+)/), u = brut.match(/[hjd]/i);
    if (!n || !u) return { brut: brut, delai: '', unite: '' };
    var unite = u[0].toLowerCase();
    return { brut: brut, delai: 'sous ' + n[1] + (unite === 'h' ? 'H' : unite === 'j' ? 'J' : 'D'),
             unite: unite, heures: unite === 'h' ? Number(n[1]) : unite === 'd' ? Number(n[1]) * 24 : null };
  }

  /* Le nom du magasin annoncé : « Fnac Paris - Saint-Lazare »,
     « Fnac Bordeaux », « Fnac Toulouse - Labège ». */
  function lireMagasinAnnonce(lignes, texte) {
    var i, m;
    for (i = 0; i < lignes.length; i++) {
      m = lignes[i].match(/^Fnac\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9][^\n]{1,70})$/);
      if (m && nomPlausible(m[1])) return { nom: nettoyer(m[1], 80), ligne: i, forme: 'ligne' };
    }
    /* Gabarit compact : le nom est collé au milieu d'une ligne. */
    var re = /Fnac\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÿ0-9'’\-\.\s]{1,60}?)(?=\s*(?:Retrait|Retirer|Livrable|En stock|Choisir|Voir|$|\n))/g;
    while ((m = re.exec(String(texte || ''))) !== null) {
      if (nomPlausible(m[1])) return { nom: nettoyer(m[1], 80), ligne: -1, forme: 'inline' };
    }
    return { nom: '', ligne: -1, forme: '' };
  }

  function nomPlausible(nom) {
    var n = nettoyer(nom, 80);
    if (!n || n.length < 2) return false;
    var bas = sansAccents(n).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!bas) return false;
    if (/^\+/.test(n) || /^fnac\s*\+/i.test(n)) return false;
    var mots = bas.split(' ');
    for (var i = 0; i < mots.length; i++) {
      if (FAUX_MAGASINS.indexOf(mots[i]) >= 0) return false;
    }
    if (/\d\s*€|prix|avis|note|livraison|cookie|publicit/i.test(bas)) return false;
    return true;
  }

  /* Offres marketplace : « Vendu et livré par GibertJoseph ». Ce sont des
     offres PARTENAIRES, toujours hors sélection automatique. */
  function lireVendeursPartenaires(texte) {
    var out = [], re = /vendu(?:\s+et\s+livr[ée])?\s+par\s+\*{0,2}([^\n*]{2,60})/gi, m;
    while ((m = re.exec(String(texte || ''))) !== null) {
      var nom = nettoyer(m[1], 60);
      if (nom && out.indexOf(nom) < 0) out.push(nom);
      if (out.length >= 8) break;
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Métadonnées bibliographiques                                        */
  /* ------------------------------------------------------------------ */

  var LIBELLES_CARACTERISTIQUES = {
    ean: ['EAN', 'EAN-13', 'Gtin13', 'gtin13'],
    isbn: ['ISBN'],
    sku: ['SKU', 'Référence vendeur', 'Reference vendeur'],
    editeur: ['Éditeur', 'Editeur', 'Edité par', 'Édité par', 'Brand', 'Marque'],
    collection: ['Collection'],
    parution: ['Date de parution', 'Parution', 'Paru le', 'Date de publication'],
    pages: ['Nombre de pages', 'Nb. de pages', 'Pages'],
    format: ['Format', 'Dimensions'],
    poids: ['Poids'],
    auteur: ['Auteur', 'Auteurs'],
    public: ['Public', 'Age minimum', 'Âge minimum']
  };

  function estUnLibelle(ligne) {
    var l = sansAccents(ligne).toLowerCase().replace(/[^a-z0-9]+/g, '');
    var tous = [];
    Object.keys(LIBELLES_CARACTERISTIQUES).forEach(function (k) {
      LIBELLES_CARACTERISTIQUES[k].forEach(function (v) {
        tous.push(sansAccents(v).toLowerCase().replace(/[^a-z0-9]+/g, ''));
      });
    });
    return tous.indexOf(l) >= 0;
  }

  /* Valeur qui suit un libellé, sur la même ligne ou sur la suivante. */
  function valeurApres(lignes, libelles) {
    var i, j;
    for (i = 0; i < lignes.length; i++) {
      for (j = 0; j < libelles.length; j++) {
        var l = libelles[j];
        var ligne = lignes[i];
        /* même ligne : « EAN : 2000000001005 » */
        var reMeme = new RegExp('^' + echapperRe(sansAccents(l)) + '\\s*[:\\-]?\\s*(.+)$', 'i');
        var mm = sansAccents(ligne).match(reMeme);
        if (mm && nettoyer(mm[1], 200)) {
          /* on récupère la valeur AVEC ses accents : on recoupe par position */
          var pos = sansAccents(ligne).indexOf(mm[1]);
          return nettoyer(ligne.slice(pos), 200);
        }
        /* ligne suivante, si ce n'est pas un autre libellé */
        if (sansAccents(ligne).replace(/[^a-z0-9]/gi, '').toLowerCase()
            === sansAccents(l).replace(/[^a-z0-9]/gi, '').toLowerCase()) {
          var suiv = lignes[i + 1];
          if (suiv && !estUnLibelle(suiv)) return nettoyer(suiv, 200);
        }
      }
    }
    return '';
  }

  function echapperRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function lireTitre(html, conv, jsonLd) {
    var prod = jsonLdParType(jsonLd, ['book', 'product', 'individualproduct']);
    if (prod && prod.name) return nettoyer(prod.name, 300);
    var m = String(html || '').match(/<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']+)["']/i);
    if (m) return epurerTitre(decoderEntites(m[1]));
    m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m) return epurerTitre(decoderEntites(m[1]));
    /* Texte brut / markdown collé : la première ligne « # Titre ».
       On la cherche dans le BRUT, car le nettoyage a déjà enlevé les « # ». */
    var h1 = String(html || '').match(/^\s*#\s+(.+)$/m);
    if (h1) return epurerTitre(h1[1]);
    for (var i = 0; i < conv.lignes.length; i++) {
      var l = conv.lignes[i];
      if (/^#\s+/.test(l)) return epurerTitre(l.replace(/^#\s+/, ''));
    }
    return '';
  }

  function epurerTitre(t) {
    return nettoyer(String(t || ''), 300)
      .replace(/\s*[\|\-–]\s*(Achat\s+)?(Livre|ebook|livre\s+num[ée]rique|fnac)\b[\s\S]*$/i, '')
      .replace(/\s+\|\s+fnac\s*$/i, '')
      .replace(/\s*-\s*(broch[ée]|reli[ée]|poche|cartonn[ée]|beau livre|livre audio|texte lu \(CD\)|ebook \(ePub\))\s*-\s*[\s\S]*$/i, '')
      .trim();
  }

  function lireAuteurs(conv, jsonLd) {
    var roles = [], i;
    var prod = jsonLdParType(jsonLd, ['book', 'product']);
    if (prod && prod.author) {
      var liste = Array.isArray(prod.author) ? prod.author : [prod.author];
      liste.forEach(function (a) {
        var nom = typeof a === 'string' ? a : (a && a.name) || '';
        if (nom) roles.push({ nom: nettoyer(nom, 120), role: 'Auteur' });
      });
    }
    if (!roles.length) {
      var re = /([A-Za-zÀ-ÿ][^\n\[\]()]{1,90}?)\s*\((Auteur|Pr[ée]face|Illustration|Adapt[ée]|Traduction|Directeur de publication|Photographe|Cartographie)\)/g;
      var m;
      while ((m = re.exec(conv.texte)) !== null) {
        var nom2 = nettoyer(m[1], 120).replace(/^[\s\-\u00b7]+/, '');
        if (nom2 && nom2.length > 1 && !/fnac|libraire|avis/i.test(nom2)) {
          roles.push({ nom: nom2, role: m[2] });
        }
        if (roles.length >= 8) break;
      }
    }
    var auteurs = roles.filter(function (r) { return r.role === 'Auteur'; });
    if (!auteurs.length) auteurs = roles.slice(0, 1);
    var noms = auteurs.map(function (r) { return r.nom; });
    var uniq = [];
    noms.forEach(function (n) { if (uniq.indexOf(n) < 0) uniq.push(n); });
    var collectif = uniq.some(function (n) { return /^(collectif|ouvrage collectif|sous la direction)/i.test(n); });
    return {
      roles: roles,
      noms: uniq,
      auteur: uniq.join(', '),
      auteurType: collectif ? 'collectif' : (uniq.length > 1 ? 'plusieurs' : uniq.length === 1 ? 'unique' : '')
    };
  }

  /* Le libellé défilant : collé à la date de parution en tête de fiche.
     Deux gabarits observés :
       « Paru le 10 septembre 2026 » / « Atlas / carte (broché) »  (2 lignes)
       « Paru le 10 septembre 2026Atlas / carte (broché) »        (collé)
     On ne garde que ce qui suit « Paru … », jamais le nom d'auteur qui
     précède. */
  function lireEtiquette(conv) {
    var i, m;
    for (i = 0; i < conv.lignes.length; i++) {
      m = conv.lignes[i].match(/Paru(?:\s+(?:le|en))?\s+/);
      if (!m) continue;
      var apres = conv.lignes[i].slice(m.index + m[0].length);
      var reste = nettoyer(apres, 200);
      /* « 10 septembre 2026Atlas / carte (broché) » : la date colle au libellé */
      var coupe = reste.match(/^\d{1,2}\s+[a-zà-ÿ]+\s+\d{4}(.*)$/i)
               || reste.match(/^(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)\s+\d{4}(.*)$/i)
               || reste.match(/^\d{1,2}\/\d{1,2}\/\d{4}(.*)$/i)
               || reste.match(/^\d{4}(.*)$/);
      if (coupe && coupe[1] && couperFormat(coupe[1]).brut) return couperFormat(coupe[1]);
      if (couperFormat(reste).brut) return couperFormat(reste);
      if (!reste) {
        /* libellé sur la ligne suivante */
        var suiv = conv.lignes[i + 1];
        if (suiv && couperFormat(suiv).brut) return couperFormat(suiv);
      }
    }
    /* Repli : n'importe quelle ligne « … (broché) » en tête de fiche */
    for (i = 0; i < Math.min(conv.lignes.length, 25); i++) {
      var c = couperFormat(conv.lignes[i]);
      if (c.brut && c.format && !/paru|\(auteur\)|\(pr[ée]face\)/i.test(c.brut)) return c;
    }
    return { brut: '', categorie: '', format: '' };
  }

  function couperFormat(s) {
    var t = nettoyer(s, 200);
    var m = t.match(/^(.{2,120}?)\s*\((broch[ée]|reli[ée]|poche|cartonn[ée]|livre audio|ebook \(ePub\)|texte lu \(CD\)|cd|beau livre|album|dvd|blu-ray)\)\s*$/i);
    if (!m) return { brut: '', categorie: '', format: '' };
    return { brut: t, categorie: nettoyer(m[1], 120), format: nettoyer(m[2], 40).toLowerCase() };
  }

  function lireAnnee(brutParution) {
    var t = String(brutParution || '').trim();
    var m = t.match(/\b(19|20)\d{2}\b/);
    return m ? Number(m[0]) : 0;
  }

  function lireEdition(titre, brut) {
    var texte = nettoyer((titre || '') + ' ' + (brut || ''), 400);
    var m = texte.match(/(\d{1,2})\s*(?:er|re|e|ème|eme|°)\s*(?:[ée]d(?:ition)?\.?|ed\.?)\b/i);
    if (m) {
      var n = Math.min(99, Number(m[1]));
      return { edition: n + (n === 1 ? 're édition' : 'e édition'), editionNumero: n };
    }
    if (/\b(?:nouvelle|nle)\s+[ée]dition\b/i.test(texte)) return { edition: 'Nouvelle édition', editionNumero: 0 };
    if (/\b[ée]dition\s+(?:originale|illustr[ée]e|abr[ée]g[ée]e|int[ée]grale)\b/i.test(texte)) {
      var q = texte.match(/\b[ée]dition\s+(originale|illustr[ée]e|abr[ée]g[ée]e|int[ée]grale)\b/i);
      return { edition: 'Édition ' + q[1].toLowerCase(), editionNumero: 0 };
    }
    return { edition: '', editionNumero: 0 };
  }

  function lirePrix(conv, jsonLd) {
    var prod = jsonLdParType(jsonLd, ['book', 'product']);
    if (prod && prod.offers) {
      var o = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers;
      if (o && (o.price || o.lowPrice)) {
        var p = Number(String(o.price || o.lowPrice).replace(',', '.'));
        if (isFinite(p) && p > 0) return { prix: p, devise: 'EUR' };
      }
    }
    var m = conv.texte.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*€/);
    if (m) return { prix: Number(m[1].replace(',', '.')), devise: 'EUR' };
    return { prix: 0, devise: 'EUR' };
  }

  /* L'identifiant produit ne se DEVINE PAS : on ne l'accepte que s'il
     figure dans une URL de fiche (celle demandée, la canonique, og:url,
     ou un lien /a<id> de la page). Un nombre trouvé au hasard du corps de
     page (ISBN, prix, poids) n'est JAMAIS pris pour un identifiant. */
  function lireIdentifiantFiche(html, url) {
    var h = String(html == null ? '' : html);
    var candidats = [];
    if (url) candidats.push(String(url));
    var canon = h.match(/<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']+)["']/i)
             || h.match(/<meta[^>]+property\s*=\s*["']og:url["'][^>]+content\s*=\s*["']([^"']+)["']/i);
    if (canon) candidats.push(decoderEntites(canon[1]));
    var i, m;
    for (i = 0; i < candidats.length; i++) {
      m = candidats[i].match(/fnac\.com\/a(\d{5,10})\b/i) || candidats[i].match(/\/a(\d{5,10})\b/);
      if (m) return { produitId: m[1], urlFiche: 'https://www.fnac.com/a' + m[1], source: i === 0 ? 'url' : 'canonique' };
    }
    /* URL explicite courte : « a99000001 » ou « 99000001 » seuls. */
    if (url) {
      m = String(url).trim().match(/^a?(\d{5,10})$/i);
      if (m) return { produitId: m[1], urlFiche: 'https://www.fnac.com/a' + m[1], source: 'url' };
    }
    return { produitId: '', urlFiche: '', source: '' };
  }

  /* ------------------------------------------------------------------ */
  /* Type thématique : ce que le moteur sait exploiter                   */
  /* ------------------------------------------------------------------ */

  var TYPES_PAR_MOTS = [
    { type: 'atlas-maritime', mots: ['océan', 'ocean', 'mers', 'mer ', 'maritime', 'navigation', 'sous-marin', 'bateau', 'navire', 'cap', 'détroit', 'phare'] },
    { type: 'atlas-mondial', mots: ['atlas', 'planisphère', 'planisphere', 'cartographie', 'géographie', 'geographie', 'monde', 'mondial', 'pays', 'cartes'] },
    { type: 'nature-marine', mots: ['faune', 'baleine', 'poisson', 'cétacé', 'cetae', 'corail', 'algue', 'biologie', 'espèces', 'especes', 'animal'] },
    { type: 'sciences-pressions', mots: ['océanographie', 'oceanographie', 'pression', 'physique', 'profondeur', 'science', 'hydrographie', 'marée', 'maree'] },
    { type: 'exploration-histoire', mots: ['exploration', 'explorateur', 'expédition', 'expedition', 'navigateur', 'histoire', 'xixe', '19e siècle', 'héros'] },
    { type: 'guide-voyage', mots: ['guide', 'voyage', 'tourisme', 'escale', 'itinéraire', 'itineraire', 'circuit'] },
    { type: 'technique-inventions', mots: ['invention', 'technologie', 'technique', 'machine', 'ingénieur', 'ingenieur', 'submersible', 'moteur'] },
    { type: 'images-illustration', mots: ['illustration', 'gravure', 'beaux-arts', 'beaux arts', 'dessin', 'photographie', 'album illustré', 'beau livre'] },
    { type: 'jeunesse-aventure', mots: ['jeunesse', 'junior', 'dès 9 ans', 'des 9 ans', 'enfant', 'album jeunesse'] },
    { type: 'litterature-aventure', mots: ['roman', 'littérature', 'litterature', 'aventure', 'verne', 'fiction', 'nouvelle', 'récit', 'recit', 'poche'] },
    { type: 'etude-analyse', mots: ['essai', 'étude', 'etude', 'document', 'référence', 'reference', 'dictionnaire', 'encyclopédie', 'encyclopedie', 'scolaire', 'universitaire', 'analyse'] }
  ];

  /* ---- Catégorie Fnac → type exploitable par le moteur --------------
     La barre défilante de la fiche (« Atlas / carte (broché) »,
     « Roman (Poche) », « Guide de voyage (broché) »…) est la
     CLASSIFICATION DE LA FNAC : c'est elle qui tranche en premier,
     parce que c'est celle que le joueur lira sur l'étiquette du rayon.
     Les formats seuls (« Beau livre », « Album », « Poche ») ne sont
     PAS des sujets : on les ignore et on laisse parler le titre. */
  var TYPES_PAR_CATEGORIE = [
    { type: 'atlas-mondial', mots: ['atlas', 'carte', 'géographie', 'geographie', 'planisphère'] },
    { type: 'guide-voyage', mots: ['guide de voyage', 'guide', 'voyage', 'tourisme', 'escale'] },
    { type: 'nature-marine', mots: ['mer', 'océan', 'ocean', 'nature', 'animal', 'faune', 'flore', 'jardin', 'marine'] },
    { type: 'exploration-histoire', mots: ['histoire', 'biographie', 'mémoires', 'memoires', 'antiquité', 'archéologie'] },
    { type: 'sciences-pressions', mots: ['science', 'physique', 'chimie', 'astronomie', 'médecine', 'technique', 'informatique'] },
    { type: 'etude-analyse', mots: ['scolaire', 'universitaire', 'essai', 'document', 'référence', 'reference', 'dictionnaire', 'encyclopédie', 'étude', 'etude', 'parascolaire'] },
    { type: 'jeunesse-aventure', mots: ['jeunesse', 'enfant', 'contes', 'junior', 'album jeunesse'] },
    { type: 'images-illustration', mots: ['beaux-arts', 'beaux arts', 'peinture', 'dessin', 'photographie', 'illustration', 'cinéma', 'musique', 'bande dessinée', 'manga', 'comics', 'humour'] },
    { type: 'litterature-aventure', mots: ['roman', 'littérature', 'litterature', 'policier', 'thriller', 'science-fiction', 'fantasy', 'fantastique', 'nouvelles', 'poésie', 'theatre', 'théâtre', 'aventure'] }
  ];

  /* Formats seuls : jamais un sujet. */
  var CATEGORIES_NEUTRES = ['beau livre', 'album', 'poche', 'broché', 'broche', 'relié', 'relie',
                            'cartonné', 'cartonne', 'livre audio', 'ebook', 'cd', 'dvd', 'blu-ray'];

  function typeParCategorie(categorie) {
    var t = sansAccents(String(categorie || '')).toLowerCase();
    if (!t) return null;
    var neutre = CATEGORIES_NEUTRES.some(function (n) { return sansAccents(n) === t.trim(); });
    if (neutre) return null;
    for (var i = 0; i < TYPES_PAR_CATEGORIE.length; i++) {
      var regle = TYPES_PAR_CATEGORIE[i];
      for (var j = 0; j < regle.mots.length; j++) {
        if (t.indexOf(sansAccents(regle.mots[j]).toLowerCase()) >= 0) {
          return { type: regle.type, famille: regle.type,
                   liens: [regle.mots[j]], motif: 'catégorie Fnac « ' + nettoyer(categorie, 60) + ' »' };
        }
      }
    }
    return null;
  }

  /* Retourne { type, famille, liens, motif }. Type vide = aucun lien
     exploitable : le moteur écartera l'ouvrage, c'est voulu — on ne
     force jamais une filiation thématique douteuse. */
  function devinerType(champs) {
    /* 1. La classification Fnac d'abord. */
    var parCategorie = typeParCategorie(champs.categorieFnac || champs.etiquetteFnac);
    if (parCategorie) return parCategorie;

    /* 2. À défaut, les mots du titre et de la collection. */
    var texte = sansAccents([
      champs.titre, champs.sousTitre, champs.categorieFnac, champs.etiquetteFnac,
      champs.collection, champs.rayon, champs.auteur, (champs.liens || []).join(' ')
    ].filter(Boolean).join(' ')).toLowerCase();
    var i, j;
    for (i = 0; i < TYPES_PAR_MOTS.length; i++) {
      var regle = TYPES_PAR_MOTS[i];
      for (j = 0; j < regle.mots.length; j++) {
        if (texte.indexOf(sansAccents(regle.mots[j]).toLowerCase()) >= 0) {
          return { type: regle.type, famille: regle.type,
                   liens: [regle.mots[j].trim()], motif: 'rapproché de « ' + regle.mots[j].trim() + ' »' };
        }
      }
    }
    return { type: '', famille: '', liens: [], motif: 'aucun mot de l’univers du Nautilus dans la fiche' };
  }

  /* ------------------------------------------------------------------ */
  /* LECTURE COMPLÈTE D'UNE FICHE                                        */
  /* ------------------------------------------------------------------ */

  /* opts: { url, magasinId, magasins, maintenant, checkedAt, strictMagasin } */
  function lireFiche(brut, opts) {
    var o = opts || {};
    var conv = htmlVersLignes(brut);
    var jsonLd = conv.jsonLd;
    var alertes = [];

    var fiche = lireIdentifiantFiche(brut, o.url);
    var titre = lireTitre(brut, conv, jsonLd);
    var auteurs = lireAuteurs(conv, jsonLd);
    var etiquette = lireEtiquette(conv);

    var eanTexte = valeurApres(conv.lignes, LIBELLES_CARACTERISTIQUES.ean);
    var prod = jsonLdParType(jsonLd, ['book', 'product']);
    var eanBrut = (eanTexte.match(/\d{13}/) || [])[0]
               || String((prod && (prod.gtin13 || prod.gtin || prod.isbn)) || '').replace(/[^0-9]/g, '')
               || (conv.texte.match(/\b(?:EAN|GTIN-?13)\s*[:\-]?\s*(\d{13})\b/i) || [])[1]
               || '';
    if (!eanBrut) {
      var treize = conv.texte.match(/\b(97[89]\d{10})\b/);
      if (treize) eanBrut = treize[1];
    }
    var ean = eanValide(eanBrut) ? eanBrut : '';
    if (!ean && eanBrut) alertes.push({ code: 'ean-invalide', message: 'EAN lu mais clé de contrôle fausse (' + eanBrut + ')' });
    if (!ean) alertes.push({ code: 'ean-absent', message: 'aucun EAN à 13 chiffres valide dans la fiche' });

    var parution = valeurApres(conv.lignes, LIBELLES_CARACTERISTIQUES.parution);
    var pages = parseInt(valeurApres(conv.lignes, LIBELLES_CARACTERISTIQUES.pages).replace(/[^0-9]/g, ''), 10) || 0;
    var editeur = valeurApres(conv.lignes, LIBELLES_CARACTERISTIQUES.editeur);
    var collection = valeurApres(conv.lignes, LIBELLES_CARACTERISTIQUES.collection);
    var isbn = (valeurApres(conv.lignes, LIBELLES_CARACTERISTIQUES.isbn).match(/[0-9Xx]{10,13}/) || [''])[0];
    var sku = valeurApres(conv.lignes, LIBELLES_CARACTERISTIQUES.sku).replace(/[^A-Za-z0-9-]/g, '');
    var formatBrut = valeurApres(conv.lignes, LIBELLES_CARACTERISTIQUES.format);
    var prix = lirePrix(conv, jsonLd);
    var edition = lireEdition(titre, conv.texte.slice(0, 400));

    var categorie = etiquette.categorie
      || String((prod && (prod.category || prod.genre)) || '')
      || '';

    /* --- disponibilité ------------------------------------------- */
    var dispo = interpreterDisponibilite(conv, {
      magasins: o.magasins || [],
      magasinId: o.magasinId || '',
      maintenant: Number(o.maintenant) || Date.now(),
      checkedAt: o.checkedAt || new Date(Number(o.maintenant) || Date.now()).toISOString()
    });
    dispo.alertes.forEach(function (a) { alertes.push(a); });

    var brutLivre = {
      id: fiche.produitId ? 'fnac-a' + fiche.produitId : '',
      titre: titre,
      sousTitre: '',
      auteur: auteurs.auteur,
      auteurType: auteurs.auteurType,
      editeur: editeur,
      collection: collection,
      edition: edition.edition,
      editionNumero: edition.editionNumero,
      annee: lireAnnee(parution),
      pages: pages,
      format: etiquette.format || formatBrut,
      ean: ean,
      sku: sku,
      isbn: isbn,
      url: fiche.urlFiche,
      categorieFnac: categorie,
      etiquetteFnac: etiquette.brut || categorie,
      rayon: '',
      vendeur: dispo.vendeur,
      prix: prix.prix,
      disponibilite: {}
    };

    var type = devinerType({
      titre: titre, categorieFnac: categorie, etiquetteFnac: etiquette.brut,
      collection: collection, auteur: auteurs.auteur, liens: []
    });
    brutLivre.type = type.type;
    brutLivre.famille = type.famille;
    brutLivre.liens = type.liens;

    if (o.magasinId && dispo.magasinId === o.magasinId) {
      brutLivre.disponibilite[o.magasinId] = dispo.disponibilite;
    } else if (dispo.magasinId) {
      brutLivre.disponibilite[dispo.magasinId] = dispo.disponibilite;
    }

    return {
      ok: alertes.filter(function (a) { return a.bloquant; }).length === 0,
      produitId: fiche.produitId,
      urlFiche: fiche.urlFiche,
      titre: titre,
      livre: brutLivre,
      auteurs: auteurs,
      disponibilite: dispo.disponibilite,
      magasinId: dispo.magasinId,
      magasinAnnonce: dispo.magasinAnnonce,
      resolution: dispo.resolution,
      etat: dispo.etat,
      delaiBrut: dispo.delaiBrut,
      delai: dispo.delai,
      vendeur: dispo.vendeur,
      vendeursPartenaires: dispo.vendeursPartenaires,
      exploitable: dispo.exploitable,
      motif: dispo.motif,
      alertes: alertes,
      brut: {
        titre: titre, ean: ean, isbn: isbn, sku: sku, prix: prix.prix,
        pages: pages, editeur: editeur, collection: collection,
        parution: parution, format: brutLivre.format,
        categorieFnac: categorie, etiquette: etiquette.brut,
        auteurs: auteurs.roles, produitId: fiche.produitId,
        jsonLd: jsonLd.length
      },
      lignes: conv.lignes
    };
  }

  /* Lecture du bloc disponibilité à partir de lignes déjà nettoyées.
     `conv` = { lignes, texte }. */
  function interpreterDisponibilite(conv, opts) {
    var o = opts || {};
    var texte = conv.texte || (conv.lignes || []).join('\n');
    var alertes = [];

    /* « Stock en ligne épuisé » parle du SITE, pas du rayon : c'est le
       moins décisif des libellés. Les trois autres tranchent d'abord, à
       position égale dans la page. */
    var positions = [
      { etat: ETATS.INDISPONIBLE, rang: 0, pos: premierLibelle(texte, LIBELLES.indisponibleMagasin) },
      { etat: ETATS.EN_STOCK, rang: 0, pos: premierLibelle(texte, LIBELLES.enStockMagasin) },
      { etat: ETATS.LIVRABLE, rang: 0, pos: premierLibelle(texte, LIBELLES.livrableMagasin) },
      { etat: ETATS.EPUISE, rang: 1, pos: premierLibelle(texte, LIBELLES.epuiseEnLigne) }
    ].filter(function (c) { return c.pos.index >= 0; })
     .sort(function (a, b) { return a.rang - b.rang || a.pos.index - b.pos.index; });

    var etat = positions.length ? positions[0].etat : ETATS.INCONNU;
    var delaiLu = lireDelai(texte);
    var annonce = lireMagasinAnnonce(conv.lignes || [], texte);
    var partenaires = lireVendeursPartenaires(texte);

    var resolution = annonce.nom
      ? resoudreMagasin(annonce.nom, o.magasins || [])
      : { id: null, nom: '', score: 0, couverts: 0, candidats: [], ambigu: false,
          inactif: false, motif: 'aucun magasin annoncé dans la page' };

    /* Le magasin retenu : celui du joueur SI la page le confirme. */
    var magasinId = '';
    if (o.magasinId && resolution.id && String(resolution.id) === String(o.magasinId)) {
      magasinId = String(o.magasinId);
    } else if (o.magasinId && !annonce.nom) {
      magasinId = '';   // rien d'annoncé : on n'attribue pas la disponibilité
      alertes.push({ code: 'magasin-non-annonce', bloquant: !!o.strictMagasin,
        message: 'la page n’annonce aucun magasin : la disponibilité ne peut pas être attribuée à « '
                 + o.magasinId + ' » (session du visiteur non renseignée)' });
    } else if (o.magasinId && resolution.id && String(resolution.id) !== String(o.magasinId)) {
      alertes.push({ code: 'magasin-different', bloquant: !!o.strictMagasin,
        message: 'disponibilité annoncée pour « ' + (resolution.nom || annonce.nom) + ' » ('
                 + resolution.id + ') et non pour le magasin choisi « ' + o.magasinId + ' »' });
    } else if (annonce.nom && !resolution.id) {
      alertes.push({ code: resolution.ambigu ? 'magasin-ambigu' : 'magasin-inconnu',
        bloquant: !!o.strictMagasin,
        message: resolution.motif + ' (annonce : « ' + annonce.nom + ' »)' });
    } else if (!o.magasinId && resolution.id) {
      magasinId = String(resolution.id);
    }

    /* Statut : on ne déclare JAMAIS « disponible » sans le libellé. */
    var statut = 'indisponible', motif = '', exploitable = false;
    if (etat === ETATS.INCONNU) {
      motif = 'aucun libellé de disponibilité magasin reconnu dans la page';
      alertes.push({ code: 'disponibilite-illisible', bloquant: !!o.strictMagasin, message: motif });
    } else if (etat === ETATS.INDISPONIBLE) {
      motif = 'ouvrage annoncé indisponible en magasin';
    } else if (etat === ETATS.EPUISE) {
      motif = 'stock en ligne épuisé : la fiche ne prouve rien pour le rayon';
    } else if (etat === ETATS.LIVRABLE) {
      motif = 'ouvrage à acheminer en magasin (' + (delaiLu.delai || 'délai non précisé')
            + ') : il n’est pas en rayon, la mission ne peut pas s’y appuyer';
    } else if (etat === ETATS.EN_STOCK) {
      if (!delaiLu.delai) {
        motif = 'ouvrage annoncé en stock mais délai de retrait non précisé : à confirmer par l’opérateur';
        alertes.push({ code: 'delai-non-precise', bloquant: false, message: motif });
      } else if (/^sous\s+\d+\s*H$/i.test(delaiLu.delai) && Number(delaiLu.delai.match(/\d+/)[0]) <= 1) {
        statut = 'disponible';
        exploitable = true;
        motif = 'retrait sous 1 h confirmé par la fiche publique';
      } else {
        motif = 'délai annoncé « ' + delaiLu.delai + ' » : supérieur à une heure';
      }
    }

    if (!magasinId && statut === 'disponible') {
      exploitable = false;
      statut = 'indisponible';
      motif = motif + ' — mais aucun magasin identifié : impossible d’attribuer cette disponibilité';
      alertes.push({ code: 'disponibilite-sans-magasin', bloquant: true,
        message: 'retrait sous 1 h annoncé sans magasin identifiable' });
    }

    var vendeur = 'fnac';
    /* Une offre partenaire NE REMPLACE PAS l'offre Fnac : on ne marque
       l'ouvrage « partenaire » que si la fiche ne propose AUCUN retrait
       magasin Fnac mais seulement des vendeurs tiers. */
    if (partenaires.length && etat !== ETATS.EN_STOCK && etat !== ETATS.LIVRABLE) {
      vendeur = 'partenaire';
      alertes.push({ code: 'offre-partenaire', bloquant: false,
        message: 'seules des offres de vendeurs partenaires sont lisibles (' + partenaires.join(', ') + ')' });
    }

    return {
      etat: etat,
      delaiBrut: delaiLu.brut,
      delai: delaiLu.delai,
      magasinAnnonce: annonce.nom,
      resolution: resolution,
      magasinId: magasinId,
      statut: statut,
      motif: motif,
      exploitable: exploitable,
      vendeur: vendeur,
      vendeursPartenaires: partenaires,
      alertes: alertes,
      disponibilite: {
        magasin: magasinId || (resolution.id || ''),
        statut: statut,
        delai: delaiLu.delai || '',
        checkedAt: o.checkedAt || new Date(Number(o.maintenant) || Date.now()).toISOString(),
        vendeur: vendeur,
        magasinAnnonce: annonce.nom,
        etatBrut: etat,
        delaiBrut: delaiLu.brut,
        source: 'fiche-publique-fnac',
        motif: motif
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Découverte de fiches depuis une page de rayon / auteur / éditeur     */
  /* ------------------------------------------------------------------ */

  function extraireLiensFiches(brut) {
    var s = String(brut == null ? '' : brut);
    var vus = {}, out = [];
    var re = /https?:\/\/(?:www\.|livre\.)?fnac\.com\/a(\d{5,10})([^\s"'<)]*)/gi;
    var m;
    while ((m = re.exec(s)) !== null) {
      var id = m[1];
      if (vus[id]) continue;
      vus[id] = true;
      out.push({ produitId: id, url: 'https://www.fnac.com/a' + id });
      if (out.length >= 500) break;
    }
    /* Liens relatifs (« /a99000001/… ») dans le HTML brut. */
    var re2 = /["'(]\/a(\d{5,10})\b/gi;
    while ((m = re2.exec(s)) !== null) {
      var id2 = m[1];
      if (vus[id2]) continue;
      vus[id2] = true;
      out.push({ produitId: id2, url: 'https://www.fnac.com/a' + id2 });
      if (out.length >= 500) break;
    }
    return out;
  }

  function urlFiche(idOuUrl) {
    var s = String(idOuUrl || '').trim();
    var m = s.match(/a(\d{5,10})/) || s.match(/^(\d{5,10})$/);
    if (!m) return '';
    return 'https://www.fnac.com/a' + m[1];
  }

  /* ------------------------------------------------------------------ */
  /* Respect de robots.txt — vérifié AVANT tout appel réseau             */
  /* ------------------------------------------------------------------ */

  /* robots.txt (consulté le 19/10/2026) interdit : /Account/, /MyAccount/,
     /identity/gateway/, /OrderPipe/, /basket/*, /Comments/Share/,
     /SearchResult/ResultList.aspx*SFilt=* et *PageIndex=*, et marque
     /api/* en Noindex. Tout le reste des fiches et pages de rayon est
     public. On s'y tient STRICTEMENT. */
  var ROBOTS_INTERDITS = [
    /^\/account\//i, /^\/myaccount\//i, /^\/identity\/gateway\//i,
    /^\/orderpipe/i, /^\/lastundeliveredorder\.aspx$/i, /^\/comments\/share\//i,
    /^\/mobile\/basket\//i, /^\/basket\/(add|oneclick|delete)$/i,
    /^\/api\//i
  ];

  function robotsAutorise(url) {
    var u;
    try { u = new URL(String(url)); } catch (e) { return { ok: false, motif: 'URL illisible' }; }
    if (!/(^|\.)fnac\.com$/i.test(u.hostname)) {
      return { ok: false, motif: 'hôte hors fnac.com : ' + u.hostname };
    }
    var chemin = u.pathname || '/';
    for (var i = 0; i < ROBOTS_INTERDITS.length; i++) {
      if (ROBOTS_INTERDITS[i].test(chemin)) {
        return { ok: false, motif: 'chemin interdit par robots.txt : ' + chemin };
      }
    }
    /* Les filtres et la pagination de la recherche sont explicitement
       interdits : on ne les utilise pas, point. */
    if (/^\/SearchResult\/ResultList\.aspx$/i.test(chemin)) {
      if (u.searchParams && (u.searchParams.has('SFilt') || u.searchParams.has('PageIndex'))) {
        return { ok: false, motif: 'SearchResult avec SFilt/PageIndex : interdit par robots.txt' };
      }
      return { ok: false, motif: 'page de recherche non utilisée : préfère une fiche (/a<id>) ou un rayon (/s<id>, /e<id>, /ia<id>)' };
    }
    var autorises = /^\/(a\d{5,10}|o\d{5,10}|s\d+|e\d+|ia\d+|c\d+|n\d+|l\d+|localiser-magasin-fnac|retrait-magasin|livraison)(\/|$)/i;
    if (autorises.test(chemin.replace(/^\/[^/]+\/[^/]+\/cl\d+\//, '/'))) return { ok: true, motif: '' };
    if (/\/cl\d+\/w-4$/i.test(chemin) || /\/cl\d+(\/|$)/i.test(chemin)) return { ok: true, motif: '' };
    return { ok: true, motif: '' };
  }

  /* Les jetons anti-bot que le site colle parfois aux URL : on les
     GARDE (on ne les fabrique pas, on ne les devine pas). */
  function jetonsAntiBot(url) {
    var noms = ['wanderlu', 'quizzi', 'bumble', 'kerfu', 'doodl', 'moonli', 'acrob',
                'dan', 'th', 'wonk', 'fiddl', 'snugg', 'chi', 'knickkna', 'jibbe',
                'yaho', 'dillyda', 'zephy', 'mal', 'p', 'mumbo-j', 'kl', 'mu'];
    var u;
    try { u = new URL(String(url)); } catch (e) { return []; }
    var trouves = [];
    noms.forEach(function (n) { if (u.searchParams && u.searchParams.has(n)) trouves.push(n); });
    return trouves;
  }

  /* ------------------------------------------------------------------ */

  var api = {
    VERSION_LECTEUR: VERSION_LECTEUR,
    LIBELLES: LIBELLES,
    ETATS: ETATS,
    TYPES_PAR_MOTS: TYPES_PAR_MOTS, TYPES_PAR_CATEGORIE: TYPES_PAR_CATEGORIE,
    CATEGORIES_NEUTRES: CATEGORIES_NEUTRES, typeParCategorie: typeParCategorie,
    MOTS_MAGASIN_IGNORES: MOTS_MAGASIN_IGNORES,
    /* texte */
    sansAccents: sansAccents, nettoyer: nettoyer, decoderEntites: decoderEntites,
    estHtml: estHtml, htmlVersLignes: htmlVersLignes, extraireJsonLd: extraireJsonLd,
    jsonLdParType: jsonLdParType,
    /* identification */
    eanValide: eanValide, lireIdentifiantFiche: lireIdentifiantFiche, urlFiche: urlFiche,
    extraireLiensFiches: extraireLiensFiches,
    /* magasins */
    normaliserNomMagasin: normaliserNomMagasin, resoudreMagasin: resoudreMagasin,
    /* fiche */
    lireFiche: lireFiche, interpreterDisponibilite: interpreterDisponibilite,
    lireDelai: lireDelai, lireMagasinAnnonce: lireMagasinAnnonce,
    lireEtiquette: lireEtiquette, lireAuteurs: lireAuteurs, devinerType: devinerType,
    lireEdition: lireEdition, lireAnnee: lireAnnee, valeurApres: valeurApres,
    /* politesse */
    robotsAutorise: robotsAutorise, jetonsAntiBot: jetonsAntiBot
  };

  return { api: api };
});
