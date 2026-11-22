/* =============================================================
   LE JUSTE PRIX DU NAUTILUS — MOTEUR DU PALIER 5 (juste-prix.js)
   -------------------------------------------------------------
   Architecture partagée Mission Nautilus :
   - 10 produits Fnac tirés au hasard par partie.
   - Catalogue et prix rechargés frais à chaque lancement (anti-cache).
   - 3 essais maximum par produit.
   - 3 voyants rouges vifs qui s'illuminent à chaque erreur.
   - Chronomètre de 10 secondes par réponse.
   - Évaluation au juste prix EXACT (aucune tolérance).
   - Retours sonores immersifs distincts (plus / moins / erreur / succès).
   - Aucune voix off de synthèse vocale.
   - Animation de pouce 👍 vert (succès) ou 👎🏻 rouge (échec).
   - À la 3e erreur sur un produit : le produit est perdu et le
     vrai prix Fnac est affiché.
   - Si le matelot n'atteint pas 8 réponses trouvées sur 10 :
     DÉFAITE immédiate et remontée en surface (blocage matelot).
   - Anti-triche : les prix ne sont pas stockés en clair dans le JSON.
   - Persistance de session : reprise automatique en cas de rechargement.
   ============================================================= */
(function () {
  'use strict';

  var SALT_ANTI_TRICHE = 'Nautilus_Fnac_JustePrix_2026';
  var NB_PRODUITS_PARTIE = 10;
  var ESSAIS_PAR_PRODUIT = 3;
  var SEUIL_VICTOIRE_MIN = 8;    // ≥ 80% (8 sur 10)
  var TEMPS_REPONSE_SEC = 10;    // 10 secondes par réponse

  var instanceCourante = null;

  /* Décodage anti-triche du prix masqué */
  function decoderPrix(hexOrProd, optId) {
    var hex = hexOrProd;
    var id = optId;
    if (hexOrProd && typeof hexOrProd === 'object') {
      hex = hexOrProd.sec;
      id = hexOrProd.id;
    }
    if (!hex || typeof hex !== 'string') return 0;
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.slice(i, i + 2), 16));
    }
    var key = SALT_ANTI_TRICHE + id;
    var out = [];
    for (var j = 0; j < bytes.length; j++) {
      out.push(String.fromCharCode(bytes[j] ^ key.charCodeAt(j % key.length)));
    }
    return Math.round(parseFloat(out.join('')));
  }

  function aleaSeed(graine) {
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

  function tirerProduitsEquipe(catalogue, equipeCode) {
    if (!catalogue || !catalogue.length) return [];
    var rnd = aleaSeed('palier5_' + String(equipeCode || 'NEMO').toUpperCase());
    var pool = catalogue.slice();
    var selection = [];
    for (var i = 0; i < NB_PRODUITS_PARTIE && pool.length > 0; i++) {
      var idx = Math.floor(rnd() * pool.length);
      selection.push(pool.splice(idx, 1)[0]);
    }
    return selection;
  }

  /* Test d'une proposition : prix EXACT (aucune tolérance) */
  function testerProposition(p, val) {
    var vraiPrix = decoderPrix(p);
    var v = Math.round(Number(val));
    if (isNaN(v)) return { valide: false, message: "Proposition invalide", prixVrai: vraiPrix };
    if (v === vraiPrix) {
      return { valide: true, message: "C'est le juste prix !", prixVrai: vraiPrix };
    }
    if (v < vraiPrix) {
      return { valide: false, tropBas: true, message: "C'est plus ! 👆", prixVrai: vraiPrix };
    }
    return { valide: false, tropHaut: true, message: "C'est moins ! 👇", prixVrai: vraiPrix };
  }

  function formaterEuros(val) {
    return Math.round(Number(val)) + ' €';
  }

  function melanger(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Gestion sonore respectant NautilusSon (silence total si sonar coupé) */
  var audioCtx = null;
  function sonEstActif() {
    if (window.NautilusSon && typeof window.NautilusSon.sonActif === 'function') {
      return window.NautilusSon.sonActif();
    }
    try { return localStorage.getItem('nautilusSoundOn') !== '0'; }
    catch (_) { return true; }
  }

  function initAudioCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try {
          audioCtx = new AC();
          if (window.NautilusSon && window.NautilusSon.registerContexte) {
            window.NautilusSon.registerContexte(audioCtx);
          }
        } catch (_) {}
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  /* Sons Web Audio distincts pour chaque événement */
  function playTone(type) {
    if (!sonEstActif()) return;
    try {
      var ctx = initAudioCtx();
      if (!ctx) return;
      var now = ctx.currentTime;

      if (type === 'more') {
        // Son distinct pour "C'est plus" : deux bips harmoniques ascendants
        var osc1 = ctx.createOscillator();
        var gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(380, now);
        osc1.frequency.exponentialRampToValueAtTime(520, now + 0.08);
        osc1.frequency.setValueAtTime(520, now + 0.09);
        osc1.frequency.exponentialRampToValueAtTime(740, now + 0.22);
        gain1.gain.setValueAtTime(0.22, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.26);
      } else if (type === 'less') {
        // Son distinct pour "C'est moins" : deux bips harmoniques descendants
        var osc2 = ctx.createOscillator();
        var gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(680, now);
        osc2.frequency.exponentialRampToValueAtTime(500, now + 0.08);
        osc2.frequency.setValueAtTime(500, now + 0.09);
        osc2.frequency.exponentialRampToValueAtTime(280, now + 0.22);
        gain2.gain.setValueAtTime(0.22, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.26);
      } else if (type === 'error') {
        // Son d'erreur : sonnerie d'alerte / buzzer
        var oscE = ctx.createOscillator();
        var gainE = ctx.createGain();
        oscE.type = 'sawtooth';
        oscE.frequency.setValueAtTime(160, now);
        oscE.frequency.setValueAtTime(130, now + 0.12);
        gainE.gain.setValueAtTime(0.2, now);
        gainE.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        oscE.connect(gainE);
        gainE.connect(ctx.destination);
        oscE.start(now);
        oscE.stop(now + 0.3);
      } else if (type === 'win') {
        // Son de réussite : carillon triomphant en 4 notes
        var notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach(function (freq, idx) {
          var o = ctx.createOscillator();
          var g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, now + idx * 0.07);
          g.gain.setValueAtTime(0.2, now + idx * 0.07);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.32);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(now + idx * 0.07);
          o.stop(now + idx * 0.07 + 0.34);
        });
      } else if (type === 'lost') {
        // Son de produit perdu / défaite : klaxon sous-marin descendant
        var oscL = ctx.createOscillator();
        var gainL = ctx.createGain();
        oscL.type = 'sawtooth';
        oscL.frequency.setValueAtTime(220, now);
        oscL.frequency.exponentialRampToValueAtTime(70, now + 0.45);
        gainL.gain.setValueAtTime(0.25, now);
        gainL.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        oscL.connect(gainL);
        gainL.connect(ctx.destination);
        oscL.start(now);
        oscL.stop(now + 0.5);
      } else if (type === 'click') {
        var oscC = ctx.createOscillator();
        var gainC = ctx.createGain();
        oscC.type = 'sine';
        oscC.frequency.setValueAtTime(480, now);
        gainC.gain.setValueAtTime(0.08, now);
        gainC.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        oscC.connect(gainC);
        gainC.connect(ctx.destination);
        oscC.start(now);
        oscC.stop(now + 0.05);
      }
    } catch (_) {}
  }

  /* Sauvegarde de session mid-game */
  function cleSession(equipe) {
    return 'nautilusJustePrixEtat_' + (equipe || 'NEMO');
  }

  function sauverEtat(equipe, etat) {
    try {
      if (!etat) {
        sessionStorage.removeItem(cleSession(equipe));
        sessionStorage.removeItem('nautilusJustePrixSession');
      } else {
        var str = JSON.stringify(etat);
        sessionStorage.setItem(cleSession(equipe), str);
        sessionStorage.setItem('nautilusJustePrixSession', str);
      }
    } catch (_) {}
  }

  function chargerEtat(equipe) {
    try {
      var brut = sessionStorage.getItem(cleSession(equipe)) || sessionStorage.getItem('nautilusJustePrixSession');
      return brut ? JSON.parse(brut) : null;
    } catch (_) { return null; }
  }

  /* Initialisation du moteur de jeu */
  function init(host, options) {
    if (!host) return Promise.resolve(null);
    options = options || {};
    var equipeCode = options.equipe || 'NEMO';
    var onVictoire = options.onVictoire || function () {};
    var onEchec = options.onEchec || function () {};
    var onAbandon = options.onAbandon || function () {};
    var delaiTransitionMs = options.delaiTransitionMs || 1800;

    host.innerHTML =
      '<div class="jp-mission">'
      + '  <div class="jp-hud">'
      + '    <div class="jp-hud-stat">'
      + '      <span class="jp-hud-label">Article</span>'
      + '      <span class="jp-hud-val is-gold" id="jpHudIndex">1 / 10</span>'
      + '    </div>'
      + '    <div class="jp-hud-stat">'
      + '      <span class="jp-hud-label">Trouvés</span>'
      + '      <span class="jp-hud-val is-cyan" id="jpHudScore">0 / 10</span>'
      + '    </div>'
      + '    <div class="jp-hud-stat">'
      + '      <span class="jp-hud-label">Pertes</span>'
      + '      <span class="jp-hud-val is-danger" id="jpHudPertes">0 / 2 max</span>'
      + '    </div>'
      + '  </div>'
      + '  <div class="jp-card">'
      + '    <div class="jp-product-header">'
      + '      <div class="jp-image-box">'
      + '        <img class="jp-image" id="jpProdImg" src="assets/icon.svg" alt="Article Fnac à estimer">'
      + '        <div class="jp-thumb is-win" id="jpThumbWin" aria-hidden="true"><span class="jp-thumb-ico">👍</span></div>'
      + '        <div class="jp-thumb is-loss" id="jpThumbLoss" aria-hidden="true"><span class="jp-thumb-ico">👎🏻</span></div>'
      + '      </div>'
      + '      <div class="jp-product-info">'
      + '        <span class="jp-category-badge" id="jpProdCat">Rayon Fnac</span>'
      + '        <h3 class="jp-title" id="jpProdTitle">Chargement de l’article…</h3>'
      + '      </div>'
      + '    </div>'
      + '    <div class="jp-status-row">'
      + '      <div class="jp-voyants-box" role="status" aria-label="Erreurs sur l\'article">'
      + '        <span class="jp-voyants-label">Erreurs</span>'
      + '        <div class="jp-voyants" id="jpVoyantsContainer">'
      + '          <span class="jp-voyant" id="jpVoyant1" title="Erreur 1">1</span>'
      + '          <span class="jp-voyant" id="jpVoyant2" title="Erreur 2">2</span>'
      + '          <span class="jp-voyant" id="jpVoyant3" title="Erreur 3">3</span>'
      + '        </div>'
      + '      </div>'
      + '      <div class="jp-timer-box" role="timer" aria-label="Temps restant pour répondre">'
      + '        <div class="jp-timer-head">'
      + '          <span>Chrono</span>'
      + '          <span class="jp-timer-val" id="jpTimerVal">10s</span>'
      + '        </div>'
      + '        <div class="jp-timer-track">'
      + '          <div class="jp-timer-bar" id="jpTimerBar" style="width:100%;"></div>'
      + '        </div>'
      + '      </div>'
      + '    </div>'
      + '    <div class="jp-feedback is-neutral" id="jpFeedback" role="status" aria-live="polite">'
      + '      Estimez le juste prix exact (10s par réponse).<br><span style="font-size:11px;color:#9bc4d4;font-weight:600">Arrondi à l’euro : 87,98 € = 88 € · 112,90 € = 113 € · 34,50 € = 35 € · 11,49 € = 11 €</span>'
      + '    </div>'
      + '    <form class="jp-form" id="jpForm" onsubmit="return false;">'
      + '      <div class="jp-input-group">'
      + '        <div class="jp-price-input-row">'
      + '          <div class="jp-input-wrap">'
      + '            <input class="jp-input" id="jpInputPrix" type="number" step="1" min="1" max="9999" placeholder="Ex: 150" inputmode="numeric" autocomplete="off" required>'
      + '            <span class="jp-input-unit">€</span>'
      + '          </div>'
      + '          <button type="button" class="jp-btn-clear" id="jpBtnClear" title="Effacer la saisie">⌫</button>'
      + '        </div>'
      + '        <div class="jp-chips-row" role="group" aria-label="Ajustements rapides du prix">'
      + '          <button type="button" class="jp-chip" data-add="-50">-50 €</button>'
      + '          <button type="button" class="jp-chip" data-add="-10">-10 €</button>'
      + '          <button type="button" class="jp-chip" data-add="-1">-1 €</button>'
      + '          <button type="button" class="jp-chip" data-add="1">+1 €</button>'
      + '          <button type="button" class="jp-chip" data-add="10">+10 €</button>'
      + '          <button type="button" class="jp-chip" data-add="50">+50 €</button>'
      + '        </div>'
      + '        <button class="jp-submit-btn" id="jpBtnValider" type="submit">VALIDER LE PRIX ⚓</button>'
      + '      </div>'
      + '    </form>'
      + '  </div>'
      + '</div>';

    var hudIndex = host.querySelector('#jpHudIndex');
    var hudScore = host.querySelector('#jpHudScore');
    var hudPertes = host.querySelector('#jpHudPertes');
    var prodCat = host.querySelector('#jpProdCat');
    var prodImg = host.querySelector('#jpProdImg');
    var prodTitle = host.querySelector('#jpProdTitle');
    var thumbWin = host.querySelector('#jpThumbWin');
    var thumbLoss = host.querySelector('#jpThumbLoss');
    var voyant1 = host.querySelector('#jpVoyant1');
    var voyant2 = host.querySelector('#jpVoyant2');
    var voyant3 = host.querySelector('#jpVoyant3');
    var timerVal = host.querySelector('#jpTimerVal');
    var timerBar = host.querySelector('#jpTimerBar');
    var feedbackBox = host.querySelector('#jpFeedback');
    var form = host.querySelector('#jpForm');
    var priceInput = host.querySelector('#jpInputPrix');
    var btnClear = host.querySelector('#jpBtnClear');
    var btnSubmit = host.querySelector('#jpBtnValider');

    var catalogueComplet = [];
    var serieProduits = [];
    var indexProduit = 0;
    var essaiCourant = 0;
    var produitsTrouves = 0;
    var produitsPerdus = 0;
    var t0Partie = null;
    var verrouTransition = false;

    /* Timer 10 secondes */
    var timerInterval = null;
    var tempsRestant = TEMPS_REPONSE_SEC;

    function arreterTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    function demarrerTimer() {
      arreterTimer();
      if (verrouTransition) return;
      tempsRestant = TEMPS_REPONSE_SEC;
      majRenduTimer();

      timerInterval = setInterval(function () {
        if (verrouTransition) {
          arreterTimer();
          return;
        }
        tempsRestant = Math.max(0, tempsRestant - 0.1);
        majRenduTimer();

        if (tempsRestant <= 0) {
          arreterTimer();
          gererTempsEcoule();
        }
      }, 100);
    }

    function majRenduTimer() {
      if (!timerVal || !timerBar) return;
      var secEntiere = Math.ceil(tempsRestant);
      timerVal.textContent = secEntiere + 's';
      var pct = Math.max(0, Math.min(100, (tempsRestant / TEMPS_REPONSE_SEC) * 100));
      timerBar.style.width = pct.toFixed(1) + '%';

      timerVal.className = 'jp-timer-val'
        + (secEntiere <= 3 ? ' is-critical' : secEntiere <= 5 ? ' is-warning' : '');
      timerBar.className = 'jp-timer-bar'
        + (secEntiere <= 3 ? ' is-critical' : secEntiere <= 5 ? ' is-warning' : '');
    }

    function declencherPouce(type) {
      if (thumbWin) thumbWin.classList.remove('animate');
      if (thumbLoss) thumbLoss.classList.remove('animate');
      if (type === 'win' && thumbWin) {
        void thumbWin.offsetWidth;
        thumbWin.classList.add('animate');
      } else if (type === 'loss' && thumbLoss) {
        void thumbLoss.offsetWidth;
        thumbLoss.classList.add('animate');
      }
    }

    function gererTempsEcoule() {
      if (verrouTransition) return;
      essaiCourant++;
      majVoyants();

      var p = serieProduits[indexProduit];
      var vraiPrix = decoderPrix(p);

      playTone('error');
      declencherPouce('loss');

      if (feedbackBox) {
        feedbackBox.className = 'jp-feedback is-lost';
        feedbackBox.innerHTML = '⏱️ <b>Temps écoulé (10s) !</b> Essai ' + essaiCourant + '/3 perdu.';
      }

      if (essaiCourant >= ESSAIS_PAR_PRODUIT) {
        // 3e erreur : produit perdu
        verrouTransition = true;
        arreterTimer();
        if (btnSubmit) btnSubmit.disabled = true;
        if (priceInput) priceInput.disabled = true;
        produitsPerdus++;
        majHUD();

        playTone('lost');
        if (feedbackBox) {
          feedbackBox.className = 'jp-feedback is-lost';
          feedbackBox.innerHTML = '❌ <b>Produit perdu !</b> Le juste prix Fnac était de <b>' + formaterEuros(vraiPrix) + '</b>.';
        }

        setTimeout(function () {
          indexProduit++;
          essaiCourant = 0;
          if (produitsPerdus >= 3 || indexProduit >= serieProduits.length) {
            conclurePartie();
          } else {
            afficherProduit();
          }
        }, delaiTransitionMs);
      } else {
        // Relance le chrono pour l'essai suivant
        enregistrerEtatCourant();
        demarrerTimer();
        if (priceInput) priceInput.focus();
      }
    }

    function majHUD() {
      if (hudIndex) hudIndex.textContent = (Math.min(indexProduit + 1, NB_PRODUITS_PARTIE)) + ' / ' + NB_PRODUITS_PARTIE;
      if (hudScore) hudScore.textContent = produitsTrouves + ' / ' + NB_PRODUITS_PARTIE;
      if (hudPertes) hudPertes.textContent = produitsPerdus + ' / 2 max';
    }

    /* Mise à jour des voyants : 1 voyant rouge vif s'illumine à chaque erreur */
    function majVoyants() {
      var voyants = [voyant1, voyant2, voyant3];
      for (var i = 0; i < 3; i++) {
        if (voyants[i]) {
          if (i < essaiCourant) {
            voyants[i].className = 'jp-voyant is-error';
          } else {
            voyants[i].className = 'jp-voyant';
          }
        }
      }
    }

    function afficherProduit() {
      verrouTransition = false;
      if (thumbWin) thumbWin.classList.remove('animate');
      if (thumbLoss) thumbLoss.classList.remove('animate');
      if (btnSubmit) btnSubmit.disabled = false;
      if (priceInput) {
        priceInput.disabled = false;
        priceInput.value = '';
        priceInput.focus();
      }

      var p = serieProduits[indexProduit];
      if (!p) {
        conclurePartie();
        return;
      }

      if (prodCat) prodCat.textContent = p.categorie || 'Rayon Fnac';
      if (prodTitle) prodTitle.textContent = p.nom;
      if (prodImg) {
        prodImg.src = p.image || 'assets/icon.svg';
        prodImg.onerror = function () { this.src = 'assets/icon.svg'; };
      }

      majHUD();
      majVoyants();

      if (feedbackBox) {
        feedbackBox.className = 'jp-feedback is-neutral';
        feedbackBox.textContent = 'Estimez le juste prix exact de ce produit Fnac (10s par réponse).';
      }

      enregistrerEtatCourant();
      demarrerTimer();
    }

    function enregistrerEtatCourant() {
      sauverEtat(equipeCode, {
        ids: serieProduits.map(function (p) { return p.id; }),
        indexProduit: indexProduit,
        indexCourant: indexProduit,
        produitsTrouves: produitsTrouves,
        score: produitsTrouves,
        produitsPerdus: produitsPerdus,
        essaiCourant: essaiCourant,
        t0Partie: t0Partie
      });
    }

    function conclurePartie() {
      arreterTimer();
      sauverEtat(equipeCode, null); // Partie terminée
      var dureeSec = Math.max(0, Math.round((Date.now() - t0Partie) / 1000));

      // Règle stricte : si le matelot n'atteint pas 8 réponses trouvées -> DÉFAITE
      if (produitsTrouves >= SEUIL_VICTOIRE_MIN && produitsPerdus <= 2) {
        // Au moins 8 sur 10 -> victoire
        playTone('win');
        declencherPouce('win');
        onVictoire({
          reussite: true,
          articlesTrouves: produitsTrouves,
          articlesTotal: serieProduits.length,
          score: produitsTrouves + ' / ' + serieProduits.length,
          pourcentage: Math.round((produitsTrouves / serieProduits.length) * 100),
          duree: dureeSec
        });
      } else {
        // Moins de 8 réponses trouvées ou 3 pertes -> défaite immédiate (remontée en surface)
        playTone('lost');
        declencherPouce('loss');
        onEchec('erreurs');
      }
    }

    function evaluerPrix() {
      if (verrouTransition) return;
      var val = Math.round(parseFloat(priceInput.value));
      if (isNaN(val) || val <= 0) {
        if (feedbackBox) {
          feedbackBox.className = 'jp-feedback is-neutral';
          feedbackBox.textContent = '⚠️ Veuillez entrer un prix supérieur à 0 €.';
        }
        priceInput.focus();
        return;
      }

      arreterTimer();
      var p = serieProduits[indexProduit];
      if (!p) return;

      var vraiPrix = decoderPrix(p);

      if (val === vraiPrix) {
        // Trouvé au juste prix exact
        verrouTransition = true;
        if (btnSubmit) btnSubmit.disabled = true;
        if (priceInput) priceInput.disabled = true;
        produitsTrouves++;
        majHUD();

        playTone('win');
        declencherPouce('win');
        if (feedbackBox) {
          feedbackBox.className = 'jp-feedback is-won';
          feedbackBox.innerHTML = '🎯 <b>C’est le juste prix !</b> Exactement <b>' + formaterEuros(vraiPrix) + '</b>.';
        }

        setTimeout(function () {
          indexProduit++;
          essaiCourant = 0;
          if (indexProduit >= serieProduits.length || produitsPerdus >= 3) {
            conclurePartie();
          } else {
            afficherProduit();
          }
        }, delaiTransitionMs);
      } else {
        // Erreur
        essaiCourant++;
        majVoyants();

        var estMoins = val > vraiPrix;
        playTone(estMoins ? 'less' : 'more');
        declencherPouce('loss');

        if (feedbackBox) {
          feedbackBox.className = 'jp-feedback ' + (estMoins ? 'is-less' : 'is-more');
          feedbackBox.innerHTML = estMoins
            ? '👇 <b>C’est moins !</b> Votre estimation (' + formaterEuros(val) + ') est trop haute.'
            : '👆 <b>C’est plus !</b> Votre estimation (' + formaterEuros(val) + ') est trop basse.';
        }

        if (essaiCourant >= ESSAIS_PAR_PRODUIT) {
          // 3e erreur : produit perdu
          verrouTransition = true;
          if (btnSubmit) btnSubmit.disabled = true;
          if (priceInput) priceInput.disabled = true;
          produitsPerdus++;
          majHUD();

          playTone('lost');
          if (feedbackBox) {
            feedbackBox.className = 'jp-feedback is-lost';
            feedbackBox.innerHTML = '❌ <b>Produit perdu !</b> Le juste prix Fnac était de <b>' + formaterEuros(vraiPrix) + '</b>.';
          }

          setTimeout(function () {
            indexProduit++;
            essaiCourant = 0;
            if (produitsPerdus >= 3 || indexProduit >= serieProduits.length) {
              conclurePartie();
            } else {
              afficherProduit();
            }
          }, delaiTransitionMs);
        } else {
          enregistrerEtatCourant();
          demarrerTimer();
          if (priceInput && priceInput.select) priceInput.select();
        }
      }
    }

    // Gestion des clics boutons chips
    host.querySelectorAll('.jp-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (verrouTransition) return;
        var add = parseFloat(btn.dataset.add || '0');
        var cur = parseFloat(priceInput.value || '0');
        if (isNaN(cur)) cur = 0;
        var next = Math.max(0, Math.round(cur + add));
        priceInput.value = String(next);
        playTone('click');
        priceInput.focus();
      });
    });

    if (btnClear) {
      btnClear.addEventListener('click', function () {
        if (verrouTransition) return;
        priceInput.value = '';
        priceInput.focus();
      });
    }

    if (btnSubmit) {
      btnSubmit.addEventListener('click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        evaluerPrix();
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        evaluerPrix();
      });
    }

    var instance = {
      arreter: function () {
        arreterTimer();
        sauverEtat(equipeCode, null);
      },
      getEtat: function () {
        return {
          score: produitsTrouves,
          produitsTrouves: produitsTrouves,
          produitsPerdus: produitsPerdus,
          indexCourant: indexProduit,
          essaiCourant: essaiCourant,
          essaisRestants: Math.max(0, ESSAIS_PAR_PRODUIT - essaiCourant),
          total: serieProduits ? serieProduits.length : NB_PRODUITS_PARTIE
        };
      },
      getProduitCourant: function () {
        return (serieProduits && serieProduits[indexProduit]) || null;
      },
      getEssaisRestants: function () {
        return Math.max(0, ESSAIS_PAR_PRODUIT - essaiCourant);
      },
      getTempsRestant: function () {
        return tempsRestant;
      },
      forcerTempsEcoule: function () {
        arreterTimer();
        gererTempsEcoule();
      }
    };
    instanceCourante = instance;

    function demarrerAvecCatalogue(catalogue) {
      if (!Array.isArray(catalogue) || catalogue.length === 0) {
        host.innerHTML =
          '<div class="status-banner warning jp-vide" style="margin:20px 0;">'
          + '  ⚠️ <b>Catalogue indisponible :</b> Aucun article disponible pour l’épreuve du Juste Prix. Veuillez contacter l’organisation.'
          + '  <div style="margin-top:10px;"><button class="jp-btn-submit" type="button" id="btnJpRetry">🔄 Réessayer</button></div>'
          + '</div>';
        var b = host.querySelector('#btnJpRetry');
        if (b) b.addEventListener('click', function () { init(host, options); });
        return instance;
      }

      catalogueComplet = catalogue;
      var etatSauve = chargerEtat(equipeCode);

      if (etatSauve && Array.isArray(etatSauve.ids) && etatSauve.ids.length === NB_PRODUITS_PARTIE) {
        // Restauration de session en cours
        serieProduits = etatSauve.ids.map(function (id) {
          return catalogueComplet.find(function (p) { return p.id === id; });
        }).filter(Boolean);

        if (serieProduits.length === NB_PRODUITS_PARTIE) {
          indexProduit = etatSauve.indexProduit || etatSauve.indexCourant || 0;
          produitsTrouves = etatSauve.produitsTrouves || etatSauve.score || 0;
          produitsPerdus = etatSauve.produitsPerdus || 0;
          essaiCourant = etatSauve.essaiCourant || 0;
          t0Partie = etatSauve.t0Partie || Date.now();
          afficherProduit();
          return instance;
        }
      }

      // Nouvelle partie : tirage des 10 produits déterminés pour l'équipage
      serieProduits = tirerProduitsEquipe(catalogueComplet, equipeCode);
      if (!serieProduits || serieProduits.length !== NB_PRODUITS_PARTIE) {
        serieProduits = melanger(catalogueComplet).slice(0, NB_PRODUITS_PARTIE);
      }
      indexProduit = 0;
      produitsTrouves = 0;
      produitsPerdus = 0;
      essaiCourant = 0;
      t0Partie = Date.now();
      afficherProduit();
      return instance;
    }

    // Récupération anti-cache à chaque lancement
    return fetch('produits.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        return demarrerAvecCatalogue(data);
      })
      .catch(function (_) {
        return demarrerAvecCatalogue([]);
      });
  }

  window.NautilusJustePrix = {
    init: init,
    decoderPrix: decoderPrix,
    decrypterPrix: decoderPrix,
    tirerProduitsEquipe: tirerProduitsEquipe,
    verifierProposition: testerProposition,
    getEtatPartie: function () {
      return instanceCourante ? instanceCourante.getEtat() : null;
    },
    getProduitCourant: function () {
      return instanceCourante ? instanceCourante.getProduitCourant() : null;
    },
    getEssaisRestants: function () {
      return instanceCourante ? instanceCourante.getEssaisRestants() : 0;
    },
    forcerTempsEcoule: function () {
      if (instanceCourante) instanceCourante.forcerTempsEcoule();
    }
  };
})();
