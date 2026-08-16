/* =============================================================
   JOURNAL DE BORD — « ACTES DE L'ÉQUIPAGE EN DIRECT » — CODE COMMUN
   À TOUS LES PALIERS, ACTIVITÉ PARTAGÉE DE L'ÉQUIPAGE.

   REFONTE « TÉLÉSCRIPTEUR DES PROFONDEURS » (thème 20 000 lieues
   sous les mers) : le bloc ne montre plus que les ACTES de l'épreuve
   faits par un coéquipier, une ligne compacte par acte :
   heure · prénom · action. Plus aucune ligne technique (caméra, QR,
   sas, mode test, messages de bienvenue…) : seul l'essentiel reste.

   AFFICHAGE :
     • seuls les événements marqués `type:'acte'` sont affichés ;
     • chaque acte tient sur UNE ligne : `14:32  JULES  prend les
       commandes` — prénom seul (premier mot du nom), pas de pastille
       ni de code couleur ;
     • les 8 actes les plus récents sont visibles (du plus récent au
       plus ancien), le reste est simplement omis ;
     • la carte reste REPLIABLE : le titre « 📜 JOURNAL DE BORD » est
       un bouton (chevron ▾/▸ + aria-expanded).

   ÉCRITURE :
     • `JournalDeBord.addActe(action, kind, auteur?)` → un ACTE de
       l'épreuve (affiché) ;
     • `JournalDeBord.addLogEntry(texte, kind, quand, auteur?)` →
       consigné en base mais NON affiché (historique technique) ;
     • chaque entrée porte un champ `auteur` (le nom du matelot,
       résolu automatiquement depuis la fiche si non fourni).

   REPLI LOCAL : joueur anonyme, compte de test (ZZZZ-0000) ou appareil
   hors ligne → aucune lecture/écriture Firestore ; le journal retombe
   sur son comportement historique (les derniers actes locaux).

   La page doit contenir le bloc HTML :

     <section class="card" id="logCard">
       <h2>📜 JOURNAL DE BORD</h2>
       <div class="body">
         <div class="morse-log">
           <div class="journal-live">
             <span class="journal-live-dot"></span>
             <span class="journal-live-txt">Actes de l'équipage — en direct</span>
           </div>
           <ul id="morse-log-list"></ul>
         </div>
       </div>
     </section>

   … et la feuille css/palier1.css (styles .morse-log / .journal-*).

   Utilisation : <script src="journal-bord.js?v=5"></script>
   ============================================================= */
(function () {
  'use strict';

  var CODE_TEST = 'ZZZZ-0000';
  var N_VISIBLE = 8;         // actes visibles (les plus récents)
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
     </b>, les deux seules balises autorisées. */
  function journalEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var COLORS = {
    info:    { border: 'rgba(142,231,255,.45)' },
    success: { border: 'rgba(91,255,156,.55)' },
    warning: { border: 'rgba(245,176,39,.55)' },
    danger:  { border: 'rgba(255,75,62,.6)' }
  };

  /* Prénom d'un matelot : le premier mot du nom enregistré, mis en forme
     « Prénom » (majuscule initiale, reste en minuscules). Le nom complet
     en MAJUSCULES (« JULES VERNE ») donne ainsi « Jules », plus léger à
     lire que le nom entier. */
  function prenomMatelot(nom) {
    var s = String(nom || '').trim();
    if (!s) return '';
    var premier = s.split(/\s+/)[0];
    return premier.charAt(0).toUpperCase() + premier.slice(1).toLowerCase();
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

  /* Firebase mutualisé : getApp() si une page a déjà initialisé l'app. */
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

  /* Équipage + nom du matelot connecté (la FICHE fait foi). Mode test /
     anonyme → null → repli local. _monNom sert d'auteur aux actes écrits
     par ce matelot. */
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

  /* ---------- DOM ---------- */
  var _listEl = null;

  function ensureDom() {
    _listEl = document.getElementById('morse-log-list');
    if (!_listEl) return false;
    if (_listEl.dataset.prepare === '1') return true;

    /* REPLI / DÉPLI DE LA CARTE : le titre « 📜 JOURNAL DE BORD » devient
       un bouton. Un chevron à droite indique l'état (▾ ouvert / ▸ fermé),
       et le clic (ou Entrée / Espace au clavier) plie/déplie le contenu. */
    var carte = _listEl.closest ? _listEl.closest('.card') : null;
    if (carte) {
      var tete = carte.querySelector('h2');
      var corps = carte.querySelector('.body');
      if (tete && corps) {
        tete.style.cursor = 'pointer';
        tete.setAttribute('role', 'button');
        tete.setAttribute('tabindex', '0');
        tete.setAttribute('aria-expanded', 'true');
        tete.title = 'Ouvrir ou fermer le journal de bord';
        var chevron = document.createElement('span');
        chevron.className = 'log-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '▾';
        tete.appendChild(chevron);
        var bascule = function () {
          var replie = carte.classList.toggle('log-replie');
          chevron.textContent = replie ? '▸' : '▾';
          tete.setAttribute('aria-expanded', replie ? 'false' : 'true');
        };
        tete.addEventListener('click', bascule);
        tete.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); bascule(); }
        });
      }
    }
    _listEl.dataset.prepare = '1';
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
    return p2(t.getHours()) + ':' + p2(t.getMinutes());
  }

  /* Une ligne d'ACTE : heure · prénom · action, sur un ruban monospace.
     La couleur du liseré gauche (--accent) reflète la nature de l'acte
     (succès, échec, avertissement, info). */
  function acteHtml(e) {
    var c = COLORS[e.kind] || COLORS.info;
    var auteur = e.auteur ? journalEsc(prenomMatelot(e.auteur)) : '';
    var action = journalEsc(e.text)
      .replace(/&lt;b&gt;/g, '<b>')
      .replace(/&lt;\/b&gt;/g, '</b>');
    return '<li class="journal-acte" style="--accent:' + c.border + ';">'
      + '<span class="journal-acte-heure">' + heureLisible(e.ts) + '</span>'
      + (auteur ? '<span class="journal-acte-auteur">' + auteur + '</span>' : '')
      + '<span class="journal-acte-action">' + action + '</span>'
      + '</li>';
  }

  /* Ne garde que les ACTES (type 'acte'), les plus récents d'abord. */
  function actesSeuls(entries) {
    var actes = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].type === 'acte') actes.push(entries[i]);
    }
    return actes.slice(0, N_VISIBLE);
  }

  function render() {
    ensureDom();
    if (!_listEl) return;
    if (_mode === 'live') {
      _listEl.innerHTML = actesSeuls(_entries).map(acteHtml).join('');
    } else {
      _listEl.innerHTML = actesSeuls(_localEntries).map(acteHtml).join('');
    }
  }

  /* ---------- écriture Firestore ---------- */
  function ecrireEntree(e) {
    resoudreEquipe().then(function (teamCode) {
      if (!teamCode) return;
      var auteur = e.auteur || _monNom || null;
      db().then(function (x) {
        return x.fs.addDoc(x.fs.collection(x.db, 'teams', teamCode, 'journal'), {
          ts: e.ts,
          kind: e.kind,
          text: e.text,
          auteur: auteur,
          type: e.type || null
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
            liste.push({ ts: data.ts, kind: data.kind || 'info', text: data.text || '', auteur: data.auteur || null, type: data.type || null });
          });
          _entries = liste;
          render();
        }, function () { /* lecture indisponible : on garde l'état précédent */ });
      }).catch(function () { _mode = 'local'; render(); });
    }).catch(function () { _mode = 'local'; render(); });
  }

  /* ---------- écriture locale (insertion triée du plus récent au plus ancien) ---------- */
  function insererLocalement(e) {
    var ms = new Date(e.ts).getTime();
    var place = null;
    for (var i = 0; i < _localEntries.length; i++) {
      if (new Date(_localEntries[i].ts).getTime() <= ms) { place = i; break; }
    }
    if (place === null) _localEntries.push(e);
    else _localEntries.splice(place, 0, e);
    if (_localEntries.length > MAX_LOCAL) _localEntries.length = MAX_LOCAL;
  }

  /* ---------- API publique ---------- */
  /* ACTE de l'épreuve (affiché). `action` est une phrase courte et nue,
     sans nom ni emoji (le prénom est ajouté à l'affichage). */
  function addActe(action, kind, auteur) {
    kind = kind || 'info';
    var e = {
      ts: new Date().toISOString(),
      kind: kind,
      text: String(action == null ? '' : action),
      auteur: auteur || _monNom || null,
      type: 'acte'
    };
    insererLocalement(e);
    activerModeLive();
    if (_mode !== 'live') render();
    ecrireEntree(e);
  }

  /* Entrée technique : consignée en base, jamais affichée dans le flux. */
  function addLogEntry(text, kind, quand, auteur) {
    kind = kind || 'info';
    var t = (quand instanceof Date) ? quand : new Date();
    var e = { ts: t.toISOString(), kind: kind, text: String(text == null ? '' : text), auteur: auteur || null };
    insererLocalement(e);
    activerModeLive();
    if (_mode !== 'live') render();
    ecrireEntree(e);
  }

  function clearLog() {
    _localEntries = [];
    _entries = [];
    render();
  }

  function afficher(idCarte) {
    var el = document.getElementById(idCarte || 'logCard');
    if (el) el.style.display = 'block';
  }
  function masquer(idCarte) {
    var el = document.getElementById(idCarte || 'logCard');
    if (el) el.style.display = 'none';
  }

  window.JournalDeBord = {
    addActe: addActe,
    addLogEntry: addLogEntry,
    clearLog: clearLog,
    afficher: afficher,
    masquer: masquer
  };

  /* Démarrage : la résolution d'équipage + l'écoute temps réel partent dès
     que le DOM est prêt. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { activerModeLive(); });
  } else {
    activerModeLive();
  }
})();
