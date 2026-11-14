/* =============================================================
   PALIER 4 — « LE RELEVÉ DU SONAR »
   Moteur de l'épreuve (palier4-marqueurs.js)

   PRINCIPE (même famille de jeu que le puzzle du Palier 3, mais autre
   geste) : le sonar a relevé plusieurs ÉCHOS dans la zone. Chaque écho
   est un MARQUEUR portant un SIGLE (deux lettres) et une POSITION.
   L'équipage doit POSER chaque marqueur sur son emplacement du relevé.

   DIFFICULTÉ : les marqueurs sont de simples jetons (aucune image, donc
   aucun indice visuel) — seuls le SIGLE et le compteur de distance du
   sonar permettent de les placer. Brancher le sonar (« 📡 Ping sonar »)
   annonce la distance, en cases, du marqueur sélectionné à SA position :
   de quoi trianguler, case après case.

   • Marqueur posé au bon endroit → il se VERROUILLE (vert).
   • Marqueur posé ailleurs → il revient, et la case est marquée ROUGE
     (elle ne peut donc pas être la bonne : déduction gratuite).
   • « 📡 Ping sonar » (gratuit) : distance du marqueur sélectionné.
   • « 🔎 Révéler un marqueur » : le sonar le pose à ta place. Chaque
     aide compte pour 1 ERREUR — 3 erreurs = remontée personnelle
     (règle globale du jeu, matelot-blocages.js).

   Utilisation :
     window.NautilusMarqueurs.init(hote, {
       grille: 9,                       // 9 → grille 9 × 9 (81 cases)
       marqueurs: [ { sigle: 'NR', nom: '…' }, … ],   // 6 à 10
       maxErreurs: 3,
       onErreur: function (n, max) {},
       onVictoire: function (stats) {}  // stats = { erreurs, pings, temps }
     });

   Le moteur est VOLONTAIREMENT autonome : aucune dépendance réseau, il
   fonctionne donc aussi hors connexion, comme le reste des épreuves.
   ============================================================= */
(function () {
  'use strict';
  if (window.NautilusMarqueurs) return;

  /* Générateur pseudo-aléatoire REPRODUCTIBLE : chaque équipage obtient
     un relevé différent, mais le MÊME relevé à chaque rechargement —
     sinon un matelot qui reprend la partie repartirait de zéro. */
  function alea(graine) {
    var h = 2166136261;
    var s = String(graine);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  }

  function init(host, opts) {
    if (!host || !opts) return;

    var n = Math.max(5, Math.min(12, Math.round(Number(opts.grille) || 9)));
    var liste = (opts.marqueurs && opts.marqueurs.length) ? opts.marqueurs.slice() : [];
    if (liste.length < 3) return;
    var maxErreurs = Number(opts.maxErreurs) || 3;
    var onErreur = opts.onErreur || function () {};
    var onVictoire = opts.onVictoire || function () {};
    var graine = opts.graine || 'nautilus';

    var M = liste.length;
    var N = n * n;
    var rnd = alea(graine);

    /* ---------- Tirage du relevé (positions réelles des échos) ---------- */
    var cibles = [];          // idx marqueur -> case du relevé (0..N-1)
    var pris = {};
    var libres = [];
    for (var c = 0; c < N; c++) libres.push(c);
    for (var m = 0; m < M; m++) {
      var k = Math.floor(rnd() * libres.length);
      cibles.push(libres[k]);
      libres.splice(k, 1);
    }

    /* ---------- État de la partie ---------- */
    var erreurs = 0, pings = 0;
    var t0 = Date.now();
    var locked = {};          // idx marqueur -> true
    var faux = {};            // case (0..N-1) -> true (case écartée)
    var restants = [];        // marqueurs encore dans le rack (ordre MÉLANGÉ)
    for (var i = 0; i < M; i++) restants.push(i);
    melanger(restants);

    var selection = restants[0];   // marqueur sélectionné (surbrillance)
    var fini = false;
    var dragEl = null, grabDX = 0, grabDY = 0, stageRect = null;

    host.innerHTML =
      '<div class="marq">'
      + '<div class="marq-status" id="mrqStatus"></div>'
      + '<div class="marq-sonar" id="mrqSonar"></div>'
      + '<div class="marq-board" id="mrqBoard" aria-label="Relevé du sonar"></div>'
      + '<div class="marq-rack" id="mrqRack" aria-label="Marqueurs à poser"></div>'
      + '<div class="marq-actions">'
      +   '<button type="button" class="marq-btn" id="mrqPing">📡 Ping sonar</button>'
      +   '<button type="button" class="marq-btn marq-btn--aide" id="mrqReveal">🔎 Révéler un marqueur</button>'
      + '</div>'
      + '<div class="marq-feedback" id="mrqFeedback"></div>'
      + '</div>';

    var statusEl = host.querySelector('#mrqStatus');
    var sonarEl = host.querySelector('#mrqSonar');
    var board = host.querySelector('#mrqBoard');
    var rack = host.querySelector('#mrqRack');
    var pingBtn = host.querySelector('#mrqPing');
    var revealBtn = host.querySelector('#mrqReveal');
    var feedback = host.querySelector('#mrqFeedback');

    function melanger(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
    }

    function nomDe(idx) { return liste[idx].sigle || ('M' + (idx + 1)); }
    function nbPoses() { var p = 0; for (var i = 0; i < M; i++) if (locked[i]) p++; return p; }
    function ligneDe(cell) { return Math.floor(cell / n); }
    function colDe(cell) { return cell % n; }

    /* Distance en cases, en restant DANS la grille (distance de
       Manhattan : c'est ainsi qu'un relevé sonar se lit sur un plan). */
    function distance(a, b) {
      return Math.abs(ligneDe(a) - ligneDe(b)) + Math.abs(colDe(a) - colDe(b));
    }

    function majStatus() {
      if (statusEl) {
        statusEl.textContent = nbPoses() >= M
          ? '✅ Relevé reconstitué !'
          : '📡 ' + nbPoses() + ' / ' + M + ' marqueurs placés';
      }
      if (pingBtn) {
        var selDeja = (selection >= 0 && locked[selection]);
        pingBtn.disabled = (nbPoses() >= M) || selDeja || selection < 0;
        pingBtn.textContent = selDeja
          ? '📡 Marqueur déjà placé'
          : '📡 Ping sonar' + (selection >= 0 ? ' (' + nomDe(selection) + ')' : '');
      }
      if (revealBtn) {
        var rest = maxErreurs - erreurs;
        if (rest <= 0 || nbPoses() >= M) {
          revealBtn.disabled = true;
          revealBtn.textContent = '🔎 Plus de révélation possible';
        } else {
          revealBtn.disabled = false;
          revealBtn.textContent = '🔎 Révéler un marqueur (' + rest + ')';
        }
      }
    }

    function dire(html, kind) {
      if (!feedback) return;
      feedback.innerHTML = html;
      feedback.className = 'marq-feedback' + (kind ? ' is-' + kind : '');
    }

    function annoncer(txt) {
      if (sonarEl) { sonarEl.innerHTML = txt; }
    }

    /* ---------------------- Construction du plateau ---------------------- */
    function construire() {
      var frag = document.createDocumentFragment();
      for (var cell = 0; cell < N; cell++) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'marq-case';
        d.setAttribute('data-cell', String(cell));
        d.setAttribute('role', 'gridcell');
        d.setAttribute('aria-label', 'Case ' + (colDe(cell) + 1) + '-' + (ligneDe(cell) + 1));
        /* Repères de lecture : axes du relevé (A1, B1, …). */
        if (ligneDe(cell) === 0) d.classList.add('marq-case--axe-haut');
        if (colDe(cell) === 0) d.classList.add('marq-case--axe-gauche');
        if ((colDe(cell) & 1) === 0) d.classList.add('marq-case--pair');
        frag.appendChild(d);
      }
      board.style.setProperty('--n', String(n));
      board.appendChild(frag);

      /* Marqueurs du rack (MÉLANGÉS : c'est l'ordre de « restants »). */
      var f2 = document.createDocumentFragment();
      for (var p = 0; p < restants.length; p++) {
        var idx = restants[p];
        var j = document.createElement('button');
        j.type = 'button';
        j.className = 'marq-jeton';
        j.setAttribute('data-marq', String(idx));
        j.innerHTML = '<span class="marq-sigle">' + nomDe(idx) + '</span>'
          + (liste[idx].nom ? '<span class="marq-nom">' + liste[idx].nom + '</span>' : '');
        f2.appendChild(j);
      }
      rack.appendChild(f2);
    }

    function majSelection() {
      var jetons = rack.querySelectorAll('.marq-jeton');
      for (var i = 0; i < jetons.length; i++) {
        var idx = Number(jetons[i].getAttribute('data-marq'));
        jetons[i].classList.toggle('is-sel', idx === selection);
        jetons[i].setAttribute('aria-pressed', idx === selection ? 'true' : 'false');
      }
    }

    /* Redessine une case : marqueur verrouillé ou case écartée. */
    function peindreCases() {
      var cases = board.querySelectorAll('.marq-case');
      for (var i = 0; i < cases.length; i++) {
        var cell = Number(cases[i].getAttribute('data-cell'));
        var pose = null;
        for (var m = 0; m < M; m++) if (locked[m] && cibles[m] === cell) { pose = m; break; }
        cases[i].classList.toggle('is-faux', !!faux[cell] && pose === null);
        cases[i].classList.toggle('is-ok', pose !== null);
        cases[i].innerHTML = pose === null ? '' : '<span class="marq-pose">' + nomDe(pose) + '</span>';
      }
    }

    function deposeJeton(idx) {
      var j = rack.querySelector('.marq-jeton[data-marq="' + idx + '"]');
      if (j && j.parentNode) j.parentNode.removeChild(j);
    }

    function victoire() {
      fini = true;
      setTimeout(function () {
        onVictoire({ erreurs: erreurs, pings: pings, temps: Math.round((Date.now() - t0) / 1000) });
      }, 420);
    }

    function place(idx, cell) {
      if (fini) return false;
      if (cibles[idx] === cell) {
        locked[idx] = true;
        faux[cell] = false;
        deposeJeton(idx);
        peindreCases();
        dire('✅ Écho <b>' + nomDe(idx) + '</b> calé sur sa position.', 'ok');
        var suivante = -1;
        for (var p = 0; p < restants.length; p++) if (!locked[restants[p]]) { suivante = restants[p]; break; }
        selection = suivante;
        majSelection();
        majStatus();
        if (nbPoses() >= M) victoire();
        return true;
      }
      faux[cell] = true;
      peindreCases();
      dire('✗ Aucun écho ici : case <b>écartée</b>. Le marqueur <b>' + nomDe(idx) + '</b> reste à quai.', 'warn');
      return false;
    }

    /* ---------------------- Ping sonar (gratuit) ---------------------- */
    function ping() {
      if (fini || selection < 0 || locked[selection]) return;
      pings++;
      var cible = cibles[selection];
      /* Distance annoncée : on ne dit JAMAIS la direction. On la donne
         par rapport à la case ÉCARTÉE la plus proche (elle donne un
         repère concret au joueur), sinon par rapport au centre. */
      var ref = -1;
      var meilleur = Infinity;
      for (var cell = 0; cell < N; cell++) {
        if (!faux[cell]) continue;
        var dd = distance(cell, cible);
        if (dd < meilleur) { meilleur = dd; ref = cell; }
      }
      if (ref >= 0) {
        annoncer('📡 <b>' + nomDe(selection) + '</b> : à <b>' + meilleur + ' case' + (meilleur > 1 ? 's' : '')
          + '</b> de la case écartée <b>' + (colDe(ref) + 1) + '-' + (ligneDe(ref) + 1) + '</b>.');
      } else {
        var centre = Math.floor(n / 2) * n + Math.floor(n / 2);
        var dc = distance(centre, cible);
        annoncer('📡 <b>' + nomDe(selection) + '</b> : à <b>' + dc + ' case' + (dc > 1 ? 's' : '')
          + '</b> du centre du relevé <b>' + (colDe(centre) + 1) + '-' + (ligneDe(centre) + 1) + '</b>.');
      }
      majStatus();
    }

    /* ---------------------- Aide payante ---------------------- */
    function reveler() {
      if (fini || erreurs >= maxErreurs || nbPoses() >= M) return;
      var pool = restants.filter(function (x) { return !locked[x]; });
      if (!pool.length) return;
      var idx = pool[Math.floor(Math.random() * pool.length)];
      erreurs++;
      locked[idx] = true;
      faux[cibles[idx]] = false;
      deposeJeton(idx);
      peindreCases();
      dire('🔎 Le sonar a calé <b>' + nomDe(idx) + '</b> à ta place.', '');
      var suivante = -1;
      for (var p = 0; p < restants.length; p++) if (!locked[restants[p]]) { suivante = restants[p]; break; }
      selection = suivante;
      majSelection();
      majStatus();
      if (nbPoses() >= M) { victoire(); return; }
      onErreur(erreurs, maxErreurs);
    }

    /* ---------------------- Interactions ---------------------- */
    pingBtn.addEventListener('click', ping);
    revealBtn.addEventListener('click', reveler);

    /* Sélection d'un marqueur (clic simple), puis dépôt (2e clic sur la
       case) : utilisable au doigt SANS glisser — plus sûr sur mobile. */
    rack.addEventListener('click', function (e) {
      var j = e.target.closest ? e.target.closest('.marq-jeton') : null;
      if (!j || fini) return;
      var idx = Number(j.getAttribute('data-marq'));
      if (locked[idx]) return;
      /* Toucher un marqueur le SÉLECTIONNE (jamais « désélectionner ») :
         après un placement réussi le moteur présélectionne le suivant,
         et un appui sur ce marqueur ne doit pas annuler la sélection. */
      selection = idx;
      majSelection();
      majStatus();
      annoncer(selection >= 0
        ? '🎯 Marqueur <b>' + nomDe(selection) + '</b> sélectionné — touche une case du relevé, ou lance un ping.'
        : '');
    });

    board.addEventListener('click', function (e) {
      var c = e.target.closest ? e.target.closest('.marq-case') : null;
      if (!c || fini) return;
      var cell = Number(c.getAttribute('data-cell'));
      if (selection < 0) { dire('Choisis d’abord un marqueur dans le rack, sous le relevé.', 'warn'); return; }
      place(selection, cell);
    });

    /* Glisser-déposer (souris) en complément du clic. */
    function onDown(e) {
      if (fini) return;
      var j = e.target.closest ? e.target.closest('.marq-jeton') : null;
      if (!j) return;
      var idx = Number(j.getAttribute('data-marq'));
      if (locked[idx]) return;
      selection = idx;
      majSelection();
      majStatus();
      stageRect = host.getBoundingClientRect();
      dragEl = j;
      grabDX = e.clientX - stageRect.left;
      grabDY = e.clientY - stageRect.top;
      j.style.zIndex = '50';
      j.classList.add('is-drag');
    }
    function onMove(e) {
      if (!dragEl || !stageRect) return;
      e.preventDefault();
      dragEl.style.left = (e.clientX - stageRect.left - dragEl.offsetWidth / 2) + 'px';
      dragEl.style.top = (e.clientY - stageRect.top - dragEl.offsetHeight / 2) + 'px';
    }
    function onUp(e) {
      if (!dragEl) return;
      var el = dragEl;
      dragEl = null;
      var r = el.getBoundingClientRect();
      var cx = e.clientX, cy = e.clientY;
      el.style.left = ''; el.style.top = ''; el.style.zIndex = '';
      el.classList.remove('is-drag');
      var cible = document.elementFromPoint
        ? document.elementFromPoint(cx, cy)
        : null;
      var c = cible && cible.closest ? cible.closest('.marq-case') : null;
      if (c) place(selection, Number(c.getAttribute('data-cell')));
      else if (r) { /* relâché dans le vide : rien ne bouge */ }
    }
    host.addEventListener('pointerdown', function (e) {
      if (e.target.closest && !e.target.closest('.marq-jeton')) return;
      onDown(e);
    });
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);

    construire();
    majSelection();
    peindreCases();
    majStatus();
    annoncer('📡 Relevé en attente — sélectionne un marqueur, puis touche sa case.');
    if (opts.onPrete) opts.onPrete({ cases: N, marqueurs: M });
  }

  window.NautilusMarqueurs = { init: init };
})();
