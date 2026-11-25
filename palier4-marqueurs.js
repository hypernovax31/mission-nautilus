/* =============================================================
   PALIER 4 — « LE RELEVÉ DU SONAR »
   Moteur de l'épreuve & Ergonomie interactive (palier4-marqueurs.js)

   ARCHITECTURE & GAMEPLAY :
   1. Guidage visuel immédiat en 3 étapes :
      - 1. Sélectionner un écho sonar
      - 2. Activer le Ping pour évaluer la distance
      - 3. Toucher la coordonnée cible sur la grille (A–I / 1–9)
   2. Rack des échos placé au-dessus du plateau pour une accessibilité
      instantanée sur mobile comme sur grand écran.
   3. Grille 9×9 avec axes complets : colonnes 1 à 9 et lignes A à I.
   4. Feedback chaud / froid dynamique avec distance Manhattan sur les
      cases écartées pour une triangulation logique et intuitive.
   5. Enchaînement automatique : dès qu'un écho est calé, l'écho suivant
      est présélectionné pour une fluidité totale.
   ============================================================= */
(function () {
  'use strict';
  if (window.NautilusMarqueurs) return;

  /* Générateur pseudo-aléatoire reproductible par équipage */
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

  /* Sons de navigation sonar via Web Audio (respectent la règle NautilusSon) */
  function jouerPingSonar() {
    if (!window.NautilusSon || !window.NautilusSon.sonActif()) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      window.NautilusSon.registerContexte(ctx);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1480, ctx.currentTime + 0.10);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.48);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.50);
    } catch (e) {}
  }

  function jouerSonEchoOk() {
    if (!window.NautilusSon || !window.NautilusSon.sonActif()) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      window.NautilusSon.registerContexte(ctx);
      var notes = [523.25, 659.25, 783.99, 1046.50]; // C5 - E5 - G5 - C6
      notes.forEach(function (freq, idx) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.20, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.36);
      });
    } catch (e) {}
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

    /* Tirage du relevé (positions réelles des échos) */
    var cibles = [];
    var libres = [];
    for (var c = 0; c < N; c++) libres.push(c);
    for (var m = 0; m < M; m++) {
      var k = Math.floor(rnd() * libres.length);
      cibles.push(libres[k]);
      libres.splice(k, 1);
    }

    /* État de la partie */
    var erreurs = 0;
    var pings = 0;
    var t0 = Date.now();
    var locked = {};       // idx marqueur -> true
    var fauxParCible = {}; // cell -> distance par rapport au marqueur testé
    var casesEcartees = {};// cell -> true
    var restants = [];     // ordre de présentation
    for (var i = 0; i < M; i++) restants.push(i);

    var selection = restants[0]; // premier marqueur actif par défaut
    var fini = false;

    function nomDe(idx) { return liste[idx] ? liste[idx].sigle : ('M' + (idx + 1)); }
    function nomCompletDe(idx) { return liste[idx] ? (liste[idx].nom || liste[idx].sigle) : ('Écho ' + (idx + 1)); }
    function nbPoses() { var p = 0; for (var i = 0; i < M; i++) if (locked[i]) p++; return p; }
    function ligneDe(cell) { return Math.floor(cell / n); }
    function colDe(cell) { return cell % n; }
    function coordLisible(cell) {
      return String.fromCharCode(65 + ligneDe(cell)) + (colDe(cell) + 1);
    }

    function distance(a, b) {
      return Math.abs(ligneDe(a) - ligneDe(b)) + Math.abs(colDe(a) - colDe(b));
    }

    /* Injection du gabarit ergonomique refondu */
    host.innerHTML =
      '<div class="marq-container">'
      + '  <!-- 1. En-tête de mission & progression -->'
      + '  <div class="marq-mission-card">'
      + '    <div class="marq-mission-header">'
      + '      <div class="marq-mission-title">'
      + '        <span class="marq-pulse-radar" aria-hidden="true"></span>'
      + '        <span>RELEVÉ SONAR DES ABYSSES</span>'
      + '      </div>'
      + '      <div class="marq-aides-badge" id="mrqAidesBadge" title="Aides de secours du capitaine">'
      + '        <span>Aides :</span> <b id="mrqAidesCount">3 / 3</b>'
      + '      </div>'
      + '    </div>'
      + '    <div class="marq-progression-box">'
      + '      <div class="marq-progression-labels">'
      + '        <span id="mrqProgressLabel"><b>0 / ' + M + '</b> échos verrouillés</span>'
      + '        <span id="mrqProgressPct">0%</span>'
      + '      </div>'
      + '      <div class="marq-progression-bar">'
      + '        <div class="marq-progression-fill" id="mrqProgressFill" style="width:0%"></div>'
      + '      </div>'
      + '    </div>'
      + '    <div class="marq-guide-steps">'
      + '      <div class="marq-step-item active" id="mrqStep1">'
      + '        <span class="marq-step-num">1</span>'
      + '        <div class="marq-step-text"><b>1. Choisissez un écho</b><span class="marq-step-sub" id="mrqStep1Sub">Sélection dans la liste</span></div>'
      + '      </div>'
      + '      <div class="marq-step-arrow">➔</div>'
      + '      <div class="marq-step-item" id="mrqStep2">'
      + '        <span class="marq-step-num">2</span>'
      + '        <div class="marq-step-text"><b>2. Pingez le radar</b><span class="marq-step-sub" id="mrqStep2Sub">Distance en cases</span></div>'
      + '      </div>'
      + '      <div class="marq-step-arrow">➔</div>'
      + '      <div class="marq-step-item" id="mrqStep3">'
      + '        <span class="marq-step-num">3</span>'
      + '        <div class="marq-step-text"><b>3. Touchez la case</b><span class="marq-step-sub">Grille A–I / 1–9</span></div>'
      + '      </div>'
      + '    </div>'
      + '  </div>'

      + '  <!-- 2. Console de l\'écho actif (au premier coup d\'œil !) -->'
      + '  <div class="marq-active-card" id="mrqActiveCard">'
      + '    <div class="marq-active-head">'
      + '      <span class="marq-active-badge">🎯 CIBLE ACTUELLE</span>'
      + '      <span class="marq-active-help">👉 Touchez une case du relevé ou lancez un Ping</span>'
      + '    </div>'
      + '    <div class="marq-active-body">'
      + '      <div class="marq-active-sigle" id="mrqActiveSigle">—</div>'
      + '      <div class="marq-active-details">'
      + '        <div class="marq-active-nom" id="mrqActiveNom">—</div>'
      + '        <div class="marq-active-hint" id="mrqActiveSonarMsg">📡 Sonar en veille — Touchez le plateau ou lancez un Ping</div>'
      + '      </div>'
      + '    </div>'
      + '  </div>'

      + '  <!-- 3. Rack des échos (placé en haut, sous la cible) -->'
      + '  <div class="marq-rack-wrapper">'
      + '    <div class="marq-rack-title">ÉCHOS SONAR DU SECTEUR (touchez pour cibler) :</div>'
      + '    <div class="marq-rack" id="mrqRack" aria-label="Liste des échos sonar"></div>'
      + '  </div>'

      + '  <!-- 4. Commandes d\'actions rapides -->'
      + '  <div class="marq-actions">'
      + '    <button type="button" class="marq-btn marq-btn--ping" id="mrqPing">'
      + '      <span class="marq-btn-ico">📡</span>'
      + '      <span class="marq-btn-text"><b>PING SONAR</b> <span class="marq-btn-sub" id="mrqPingSub">Mesurer la distance</span></span>'
      + '    </button>'
      + '    <button type="button" class="marq-btn marq-btn--aide" id="mrqReveal">'
      + '      <span class="marq-btn-ico">🔎</span>'
      + '      <span class="marq-btn-text"><b>AIDE DU CAPITAINE</b> <span class="marq-btn-sub" id="mrqRevealSub">Révéler la case (3/3)</span></span>'
      + '    </button>'
      + '  </div>'

      + '  <!-- 5. Bandeau de feedback dynamique -->'
      + '  <div class="marq-feedback" id="mrqFeedback" aria-live="polite"></div>'

      + '  <!-- 6. Le Relevé Sonar avec Axes A..I et 1..9 -->'
      + '  <div class="marq-board-wrapper">'
      + '    <div class="marq-axis-cols" id="mrqAxisCols"></div>'
      + '    <div class="marq-board-grid-wrap">'
      + '      <div class="marq-axis-rows" id="mrqAxisRows"></div>'
      + '      <div class="marq-board" id="mrqBoard" aria-label="Grille sonar 9x9"></div>'
      + '    </div>'
      + '  </div>'
      + '</div>';

    var board = host.querySelector('#mrqBoard');
    var rack = host.querySelector('#mrqRack');
    var pingBtn = host.querySelector('#mrqPing');
    var revealBtn = host.querySelector('#mrqReveal');
    var feedback = host.querySelector('#mrqFeedback');
    var progressLabel = host.querySelector('#mrqProgressLabel');
    var progressPct = host.querySelector('#mrqProgressPct');
    var progressFill = host.querySelector('#mrqProgressFill');
    var aidesCount = host.querySelector('#mrqAidesCount');
    var activeSigle = host.querySelector('#mrqActiveSigle');
    var activeNom = host.querySelector('#mrqActiveNom');
    var activeSonarMsg = host.querySelector('#mrqActiveSonarMsg');
    var pingSub = host.querySelector('#mrqPingSub');
    var revealSub = host.querySelector('#mrqRevealSub');

    /* Construction des axes de coordonnées et de la grille */
    function construireAxesEtGrille() {
      // 1. Axe des colonnes (1 à 9)
      var axisCols = host.querySelector('#mrqAxisCols');
      if (axisCols) {
        var colsHtml = '<span class="marq-axis-corner" aria-hidden="true">✛</span>';
        for (var col = 1; col <= n; col++) {
          colsHtml += '<span class="marq-axis-col-lbl">' + col + '</span>';
        }
        axisCols.innerHTML = colsHtml;
      }

      // 2. Axe des lignes (A à I)
      var axisRows = host.querySelector('#mrqAxisRows');
      if (axisRows) {
        var rowsHtml = '';
        for (var lig = 0; lig < n; lig++) {
          var lettre = String.fromCharCode(65 + lig);
          rowsHtml += '<span class="marq-axis-row-lbl">' + lettre + '</span>';
        }
        axisRows.innerHTML = rowsHtml;
      }

      // 3. Grille 9x9 des cases
      var frag = document.createDocumentFragment();
      for (var cell = 0; cell < N; cell++) {
        var d = document.createElement('button');
        d.type = 'button';
        d.className = 'marq-case';
        d.setAttribute('data-cell', String(cell));
        d.setAttribute('role', 'gridcell');
        var cName = coordLisible(cell);
        d.setAttribute('aria-label', 'Case ' + cName);
        d.setAttribute('title', 'Coordonnée ' + cName);
        d.innerHTML = '<span class="marq-case-coord">' + cName + '</span>';
        frag.appendChild(d);
      }
      board.style.setProperty('--n', String(n));
      board.appendChild(frag);

      // 4. Rack des échos
      var f2 = document.createDocumentFragment();
      for (var p = 0; p < restants.length; p++) {
        var idx = restants[p];
        var j = document.createElement('button');
        j.type = 'button';
        j.className = 'marq-jeton';
        j.setAttribute('data-marq', String(idx));
        j.setAttribute('id', 'mrqJeton-' + idx);
        j.innerHTML =
          '<div class="marq-jeton-top">'
          + '  <span class="marq-sigle">' + nomDe(idx) + '</span>'
          + '  <span class="marq-jeton-badge" id="mrqBadge-' + idx + '">À placer</span>'
          + '</div>'
          + '<div class="marq-nom">' + nomCompletDe(idx) + '</div>';
        f2.appendChild(j);
      }
      rack.appendChild(f2);
    }

    function dire(html, kind) {
      if (!feedback) return;
      feedback.innerHTML = html;
      feedback.className = 'marq-feedback' + (kind ? ' is-' + kind : '');
    }

    function majConsoleActive() {
      if (selection < 0 || locked[selection]) {
        // Recherche du premier écho restant
        var suivant = -1;
        for (var p = 0; p < restants.length; p++) {
          if (!locked[restants[p]]) { suivant = restants[p]; break; }
        }
        selection = suivant;
      }

      if (selection >= 0 && !locked[selection]) {
        if (activeSigle) activeSigle.textContent = nomDe(selection);
        if (activeNom) activeNom.textContent = nomCompletDe(selection);
        if (pingSub) pingSub.textContent = 'Distance vers ' + nomDe(selection);
        if (activeSonarMsg) activeSonarMsg.innerHTML = '🎯 Cible active : <b>' + nomDe(selection) + '</b>. Touchez une case du relevé ou lancez le Ping Sonar !';
      } else {
        if (activeSigle) activeSigle.textContent = '✓';
        if (activeNom) activeNom.textContent = 'Tous les échos sont validés !';
        if (activeSonarMsg) activeSonarMsg.textContent = '🏆 Cartographie reconstituée avec succès.';
      }

      // Mise à jour visuelle des jetons
      var jetons = rack.querySelectorAll('.marq-jeton');
      for (var i = 0; i < jetons.length; i++) {
        var idx = Number(jetons[i].getAttribute('data-marq'));
        var isVerrouille = !!locked[idx];
        var isActif = (idx === selection && !isVerrouille);
        jetons[i].classList.toggle('is-sel', isActif);
        jetons[i].classList.toggle('is-ok', isVerrouille);
        jetons[i].setAttribute('aria-pressed', isActif ? 'true' : 'false');
        var badge = jetons[i].querySelector('.marq-jeton-badge');
        if (badge) {
          if (isVerrouille) {
            badge.textContent = '✓ Validé';
            badge.className = 'marq-jeton-badge is-ok';
          } else if (isActif) {
            badge.textContent = '🎯 CIBLÉ';
            badge.className = 'marq-jeton-badge is-active';
          } else {
            badge.textContent = 'À placer';
            badge.className = 'marq-jeton-badge';
          }
        }
      }
    }

    function majProgression() {
      var poses = nbPoses();
      var pct = Math.round((poses / M) * 100);
      if (progressLabel) progressLabel.innerHTML = '<b>' + poses + ' / ' + M + '</b> échos verrouillés';
      if (progressPct) progressPct.textContent = pct + '%';
      if (progressFill) progressFill.style.width = pct + '%';

      var restAides = maxErreurs - erreurs;
      if (aidesCount) aidesCount.textContent = Math.max(0, restAides) + ' / ' + maxErreurs;
      if (revealSub) revealSub.textContent = 'Révéler la case (' + Math.max(0, restAides) + '/' + maxErreurs + ')';

      if (pingBtn) {
        var pret = (selection >= 0 && !locked[selection] && poses < M);
        pingBtn.disabled = !pret;
      }
      if (revealBtn) {
        revealBtn.disabled = (restAides <= 0 || poses >= M);
      }
    }

    /* Peindre les cases du plateau */
    function peindreCases() {
      var cases = board.querySelectorAll('.marq-case');
      for (var i = 0; i < cases.length; i++) {
        var cell = Number(cases[i].getAttribute('data-cell'));
        var pose = null;
        for (var m = 0; m < M; m++) {
          if (locked[m] && cibles[m] === cell) { pose = m; break; }
        }

        if (pose !== null) {
          cases[i].classList.remove('is-faux', 'is-hot', 'is-warm', 'is-cold');
          cases[i].classList.add('is-ok');
          cases[i].innerHTML = '<span class="marq-pose"><b class="marq-pose-sigle">' + nomDe(pose) + '</b><span class="marq-pose-sub">' + coordLisible(cell) + '</span></span>';
        } else if (casesEcartees[cell]) {
          cases[i].classList.add('is-faux');
          var dist = fauxParCible[cell];
          if (typeof dist === 'number') {
            if (dist === 1) {
              cases[i].classList.add('is-hot');
              cases[i].innerHTML = '<span class="marq-dist-badge is-hot" title="À 1 case de la cible !">🔥 1</span>';
            } else if (dist === 2) {
              cases[i].classList.add('is-warm');
              cases[i].innerHTML = '<span class="marq-dist-badge is-warm" title="À 2 cases de la cible">🟡 2</span>';
            } else {
              cases[i].classList.add('is-cold');
              cases[i].innerHTML = '<span class="marq-dist-badge is-cold" title="À ' + dist + ' cases">❄️ ' + dist + '</span>';
            }
          } else {
            cases[i].innerHTML = '<span class="marq-dist-badge">✕</span>';
          }
        } else {
          cases[i].classList.remove('is-ok', 'is-faux', 'is-hot', 'is-warm', 'is-cold');
          cases[i].innerHTML = '<span class="marq-case-coord">' + coordLisible(cell) + '</span>';
        }
      }
    }

    function victoire() {
      fini = true;
      if (activeSonarMsg) activeSonarMsg.innerHTML = '🏆 <b>FÉLICITATIONS !</b> Le relevé est intégralement reconstitué.';
      dire('🏆 <b>RELEVÉ COMPLET !</b> Le sonar a déverrouillé l’accès au palier suivant.', 'ok');
      setTimeout(function () {
        onVictoire({ erreurs: erreurs, pings: pings, temps: Math.round((Date.now() - t0) / 1000) });
      }, 550);
    }

    /* Placement d'un marqueur sur une case */
    function place(idx, cell) {
      if (fini || idx < 0 || locked[idx]) return false;

      var cibleVoulue = cibles[idx];
      var cCoord = coordLisible(cell);
      var nomItem = nomDe(idx);

      if (cibleVoulue === cell) {
        // ✅ Bonne case trouvée !
        locked[idx] = true;
        delete casesEcartees[cell];
        delete fauxParCible[cell];
        jouerSonEchoOk();
        peindreCases();

        dire('✅ <b>EXCELLENT !</b> Écho <b>' + nomItem + ' (' + nomCompletDe(idx) + ')</b> verrouillé en <b>' + cCoord + '</b>.', 'ok');

        // Passage automatique à l'écho suivant
        var suivant = -1;
        for (var p = 0; p < restants.length; p++) {
          if (!locked[restants[p]]) { suivant = restants[p]; break; }
        }
        selection = suivant;
        majConsoleActive();
        majProgression();

        if (nbPoses() >= M) {
          victoire();
        }
        return true;
      }

      // ❌ Case écartée (avec distance d'aide pour guider le joueur !)
      var d = distance(cell, cibleVoulue);
      casesEcartees[cell] = true;
      fauxParCible[cell] = d;
      peindreCases();

      var aideDist = d === 1
        ? '🔥 <b>SIGNAL BRÛLANT !</b> ' + nomItem + ' est à <b>1 case seulement</b> !'
        : (d === 2
          ? '🟡 <b>SIGNAL CHAUD !</b> ' + nomItem + ' est à <b>2 cases</b>.'
          : '❄️ Pas d’écho en ' + cCoord + ' (signal à <b>' + d + ' cases</b>).');

      dire('❌ <b>Case ' + cCoord + ' écartée.</b> ' + aideDist, d <= 2 ? 'ok' : 'warn');
      if (activeSonarMsg) activeSonarMsg.innerHTML = '📡 Dernier écho testé en <b>' + cCoord + '</b> : ' + aideDist;
      return false;
    }

    /* Ping sonar (distance) */
    function ping() {
      if (fini || selection < 0 || locked[selection]) return;
      pings++;
      jouerPingSonar();

      var cible = cibles[selection];
      var nomItem = nomDe(selection);
      var centre = Math.floor(n / 2) * n + Math.floor(n / 2);
      var dc = distance(centre, cible);
      var cCentre = coordLisible(centre);

      // Calcul par rapport au centre ou à une case déjà testée
      var msg = '';
      if (dc === 1) {
        msg = '🔥 <b>SIGNAL TRÈS FORT !</b> L’écho <b>' + nomItem + '</b> est à <b>1 case</b> du centre <b>' + cCentre + '</b> !';
      } else if (dc <= 2) {
        msg = '🟡 <b>Signal chaud :</b> L’écho <b>' + nomItem + '</b> est à <b>' + dc + ' cases</b> du centre <b>' + cCentre + '</b>.';
      } else {
        msg = '📡 <b>Ping sonar :</b> L’écho <b>' + nomItem + '</b> est à <b>' + dc + ' cases</b> du centre <b>' + cCentre + '</b>.';
      }

      dire(msg, dc <= 2 ? 'ok' : '');
      if (activeSonarMsg) activeSonarMsg.innerHTML = msg;
      majProgression();
    }

    /* Révéler un marqueur via l'aide du Capitaine */
    function reveler() {
      if (fini || erreurs >= maxErreurs || nbPoses() >= M) return;
      var pool = restants.filter(function (x) { return !locked[x]; });
      if (!pool.length) return;

      var idx = (selection >= 0 && !locked[selection]) ? selection : pool[0];
      erreurs++;
      locked[idx] = true;
      var cell = cibles[idx];
      delete casesEcartees[cell];
      delete fauxParCible[cell];

      jouerSonEchoOk();
      peindreCases();

      var cCoord = coordLisible(cell);
      dire('🔎 <b>Aide du Capitaine :</b> L’écho <b>' + nomDe(idx) + '</b> a été verrouillé sur sa coordonnée <b>' + cCoord + '</b>.', '');

      var suivant = -1;
      for (var p = 0; p < restants.length; p++) {
        if (!locked[restants[p]]) { suivant = restants[p]; break; }
      }
      selection = suivant;
      majConsoleActive();
      majProgression();

      if (nbPoses() >= M) {
        victoire();
        return;
      }
      onErreur(erreurs, maxErreurs);
    }

    /* Événements d'interaction */
    pingBtn.addEventListener('click', ping);
    revealBtn.addEventListener('click', reveler);

    // Clic sur un jeton du rack
    rack.addEventListener('click', function (e) {
      var j = e.target.closest ? e.target.closest('.marq-jeton') : null;
      if (!j || fini) return;
      var idx = Number(j.getAttribute('data-marq'));
      if (locked[idx]) return;
      selection = idx;
      majConsoleActive();
      majProgression();
      dire('🎯 Écho <b>' + nomDe(selection) + ' (' + nomCompletDe(selection) + ')</b> ciblé. Touchez sa case sur la grille.', '');
    });

    // Clic sur une case de la grille
    board.addEventListener('click', function (e) {
      var c = e.target.closest ? e.target.closest('.marq-case') : null;
      if (!c || fini) return;
      var cell = Number(c.getAttribute('data-cell'));
      if (selection < 0 || locked[selection]) {
        dire('⚠️ Choisissez d’abord un écho à placer dans la liste ci-dessus.', 'warn');
        return;
      }
      place(selection, cell);
    });

    // Initialisation du plateau
    construireAxesEtGrille();
    majConsoleActive();
    peindreCases();
    majProgression();
    dire('📡 <b>Radar opérationnel :</b> Cible active <b>' + nomDe(selection) + '</b>. Lancez un Ping pour mesurer sa distance, ou touchez sa case !', 'ok');

    if (opts.onPrete) opts.onPrete({ cases: N, marqueurs: M });
  }

  window.NautilusMarqueurs = { init: init };
})();
