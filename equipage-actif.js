/* =============================================================
   ÉQUIPAGE ACTIF EN PLONGÉE — code commun à tous les paliers ≥ 2
   (equipage-actif.js)

   Reprend À L'IDENTIQUE le bloc « ⚓ ÉQUIPAGE ACTIF EN PLONGÉE » du
   Palier 1 (palier1.html) : la liste des matelots de l'équipage
   connectés en direct — en train de jouer ou en spectateur. Chaque
   palier charge ce script et dispose du même suivi de présence.

   La page doit contenir le bloc HTML (même structure que le Palier 1) :

     <section class="card" id="teamCard">
       <h2>⚓ ÉQUIPAGE ACTIF EN PLONGÉE</h2>
       <div class="body">
         <div class="crew" id="crewList"></div>
       </div>
     </section>

   … et la feuille css/palier1.css (styles .crew / .crew-member /
   .crew-name / .crew-meta), chargée par toutes les pages de palier.

   Présence : chaque matelot identifié écrit sa clé
   (onlineMatelots[memberKey]) toutes les 30 s, exactement comme le
   Palier 1. La liste ne montre que les matelots dont le dernier
   battement date de moins de 90 s (moi y compris — « (toi) »).

   Mode test (ZZZZ-0000) : le compte fantôme n'appartient à aucun
   équipage — aucune lecture, aucune écriture, la liste reste vide.

   Utilisation : <script src="equipage-actif.js?v=1"></script>
                 <script>window.EquipageActif.init();</script>
   ============================================================= */
(function () {
  'use strict';
  if (window.EquipageActif) return;

  var CODE_TEST = 'ZZZZ-0000';
  var PRESENCE_FRAICHE_MS = 90 * 1000;

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

  var _teamCode = null;
  var _meKey = null;
  var _unsub = null;
  var _hb = null;

  function renderCrew(team) {
    var list = document.getElementById('crewList');
    if (!list || !team) return;
    var members = (team.members || []).filter(function (m) { return !estMembreTest(m); });
    var vus = team.onlineMatelots || {};
    var maintenant = Date.now();
    var connectes = members.filter(function (m) {
      var cle = m.memberKey || memberKey(m.name || '');
      if (_meKey && cle === _meKey) return true;   // moi : connecté
      var vu = vus[cle] ? new Date(vus[cle]).getTime() : 0;
      return (maintenant - vu) < PRESENCE_FRAICHE_MS;
    });
    list.innerHTML = connectes.map(function (m) {
      var isMe = _meKey && (m.memberKey === _meKey);
      return '<div class="crew-member ' + (isMe ? 'self' : '') + '">'
        + '<div class="crew-name">' + esc(m.name) + (isMe ? ' (toi)' : '') + '</div>'
        + '<div class="crew-meta">' + esc(m.service || '—') + '</div>'
        + '</div>';
    }).join('') || '<div style="color:#9bc4d4;font-size:13px;grid-column:1/-1;">Aucun matelot connecté pour le moment.</div>';
  }

  function heartbeat() {
    var B = window.NautilusBlocages;
    if (!B || !B.db || !_teamCode || !_meKey) return;
    var now = new Date().toISOString();
    var patch = {};
    patch['onlineMatelots.' + _meKey] = now;
    patch.updatedAt = now;
    B.db().then(function (x) {
      return x.fs.updateDoc(x.fs.doc(x.db, 'teams', _teamCode), patch);
    }).catch(function () { /* présence non écrite : la liste locale continue */ });
  }

  function init() {
    var B = window.NautilusBlocages;
    if (!B || !B.identiteCourante) return;
    B.identiteCourante().then(function (ident) {
      /* Mode test / matelot non identifié : aucune équipe à afficher. */
      if (!ident || ident.isTest || !ident.teamCode) {
        renderCrew({ members: [] });
        return;
      }
      _teamCode = ident.teamCode;
      _meKey = ident.memberKey;

      heartbeat();
      _hb = setInterval(heartbeat, 30000);

      B.db().then(function (x) {
        _unsub = x.fs.onSnapshot(
          x.fs.doc(x.db, 'teams', _teamCode),
          function (snap) {
            if (snap && snap.exists()) renderCrew(snap.data());
          },
          function () { /* lecture indisponible : on garde l'état précédent */ }
        );
      }).catch(function () {});
    }).catch(function () {
      renderCrew({ members: [] });
    });
  }

  window.EquipageActif = { init: init, renderCrew: renderCrew };
})();
