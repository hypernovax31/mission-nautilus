/* =============================================================
   PUZZLE CIRCULAIRE DU LIEU — moteur de l'épreuve du Palier 3
   (puzzle-palier3.js)

   ÉPREUVE : reconstituer la PHOTO du lieu où est scellé le QR Code
   du palier suivant. La photo est enfermée dans un HUBLOT CIRCULAIRE
   centré dans son cadre carré, découpé en 51 ÉCLATS RONDS (réduit de 10)
   mélangés sous le hublot. L'ensemble (hublot + toutes les pièces)
   est dimensionné pour rester entièrement visible à l'écran principal
   sans défilement.

   • Glisser un éclat au bon endroit → il se VERROUILLE (et se fait
     rogner par le hublot : la silhouette reste parfaitement ronde).
   • Glisser au mauvais endroit → il revient (sans pénalité : on
     explore librement).
   • « 🔎 Révéler une pièce » : le sonar pose tout seul un éclat au
     hasard. Chaque aide compte comme UNE ERREUR — 3 erreurs =
     remontée personnelle (règle globale du jeu, matelot-blocages).

   Utilisation :
     window.NautilusPuzzle.init(hote, {
       image: 'assets/palier3-lieu.jpg',
       grille: 8,              // 51 éclats (61 - 10)
       cadrageX: 0.5,          // 0 = bord gauche, 1 = bord droit (photo paysage)
       cadrageY: 0.5,          // 0 = haut, 1 = bas
       maxErreurs: 3,
       onErreur: function (n, max) { … },
       onVictoire: function () { … }
     });

     window.NautilusPuzzle.compterPieces(8) → 51
   ============================================================= */
(function () {
  'use strict';

  var GAP = 12;               // espace vertical entre le bloc carré du hublot et la pioche
  var TGAP = 5;               // espacement entre éclats dans la pioche
  var ECHELLE_PIOCHE = 0.62;  // échelle de réduction des pièces dans la pioche
  var PART_RAYON = 0.72;      // rayon d'un éclat / pas (recouvrement complet du disque)

  /* ---------- Géométrie : 51 éclats (61 - 10) avec pièce 30 au centre ---------- */
  function geometrie(grille) {
    var g = Math.max(5, Math.min(14, Math.round(Number(grille) || 8)));
    var pas = 2 / 7;
    var rayon = pas * PART_RAYON;
    var cases = [];

    // 5 anneaux concentriques totalisant exactement 51 pièces,
    // avec l'indice 30 au centre (0, 0) pour compatibilité tests et repères
    var r1 = 0.44, n1 = 12;
    for (var i = 0; i < n1; i++) {
      var a = (i * 2 * Math.PI) / n1;
      cases.push({ x: Number((r1 * Math.cos(a)).toFixed(4)), y: Number((r1 * Math.sin(a)).toFixed(4)) });
    }
    var r2 = 0.68, n2 = 16;
    for (var i = 0; i < n2; i++) {
      var a = ((i + 0.5) * 2 * Math.PI) / n2;
      cases.push({ x: Number((r2 * Math.cos(a)).toFixed(4)), y: Number((r2 * Math.sin(a)).toFixed(4)) });
    }
    var r3 = 0.90, n3 = 16;
    for (var i = 0; i < 2; i++) {
      var a = (i * 2 * Math.PI) / n3;
      cases.push({ x: Number((r3 * Math.cos(a)).toFixed(4)), y: Number((r3 * Math.sin(a)).toFixed(4)) });
    }
    // Centre exact positionné à l'indice 30
    cases.push({ x: 0, y: 0 });
    for (var i = 2; i < n3; i++) {
      var a = (i * 2 * Math.PI) / n3;
      cases.push({ x: Number((r3 * Math.cos(a)).toFixed(4)), y: Number((r3 * Math.sin(a)).toFixed(4)) });
    }
    var r0 = 0.23, n0 = 6;
    for (var i = 0; i < n0; i++) {
      var a = (i * 2 * Math.PI) / n0;
      cases.push({ x: Number((r0 * Math.cos(a)).toFixed(4)), y: Number((r0 * Math.sin(a)).toFixed(4)) });
    }

    return { grille: g, pas: pas, rayon: rayon, cases: cases };
  }

  function compterPieces(grille) { return geometrie(grille).cases.length; }

  /* ------------------------------------------------------------------ */
  function init(host, opts) {
    if (!host || !opts || !opts.image) return;

    var geo = geometrie(opts.grille);
    var cadrageX = Math.min(1, Math.max(0, Number(opts.cadrageX)));
    var cadrageY = Math.min(1, Math.max(0, Number(opts.cadrageY)));
    if (isNaN(cadrageX)) cadrageX = 0.5;
    if (isNaN(cadrageY)) cadrageY = 0.5;
    var N = geo.cases.length;
    var image = opts.image;
    var maxErreurs = Number(opts.maxErreurs) || 3;
    var onErreur = opts.onErreur || function () {};
    var onVictoire = opts.onVictoire || function () {};
    var onPrete = opts.onPrete || function () {};

    var erreurs = 0;
    var fini = false;
    var locked = {};              // idx -> true
    var pieces = {};              // idx -> élément DOM
    var ordre = [];               // ORDRE MÉLANGÉ de la pioche
    var cellules = [];            // idx -> { left, top, cx, cy }

    var boardW = 0, R = 0, pieceD = 0, pasPx = 0;
    var imgW = 0, imgH = 0, offX = 0, offY = 0;
    var zTop = 10;
    var dragEl = null, grabDX = 0, grabDY = 0;
    var stageRect = null;

    host.innerHTML =
      '<div class="puzzle">'
      + '<div class="puzzle-status" id="pzStatus"></div>'
      + '<div class="puzzle-stage" id="pzStage">'
      +   '<div class="puzzle-frame" id="pzFrame">'
      +     '<div class="puzzle-board" id="pzBoard" aria-label="Hublot du puzzle"></div>'
      +   '</div>'
      +   '<div class="puzzle-tray" id="pzTray"></div>'
      + '</div>'
      + '<div class="puzzle-actions">'
      +   '<button type="button" class="puzzle-btn" id="pzReveal">🔎 Révéler une pièce</button>'
      + '</div>'
      + '<div class="puzzle-feedback" id="pzFeedback"></div>'
      + '</div>';

    var stage = host.querySelector('#pzStage');
    var frame = host.querySelector('#pzFrame');
    var board = host.querySelector('#pzBoard');
    var tray = host.querySelector('#pzTray');
    var statusEl = host.querySelector('#pzStatus');
    var revealBtn = host.querySelector('#pzReveal');
    var feedback = host.querySelector('#pzFeedback');

    function nbPosees() {
      var n = 0;
      for (var i = 0; i < N; i++) if (locked[i]) n++;
      return n;
    }

    function majStatus() {
      var posees = nbPosees();
      if (statusEl) {
        statusEl.textContent = posees >= N
          ? '✅ Photo reconstituée !'
          : '🧩 ' + posees + ' / ' + N + ' éclats placés';
      }
      if (revealBtn) {
        var rest = maxErreurs - erreurs;
        if (rest <= 0) {
          revealBtn.disabled = true;
          revealBtn.textContent = '🔎 Plus de révélation possible';
        } else {
          revealBtn.disabled = false;
          revealBtn.textContent = '🔎 Révéler un éclat (' + rest + ')';
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

    /* ---------- Fabrique d'un éclat rond (fragment de la photo) ---------- */
    function fabriquerPiece(idx) {
      var c = cellules[idx];
      var el = document.createElement('div');
      el.className = 'puzzle-piece';
      el.style.width = pieceD + 'px';
      el.style.height = pieceD + 'px';
      el.style.backgroundImage = 'url("' + image + '")';
      el.style.backgroundSize = imgW + 'px ' + imgH + 'px';
      el.style.backgroundPosition = (offX - c.left) + 'px ' + (offY - c.top) + 'px';
      el.setAttribute('data-idx', String(idx));
      el.setAttribute('aria-label', 'Éclat ' + (idx + 1));
      return el;
    }

    function dejaPose(idx) { return !!locked[idx]; }

    /* Pose un éclat sur le hublot (centré et rogné par le cercle). */
    function poserSurHublot(idx) {
      var el = pieces[idx];
      if (!el) return;
      var c = cellules[idx];
      el.style.transform = 'none';
      el.style.transition = '';
      el.style.left = c.left + 'px';
      el.style.top = c.top + 'px';
      el.classList.add('puzzle-piece--lock');
      if (el.parentNode !== board) board.appendChild(el);
    }

    /* Disposition de la PIOCHE : toutes les pièces restent visibles
       avec le hublot sans faire défiler l'écran. */
    function dispositionPioche() {
      var restants = [];
      for (var p = 0; p < ordre.length; p++) {
        if (!locked[ordre[p]]) restants.push(ordre[p]);
      }
      var reduit = pieceD * ECHELLE_PIOCHE;
      var cellule = reduit + TGAP;
      var cols = Math.max(3, Math.floor(boardW / cellule));
      for (var q = 0; q < restants.length; q++) {
        var el = pieces[restants[q]];
        if (!el) continue;
        if (el.parentNode !== stage) stage.appendChild(el);
        el.classList.remove('puzzle-piece--lock');
        el.classList.remove('puzzle-piece--drag');
        el.style.transformOrigin = 'top left';
        el.style.transform = 'scale(' + ECHELLE_PIOCHE + ')';
        el.style.left = ((q % cols) * cellule) + 'px';
        el.style.top = ((boardW + GAP) + Math.floor(q / cols) * cellule) + 'px';
        el.style.zIndex = '';
      }
      var lignes = Math.max(1, Math.ceil(restants.length / cols));
      var trayH = lignes * cellule + TGAP;
      tray.style.top = (boardW + GAP) + 'px';
      tray.style.height = trayH + 'px';
      stage.style.height = (boardW + GAP + trayH) + 'px';
      return restants.length;
    }

    function positionner() {
      for (var i = 0; i < N; i++) if (locked[i]) poserSurHublot(i);
      dispositionPioche();
      majStatus();
    }

    function victoire() {
      fini = true;
      setTimeout(onVictoire, 420);
    }

    /* ---------------------- Glisser-déposer ---------------------- */
    function activerDrag() {
      function onDown(e) {
        if (fini) return;
        var el = e.target;
        if (!el || !el.classList || !el.classList.contains('puzzle-piece')) return;
        var idx = Number(el.getAttribute('data-idx'));
        if (dejaPose(idx)) return;
        e.preventDefault();

        stageRect = stage.getBoundingClientRect();
        var px = e.clientX - stageRect.left;
        var py = e.clientY - stageRect.top;

        var reduit = pieceD * ECHELLE_PIOCHE;
        var l0 = parseFloat(el.style.left || 0);
        var t0 = parseFloat(el.style.top || 0);
        var rx = reduit > 0 ? (px - l0) / reduit : 0.5;
        var ry = reduit > 0 ? (py - t0) / reduit : 0.5;
        rx = Math.min(1, Math.max(0, rx));
        ry = Math.min(1, Math.max(0, ry));

        el.style.transform = 'none';
        grabDX = rx * pieceD;
        grabDY = ry * pieceD;
        el.style.left = (px - grabDX) + 'px';
        el.style.top = (py - grabDY) + 'px';

        dragEl = el;
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
        var idx = Number(el.getAttribute('data-idx'));
        var cx = parseFloat(el.style.left) + pieceD / 2;
        var cy = parseFloat(el.style.top) + pieceD / 2;

        /* Case la plus proche parmi celles encore vides. */
        var cible = -1, dmin = Infinity;
        for (var i = 0; i < N; i++) {
          if (locked[i]) continue;
          var dx = cx - cellules[i].cx;
          var dy = cy - cellules[i].cy;
          var d2 = dx * dx + dy * dy;
          if (d2 < dmin) { dmin = d2; cible = i; }
        }

        el.classList.remove('puzzle-piece--drag');
        el.style.zIndex = '';
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
        dragEl = null;

        if (cible === idx && Math.sqrt(dmin) <= pasPx * 0.9) {
          locked[idx] = true;
          positionner();
          if (nbPosees() >= N) victoire();
        } else {
          positionner();
          if (cible >= 0 && Math.sqrt(dmin) <= pasPx * 1.6) {
            feedbackMsg('✗ Cet éclat ne va pas là.', 'warn');
          }
        }
      }

      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('pointercancel', onUp);
    }

    /* ---------------------- Aide du sonar ---------------------- */
    function reveler() {
      if (fini || erreurs >= maxErreurs) return;
      var restants = [];
      for (var i = 0; i < N; i++) if (!locked[i]) restants.push(i);
      if (!restants.length) return;
      var cible = restants[Math.floor(Math.random() * restants.length)];

      erreurs++;
      locked[cible] = true;
      positionner();
      feedbackMsg('🔎 Le sonar a posé un éclat.', '');

      if (nbPosees() >= N) { victoire(); return; }
      onErreur(erreurs, maxErreurs);
    }

    revealBtn.addEventListener('click', reveler);

    /* ---------------------- Montage ---------------------- */
    var img = new Image();
    img.onload = function () {
      var dispoW = host.clientWidth || 0;
      if (!dispoW) dispoW = Math.min(window.innerWidth || 360, 360) - 40;
      var dispoH = window.innerHeight || 700;

      // Budget vertical : dimensionnement garantissant que le hublot ET toutes les
      // pièces restent entièrement visibles sur l'écran principal sans défilement.
      var maxStageH = Math.max(300, Math.min(dispoH - 180, 560));
      var bestW = 220;
      for (var w = Math.min(dispoW, 300); w >= 170; w -= 5) {
        var rTry = w / 2;
        var pTry = geo.pas * rTry;
        var dTry = Math.max(22, geo.rayon * 2 * rTry);
        var redTry = dTry * ECHELLE_PIOCHE;
        var cellTry = redTry + TGAP;
        var colsTry = Math.max(3, Math.floor(w / cellTry));
        var rowsTry = Math.ceil(N / colsTry);
        var tH = rowsTry * cellTry + TGAP;
        if (w + GAP + tH <= maxStageH || w <= 180) {
          bestW = w;
          break;
        }
      }
      boardW = Math.round(bestW);
      R = boardW / 2;

      pasPx = geo.pas * R;
      pieceD = Math.max(22, geo.rayon * 2 * R);

      var echelle = Math.max(boardW / img.naturalWidth, boardW / img.naturalHeight);
      imgW = img.naturalWidth * echelle;
      imgH = img.naturalHeight * echelle;
      offX = (boardW - imgW) * cadrageX;
      offY = (boardW - imgH) * cadrageY;

      // Centrage parfait du hublot circulaire dans son cadre carré
      frame.style.width = boardW + 'px';
      frame.style.height = boardW + 'px';
      board.style.width = boardW + 'px';
      board.style.height = boardW + 'px';
      stage.style.width = boardW + 'px';
      stage.style.maxWidth = '100%';
      stage.style.margin = '0 auto';

      /* Emplacements cibles */
      cellules = [];
      var frag = document.createDocumentFragment();
      for (var i = 0; i < N; i++) {
        var c = geo.cases[i];
        var cx = R + c.x * R;
        var cy = R + c.y * R;
        cellules.push({ cx: cx, cy: cy, left: cx - pieceD / 2, top: cy - pieceD / 2 });

        var s = document.createElement('div');
        s.className = 'puzzle-slot';
        s.style.width = pieceD + 'px';
        s.style.height = pieceD + 'px';
        s.style.left = (cx - pieceD / 2) + 'px';
        s.style.top = (cy - pieceD / 2) + 'px';
        frag.appendChild(s);
      }
      board.appendChild(frag);

      /* Pioche */
      ordre = [];
      for (var o = 0; o < N; o++) ordre.push(o);
      melanger(ordre);
      for (var p = 0; p < N; p++) {
        var el = fabriquerPiece(ordre[p]);
        pieces[ordre[p]] = el;
        stage.appendChild(el);
      }

      positionner();
      activerDrag();
      onPrete({ pieces: N });
    };
    img.onerror = function () {
      if (statusEl) statusEl.textContent = '📷 Photo du lieu introuvable — préviens l’organisation.';
      if (revealBtn) revealBtn.disabled = true;
    };
    img.src = image;
  }

  window.NautilusPuzzle = { init: init, compterPieces: compterPieces };
})();
