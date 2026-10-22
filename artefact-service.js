/* =====================================================================
   ARTEFACT DU NAUTILUS — SERVICE DE SÉLECTION ET DE SESSION
   (artefact-service.js)

   Ce module est la COUCHE DONNÉES du Palier 3. Il ne dessine rien :
   il choisit l'ouvrage, verrouille la mission, vérifie les réponses et
   tient l'historique. Le dessin vit dans artefact-palier3.js, les
   règles dans artefact-moteur.js.

   ---------------------------------------------------------------------
   CE QUE LE JOUEUR REÇOIT — ET CE QU'IL NE REÇOIT JAMAIS
   ---------------------------------------------------------------------
   Reçu  : les textes d'indices, les consignes d'étape, les EMPREINTES
           des réponses attendues, sa progression, ses erreurs.
   Jamais: le titre enregistré, l'EAN, le SKU, l'URL Fnac, la catégorie
           Fnac, le nom du rayon, la disponibilité, la solution.

   Le catalogue des ouvrages (titres, EAN, SKU, éditions) est CHIFFRÉ
   (AES-GCM, clé dérivée de la phrase d'administration) avant tout
   stockage : ni la page, ni le réseau, ni Firestore ne contiennent ces
   valeurs en clair. Seules des EMPREINTES salées circulent côté joueur.

   ---------------------------------------------------------------------
   DEUX MODES DE VÉRIFICATION DE LA DISPONIBILITÉ
   ---------------------------------------------------------------------
   · mode « operateur » (par défaut, fonctionne sur un hébergement
     statique) : l'organisateur confirme la disponibilité « retrait
     sous 1 h » dans le magasin choisi ; la confirmation est horodatée
     et n'est valable que 15 minutes AU MOMENT DE PRÉPARER la mission.
   · mode « fonction » (Cloud Functions déployées) : le service
     serveur vérifie lui-même la disponibilité et renvoie une réponse
     sans aucune donnée d'ouvrage. Aucun appel à fnac.com n'est fait
     depuis le navigateur (blocage CORS, exposition de la logique, et
     respect des conditions d'utilisation du site).

   La fenêtre de 15 minutes NE CHRONOMÈTRE JAMAIS LE MATELOT : une fois
   l'ouvrage affecté à la session, il peut le chercher aussi longtemps
   qu'il faut. Si l'ouvrage disparaît en cours de route, l'admin (ou la
   fonction) le remplace sans compter d'erreur.

   Utilisation :
     <script src="artefact-moteur.js?v=1"></script>
     <script src="artefact-service.js?v=1"></script>
     const s = await NautilusArtefact.ouvrirSession('NEMO', 'cl57');
     const r = await NautilusArtefact.verifierEtape('NEMO', 'sceau', '978…');
   ===================================================================== */
(function () {
  'use strict';
  if (window.NautilusArtefact) return;

  var M = window.NautilusArtefactMoteur;
  if (!M) { console.error('artefact-service.js : artefact-moteur.js doit être chargé avant.'); return; }

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyB5ivqXO1W9fZqqhwJ0uDnLgVgvWSfQz50",
    authDomain: "mission-nautilus.firebaseapp.com",
    projectId: "mission-nautilus",
    storageBucket: "mission-nautilus.firebasestorage.app",
    messagingSenderId: "444670686419",
    appId: "1:444670686419:web:00d186940a2fb8c8c29026"
  };
  var URL_APP  = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
  var URL_FS   = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
  var URL_AUTH = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

  /* Chemins Firestore. Tout vit sous la collection racine « artefacts »
     pour que les règles (firestore.rules) tiennent en trois lignes. */
  var CHEMINS = {
    config: 'artefacts/config',
    catalogue: 'artefacts/catalogue',
    cartouches: 'artefacts/cartouches',     // + /{id}   (public : empreintes)
    coffres: 'artefacts/coffres',           // + /{id}   (chiffré : réponses)
    sessions: 'artefacts/sessions',         // + /{EQUIPE}
    magasins: 'artefacts/magasins'
  };

  var CONFIG_DEFAUT = {
    mode: 'operateur',                      // 'operateur' | 'fonction'
    endpoint: '',                           // URL HTTPS de la Cloud Function
    fenetreMinutes: M.FENETRE_FRAICHEUR_MINUTES,
    iterationsEan: M.ITERATIONS_EAN,
    iterationsTexte: M.ITERATIONS_DEFAUT,
    maxErreurs: M.MAX_ERREURS,
    magasinDefaut: '',
    catalogueVersion: '',
    magasinsVersion: ''
  };

  /* ==================================================================
     1. STOCKAGE — trois implémentations, une seule interface :
        lire / poser / ecrire / lister / supprimer.
        · firestore : le mode normal (partagé entre tous les appareils) ;
        · memoire   : les tests Node et l'aperçu organisateur ;
        · local     : le secours hors ligne d'un SEUL appareil (démo).
     ================================================================== */
  function stockageMemoire(seed) {
    var base = {};
    Object.keys(seed || {}).forEach(function (k) { base[k] = JSON.parse(JSON.stringify(seed[k])); });
    function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
    return {
      nom: 'memoire',
      lire: function (c) { return Promise.resolve(clone(base[c]) || null); },
      poser: function (c, d) { base[c] = clone(d); return Promise.resolve(true); },
      ecrire: function (c, d) { base[c] = Object.assign(clone(base[c]) || {}, clone(d)); return Promise.resolve(true); },
      lister: function (p) {
        var out = [];
        Object.keys(base).forEach(function (c) {
          if (c.indexOf(p + '/') === 0 && c.slice(p.length + 1).indexOf('/') < 0) {
            out.push(Object.assign({ _id: c.slice(p.length + 1) }, clone(base[c])));
          }
        });
        return Promise.resolve(out);
      },
      supprimer: function (c) { delete base[c]; return Promise.resolve(true); },
      _base: base
    };
  }

  function stockageLocal(cleRacine) {
    var racine = cleRacine || 'nautilusArtefact';
    function lireTout() {
      try { return JSON.parse(localStorage.getItem(racine) || '{}'); } catch (e) { return {}; }
    }
    function ecrireTout(o) { try { localStorage.setItem(racine, JSON.stringify(o)); } catch (e) {} }
    var memo = stockageMemoire(lireTout());
    var _poser = memo.poser, _ecrire = memo.ecrire, _sup = memo.supprimer;
    memo.nom = 'local';
    memo.poser = function (c, d) { return _poser(c, d).then(function () { ecrireTout(memo._base); }); };
    memo.ecrire = function (c, d) { return _ecrire(c, d).then(function () { ecrireTout(memo._base); }); };
    memo.supprimer = function (c) { return _sup(c).then(function () { ecrireTout(memo._base); }); };
    return memo;
  }

  /* --- Firestore ------------------------------------------------- */
  function importMod(url) {
    if (window.NautilusArtefactImport) return Promise.resolve(window.NautilusArtefactImport(url));
    return import(url);
  }
  var _fs = null;
  function firestore() {
    if (_fs) return _fs;
    _fs = Promise.all([importMod(URL_APP), importMod(URL_FS), importMod(URL_AUTH)])
      .then(function (mods) {
        var appMod = mods[0], fsMod = mods[1], authMod = mods[2];
        var app = (appMod.getApps && appMod.getApps().length) ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
        var auth = authMod.getAuth(app);
        /* Les règles Firestore exigent une session : l'app ouvre une
           authentification ANONYME, comme le reste du jeu. */
        var pret = (auth.currentUser ? Promise.resolve(auth)
          : authMod.signInAnonymously(auth).then(function () { return auth; })
            .catch(function () { return auth; }));
        return pret.then(function () { return { db: fsMod.getFirestore(app), fs: fsMod }; });
      });
    return _fs;
  }

  function stockageFirestore() {
    function ref(x, chemin) { return x.fs.doc(x.db, chemin); }
    return {
      nom: 'firestore',
      lire: function (chemin) {
        return firestore().then(function (x) {
          return x.fs.getDoc(ref(x, chemin)).then(function (s) { return s.exists() ? (s.data() || null) : null; });
        });
      },
      poser: function (chemin, donnees) {
        return firestore().then(function (x) {
          return x.fs.setDoc(ref(x, chemin), donnees, { merge: false }).then(function () { return true; });
        });
      },
      ecrire: function (chemin, champs) {
        return firestore().then(function (x) {
          return x.fs.setDoc(ref(x, chemin), champs, { merge: true }).then(function () { return true; });
        });
      },
      lister: function (prefixe) {
        return firestore().then(function (x) {
          return x.fs.getDocs(x.fs.collection(x.db, prefixe)).then(function (snap) {
            var out = [];
            snap.forEach(function (d) { out.push(Object.assign({ _id: d.id }, d.data())); });
            return out;
          });
        });
      },
      supprimer: function (chemin) {
        return firestore().then(function (x) {
          return x.fs.deleteDoc(ref(x, chemin)).then(function () { return true; });
        });
      }
    };
  }

  /* --- Cloud Function (mode « fonction ») ------------------------- */
  function appelerFonction(action, corps, opts) {
    return config().then(function (cfg) {
      if (!cfg.endpoint) return Promise.reject(new Error('aucun endpoint configuré'));
      var url = cfg.endpoint.replace(/\/$/, '') + '/' + encodeURIComponent(action);
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps || {}),
        signal: (opts && opts.signal) || undefined
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(j.erreur || ('HTTP ' + r.status));
          return j;
        });
      });
    });
  }

  /* ==================================================================
     2. CHIFFREMENT DU CATALOGUE ET DES COFFRES
        AES-GCM 256, clé PBKDF2-SHA256 (200 000 itérations) dérivée de
        la PHRASE D'ADMINISTRATION. Cette phrase n'est écrite NULLE PART
        dans le code : elle est saisie à chaque session d'administration.
        (Le code d'ouverture du panneau admin, lui, est présent dans le
        bundle public : il ne doit donc JAMAIS servir de clé.)
     ================================================================== */
  var KDF_ITER = 200000;

  function b64VersOctets(b64) {
    var brut = atob(String(b64).replace(/[^A-Za-z0-9+/=]/g, ''));
    var out = new Uint8Array(brut.length);
    for (var i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
    return out;
  }
  function octetsVersB64(octets) {
    var s = '';
    for (var i = 0; i < octets.length; i++) s += String.fromCharCode(octets[i]);
    return btoa(s);
  }
  function sousCle() {
    if (!(window.crypto && window.crypto.subtle)) {
      throw new Error('chiffrement indisponible : la page doit être servie en HTTPS');
    }
    return window.crypto.subtle;
  }
  function cleFromPhrase(phrase, sel, iter) {
    var subtle = sousCle();
    var mat = subtle.importKey('raw', new TextEncoder().encode(String(phrase || '')), 'PBKDF2', false, ['deriveKey']);
    return mat.then(function (k) {
      return subtle.deriveKey({ name: 'PBKDF2', salt: sel, iterations: iter || KDF_ITER, hash: 'SHA-256' },
        k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  function chiffrer(objet, phrase) {
    var sel = window.crypto.getRandomValues(new Uint8Array(16));
    var iv = window.crypto.getRandomValues(new Uint8Array(12));
    return cleFromPhrase(phrase, sel, KDF_ITER).then(function (cle) {
      return sousCle().encrypt({ name: 'AES-GCM', iv: iv }, cle,
        new TextEncoder().encode(JSON.stringify(objet)));
    }).then(function (buf) {
      return {
        algo: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter: KDF_ITER,
        sel: octetsVersB64(sel), iv: octetsVersB64(iv), donnees: octetsVersB64(new Uint8Array(buf)),
        majAt: new Date().toISOString()
      };
    });
  }

  function dechiffrer(coffre, phrase) {
    if (!coffre || !coffre.donnees) return Promise.reject(new Error('coffre vide'));
    if (coffre.algo !== 'AES-GCM') return Promise.reject(new Error('algorithme inconnu : ' + coffre.algo));
    return cleFromPhrase(phrase, b64VersOctets(coffre.sel), coffre.iter || KDF_ITER)
      .then(function (cle) {
        return sousCle().decrypt({ name: 'AES-GCM', iv: b64VersOctets(coffre.iv) }, cle, b64VersOctets(coffre.donnees));
      })
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); })
      .catch(function () { throw new Error('phrase d’administration incorrecte (ou coffre corrompu)'); });
  }

  /* ==================================================================
     3. ÉTAT DU MODULE
     ================================================================== */
  var _stockage = null, _configCache = null, _configAt = 0;

  function stockage() {
    if (!_stockage) _stockage = stockageFirestore();
    return _stockage;
  }
  function initialiser(opts) {
    var o = opts || {};
    if (o.stockage) _stockage = o.stockage;
    if (o.config) _configCache = Object.assign({}, CONFIG_DEFAUT, o.config), _configAt = Date.now();
    return api;
  }

  function config(opts) {
    var o = opts || {};
    if (_configCache && !o.forcer && Date.now() - _configAt < 60000) return Promise.resolve(_configCache);
    return stockage().lire(CHEMINS.config).then(function (doc) {
      _configCache = Object.assign({}, CONFIG_DEFAUT, doc || {});
      _configAt = Date.now();
      return _configCache;
    }).catch(function () {
      _configCache = Object.assign({}, CONFIG_DEFAUT);
      _configAt = Date.now();
      return _configCache;
    });
  }

  function ecrireConfig(champs) {
    return stockage().ecrire(CHEMINS.config, Object.assign({}, champs, { majAt: new Date().toISOString() }))
      .then(function () { _configAt = 0; return config({ forcer: true }); });
  }

  function equipeCle(equipe) {
    return M.nettoyerTexte(equipe, 40).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /* ==================================================================
     4. CATALOGUE (admin seul)
     ================================================================== */
  function catalogueLire(phrase) {
    return stockage().lire(CHEMINS.catalogue).then(function (doc) {
      if (!doc || !doc.coffre) return { livres: [], version: '', majAt: '' };
      return dechiffrer(doc.coffre, phrase).then(function (livres) {
        return { livres: livres || [], version: doc.version || '', majAt: doc.coffre.majAt || doc.majAt || '' };
      });
    });
  }

  function catalogueEcrire(livres, phrase) {
    var normalises = [], problemes = [];
    (livres || []).forEach(function (brut) {
      var v = M.validerLivre(brut);
      if (v.livre) normalises.push(v.livre);
      else problemes.push({ id: brut && (brut.id || brut.titre), erreurs: v.erreurs });
    });
    return catalogueLire(phrase).then(function (actuel) {
      var controle = M.controlerCatalogue(normalises, actuel.livres);
      if (controle.length) {
        throw new Error('publication refusée : ' + controle.join(' ; '));
      }
      return chiffrer(normalises, phrase);
    }).then(function (coffre) {
      var version = 'catalogue-v' + new Date().toISOString().slice(0, 10).replace(/-/g, '')
        + '-' + String(Date.now()).slice(-4);
      return stockage().poser(CHEMINS.catalogue, {
        version: version, count: normalises.length, coffre: coffre,
        majAt: new Date().toISOString()
      }).then(function () {
        return ecrireConfig({ catalogueVersion: version }).then(function () {
          return { version: version, count: normalises.length, problemes: problemes };
        });
      });
    });
  }

  /* ==================================================================
     5. CARTOUCHES — missions anonymisées, prêtes à servir
     ================================================================== */
  function genererCartouche(livre, magasinId, opts) {
    var o = opts || {};
    return config().then(function (cfg) {
      var sel = M.selAleatoire(16);
      var g = M.genererCartouche(livre, {
        magasinId: magasinId, sel: sel,
        maintenant: o.maintenant,
        /* La configuration décide du coût des empreintes ; la cartouche
           garde le sien, donc changer la configuration ne casse jamais une
           mission déjà lancée. */
        iterations: o.iterations || { ean: cfg.iterationsEan, texte: cfg.iterationsTexte }
      });
      if (g.erreur) throw new Error(g.erreur);
      var cartouche = g.cartouche;
      cartouche.mode = cfg.mode;
      delete cartouche._id;                       // artéfact du stockage, pas du jeu
      /* Direct Fnac (sans catalogue chiffré) : si pas de phrase, on stocke
         le secret en clair pour que l'admin puisse voir les réponses sans
         déchiffrement. o.sansCoffre = aperçu hors ligne (aucune écriture coffre). */
      if (o.sansCoffre) {
        return stockage().poser(CHEMINS.cartouches + '/' + cartouche.id, cartouche)
          .then(function () { return { cartouche: cartouche, secret: g.secret, sansCoffre: true }; });
      }
      if (!o.phrase) {
        return Promise.all([
          stockage().poser(CHEMINS.cartouches + '/' + cartouche.id, cartouche),
          stockage().poser(CHEMINS.coffres + '/' + cartouche.id, { secret: g.secret, cartoucheId: cartouche.id, enClair: true })
        ]).then(function () { return { cartouche: cartouche, secret: g.secret }; });
      }
      return chiffrer(g.secret, o.phrase).then(function (coffre) {
        return Promise.all([
          stockage().poser(CHEMINS.cartouches + '/' + cartouche.id, cartouche),
          stockage().poser(CHEMINS.coffres + '/' + cartouche.id, { coffre: coffre, cartoucheId: cartouche.id })
        ]).then(function () { return { cartouche: cartouche, secret: g.secret }; });
      });
    });
  }

  function genererCartouchesPour(magasinId, opts) {
    var o = opts || {};
    return config().then(function (cfg) {
      /* o.livres permet de générer sans relire le catalogue (aperçu
         organisateur, tests, Cloud Function) ; sinon c'est le catalogue
         chiffré qui fait foi. */
      var source = o.livres ? Promise.resolve({ livres: o.livres, version: 'ponctuelle', majAt: '' })
                            : catalogueLire(o.phrase);
      return source.then(function (cat) {
        var maintenant = Number(o.maintenant) || Date.now();
        var fenetre = Number(cfg.fenetreMinutes) || M.FENETRE_FRAICHEUR_MINUTES;
        var selection = M.candidats(cat.livres, magasinId, {
          maintenant: maintenant, fenetreMinutes: fenetre,
          exclus: o.exclus || [], inclurePartenaires: !!o.inclurePartenaires
        });
        var aFaire = selection.retenus.filter(function (l) {
          return !(o.livreIds && o.livreIds.length) || o.livreIds.indexOf(l.id) >= 0;
        });
        return aFaire.reduce(function (chaine, livre) {
          return chaine.then(function (acc) {
            /* Une cartouche par ouvrage : chaque sel est unique, donc
               chaque mission est distincte — y compris pour deux
               éditions du même titre. */
            return genererCartouche(livre, magasinId, {
                phrase: o.phrase, maintenant: maintenant, sansCoffre: !!o.sansCoffre
              })
              .then(function (r) {
                acc.faites.push({ id: r.cartouche.id, livre: livre.titre, cartouche: r.cartouche, secret: r.secret });
                if (o.secrets) o.secrets[r.cartouche.id] = r.secret;
                return acc;
              })
              .catch(function (e) { acc.erreurs.push({ livre: livre.id, erreur: String(e && e.message || e) }); return acc; });
          });
        }, Promise.resolve({ faites: [], erreurs: [], ecartes: selection.ecartes }));
      });
    });
  }

  function listerCartouches(magasinId) {
    return stockage().lister(CHEMINS.cartouches).then(function (docs) {
      return docs.filter(function (d) { return !magasinId || !d.magasinId || d.magasinId === magasinId; });
    });
  }

  function lireCartouche(id) {
    return stockage().lire(CHEMINS.cartouches + '/' + M.nettoyerTexte(id, 40).replace(/[^A-Za-z0-9-]/g, ''));
  }

  function lireCoffre(id, phrase) {
    return stockage().lire(CHEMINS.coffres + '/' + M.nettoyerTexte(id, 40).replace(/[^A-Za-z0-9-]/g, ''))
      .then(function (doc) {
        if (!doc) return null;
        if (doc.secret && doc.enClair) return doc.secret; // direct Fnac — en clair (plus de phrase)
        if (doc.secret && !doc.coffre) return doc.secret;
        if (doc.coffre) return dechiffrer(doc.coffre, phrase);
        return null;
      });
  }

  function supprimerCartouche(id) {
    var propre = M.nettoyerTexte(id, 40).replace(/[^A-Za-z0-9-]/g, '');
    return Promise.all([
      stockage().supprimer(CHEMINS.cartouches + '/' + propre),
      stockage().supprimer(CHEMINS.coffres + '/' + propre)
    ]);
  }

  /* Re-confirmer la disponibilité : ré-horodate les cartouches du
     magasin (et le catalogue) SANS changer les ouvrages. C'est le geste
     d'avant-partie : « j'ai vérifié sur fnac.com, retrait sous 1 h ». */
  function reconfirmerDisponibilite(magasinId, opts) {
    var o = opts || {};
    var delai = M.nettoyerTexte(o.delai, 60) || 'Retrait gratuit sous 1H';
    var maintenant = new Date(Number(o.maintenant) || Date.now()).toISOString();
    if (!M.delaiAccepte(delai)) {
      return Promise.reject(new Error('délai refusé : seul un retrait sous 1 h est acceptable (« ' + delai + ' »)'));
    }
    return listerCartouches(magasinId).then(function (docs) {
      var cibles = docs.filter(function (d) { return !magasinId || d.magasinId === magasinId; });
      return cibles.reduce(function (chaine, d) {
        return chaine.then(function (n) {
          return stockage().ecrire(CHEMINS.cartouches + '/' + d._id, {
            disponibilite: { magasin: d.magasinId, statut: 'disponible', delai: delai,
                             checkedAt: maintenant, vendeur: 'fnac' }
          }).then(function () { return n + 1; });
        });
      }, Promise.resolve(0)).then(function (n) {
        /* Le catalogue suit : la prochaine génération partira d'une
           disponibilité fraîche, elle aussi. */
        if (!o.phrase) return n;
        return catalogueLire(o.phrase).then(function (cat) {
          cat.livres.forEach(function (l) {
            l.disponibilite = l.disponibilite || {};
            l.disponibilite[magasinId] = { statut: 'disponible', delai: delai, checkedAt: maintenant,
                                           vendeur: l.vendeur || 'fnac', magasin: magasinId };
          });
          return catalogueEcrire(cat.livres, o.phrase).then(function () { return n; });
        }).catch(function () { return n; });
      }).then(function (n) { return { maj: n, delai: delai, checkedAt: maintenant }; });
    });
  }

  /* ==================================================================
     6. SESSION DE JEU — une par équipage, verrouillée sur son ouvrage
     ================================================================== */
  function cheminSession(equipe) { return CHEMINS.sessions + '/' + equipeCle(equipe); }

  function lireSession(equipe) {
    return stockage().lire(cheminSession(equipe));
  }

  function ecrireSession(equipe, champs) {
    return stockage().ecrire(cheminSession(equipe), champs);
  }

  function ajouterHistorique(session, entree) {
    var h = Array.isArray(session.historique) ? session.historique.slice() : [];
    h.push(Object.assign({ le: new Date().toISOString() }, entree));
    while (h.length > 40) h.shift();          // borne fixe : jamais de doc infini
    return h;
  }

  function cartoucheUtilisable(c, cfg, magasinId, maintenant) {
    if (!c || !c.etapes || !c.etapes.length) return false;
    if (magasinId && c.magasinId && c.magasinId !== magasinId) return false;
    var dispo = c.disponibilite;
    if (!dispo) return false;
    var fenetre = Number(cfg.fenetreMinutes) || M.FENETRE_FRAICHEUR_MINUTES;
    return M.disponibiliteValide(dispo, magasinId, { fenetreMinutes: fenetre, maintenant: maintenant }).ok;
  }

  /* Ouverture (ou reprise) de la session d'un équipage.
     RÈGLE : un ouvrage déjà affecté ne change JAMAIS en cours de partie,
     même si le stock évolue. Une session « suspendue » (ouvrage
     signalé introuvable ou devenu indisponible) attend l'admin. */
  function ouvrirSession(equipe, magasinId, opts) {
    var o = opts || {};
    var cle = equipeCle(equipe);
    if (!cle) return Promise.reject(new Error('équipage inconnu'));
    var maintenant = Number(o.maintenant) || Date.now();
    return config().then(function (cfg) {
      return lireSession(cle).then(function (session) {
        if (session && session.statut === 'terminee') return { session: session, reprise: true };
        if (session && session.statut === 'active' && session.cartouche && session.cartouche.id) {
          /* Session verrouillée : on rejoue la même mission. */
          return { session: session, reprise: true, verrouillee: true };
        }
        if (session && session.statut === 'suspendue') return { session: session, reprise: true, suspendue: true };

        var magasin = magasinId || session && session.magasinId || cfg.magasinDefaut || '';
        if (!magasin) return { erreur: 'magasin-requis', message: M.MESSAGES.magasinRequis };

        if (cfg.mode === 'fonction' && cfg.endpoint) {
          return appelerFonction('selectionner', { equipe: cle, magasinId: magasin })
            .then(function (r) {
              if (!r || !r.cartouche) return { erreur: 'aucun-ouvrage', message: M.MESSAGES.aucunOuvrageMagasin };
              return creerSession(cle, magasin, r.cartouche, 'automatique-serveur', cfg, maintenant, session);
            })
            .catch(function (e) {
              return { erreur: 'service-indisponible', message: 'Service de sélection injoignable : '
                + M.nettoyerTexte(e && e.message, 120) };
            });
        }

        return listerCartouches(magasin).then(function (docs) {
          var utilisables = docs.filter(function (c) { return cartoucheUtilisable(c, cfg, magasin, maintenant); });
          if (!utilisables.length) {
            var ecartes = docs.map(function (c) {
              var d = M.disponibiliteValide(c.disponibilite, magasin,
                { fenetreMinutes: cfg.fenetreMinutes, maintenant: maintenant });
              return { id: c.id, motif: d.ok ? 'ok' : d.motif };
            });
            return { erreur: 'aucun-ouvrage', message: M.MESSAGES.aucunOuvrageMagasin, ecartes: ecartes };
          }
          /* Tirage déterministe sur l'identifiant d'équipage : deux
             équipages ne suivent pas la même route, et un rafraîchissement
             ne change pas l'ouvrage en cours. */
          var tirage = M.aleatoireDeSel(cle + '|' + magasin);
          var choix = utilisables.length === 1 ? utilisables[0]
            : utilisables[Math.floor(tirage() * utilisables.length) % utilisables.length];
          return creerSession(cle, magasin, choix, 'automatique', cfg, maintenant, session);
        });
      });
    });
  }

  function creerSession(cle, magasinId, cartouche, modeSelection, cfg, maintenant, ancienne) {
    var session = {
      equipe: cle,
      magasinId: magasinId,
      statut: 'active',
      cartoucheId: cartouche.id,
      cartouche: cartouche,               // copie : verrouillée pour la partie
      etape: 0,
      etapesValidees: [],
      erreurs: (ancienne && ancienne.statut === 'terminee') ? 0 : Number(ancienne && ancienne.erreurs || 0),
      indicesUtilises: (ancienne && ancienne.indicesUtilises) || [],
      indicesTransmis: {},
      demandeIndice: null,
      introuvable: null,
      remplacement: null,
      selectionMode: modeSelection,
      selectionneLe: new Date(maintenant).toISOString(),
      historique: ajouterHistorique(ancienne || {}, {
        type: 'selection', texte: 'Ouvrage affecté (' + modeSelection + ') — cartouche ' + cartouche.id
      })
    };
    return stockage().poser(cheminSession(cle), session).then(function () { return { session: session }; });
  }

  /* --- vérification d'une étape ---------------------------------- */
  function verifierEtape(equipe, etapeId, valeur, opts) {
    var o = opts || {};
    var cle = equipeCle(equipe);
    return lireSession(cle).then(function (session) {
      if (!session) return { ok: false, motif: 'aucune mission en cours', erreur: false };
      /* Session déjà scellée : une étape validée reste validée, et rien ne
         se rejoue. Le matelot qui recharge la page après la victoire ne doit
         pas voir sa mission repartir de zéro ni perdre une tentative. */
      if (session.statut === 'terminee') {
        return { ok: (session.etapesValidees || []).indexOf(etapeId) >= 0,
                 dejaValidee: true, fini: true, erreur: false,
                 message: M.MESSAGES.victoire };
      }
      if (session.statut !== 'active') {
        return { ok: false, motif: 'aucune mission en cours', erreur: false };
      }
      var c = session.cartouche;
      var etape = null;
      for (var i = 0; i < c.etapes.length; i++) if (c.etapes[i].id === etapeId) etape = c.etapes[i];
      if (!etape) return { ok: false, motif: 'étape inconnue', erreur: false };
      if ((session.etapesValidees || []).indexOf(etapeId) >= 0) {
        return { ok: true, dejaValidee: true };
      }
      var r = M.verifierEtape(etape, valeur);
      if (r.ok) {
        var validees = (session.etapesValidees || []).concat([etapeId]);
        var indexEtape = Math.min(c.etapes.length - 1, validees.length);
        var fini = validees.length >= c.etapes.length;
        var champs = {
          etapesValidees: validees,
          etape: indexEtape,
          derniereValidationLe: new Date().toISOString(),
          historique: ajouterHistorique(session, { type: 'etape', texte: 'Étape « ' + etapeId + ' » validée' })
        };
        if (fini) {
          champs.statut = 'terminee';
          champs.termineLe = new Date().toISOString();
          champs.historique = ajouterHistorique(Object.assign({}, session, champs),
            { type: 'victoire', texte: 'Signature complète — escale suivante déverrouillée' });
        }
        return ecrireSession(cle, champs).then(function () {
          return { ok: true, fini: fini, etapesValidees: validees, message: fini ? M.MESSAGES.victoire : M.MESSAGES.etapeValidee };
        });
      }
      /* Échec : une erreur de plus, sauf si la réponse n'était pas
         examinable (code-barres illisible, champ vide) — un scan raté
         par la caméra ne doit pas coûter une tentative au matelot. */
      if (!r.erreur) return { ok: false, motif: r.motif, erreur: false, erreurs: session.erreurs || 0 };
      var erreurs = Number(session.erreurs || 0) + 1;
      var maxErreurs = Number(session.cartouche.maxErreurs) || M.MAX_ERREURS;
      var essaiBrut = M.nettoyerTexte(valeur, 40);
      var essaiLog = essaiBrut ? ' — essai : « ' + essaiBrut + ' »' : '';
      var champs2 = {
        erreurs: erreurs,
        derniereErreurLe: new Date().toISOString(),
        historique: ajouterHistorique(session, { type: 'erreur', texte: 'Réponse refusée à l’étape « ' + etapeId + ' »' + essaiLog + ' (' + erreurs + '/' + maxErreurs + ')', essai: essaiBrut, etapeId: etapeId })
      };
      return ecrireSession(cle, champs2).then(function () {
        return {
          ok: false, motif: r.motif, erreur: true, erreurs: erreurs, maxErreurs: maxErreurs,
          remontee: erreurs >= maxErreurs,
          dernierAvertissement: erreurs === maxErreurs - 1 ? M.MESSAGES.dernierAvertissement : ''
        };
      });
    });
  }

  /* --- signalement « livre introuvable » (aucune erreur comptée) --- */
  function signalerIntrouvable(equipe, opts) {
    var o = opts || {};
    var cle = equipeCle(equipe);
    return lireSession(cle).then(function (session) {
      if (!session) return { ok: false, motif: 'aucune mission en cours' };
      var champs = {
        introuvable: { signaleLe: new Date().toISOString(), par: M.nettoyerTexte(o.par, 60) || '',
                       cartoucheId: session.cartoucheId },
        statut: 'suspendue',
        historique: ajouterHistorique(session, {
          type: 'introuvable', texte: 'Ouvrage signalé introuvable par ' + (M.nettoyerTexte(o.par, 60) || 'un matelot')
            + ' — aucune erreur comptée, en attente du capitaine'
        })
      };
      return ecrireSession(cle, champs).then(function () {
        return { ok: true, message: M.MESSAGES.introuvableEnregistre };
      });
    });
  }

  /* --- indice payant : le sacrifice d'abord, l'indice ensuite ------ */
  function demanderIndice(equipe, rang, opts) {
    var o = opts || {};
    var cle = equipeCle(equipe);
    var indice = null;
    for (var i = 0; i < M.INDICES.length; i++) if (M.INDICES[i].rang === Number(rang)) indice = M.INDICES[i];
    if (!indice) return Promise.reject(new Error('indice inconnu'));
    return lireSession(cle).then(function (session) {
      if (!session || !session.cartouche) return { ok: false, motif: 'aucune mission en cours' };
      if ((session.indicesUtilises || []).indexOf(indice.cle) >= 0) {
        return { ok: false, dejaUtilise: true, motif: 'cet indice a déjà été obtenu',
                 texte: (session.indicesTransmis || {})[indice.cle] || '' };
      }
      /* Le texte de niveau 1 (méthode, jamais la réponse) est déjà dans
         la cartouche : il peut être révélé immédiatement après le
         sacrifice. La valeur EXACTE (nom du rayon, numéro d'édition,
         auteur) ne vit que dans le coffre : elle est transmise par le
         capitaine (panneau admin) ou par la Cloud Function. */
      var aide = (session.cartouche.aides || {})[indice.aide] || '';
      var champs = {
        demandeIndice: { rang: indice.rang, cle: indice.cle, demandeLe: new Date().toISOString(),
                         par: M.nettoyerTexte(o.par, 60) || '', heures: indice.heures },
        indicesUtilises: (session.indicesUtilises || []).concat([indice.cle]),
        historique: ajouterHistorique(session, {
          type: 'indice', texte: 'Indice « ' + indice.titre + ' » demandé — sacrifice de ' + indice.heures + ' h accepté'
        })
      };
      return ecrireSession(cle, champs).then(function () {
        return { ok: true, indice: indice, aide: aide, heures: indice.heures,
                 message: M.MESSAGES.sacrificeAccepte };
      });
    });
  }

  /* Admin (ou fonction) : transmet la valeur exacte d'un indice. */
  function transmettreIndice(equipe, rang, texte) {
    var cle = equipeCle(equipe);
    var indice = null;
    for (var i = 0; i < M.INDICES.length; i++) if (M.INDICES[i].rang === Number(rang)) indice = M.INDICES[i];
    if (!indice) return Promise.reject(new Error('indice inconnu'));
    var propre = M.nettoyerTexte(texte, 400);
    if (!propre) return Promise.reject(new Error('texte d’indice vide'));
    return lireSession(cle).then(function (session) {
      if (!session) return { ok: false, motif: 'aucune mission en cours' };
      var transmis = Object.assign({}, session.indicesTransmis || {});
      transmis[indice.cle] = propre;
      var champs = {
        indicesTransmis: transmis,
        demandeIndice: null,
        historique: ajouterHistorique(session, {
          type: 'indice-transmis', texte: 'Indice « ' + indice.titre + ' » transmis par le capitaine'
        })
      };
      return ecrireSession(cle, champs).then(function () { return { ok: true, texte: propre }; });
    });
  }

  /* Marquer une cartouche indisponible : elle ne sera plus jamais
     sélectionnée (ni pour un nouvel équipage, ni pour un remplacement).
     Aucun ouvrage n'est supprimé : la trace reste pour l'historique. */
  function marquerIndisponible(cartoucheId, motif, opts) {
    var o = opts || {};
    var propre = M.nettoyerTexte(cartoucheId, 40).replace(/[^A-Za-z0-9-]/g, '');
    if (!propre) return Promise.reject(new Error('cartouche inconnue'));
    return stockage().lire(CHEMINS.cartouches + '/' + propre).then(function (doc) {
      if (!doc) return { ok: false, motif: 'cartouche absente' };
      var dispo = Object.assign({}, doc.disponibilite || {});
      dispo.statut = 'indisponible';
      dispo.motif = M.nettoyerTexte(motif, 120) || 'signalé par le capitaine';
      dispo.checkedAt = new Date(Number(o.maintenant) || Date.now()).toISOString();
      return stockage().ecrire(CHEMINS.cartouches + '/' + propre, {
        disponibilite: dispo, indisponibleLe: dispo.checkedAt
      }).then(function () { return { ok: true, cartoucheId: propre, motif: dispo.motif }; });
    });
  }

  /* ==================================================================
     7. RÉSÉLECTION — « Resélectionner le livre » (admin seulement)
        L'ouvrage disparaît du rayon, ou devient indisponible : on en
        affecte un AUTRE, sans compter d'erreur, sans perdre la
        progression compatible. Si le sceau avait déjà reconnu l'ouvrage,
        la séquence liée au livre repart de cette étape : on ne mélange
        jamais les indices de deux éditions différentes.
     ================================================================== */
  function reselectionner(equipe, opts) {
    var o = opts || {};
    var cle = equipeCle(equipe);
    return config().then(function (cfg) {
      return lireSession(cle).then(function (session) {
        if (!session) return { ok: false, motif: 'aucune mission en cours' };
        var ancienId = session.cartoucheId;
        var sceauValide = (session.etapesValidees || []).indexOf('sceau') >= 0;
        var maintenant = Number(o.maintenant) || Date.now();
        return listerCartouches(session.magasinId).then(function (docs) {
          var candidats = docs.filter(function (c) {
            return c.id !== ancienId && cartoucheUtilisable(c, cfg, session.magasinId, maintenant);
          });
          if (!candidats.length) {
            var champs = {
              statut: 'suspendue',
              historique: ajouterHistorique(session, {
                type: 'remplacement-impossible',
                texte: 'Aucun autre ouvrage compatible : mission suspendue, progression conservée'
              })
            };
            return ecrireSession(cle, champs).then(function () {
              return { ok: false, motif: 'aucun-autre-ouvrage', message: M.MESSAGES.aucunOuvrage,
                       progressionConservee: true };
            });
          }
          var tirage = M.aleatoireDeSel(cle + '|' + ancienId + '|' + maintenant);
          var choix = candidats.length === 1 ? candidats[0]
            : candidats[Math.floor(tirage() * candidats.length) % candidats.length];

          /* Progression : le sceau validé appartenait à l'ancien ouvrage.
             On repart de la recherche (étape 0) mais on NE COMPTE AUCUNE
             erreur, et on garde la trace des sacrifices déjà payés. */
          var validees = sceauValide ? [] : (session.etapesValidees || []);
          var nouveauxIndice = sceauValide ? {} : (session.indicesTransmis || {});
          var champs2 = {
            statut: 'active',
            cartoucheId: choix.id,
            cartouche: choix,
            etapesValidees: validees,
            etape: Math.min(choix.etapes.length - 1, validees.length),
            indicesTransmis: nouveauxIndice,
            demandeIndice: null,
            introuvable: null,
            remplacement: {
              ancienCartoucheId: ancienId, nouveauCartoucheId: choix.id,
              raison: M.nettoyerTexte(o.raison, 120) || (o.introuvable ? 'ouvrage-introuvable' : 'ouvrage-indisponible'),
              par: M.nettoyerTexte(o.par, 60) || 'capitaine',
              le: new Date(maintenant).toISOString(),
              sceauDejaValide: sceauValide
            },
            historique: ajouterHistorique(session, {
              type: 'remplacement',
              texte: 'Ouvrage remplacé (' + (o.introuvable ? 'signalé introuvable' : 'devenu indisponible')
                + ') — cartouche ' + ancienId + ' → ' + choix.id
                + (sceauValide ? ' ; séquence liée à l’ouvrage réinitialisée' : ' ; progression conservée')
                + ' ; aucune erreur comptée'
            })
          };
          return stockage().poser(cheminSession(cle), Object.assign({}, session, champs2))
            .then(function () {
              return { ok: true, message: M.MESSAGES.replacement, cartoucheId: choix.id,
                       sceauReinitialise: sceauValide, progressionConservee: !sceauValide };
            });
        });
      });
    });
  }

  /* Réinitialisation complète (admin) : rare, mais nécessaire quand une
     équipe doit rejouer le palier après un incident. */
  function reinitialiser(equipe, opts) {
    var cle = equipeCle(equipe);
    return lireSession(cle).then(function (session) {
      return stockage().poser(cheminSession(cle), {
        equipe: cle, statut: 'attente', magasinId: (session && session.magasinId) || '',
        cartoucheId: null, cartouche: null, etape: 0, etapesValidees: [], erreurs: 0,
        indicesUtilises: [], indicesTransmis: {}, demandeIndice: null, introuvable: null,
        remplacement: null, reinitialiseeLe: new Date().toISOString(),
        historique: [{ le: new Date().toISOString(), type: 'reinitialisation',
                       texte: 'Session réinitialisée par '
                         + (M.nettoyerTexte((opts || {}).par, 60) || 'le capitaine') }]
      });
    });
  }

  /* ==================================================================
     8. LISTE DES MAGASINS PUBLIÉE (miroir Firestore du fichier statique)
        La publication est ATOMIQUE : on écrit la liste complète et sa
        version en une seule opération, jamais un morceau.
     ================================================================== */
  function publierMagasins(listeBrute) {
    var magasins = (listeBrute && Array.isArray(listeBrute.magasins)) ? listeBrute.magasins : listeBrute;
    var problemes = M.controlerMagasins(magasins, []);
    if (problemes.length) return Promise.reject(new Error('publication refusée : ' + problemes.join(' ; ')));
    var doc = {
      version: 'v' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      syncedAt: new Date().toISOString(),
      source: 'panneau-admin',
      count: magasins.length,
      magasins: magasins
    };
    return stockage().poser(CHEMINS.magasins, doc).then(function () {
      try { localStorage.setItem('nautilusMagasinsPublies', JSON.stringify(doc)); } catch (e) {}
      return ecrireConfig({ magasinsVersion: doc.version }).then(function () { return doc; });
    });
  }

  /* ==================================================================
     9. API
     ================================================================== */
  var api = {
    /* infrastructure */
    CHEMINS: CHEMINS, CONFIG_DEFAUT: CONFIG_DEFAUT, KDF_ITER: KDF_ITER,
    initialiser: initialiser, stockage: stockage, stockageMemoire: stockageMemoire,
    stockageLocal: stockageLocal, stockageFirestore: stockageFirestore,
    config: config, ecrireConfig: ecrireConfig, appelerFonction: appelerFonction,
    chiffrer: chiffrer, dechiffrer: dechiffrer,
    /* catalogue */
    catalogueLire: catalogueLire, catalogueEcrire: catalogueEcrire,
    /* cartouches */
    genererCartouche: genererCartouche, genererCartouchesPour: genererCartouchesPour,
    listerCartouches: listerCartouches, lireCartouche: lireCartouche, lireCoffre: lireCoffre,
    supprimerCartouche: supprimerCartouche, reconfirmerDisponibilite: reconfirmerDisponibilite,
    marquerIndisponible: marquerIndisponible,
    cartoucheUtilisable: cartoucheUtilisable,
    /* sessions */
    ouvrirSession: ouvrirSession, lireSession: lireSession, verifierEtape: verifierEtape,
    signalerIntrouvable: signalerIntrouvable, demanderIndice: demanderIndice,
    transmettreIndice: transmettreIndice, reselectionner: reselectionner,
    reinitialiser: reinitialiser, ajouterHistorique: ajouterHistorique, equipeCle: equipeCle,
    /* magasins */
    publierMagasins: publierMagasins
  };

  window.NautilusArtefact = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
