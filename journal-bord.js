/* =============================================================
   JOURNAL DE BORD — « Activités de l'équipage » — CODE COMMUN À TOUS
   LES PALIERS, ACTIVITÉ PARTAGÉE DE L'ÉQUIPAGE.

   Ce module remplace l'ancien journal LOCAL (chaque appareil ne voyait
   que SES propres événements, limité à 10 lignes en mémoire vive) par
   un journal PARTAGÉ : chaque événement est écrit dans Firestore, dans
   la sous-collection teams/{equipage}/journal, et tous les matelots de
   l'équipage le voient en direct, où qu'ils soient (téléphone d'un
   coéquipier, spectateur…).

   AFFICHAGE :
     • les 10 lignes les plus récentes sont visibles d'emblée ;
     • au-delà, un bouton « ⏬ Voir toute l'activité de l'équipage (N) »
       déplie la suite cachée en dessous — le matelot relit alors toute
       l'activité de son équipage depuis le début de la mission ;
     • le tri est du plus récent (en haut) au plus ancien ;
     • les activités sont GROUPÉES PAR MATELOT : chaque matelot a son
       bloc, ouvert par une pastille ronde à son initiale (couleur
       stable par nom) suivie de son nom — ses activités se lisent
       indépendamment de celles des autres.

   REPLI LOCAL : joueur anonyme, compte de test (ZZZZ-0000) ou appareil
   hors ligne → aucune lecture/écriture Firestore ; le journal retombe
   sur son comportement historique (les 10 dernières lignes locales).
   Rien ne casse : si les règles Firestore ne sont pas encore déployées,
   les écritures échouent doucement et le journal reste local.

   La page doit contenir le bloc HTML (inchangé) :

     <section class="card" id="logCard">
       <h2>📜 JOURNAL DE BORD</h2>
       <div class="body">
         <div class="morse-log">
           <h3>Activités de l'équipage</h3>
           <ul id="morse-log-list"></ul>
         </div>
       </div>
     </section>

   … et la feuille css/palier1.css (styles .morse-log, .ml-groupe). Le
   bouton « voir la suite » et la liste dépliée sont injectés par ce
   script, sans toucher au HTML de chaque page. L'API reste identique :

     JournalDeBord.addLogEntry(texte, kind, quand, auteur?)
       kind : 'info' | 'success' | 'warning' | 'danger'
       quand : Date optionnelle (sinon : maintenant)
       auteur : nom du matelot (optionnel — sinon le nom du matelot
       connecté sur l'appareil est résolu automatiquement)
       Seules les balises <b></b> sont autorisées dans le texte.
     JournalDeBord.clearLog()
     JournalDeBord.afficher(id?)  — montre la carte (défaut #logCard)
     JournalDeBord.masquer(id?)   — masque la carte

   Utilisation : <script src="journal-bord.js?v=3"></script>
   ============================================================= */
(function () {
  'use strict';

  var CODE_TEST = 'ZZZZ-0000';
  var N_VISIBLE = 10;        // lignes visibles d'emblée
  var MAX_LOCAL = 200;       // garde-fou du repli local (mémoire)

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

  /* Échappe TOUT — un nom de matelot est saisi librement et ne doit
     jamais pouvoir injecter du code — puis on ne rétablit que <b> et
     </b>, les deux seules balises autorisées dans le journal. */
  function journalEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var COLORS = {
    info:    { dot: '#8ee7ff', border: 'rgba(142,231,255,.4)' },
    success: { dot: '#5be09b', border: 'rgba(91,255,156,.5)' },
    warning: { dot: '#ffd36c', border: 'rgba(245,176,39,.5)' },
    danger:  { dot: '#ff7b72', border: 'rgba(255,75,62,.55)' }
  };

  /* Palette de couleurs STABLE par matelot : chaque nom tombe toujours
     sur la même teinte (hachage djb2), pour qu'un matelot soit repéré
     d'un coup d'œil d'une session à l'autre. Teintes vives, lisibles sur
     le fond sombre, distinctes les unes des autres. */
  var MATELOT_COLORS = [
    '#ff8a80', '#8ee7ff', '#5be09b', '#ffd36c', '#ff9ff3',
    '#c39bff', '#ffb26b', '#7be7c2', '#9fb8ff', '#f8e78a'
  ];
  function couleurMatelot(nom) {
    var s = String(nom || '').trim().toUpperCase();
    if (!s) return '#8ee7ff';
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return MATELOT_COLORS[Math.abs(h) % MATELOT_COLORS.length];
  }

  function lireParam(nom) {
    try {
      var m = location.search.match(new RegExp('[?&]' + nom + '=([^&]+)'));
      return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    } catch (e) { return ''; }
  }
  function codeMatelotCourant() {
    var fromUrl = (lireParam('m') || lireParam('matelot')).trim().toUpperCase();
    if (fromUrl) {
      try { localStorage.setItem('nautilusMatelotCode', fromUrl); } catch (e) {}
      return fromUrl;
    }
    try { return (localStorage.getItem('nautilusMatelotCode') || '').trim().toUpperCase(); } catch (e) { return ''; }
  }
  function estModeTest() {
    try {
      if (codeMatelotCourant() === CODE_TEST) return true;
      if (window.Nautilus && window.Nautilus.isTestMode && window.Nautilus.isTestMode()) return true;
    } catch (e) {}
    return false;
  }
  function equipeDepuisMemoire() {
    var code = lireParam('code').trim().toUpperCase();
    if (code) return code;
    try {
      var c = (localStorage.getItem('nautilusCurrentTeam') || '').trim().toUpperCase();
      return c || null;
    } catch (e) { return null; }
  }

  /* Firebase mutualisé : getApp() si une page (palier1, matelot-blocages…)
     a déjà initialisé l'app — jamais deux initializeApp. */
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

  /* Équipage du matelot connecté — la FICHE fait foi (index global
     matelots/{code}, même règle que matelot-blocages.js). Résolution
     autonome : ce module ne dépend d'aucun autre script de la page.
     Mode test / anonyme → null → repli local.
     Au passage, on retient aussi le NOM du matelot (_monNom) : c'est lui
     qui servira d'auteur aux activités qu'il écrit, pour le groupement
     par matelot. */
  var _teamPromise = null;
  var _monNom = null;
  function resoudreEquipe() {
    if (_teamPromise) return _teamPromise;
    _teamPromise = new Promise(function (resolve) {
      if (estModeTest()) { resolve(null); return; }
      var code = codeMatelotCourant();
      if (!code) { resolve(equipeDepuisMemoire()); return; }
      db().then(function (x) {
        return x.fs.getDoc(x.fs.doc(x.db, 'matelots', code));
      }).then(function (snap) {
        if (snap && snap.exists() && snap.data().teamCode) {
          var equipe = String(snap.data().teamCode).trim().toUpperCase();
          try { localStorage.setItem('nautilusCurrentTeam', equipe); } catch (e) {}
          if (snap.data().name) _monNom = String(snap.data().name).toUpperCase();
          resolve(equipe);
        } else {
          resolve(equipeDepuisMemoire());
        }
      }).catch(function () { resolve(equipeDepuisMemoire()); });
    });
    return _teamPromise;
  }

  /* ---------- DOM (liste principale + suite dépliée + bouton) ---------- */
  var _listEl = null, _suiteEl = null, _btn = null, _suiteOuverte = false;

  function ensureDom() {
    _listEl = document.getElementById('morse-log-list');
    if (!_listEl) return false;
    if (_suiteEl) return true;
    var parent = _listEl.parentNode;   // .morse-log
    _suiteEl = document.createElement('ul');
    _suiteEl.id = 'morse-log-suite';
    _suiteEl.hidden = true;
    _suiteEl.style.cssText = 'border-top:1px dashed rgba(142,231,255,.22);padding-top:8px;margin-top:4px;';
    _btn = document.createElement('button');
    _btn.type = 'button';
    _btn.id = 'journal-suite-btn';
    _btn.hidden = true;
    _btn.style.cssText = 'display:block;width:100%;margin:12px 0 0;padding:10px 14px;'
      + 'background:rgba(255,255,255,.07);color:#8ee7ff;border:1px solid rgba(142,231,255,.3);'
      + 'border-radius:11px;font:900 13px Arial,Helvetica,sans-serif;letter-spacing:.03em;'
      + 'cursor:pointer;text-align:center;';
    _btn.addEventListener('mouseenter', function () { _btn.style.background = 'rgba(142,231,255,.16)'; });
    _btn.addEventListener('mouseleave', function () { _btn.style.background = 'rgba(255,255,255,.07)'; });
    _btn.addEventListener('click', function () { _suiteOuverte = !_suiteOuverte; render(); });
    parent.insertBefore(_suiteEl, _listEl.nextSibling);
    parent.insertBefore(_btn, _suiteEl.nextSibling);
    return true;
  }

  /* ---------- état ---------- */
  var _mode = 'local';         // 'local' (anonyme/test/hors-ligne) | 'live' (équipage)
  var _entries = [];           // live : entrées Firestore, plus récentes d'abord
  var _localEntries = [];      // repli local, plus récentes d'abord
  var _unsub = null;
  var _liveTentee = false;

  function heureLisible(ts) {
    var t = new Date(ts);
    var p2 = function (n) { return String(n).padStart(2, '0'); };
    return p2(t.getDate()) + '/' + p2(t.getMonth() + 1) + ' '
         + p2(t.getHours()) + ':' + p2(t.getMinutes());
  }

  function entryHtml(e) {
    var c = COLORS[e.kind] || COLORS.info;
    var texteRendu = journalEsc(e.text)
      .replace(/&lt;b&gt;/g, '<b>')
      .replace(/&lt;\/b&gt;/g, '</b>');
    return '<li class="morse-log-entry" style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-left:3px solid ' + c.border + ';background:rgba(0,0,0,.22);border-radius:8px;">'
      + '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + c.dot + ';box-shadow:0 0 8px ' + c.dot + ';flex:0 0 10px;margin-top:5px;"></span>'
      + '<span style="flex:1;min-width:0;color:#dff6ff;line-height:1.4;">' + texteRendu + '</span>'
      + '<span style="flex:0 0 auto;color:rgba(142,231,255,.42);font-size:11px;font-family:Consolas,\'Courier New\',monospace;margin-top:3px;white-space:nowrap;">' + heureLisible(e.ts) + '</span>'
      + '</li>';
  }

  /* Regroupe une liste d'entrées (déjà triées du plus récent au plus
     ancien) PAR MATELOT, en conservant l'ordre de première apparition.
     Chaque groupe est un <li> ouvert par une pastille à l'initiale
     (couleur stable par nom) + le nom du matelot, puis ses activités.
     Les entrées sans auteur vont sous « Équipage ». */
  function groupeHtml(entries) {
    var groupes = [], map = {};
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var cle = String(e.auteur || '').toUpperCase();
      if (!map[cle]) {
        map[cle] = { auteur: e.auteur || null, entrees: [] };
        groupes.push(map[cle]);
      }
      map[cle].entrees.push(e);
    }
    return groupes.map(function (g) {
      var nom = g.auteur || 'Équipage';
      var couleur = couleurMatelot(nom);
      var initiale = nom.charAt(0).toUpperCase();
      return '<li class="ml-groupe">'
        + '<div class="ml-groupe-tete">'
        +   '<span class="ml-groupe-avatar" style="background:' + couleur + '">' + journalEsc(initiale) + '</span>'
        +   '<span class="ml-groupe-nom">' + journalEsc(nom) + '</span>'
        + '</div>'
        + '<ul class="ml-groupe-liste">' + g.entrees.map(entryHtml).join('') + '</ul>'
        + '</li>';
    }).join('');
  }

  function render() {
    ensureDom();
    if (!_listEl) return;
    if (_mode === 'live') {
      var visibles = _entries.slice(0, N_VISIBLE);
      var suite = _entries.slice(N_VISIBLE);
      _listEl.innerHTML = groupeHtml(visibles);
      if (_suiteEl) {
        _suiteEl.innerHTML = groupeHtml(suite);
        _suiteEl.hidden = !(_suiteOuverte && suite.length > 0);
      }
      if (_btn) {
        if (suite.length > 0) {
          _btn.hidden = false;
          _btn.textContent = _suiteOuverte
            ? '⏫ Réduire — masquer la suite'
            : '⏬ Voir toute l’activité de l’équipage (' + _entries.length + ')';
        } else {
          _btn.hidden = true;
        }
      }
    } else {
      _listEl.innerHTML = groupeHtml(_localEntries.slice(0, N_VISIBLE));
      if (_suiteEl) { _suiteEl.innerHTML = ''; _suiteEl.hidden = true; }
      if (_btn) _btn.hidden = true;
    }
  }

  /* ---------- écriture Firestore (activité partagée) ---------- */
  function ecrireEntree(e) {
    resoudreEquipe().then(function (teamCode) {
      if (!teamCode) return;
      /* Auteur : explicite (paramètre) sinon le nom du matelot connecté
         sur cet appareil (résolu au passage par resoudreEquipe). */
      var auteur = e.auteur || _monNom || null;
      db().then(function (x) {
        return x.fs.addDoc(x.fs.collection(x.db, 'teams', teamCode, 'journal'), {
          ts: e.ts,
          kind: e.kind,
          text: e.text,
          auteur: auteur
        });
      }).catch(function () { /* hors ligne ou règles non déployées : repli local */ });
    }).catch(function () {});
  }

  /* ---------- écoute temps réel de l'équipage ---------- */
  function activerModeLive() {
    if (_liveTentee) return;
    _liveTentee = true;
    resoudreEquipe().then(function (teamCode) {
      if (!teamCode) { _mode = 'local'; render(); return; }
      db().then(function (x) {
        _mode = 'live';
        var q = x.fs.query(
          x.fs.collection(x.db, 'teams', teamCode, 'journal'),
          x.fs.orderBy('ts', 'desc')
        );
        _unsub = x.fs.onSnapshot(q, function (snap) {
          var liste = [];
          snap.forEach(function (d) {
            var data = d.data() || {};
            liste.push({ ts: data.ts, kind: data.kind || 'info', text: data.text || '', auteur: data.auteur || null });
          });
          _entries = liste;
          render();
        }, function () { /* lecture indisponible : on garde l'état précédent */ });
      }).catch(function () { _mode = 'local'; render(); });
    }).catch(function () { _mode = 'local'; render(); });
  }

  /* ---------- API publique ---------- */
  function addLogEntry(text, kind, quand, auteur) {
    kind = kind || 'info';
    var t = (quand instanceof Date) ? quand : new Date();
    var e = { ts: t.toISOString(), kind: kind, text: String(text == null ? '' : text), auteur: auteur || null };

    /* Repli local : insertion TRIÉE (du plus récent au plus ancien),
       chronologie garantie même quand `quand` est antérieur à maintenant
       (l'instant relevé avant une attente réseau). */
    var ms = t.getTime();
    var place = null;
    for (var i = 0; i < _localEntries.length; i++) {
      if (new Date(_localEntries[i].ts).getTime() <= ms) { place = i; break; }
    }
    if (place === null) _localEntries.push(e);
    else _localEntries.splice(place, 0, e);
    if (_localEntries.length > MAX_LOCAL) _localEntries.length = MAX_LOCAL;

    activerModeLive();
    if (_mode !== 'live') render();

    /* Activité PARTAGÉE : écrite pour tout l'équipage, en plus du local. */
    ecrireEntree(e);
  }

  function clearLog() {
    _localEntries = [];
    _entries = [];
    render();
  }

  /* Visibilité de la carte journal (le Palier 1 utilise son propre
     $('logCard').style.display ; les deux écrivent la même chose). */
  function afficher(idCarte) {
    var el = document.getElementById(idCarte || 'logCard');
    if (el) el.style.display = 'block';
  }
  function masquer(idCarte) {
    var el = document.getElementById(idCarte || 'logCard');
    if (el) el.style.display = 'none';
  }

  window.JournalDeBord = { addLogEntry: addLogEntry, clearLog: clearLog, afficher: afficher, masquer: masquer };

  /* Démarrage : la résolution d'équipage + l'écoute temps réel partent dès
     que le DOM est prêt (le script est différé sur le Palier 1, placé en
     bas de page sur les paliers suivants). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { activerModeLive(); });
  } else {
    activerModeLive();
  }
})();
