/* =============================================================
   ÉQUIPAGE ACTIF EN PLONGÉE — code commun à tous les paliers ≥ 2
   (equipage-actif.js)

   REFONTE « PLONGÉE GLOBALE » : le bloc affiche désormais, en temps
   réel, TOUS les matelots en plongée, TOUTES équipes confondues (pas
   seulement l'équipage du matelot connecté). Chaque matelot est rangé
   dans son équipage, reconnaissable à la couleur de celui-ci.

   Présence : chaque matelot identifié écrit sa clé
   (onlineMatelots[memberKey]) toutes les 15 s. La liste ne montre que
   les matelots dont le dernier battement date de moins de 30 s (moi y
   compris — « (toi) »).

   AFFICHAGE (groupé par équipage, immersif) :
     • un panneau par équipage actif, souligné d'un liseré à la couleur
       de l'équipage et d'un voyant lumineux pulsant ;
     • le nom de l'équipage + le nombre de matelots en plongée ;
     • les matelots en cartes (nom + service), « (toi) » marqué en or.

   Mode test (ZZZZ-0000) : le compte fantôme n'appartient à aucun
   équipage — aucune lecture, aucune écriture, la liste reste vide.

   La page doit contenir le bloc HTML (inchangé) :

     <section class="card" id="teamCard">
       <h2>⚓ ÉQUIPAGE ACTIF EN PLONGÉE</h2>
       <div class="body">
         <div class="crew" id="crewList"></div>
       </div>
     </section>

   … et la feuille css/palier1.css (styles .crew / .crew-group / .crew-member).

   Utilisation : <script src="equipage-actif.js?v=3"></script>
                 <script>window.EquipageActif.init();</script>
   ============================================================= */
(function () {
  'use strict';
  if (window.EquipageActif) return;

  var CODE_TEST = 'ZZZZ-0000';
  /* Fraîcheur acceptée d'un signe de vie. Le battement de cœur part
     toutes les 15 s (et à chaque retour au premier plan) : on tolère
     deux battements manqués avant de considérer le matelot en surface.
     ÉCONOMIE DE BATTERIE : 15 s (et non 5 s) réduit les écritures
     Firestore de ~12/min à ~4/min par matelot actif. */
  var PRESENCE_FRAICHE_MS = 30 * 1000;
  var HEARTBEAT_MS = 15000;

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

  /* Couleurs des équipages — mêmes teintes que TEAM_STYLES de index.html,
     pour que la carte d'équipe, le point sonar et ce bloc restent cohérents. */
  var TEAM_STYLES = {
    NEMO:     { tint: '#0a4fd8', glow: '0,105,255' },
    NAUTILUS: { tint: '#138046', glow: '49,251,142' },
    ARONNAX:  { tint: '#924d06', glow: '252,146,51' },
    NEDLAND:  { tint: '#9f0e3d', glow: '250,42,103' },
    BALEINE:  { tint: '#0f6a6b', glow: '37,191,193' },
    TRITON:   { tint: '#71770b', glow: '225,236,36' },
    DEFAULT:  { tint: '#6a6a6a', glow: '176,176,176' }
  };
  /* Nom propre d'affichage (l'identifiant technique reste en majuscules). */
  var TEAM_NAMES = { NEMO: 'Nemo', NAUTILUS: 'Nautilus', ARONNAX: 'Aronnax', NEDLAND: 'Ned Land' };

  function normalize(s) { return String(s || '').trim().toUpperCase(); }
  function memberKey(name) {
    return normalize(String(name || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, ''));
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Le compte de test ne fait jamais partie d'un équipage : filtré à la
     lecture, comme partout ailleurs dans le jeu. */
  function estMembreTest(m) {
    return !!m && (m.codeMatelot === CODE_TEST || m.memberKey === 'TEST'
      || normalize(m.name || '') === 'TEST');
  }
  function displayTeamName(code, teamName) {
    return TEAM_NAMES[code] || teamName || code || '—';
  }
  function teamStyle(code) { return TEAM_STYLES[code] || TEAM_STYLES.DEFAULT; }

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

  var _meKey = null;
  var _unsub = null;
  var _hb = null;
  var _lastTeams = [];        // dernier état connu de la collection `teams`
  var _refreshTimer = null;   // re-rendu local de la présence

  /* Identifiant d'appareil PERSISTANT (même clé que index.html) : sert à
     tenir onlinePlayers à jour sur les pages de palier. */
  function getClientId() {
    try {
      var id = localStorage.getItem('nautilusClientId');
      if (!id) {
        id = 'P-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        localStorage.setItem('nautilusClientId', id);
      }
      return id;
    } catch (e) {}
    return 'P-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }
  var _clientId = getClientId();

  /* Rend un panneau par équipage actif : liseré + voyant à la couleur de
     l'équipage, nom, compteur, puis les matelots en cartes. */
  function renderCrew(teams) {
    var list = document.getElementById('crewList');
    if (!list) return;
    var maintenant = Date.now();
    var html = '';
    var groupes = 0;
    var total = 0;

    (teams || []).forEach(function (team) {
      if (!team) return;
      var members = (team.members || []).filter(function (m) { return !estMembreTest(m); });
      var vus = team.onlineMatelots || {};
      var connectes = members.filter(function (m) {
        var cle = m.memberKey || memberKey(m.name || '');
        if (_meKey && cle === _meKey) return true;   // moi : connecté
        var vu = vus[cle] ? new Date(vus[cle]).getTime() : 0;
        return (maintenant - vu) < PRESENCE_FRAICHE_MS;
      });
      if (!connectes.length) return;

      var st = teamStyle(team.teamCode);
      var nom = displayTeamName(team.teamCode, team.teamName);
      groupes++;
      total += connectes.length;

      var cartes = connectes.map(function (m) {
        var cle = m.memberKey || memberKey(m.name || '');
        var isMe = _meKey && (cle === _meKey);
        return '<div class="crew-member' + (isMe ? ' self' : '') + '">'
          + '<div class="crew-name">' + esc(m.name) + (isMe ? ' (toi)' : '') + '</div>'
          + '<div class="crew-meta">' + esc(m.service || '—') + '</div>'
          + '</div>';
      }).join('');

      html += '<div class="crew-group" style="--team-tint:' + st.tint + ';--team-glow:' + st.glow + '">'
        + '<div class="crew-group-head">'
        +   '<span class="crew-group-dot" aria-hidden="true"></span>'
        +   '<span class="crew-group-name">' + esc(nom) + '</span>'
        +   '<span class="crew-group-count">' + connectes.length
        +     (connectes.length > 1 ? ' matelots en plongée' : ' matelot en plongée') + '</span>'
        + '</div>'
        + '<div class="crew-group-members">' + cartes + '</div>'
        + '</div>';
    });

    var rendu = html
      || '<div class="crew-empty">Aucun matelot en plongée pour le moment.</div>';
    /* ÉCONOMIE DE BATTERIE : on ne touche au DOM QUE si le contenu a
       réellement changé. Sinon chaque battement de présence reconstruisait
       la liste, redémarrait l'animation du voyant et forçait un repaint —
       source de chauffe inutile sur téléphone. */
    if (list.innerHTML !== rendu) list.innerHTML = rendu;

    /* Voyant rouge clignotant du bloc : allumé tant qu'au moins un matelot
       est en plongée (en cours de jeu), éteint dès que la liste se vide. */
    var lamp = document.getElementById('diveLamp');
    if (lamp) {
      var actif = total > 0;
      lamp.classList.toggle('on', actif);
      lamp.setAttribute('title', actif
        ? (total + (total > 1 ? ' matelots en plongée' : ' matelot en plongée'))
        : 'Aucun matelot en plongée');
    }
  }

  /* Battement de présence : PAR MATELOT (onlineMatelots) + PAR APPAREIL
     (onlinePlayers), sur l'équipage du matelot connecté. */
  function heartbeat(teamCode) {
    var B = window.NautilusBlocages;
    if (!B || !B.db || !teamCode || !_meKey) return;
    var now = new Date().toISOString();
    var patch = {};
    patch['onlineMatelots.' + _meKey] = now;
    patch['onlinePlayers.' + _clientId] = now;
    patch.updatedAt = now;
    B.db().then(function (x) {
      return x.fs.updateDoc(x.fs.doc(x.db, 'teams', teamCode), patch);
    }).catch(function () { /* présence non écrite : la liste locale continue */ });
  }

  function init() {
    var B = window.NautilusBlocages;
    if (!B || !B.identiteCourante) return;
    B.identiteCourante().then(function (ident) {
      /* Mode test / matelot non identifié : aucune équipe à afficher. */
      if (!ident || ident.isTest || !ident.teamCode) {
        renderCrew([]);
        return;
      }
      _meKey = ident.memberKey;

      /* Battement de présence : il ne tourne QUE quand la page est
         réellement active. Dès que l'écran est verrouillé, que l'app passe
         en arrière-plan, ou que la page est refermée, on l'arrête : le
         matelot cesse alors d'apparaître « en plongée » au bout de
         PRESENCE_FRAICHE_MS. Avant, le minuteur continuait de tourner en
         arrière-plan et le matelot restait indéfiniment présent alors qu'il
         avait quitté le mini-jeu. */
      var demarrerBattement = function () {
        if (_hb) return;
        heartbeat(ident.teamCode);
        _hb = setInterval(function () { heartbeat(ident.teamCode); }, HEARTBEAT_MS);
      };
      var arreterBattement = function () {
        if (_hb) { clearInterval(_hb); _hb = null; }
      };

      demarrerBattement();

      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') demarrerBattement();
        else arreterBattement();
      });
      window.addEventListener('pageshow', demarrerBattement);
      window.addEventListener('pagehide', arreterBattement);

      /* Écoute TOUTES les équipes en temps réel : chaque matelot en
         plongée, quel que soit son équipage, apparaît / disparaît ici. */
      db().then(function (x) {
        _unsub = x.fs.onSnapshot(x.fs.collection(x.db, 'teams'), function (snap) {
          var teams = [];
          snap.forEach(function (d) { teams.push({ teamCode: d.id, teamName: d.data().teamName, members: d.data().members, onlineMatelots: d.data().onlineMatelots }); });
          _lastTeams = teams;
          renderCrew(teams);
        }, function () { /* lecture indisponible : on garde l'état précédent */ });
        /* Re-rendu périodique : la fraîcheur (onlineMatelots) devient
           « périmée » sans nouvelle écriture Firestore — un matelot parti
           cesse d'écrire, onSnapshot ne se déclenche donc pas et il
           resterait affiché. On filtre donc localement à intervalle fixe.
           ÉCONOMIE DE BATTERIE : 30 s (et non 10 s) — ce minuteur ne sert
           qu'à rattraper les départs, il n'a pas besoin d'être fréquent. */
        if (!_refreshTimer) {
          _refreshTimer = setInterval(function () { renderCrew(_lastTeams); }, 30000);
        }
      }).catch(function () {});
    }).catch(function () {
      renderCrew([]);
    });
  }

  window.EquipageActif = { init: init, renderCrew: renderCrew };
})();
