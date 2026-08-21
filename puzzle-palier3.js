/* =============================================================
   PUZZLE PHOTO DU LIEU — moteur de l'épreuve du Palier 3
   (puzzle-palier3.js)

   ÉPREUVE : reconstituer la PHOTO du lieu où est scellé le QR Code
   du palier suivant. La photo est découpée en cols × rows éclats
   (36 par défaut) et MÉLANGÉS sous la grille : impossible de lire
   la photo d'un coup d'œil tant qu'elle n'est pas remontée.

   • Glisser un éclat au bon endroit → il se VERROUILLE.
   • Glisser au mauvais endroit → il revient (sans pénalité : on
     explore librement).
   • « 🔎 Révéler une pièce » : le sonar pose tout seul la prochaine
     pièce. Chaque aide compte comme UNE ERREUR — 3 erreurs =
     remontée personnelle (règle globale du jeu, matelot-blocages).

   Utilisation :
     window.NautilusPuzzle.init(hote, {
       image: 'assets/palier3-lieu.jpg',
       cols: 6, rows: 6,
       maxErreurs: 3,
       onErreur: function (n, max) { … },
       onVictoire: function () { … }
     });
   ============================================================= */
(function () {
  'use strict';
  if (window.NautilusPuzzle) return;

  var GAP = 18;          // espace entre la grille et la pioche

  function init(host, opts) {
    if (!host || !opts || !opts.image) return;
    var cols = Math.max(2, Number(opts.cols) || 6);
    var rows = Math.max(2, Number(opts.rows) || 6);
    var image = opts.image;
    var maxErreurs = Number(opts.maxErreurs) || 3;
    var onErreur = opts.onErreur || function () {};
    var onVictoire = opts.onVictoire || function () {};

    var N = cols * rows;
    var erreurs = 0;
    var fini = false;
    var locked = {};              // idx -> true
    var pieces = {};              // idx -> élément DOM
    var boardW = 0, boardH = 0, pieceW = 0, pieceH = 0;
    var zTop = 10;
    var dragEl = null, grabDX = 0, grabDY = 0;
    var stageRect = null;

    host.innerHTML =
      '<div class="puzzle">'
      + '<div class="puzzle-status" id="pzStatus"></div>'
      + '<div class="puzzle-stage" id="pzStage">'
      +   '<div class="puzzle-board" id="pzBoard"></div>'
      +   '<div class="puzzle-tray" id="pzTray"></div>'
      + '</div>'
      + '<div class="puzzle-actions">'
      +   '<button type="button" class="puzzle-btn" id="pzReveal">🔎 Révéler une pièce</button>'
      + '</div>'
      + '<div class="puzzle-feedback" id="pzFeedback"></div>'
      + '</div>';

    var stage = host.querySelector('#pzStage');
    var board = host.querySelector('#pzBoard');
    var tray = host.querySelector('#pzTray');
    var statusEl = host.querySelector('#pzStatus');
    var revealBtn = host.querySelector('#pzReveal');
    var feedback = host.querySelector('#pzFeedback');

    function majStatus() {
      var posees = 0;
      for (var k in locked) if (locked[k]) posees++;
      if (statusEl) {
        statusEl.textContent = posees >= N
          ? '✅ Photo reconstituée !'
          : '🧩 ' + posees + ' / ' + N + ' pièces placées';
      }
      if (revealBtn) {
        var rest = maxErreurs - erreurs;
        if (rest <= 0) {
          revealBtn.disabled = true;
          revealBtn.textContent = '🔎 Plus de révélation possible';
        } else {
          revealBtn.disabled = false;
          revealBtn.textContent = '🔎 Révéler une pièce (' + rest + ')';
        }
      }
    }

    function feedbackMsg(html, kind) {
      if (!feedback) return;
      feedback.innerHTML = html;
      feedback.className = 'puzzle-feedback' + (kind ? ' is-' + kind : '');
      clearTimeout(feedback._t);
      feedback._t = setTimeout(function () {
        feedback.innerHTML = '';
        feedback.className = 'puzzle-feedback';
      }, 2200);
    }

    function melanger(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
    }

    function fabriquerPiece(idx) {
      var el = document.createElement('div');
      el.className = 'puzzle-piece';
      el.style.width = pieceW + 'px';
      el.style.height = pieceH + 'px';
      el.style.backgroundImage = 'url("' + image + '")';
      el.style.backgroundSize = boardW + 'px ' + boardH + 'px';
      el.style.backgroundPosition =
        (-(idx % cols) * pieceW) + 'px ' + (-Math.floor(idx / cols) * pieceH) + 'px';
      el.setAttribute('data-idx', String(idx));
      el.setAttribute('aria-label', 'Pièce ' + (idx + 1));
      return el;
    }

    /* Pose chaque pièce : verrouillée → sur la grille ; sinon → dans la
       pioche (repliée, sans trou). Tout est positionné en coordonnées de
       la scène : la grille occupe (0,0)-(boardW,boardH), la pioche est
       décalée sous la grille de GAP. */
    function positionner() {
      var k = 0;
      for (var i = 0; i < N; i++) {
        var el = pieces[i];
        if (!el) continue;
        if (locked[i]) {
          el.classList.add('puzzle-piece--lock');
          el.style.left = (i % cols) * pieceW + 'px';
          el.style.top = Math.floor(i / cols) * pieceH + 'px';
        } else {
          el.classList.remove('puzzle-piece--lock');
          el.style.left = (k % cols) * pieceW + 'px';
          el.style.top = (boardH + GAP + Math.floor(k / cols) * pieceH) + 'px';
          k++;
        }
      }
      var trayH = Math.max(pieceH, Math.ceil(k / cols) * pieceH);
      tray.style.height = trayH + 'px';
      stage.style.height = (boardH + GAP + trayH) + 'px';
      majStatus();
    }

    function activerDrag() {
      function onDown(e) {
        if (fini) return;
        var el = e.target;
        if (!el || !el.classList || !el.classList.contains('puzzle-piece')) return;
        var idx = Number(el.dataset.idx);
        if (locked[idx]) return;
        e.preventDefault();
        dragEl = el;
        stageRect = stage.getBoundingClientRect();
        grabDX = e.clientX - stageRect.left - parseFloat(el.style.left || 0);
        grabDY = e.clientY - stageRect.top - parseFloat(el.style.top || 0);
        el.style.zIndex = ++zTop;
        el.classList.add('puzzle-piece--drag');
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      }
      function onMove(e) {
        if (!dragEl || !stageRect) return;
        dragEl.style.left = (e.clientX - stageRect.left - grabDX) + 'px';
        dragEl.style.top = (e.clientY - stageRect.top - grabDY) + 'px';
      }
      function onUp(e) {
        if (!dragEl) return;
        var el = dragEl;
        var idx = Number(el.dataset.idx);
        var cx = parseFloat(el.style.left) + pieceW / 2;
        var cy = parseFloat(el.style.top) + pieceH / 2;

        var cible = -1;
        var meilleur = pieceW * 0.55;
        for (var i = 0; i < N; i++) {
          if (locked[i]) continue;
          var sx = (i % cols) * pieceW + pieceW / 2;
          var sy = Math.floor(i / cols) * pieceH + pieceH / 2;
          var dx = cx - sx, dy = cy - sy;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < meilleur) { meilleur = d; cible = i; }
        }

        el.classList.remove('puzzle-piece--drag');
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
        dragEl = null;

        if (cible === idx) {
          locked[idx] = true;
          positionner();
          var tout = true;
          for (var j = 0; j < N; j++) if (!locked[j]) { tout = false; break; }
          if (tout) {
            fini = true;
            setTimeout(onVictoire, 400);
          }
        } else {
          positionner();
          if (cible >= 0) feedbackMsg('✗ Cette pièce ne va pas là.', 'warn');
        }
      }
      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('pointercancel', onUp);
    }

    function reveler() {
      if (fini) return;
      if (erreurs >= maxErreurs) return;
      var cible = -1;
      for (var i = 0; i < N; i++) if (!locked[i]) { cible = i; break; }
      if (cible < 0) return;

      erreurs++;
      locked[cible] = true;
      positionner();
      feedbackMsg('🔎 Le sonar a posé une pièce.', '');

      var tout = true;
      for (var j = 0; j < N; j++) if (!locked[j]) { tout = false; break; }
      if (tout) {
        fini = true;
        setTimeout(onVictoire, 400);
        return;
      }
      onErreur(erreurs, maxErreurs);
    }

    revealBtn.addEventListener('click', reveler);

    /* Chargement de la photo, puis construction. */
    var img = new Image();
    img.onload = function () {
      var maxW = Math.min(host.clientWidth || 480, 560);
      boardW = Math.round(maxW);
      boardH = Math.max(140, Math.round(boardW * img.naturalHeight / Math.max(1, img.naturalWidth)));
      pieceW = boardW / cols;
      pieceH = boardH / rows;
      board.style.width = boardW + 'px';
      board.style.height = boardH + 'px';

      for (var i = 0; i < N; i++) {
        var s = document.createElement('div');
        s.className = 'puzzle-slot';
        s.style.left = (i % cols) * pieceW + 'px';
        s.style.top = Math.floor(i / cols) * pieceH + 'px';
        s.style.width = pieceW + 'px';
        s.style.height = pieceH + 'px';
        board.appendChild(s);
      }

      var ordre = [];
      for (var o = 0; o < N; o++) ordre.push(o);
      melanger(ordre);
      for (var p = 0; p < N; p++) {
        var el = fabriquerPiece(ordre[p]);
        pieces[ordre[p]] = el;
        stage.appendChild(el);
      }
      positionner();
      activerDrag();
    };
    img.onerror = function () {
      if (statusEl) statusEl.textContent = '📷 Photo du lieu introuvable — préviens l’organisation.';
      if (revealBtn) revealBtn.disabled = true;
    };
    img.src = image;
  }

  window.NautilusPuzzle = { init: init };
})();
