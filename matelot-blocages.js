/* =============================================================
   BLOCAGES PERSONNELS DES MATELOTS — CODE COMMUN À TOUS LES PALIERS
   (matelot-blocages.js)

   RÈGLE GLOBALE DU JEU (déjà appliquée au Palier 1, étendue ici à
   TOUS les paliers ≥ 2) : les erreurs d'un matelot lui restent
   PERSONNELLES. 3 erreurs = remise en surface de CE matelot,
   consignée dans le document Firestore de SON équipage
   (teams/{equipage}.matelotLocks[memberKey]) — JAMAIS dans le seul
   appareil. Un collègue qui fait 3 erreurs sur le même appareil le
   bloque donc LUI, pas les autres.

   Cas visé : un matelot rentre son Code Matelot pour reprendre la
   partie sur un appareil où un collègue vient d'échouer — il ne
   doit JAMAIS hériter du blocage de ce collègue.

   Barème commun (en phase avec LOCK_HOURS de palier1.html) :
   1 h, 2 h, 4 h, 8 h, 12 h, puis 24 h dès le 6ᵉ échec — le compteur
   d'échecs (failCount) suit le matelot d'un palier à l'autre.

   Identité : Code Matelot (paramètre ?m= de l'URL, à défaut
   localStorage « nautilusMatelotCode » — mêmes conventions que
   palier1.html). La fiche du matelot (teams/{equipage}/matelots/
   {code} puis index matelots/{code}) donne le nom → memberKey
   STRICTEMENT identique à palier1/index (nom en majuscules, sans
   accents ni séparateurs).

   Hors ligne ou sans Code Matelot : identiteCourante() renvoie null
   et la page retombe sur son comportement historique (blocage LOCAL
   à l'appareil). Ce repli ne concerne QUE les joueurs anonymes :
   il n'est JAMAIS lu pour un matelot identifié — sinon le collègue
   anonyme qui a échoué sur le poste bloquerait tout le monde, ce
   qui est exactement le bug résolu ici.

   Utilisation :
     <script src="matelot-blocages.js?v=1"></script>
     const moi   = await NautilusBlocages.identiteCourante();
     const bloc  = await NautilusBlocages.blocageActif(moi);
     const pose  = await NautilusBlocages.poserBlocage(moi, 'raison');
     const leves = await NautilusBlocages.leverBlocages(equipage, 'livres');
   ============================================================= */
(function () {
  'use strict';

  var LOCK_HOURS = [1, 2, 4, 8, 12];      // barème commun, = palier1.html
  var CODE_TEST = 'ZZZZ-0000';            // compte d'essai : jamais en base

  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyB5ivqXO1W9fZqqhwJ0uDnLgVgvWSfQz50",
    authDomain: "mission-nautilus.firebaseapp.com",
    projectId: "mission-nautilus",
    storageBucket: "mission-nautilus.firebasestorage.app",
    messagingSenderId: "444670686419",
    appId: "1:444670686419:web:00d186940a2fb8c8c29026"
  };
  var URL_APP = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
  var URL_FS  = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

  /* memberKey : copie EXACTE de palier1.html / index.html — les clés de
     blocage doivent être identiques d'une page à l'autre, sinon les
     blocages se fragmentent entre paliers. */
  function normalize(s) { return String(s || '').trim().toUpperCase(); }
  function memberKey(name) {
    return normalize(String(name || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, ''));
  }

  function heuresBlocage(failCount) {
    var n = Math.max(1, Number(failCount) || 1);
    return n <= LOCK_HOURS.length ? LOCK_HOURS[n - 1] : 24;
  }

  /* Firebase mutualisé : getApp() si la page (ou le bouton admin) a
     déjà initialisé l'app — jamais deux initializeApp. */
  function importMod(kind) {
    /* Point d'injection pour les tests hors navigateur : define
       window.NautilusBlocagesImport et rien ne sort en réseau. */
    if (window.NautilusBlocagesImport) {
      return Promise.resolve(window.NautilusBlocagesImport(kind));
    }
    return import(kind === 'app' ? URL_APP : URL_FS);
  }
  var _dbPromise = null;
  function db() {
    if (!_dbPromise) {
      _dbPromise = Promise.all([importMod('app'), importMod('fs')]).then(function (mods) {
        var appMod = mods[0], fsMod = mods[1];
        var app = (appMod.getApps && appMod.getApps().length)
          ? appMod.getApp()
          : appMod.initializeApp(FIREBASE_CONFIG);
        return { db: fsMod.getFirestore(app), fs: fsMod };
      });
    }
    return _dbPromise;
  }

  function lireParam(nom) {
    try {
      var m = location.search.match(new RegExp('[?&]' + nom + '=([^&]+)'));
      return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    } catch (e) { return ''; }
  }

  function equipeCourante() {
    try { return (localStorage.getItem('nautilusCurrentTeam') || '').trim().toUpperCase(); }
    catch (e) { return ''; }
  }

  function codeMatelotCourant() {
    var fromUrl = lireParam('m').trim().toUpperCase();
    if (fromUrl) {
      try { localStorage.setItem('nautilusMatelotCode', fromUrl); } catch (e) {}
      return fromUrl;
    }
    try { return (localStorage.getItem('nautilusMatelotCode') || '').trim().toUpperCase(); }
    catch (e) { return ''; }
  }

  /* Résout QUI joue sur cet appareil — null si personne n'est identifié
     (la page retombe alors sur son repli local historique).
     La fiche du matelot FAIT FOI pour l'équipage : si l'appareil traîne
     le code d'un autre équipage (session précédente), on le corrige au
     passage. Rejeter le matelot, comme le ferait une égalité stricte,
     le renverrait vers le repli local — précisément le verrou que ce
     module supprime. */
  async function identiteCourante() {
    var code = codeMatelotCourant();
    if (!code) return null;
    if (code === CODE_TEST) {
      /* RÈGLE : le compte fantôme TEST ne fait JAMAIS partie d'un
         équipage — teamCode null. L'éventuel équipage réel mémorisé sur
         l'appareil n'est pas lu non plus : il serait sinon affiché comme
         « l'équipage du testeur », ce qui a trompé le concepteur. */
      return { code: code, name: 'TEST', memberKey: 'TEST', isTest: true,
               teamCode: null };
    }
    var teamCode = equipeCourante();
    var x;
    try { x = await db(); } catch (e) { return null; }   // hors ligne : repli page
    var fiche = null;
    try {
      if (teamCode) {
        var s1 = await x.fs.getDoc(x.fs.doc(x.db, 'teams', teamCode, 'matelots', code));
        if (s1.exists()) fiche = s1.data();
      }
      if (!fiche) {
        var s2 = await x.fs.getDoc(x.fs.doc(x.db, 'matelots', code));
        if (s2.exists()) fiche = s2.data();
      }
    } catch (e) { return null; }                          // hors ligne : repli page
    if (!fiche || !fiche.name) return null;
    var equipe = normalize(fiche.teamCode || teamCode);
    if (!equipe) return null;
    if (equipe !== teamCode) {
      try { localStorage.setItem('nautilusCurrentTeam', equipe); } catch (e) {}
    }
    return { code: code, name: normalize(fiche.name),
             memberKey: memberKey(fiche.name), teamCode: equipe, isTest: false };
  }

  /* Blocage ACTIF du matelot (lockedUntil dans le futur), sinon null.
     Toute erreur réseau → null : on ne verrouille JAMAIS un matelot sur
     un doute de connexion (fail-open assumé, documenté). */
  async function blocageActif(ident) {
    if (!ident || ident.isTest) return null;
    try {
      var x = await db();
      var snap = await x.fs.getDoc(x.fs.doc(x.db, 'teams', ident.teamCode));
      if (!snap.exists()) return null;
      var l = ((snap.data().matelotLocks || {})[ident.memberKey]) || null;
      if (l && l.lockedUntil && new Date(l.lockedUntil).getTime() > Date.now()) return l;
      return null;
    } catch (e) { return null; }
  }

  /* Consigne l'échec : compteur PERSONNEL +1, durée selon le barème
     commun, écriture par CHEMIN (« matelotLocks.CLE ») pour ne jamais
     écraser le blocage d'un coéquipier écrit au même instant.
     failCount de l'équipage reste tenu à jour, comme au Palier 1 :
     il ne sert qu'à l'affichage du nombre d'avaries. */
  async function poserBlocage(ident, reason) {
    if (!ident || ident.isTest) return null;
    var x = await db();
    var ref = x.fs.doc(x.db, 'teams', ident.teamCode);
    var snap = await x.fs.getDoc(ref);
    var data = snap.exists() ? (snap.data() || {}) : {};
    var ancien = (data.matelotLocks || {})[ident.memberKey] || null;
    var nextFail = Number((ancien && ancien.failCount) || 0) + 1;
    var hours = heuresBlocage(nextFail);
    var until = new Date(Date.now() + hours * 3600e3).toISOString();
    var patch = {};
    patch['matelotLocks.' + ident.memberKey] = {
      name: ident.name, failCount: nextFail, lastLockHours: hours,
      lockedUntil: until, reason: reason || '', blockedAt: new Date().toISOString()
    };
    patch.failCount = Number(data.failCount || 0) + 1;
    patch.lastEvent = 'matelot_blocked';
    await x.fs.updateDoc(ref, patch);
    return { failCount: nextFail, hours: hours, lockedUntil: until };
  }

  /* Palier franchi : TOUT blocage personnel encore actif s'efface pour
     l'équipage — même règle que advanceTeam() du Palier 1 (un matelot
     qui réussit redonne la mission à ses camarades). failCount est
     CONSERVÉ : seule la mise à l'écart s'efface. */
  async function leverBlocages(teamCode, etape) {
    try {
      var x = await db();
      var ref = x.fs.doc(x.db, 'teams', normalize(teamCode));
      var snap = await x.fs.getDoc(ref);
      if (!snap.exists()) return 0;
      var data = snap.data() || {};
      var locks = Object.assign({}, data.matelotLocks || {});
      var maintenant = Date.now();
      var instant = new Date().toISOString();
      var leves = 0;
      Object.keys(locks).forEach(function (k) {
        var l = locks[k];
        if (l && l.lockedUntil && new Date(l.lockedUntil).getTime() > maintenant) {
          locks[k] = Object.assign({}, l, {
            lockedUntil: null, liftedByStep: etape || '', liftedAt: instant
          });
          leves++;
        }
      });
      if (leves > 0) await x.fs.updateDoc(ref, { matelotLocks: locks });
      return leves;
    } catch (e) { return 0; }
  }

  window.NautilusBlocages = {
    db: db,
    identiteCourante: identiteCourante,
    blocageActif: blocageActif,
    poserBlocage: poserBlocage,
    leverBlocages: leverBlocages,
    heuresBlocage: heuresBlocage,
    memberKey: memberKey,
    CODE_TEST: CODE_TEST
  };
})();
