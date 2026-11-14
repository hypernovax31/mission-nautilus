/* =============================================================
   PUZZLE CIRCULAIRE DU LIEU — moteur de l'épreuve du Palier 3
   (puzzle-palier3.js)

   ÉPREUVE : reconstituer la PHOTO du lieu où est scellé le QR Code
   du palier suivant. La photo est enfermée dans un HUBLOT CIRCULAIRE
   découpé en ÉCLATS RONDS, empilés en nid d'abeille et MÉLANGÉS sous
   le hublot : impossible de lire la photo d'un coup d'œil tant
   qu'elle n'est pas remontée.

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
       grille: 8,              // 8 → 63 éclats ; 7 → 43 ; 9 → 81
       maxErreurs: 3,
       onErreur: function (n, max) { … },
       onVictoire: function () { … }
     });

     window.NautilusPuzzle.compterPieces(8) → nombre d'éclats (63)

   NOTE IMPORTANTE SUR LE MÉLANGE : l'ordre de la pioche est tiré UNE
   fois (tableau « ordre ») et c'est CET ordre qui pilote la
   disposition. L'ancien moteur replaçait les pièces restantes en
   suivant leur numéro, ce qui annulait le mélange à l'écran.
   ============================================================= */
(function () {
  'use strict';
  if (window.NautilusPuzzle) return;

  var GAP = 22;            // espace entre le hublot et la pioche
  var TGAP = 6;            // espace entre les éclats dans la pioche
  var ECHELLE_PIOCHE = 0.62;  // les éclats reposent en réduction dans la pioche
  var PART_RAYON = 0.62;   // rayon d'un éclat / pas du nid d'abeille (> 0,577 = recouvrement total)
  var MARGE_GRILLE = 0.25; // débord du hublot, en pas de grille

  /* ---------- Géométrie : nid d'abeille dans le cercle unité ---------- */
  function geometrie(grille) {
    var g = Math.max(5, Math.min(14, Math.round(Number(grille) || 8)));
    var pas = 2 / g;                       // pas horizontal, en rayons
    var dy = pas * Math.sqrt(3) / 2;       // pas vertical (nid d'abeille)
    var lim = 1 + MARGE_GRILLE * pas;
    var cases = [];
    var kmax = Math.ceil(lim / dy);
    var jmax = Math.ceil(lim / pas) + 1;
    for (var k = -kmax; k <= kmax; k++) {
      var y = k * dy;
      if (Math.abs(y) > lim) continue;
      var dec = (Math.abs(k) % 2 === 1) ? 0.5 : 0;
      for (var j = -jmax; j <= jmax; j++) {
        var x = (j + dec) * pas;
        if (x * x + y * y > lim * lim) continue;
        cases.push({ x: x, y: y });
      }
    }
    return { grille: g, pas: pas, rayon: pas * PART_RAYON, cases: cases };
  }

  function compterPieces(grille) { return geometrie(grille).cases.length; }

  /* ------------------------------------------------------------------ */
  function init(host, opts) {
    if (!host || !opts || !opts.image) return;

    var geo = geometrie(opts.grille);
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
    var ordre = [];               // ORDRE MÉLANGÉ de la pioche (fixe)
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
      +   '<div class="puzzle-board" id="pzBoard" aria-label="Hublot du puzzle"></div>'
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
      /* La découpe reste TOUJOURS celle de la case d'origine : l'éclat
         transporte son morceau de photo où qu'il soit sur l'écran. */
      el.style.backgroundPosition = (offX - c.left) + 'px ' + (offY - c.top) + 'px';
      el.setAttribute('data-idx', String(idx));
      el.setAttribute('aria-label', 'Éclat ' + (idx + 1));
      return el;
    }

    function dejaPose(idx) { return !!locked[idx]; }

    /* Pose un éclat sur le hublot (il est alors rogné par le cercle). */
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

    /* Disposition de la PIOCHE : c'est ici que le mélange se voit.
       On parcourt « ordre » (l'ordre tiré au sort), jamais 0..N-1. */
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

        /* On mémorise la prise en proportion de l'éclat réduit, puis on
           remet l'éclat à sa taille pleine sans faire de saut visuel. */
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
      if (!dispoW) dispoW = Math.min(window.innerWidth || 360, 360) - 60;
      boardW = Math.round(Math.max(240, Math.min(dispoW, 560)));
      R = boardW / 2;

      pasPx = geo.pas * R;
      pieceD = Math.max(22, geo.rayon * 2 * R);

      /* La photo REMPLIT le hublot (cover) : elle est centrée, les bords
         gauche/droite sont rognés si elle est plus large que haute. */
      var echelle = Math.max(boardW / img.naturalWidth, boardW / img.naturalHeight);
      imgW = img.naturalWidth * echelle;
      imgH = img.naturalHeight * echelle;
      offX = (boardW - imgW) / 2;
      offY = (boardW - imgH) / 2;

      board.style.width = boardW + 'px';
      board.style.height = boardW + 'px';
      /* Le hublot et la pioche sont centrés dans la carte. */
      stage.style.width = boardW + 'px';
      stage.style.maxWidth = '100%';
      stage.style.margin = '0 auto';

      /* Emplacements (repères discrets) + coordonnées cibles. */
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

      /* MÉLANGE : un seul tirage, et c'est lui qui commande la pioche. */
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
