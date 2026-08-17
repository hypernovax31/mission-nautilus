/* =============================================================
   RECORDS DE RÉSOLUTION DES PALIERS — CODE COMMUN À TOUS LES PALIERS
   (records-palier.js)

   Sur l'écran de victoire, un menu déroulant DISCRET affiche les
   records de temps de TOUS les matelots / équipages (y compris le
   vôtre, marqué « (toi) »), classés du plus rapide au plus lent.

   OÙ VIVENT LES RECORDS :
     Firestore, document unique game/records (couvert par les règles
     « game/{docId} » existantes — aucune nouvelle règle requise).
     Chaque palier y tient un tableau :

       game/records = {
         start:  [ { s: 42, m: 'Alice', e: 'Nemo', at: '…' }, … ],
         livres: [ … ], son: [ … ], …
       }

     s  = durée de résolution en secondes,
     m  = nom du matelot, e = nom de l'équipage, at = horodatage.
     L'écriture passe par setDoc + arrayUnion (idempotent : chaque
     entrée porte son horodatage, donc jamais de doublon).

   ÉCRITURE : window.NautilusRecords.enregistrer({ stepId, seconds,
     matelot, equipage }) — silencieuse (toute erreur réseau est
     ignorée : un record ne doit jamais faire échouer la victoire).

   LECTURE : window.NautilusRecords.chargerEtRendre(hote, { stepId,
     moi }) — lit, trie (plus rapide d'abord), marque le matelot
     courant (« moi ») d'un « (toi) », et rend le <details> dans
     l'élément hôte. Chacun voit donc AUSSI son propre record.
   ============================================================= */
(function () {
  'use strict';

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
  var MAX_AFFICHES = 50;   /* le déroulant reste discret, même après des dizaines de parties */

  /* Firebase mutualisé (même règle que matelot-blocages.js) : getApp()
     si la page a déjà initialisé l'app — jamais deux initializeApp. */
  var _dbPromise = null;
  function db() {
    if (!_dbPromise) {
      _dbPromise = Promise.all([import(URL_APP), import(URL_FS)]).then(function (mods) {
        var appMod = mods[0], fsMod = mods[1];
        var app = (appMod.getApps && appMod.getApps().length)
          ? appMod.getApp()
          : appMod.initializeApp(FIREBASE_CONFIG);
        return { db: fsMod.getFirestore(app), fs: fsMod };
      });
    }
    return _dbPromise;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function norme(s) { return String(s || '').trim(); }
  function formatTemps(sec) {
    var n = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(n / 60), s = n % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* Consigne le record du palier dans game/records[stepId]. */
  async function enregistrer(opts) {
    opts = opts || {};
    if (!opts.stepId) return;
    try {
      var x = await db();
      var ref = x.fs.doc(x.db, 'game', 'records');
      var entree = {
        s: Math.max(0, Math.round(Number(opts.seconds) || 0)),
        m: norme(opts.matelot) || 'Un matelot',
        e: norme(opts.equipage),
        at: new Date().toISOString()
      };
      var patch = {};
      patch[opts.stepId] = x.fs.arrayUnion(entree);
      await x.fs.setDoc(ref, patch, { merge: true });
    } catch (e) { /* silencieux : le record ne doit jamais casser la victoire */ }
  }

  /* Lit les records du palier et rend le menu déroulant dans `hote`. */
  async function chargerEtRendre(hote, opts) {
    opts = opts || {};
    if (!hote || !opts.stepId) return;
    var moi = norme(opts.moi);
    var liste = [];
    try {
      var x = await db();
      var snap = await x.fs.getDoc(x.fs.doc(x.db, 'game', 'records'));
      if (snap.exists()) liste = (snap.data() || {})[opts.stepId] || [];
    } catch (e) { /* hors ligne : on affiche l'état vide, sans erreur */ }
    liste = liste
      .filter(function (r) { return !!r; })
      .map(function (r) {
        return {
          s: r.s, m: r.m, e: r.e, at: r.at,
          aMoi: !!(moi && norme(r.m) === moi)
        };
      })
      .sort(function (a, b) { return (Number(a.s) || 0) - (Number(b.s) || 0); })
      .slice(0, MAX_AFFICHES);
    rendre(hote, liste);
  }

  function rendre(hote, liste) {
    var corps;
    if (!liste.length) {
      corps = '<li class="won-records-empty">Aucun record pour l’instant.</li>';
    } else {
      corps = liste.map(function (r, i) {
        var equipe = r.e ? ' <em>· ' + esc(r.e) + '</em>' : '';
        var toi = r.aMoi ? ' <span class="won-records-self">(toi)</span>' : '';
        return '<li class="won-records-item' + (r.aMoi ? ' won-records-item--self' : '') + '">'
          + '<span class="won-records-rank">' + (i + 1) + '</span>'
          + '<span class="won-records-who">' + esc(r.m) + equipe + toi + '</span>'
          + '<span class="won-records-time">' + formatTemps(r.s) + '</span>'
          + '</li>';
      }).join('');
    }
    hote.innerHTML = ''
      + '<details class="won-records">'
      +   '<summary>⏱️ Records de résolution</summary>'
      +   '<ol class="won-records-list">' + corps + '</ol>'
      + '</details>';
  }

  window.NautilusRecords = { enregistrer: enregistrer, chargerEtRendre: chargerEtRendre };
})();
