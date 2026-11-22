/* =============================================================
   LE JUSTE PRIX DU NAUTILUS — MOTEUR DU PALIER 5 (juste-prix.js)
   -------------------------------------------------------------
   Architecture partagée Mission Nautilus :
   - 10 produits Fnac tirés au hasard par partie.
   - 3 essais maximum par produit.
   - Tolérance d'acceptation du prix : ±5%.
   - Retours immersifs : « C'est plus ! 👆 » / « C'est moins ! 👇 ».
   - À la 3e erreur sur un produit : le produit est perdu et le
     vrai prix Fnac est affiché.
   - 3 produits perdus = DÉFAITE immédiate (remontée en surface).
   - Objectif de réussite : ≥ 80% (au moins 8 produits validés sur 10).
   - Anti-triche : les prix ne sont pas stockés en clair dans le JSON.
   - Persistance de session : reprise automatique en cas de rechargement.
   ============================================================= */
(function () {
  'use strict';

  var SALT_ANTI_TRICHE = 'Nautilus_Fnac_JustePrix_2026';
  var NB_PRODUITS_PARTIE = 10;
  var ESSAIS_PAR_PRODUIT = 3;
  var MAX_PERTES_AUTORISEES = 2; // 3 pertes = défaite
  var SEUIL_VICTOIRE_MIN = 8;    // ≥ 80% (8 sur 10)

  /* Décodage anti-triche du prix masqué */
  function decoderPrix(hex, id) {
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
    return parseFloat(out.join(''));
  }

  function formaterEuros(val) {
    return Number(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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

  function playTone(type) {
    if (!sonEstActif()) return;
    try {
      var ctx = initAudioCtx();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'more') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.18);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'less') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'lost') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.setValueAtTime(160, now + 0.22);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (_) {}
  }

  function speak(text) {
    if (!sonEstActif()) return;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'fr-FR';
        u.rate = 1.12;
        window.speechSynthesis.speak(u);
      } catch (_) {}
    }
  }

  /* Sauvegarde de session mid-game */
  function cleSession(equipe) {
    return 'nautilusJustePrixEtat_' + (equipe || 'NEMO');
  }

  function sauverEtat(equipe, etat) {
    try {
      if (!etat) {
        sessionStorage.removeItem(cleSession(equipe));
      } else {
        sessionStorage.setItem(cleSession(equipe), JSON.stringify(etat));
      }
    } catch (_) {}
  }

  function chargerEtat(equipe) {
    try {
      var brut = sessionStorage.getItem(cleSession(equipe));
      return brut ? JSON.parse(brut) : null;
    } catch (_) { return null; }
  }

  /* Initialisation du moteur de jeu */
  function init(host, options) {
    if (!host) return;
    options = options || {};
    var equipeCode = options.equipe || 'NEMO';
    var onVictoire = options.onVictoire || function () {};
    var onEchec = options.onEchec || function () {};
    var onAbandon = options.onAbandon || function () {};

    host.innerHTML =
      '<div class="jp-mission">'
      + '  <div class="jp-hud">'
      + '    <div class="jp-hud-stat">'
      + '      <span class="jp-hud-label">Article</span>'
      + '      <span class="jp-hud-val is-gold" id="jpHudIndex">1 / 10</span>'
      + '    </div>'
      + '    <div class="jp-hud-stat">'
      + '      <span class="jp-hud-label">Trouvés</span>'
      + '      <span class="jp-hud-val is-success" id="jpHudFound">0 / 10</span>'
      + '    </div>'
      + '    <div class="jp-hud-stat">'
      + '      <span class="jp-hud-label">Objectif</span>'
      + '      <span class="jp-hud-val">≥ 80% (8)</span>'
      + '    </div>'
      + '    <div class="jp-hud-stat">'
      + '      <span class="jp-hud-label">Pertes</span>'
      + '      <span class="jp-hud-val is-danger" id="jpHudLost">0 / 3 max</span>'
      + '    </div>'
      + '  </div>'

      + '  <div class="jp-card" id="jpCard">'
      + '    <div class="jp-category-badge" id="jpProdCat">Rayon Fnac</div>'
      + '    <div class="jp-image-box">'
      + '      <img src="assets/icon.svg" alt="Produit Fnac" class="jp-image" id="jpProdImg" />'
      + '    </div>'
      + '    <h3 class="jp-title" id="jpProdTitle">Chargement de l’article…</h3>'
      + '    <div class="jp-attempts-box">'
      + '      <span class="jp-attempts-label" id="jpAttemptLabel">Essai 1 sur 3</span>'
      + '      <div class="jp-dots" id="jpDotsContainer">'
      + '        <span class="jp-dot is-current" id="jpDot0"></span>'
      + '        <span class="jp-dot" id="jpDot1"></span>'
      + '        <span class="jp-dot" id="jpDot2"></span>'
      + '      </div>'
      + '    </div>'
      + '    <div class="jp-input-group">'
      + '      <div class="jp-price-input-row">'
      + '        <div class="jp-input-wrap">'
      + '          <input type="number" class="jp-input" id="jpPriceInput" placeholder="0" min="0" max="9999" step="1" inputmode="numeric" aria-label="Prix estimé en euros" />'
      + '          <span class="jp-input-unit">€</span>'
      + '        </div>'
      + '        <button type="button" class="jp-btn-clear" id="jpBtnClear" title="Effacer la saisie">⌫</button>'
      + '      </div>'
      + '      <div class="jp-chips-row">'
      + '        <button type="button" class="jp-chip" data-add="1">+1 €</button>'
      + '        <button type="button" class="jp-chip" data-add="5">+5 €</button>'
      + '        <button type="button" class="jp-chip" data-add="10">+10 €</button>'
      + '        <button type="button" class="jp-chip" data-add="50">+50 €</button>'
      + '        <button type="button" class="jp-chip" data-add="100">+100 €</button>'
      + '      </div>'
      + '      <button type="button" class="jp-submit-btn" id="jpBtnSubmit">'
      + '        <span>🎯 PROPOSER MON PRIX</span>'
      + '      </button>'
      + '    </div>'
      + '    <div class="jp-feedback is-neutral" id="jpFeedback" role="status">'
      + '      Estimez le prix régulier de ce produit Fnac (tolérance de ±5%).'
      + '    </div>'
      + '  </div>'
      + '</div>';

    var hudIndex = host.querySelector('#jpHudIndex');
    var hudFound = host.querySelector('#jpHudFound');
    var hudLost = host.querySelector('#jpHudLost');
    var prodCat = host.querySelector('#jpProdCat');
    var prodImg = host.querySelector('#jpProdImg');
    var prodTitle = host.querySelector('#jpProdTitle');
    var attemptLabel = host.querySelector('#jpAttemptLabel');
    var dot0 = host.querySelector('#jpDot0');
    var dot1 = host.querySelector('#jpDot1');
    var dot2 = host.querySelector('#jpDot2');
    var priceInput = host.querySelector('#jpPriceInput');
    var btnClear = host.querySelector('#jpBtnClear');
    var btnSubmit = host.querySelector('#jpBtnSubmit');
    var feedbackBox = host.querySelector('#jpFeedback');

    var catalogueComplet = [];
    var serieProduits = [];
    var indexProduit = 0;
    var essaiCourant = 0;
    var produitsTrouves = 0;
    var produitsPerdus = 0;
    var verrouTransition = false;
    var t0Partie = Date.now();

    function majHUD() {
      if (hudIndex) hudIndex.textContent = (indexProduit + 1) + ' / ' + NB_PRODUITS_PARTIE;
      if (hudFound) hudFound.textContent = produitsTrouves + ' / ' + NB_PRODUITS_PARTIE;
      if (hudLost) hudLost.textContent = produitsPerdus + ' / 3 max';
    }

    function majPointsEssais() {
      if (attemptLabel) attemptLabel.textContent = 'Essai ' + (essaiCourant + 1) + ' sur ' + ESSAIS_PAR_PRODUIT;
      var dots = [dot0, dot1, dot2];
      for (var i = 0; i < 3; i++) {
        if (dots[i]) {
          dots[i].className = 'jp-dot'
            + (i < essaiCourant ? ' is-used' : '')
            + (i === essaiCourant ? ' is-current' : '');
        }
      }
    }

    function enregistrerEtatCourant() {
      var ids = serieProduits.map(function (p) { return p.id; });
      sauverEtat(equipeCode, {
        ids: ids,
        indexProduit: indexProduit,
        produitsTrouves: produitsTrouves,
        produitsPerdus: produitsPerdus,
        essaiCourant: essaiCourant,
        t0Partie: t0Partie
      });
    }

    function afficherProduit() {
      verrouTransition = false;
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
      majPointsEssais();

      if (feedbackBox) {
        feedbackBox.className = 'jp-feedback is-neutral';
        feedbackBox.textContent = 'Estimez le prix régulier de ce produit Fnac (tolérance de ±5%).';
      }

      enregistrerEtatCourant();
    }

    function conclurePartie() {
      sauverEtat(equipeCode, null); // Partie terminée
      var dureeSec = Math.max(0, Math.round((Date.now() - t0Partie) / 1000));

      if (produitsPerdus > MAX_PERTES_AUTORISEES) {
        // 3 produits non trouvés -> défaite
        playTone('lost');
        onEchec('erreurs');
      } else if (produitsTrouves >= SEUIL_VICTOIRE_MIN) {
        // Au moins 8 sur 10 -> victoire
        playTone('win');
        onVictoire({
          duree: dureeSec,
          score: produitsTrouves + '/' + NB_PRODUITS_PARTIE,
          trouves: produitsTrouves
        });
      } else {
        // Moins de 8 trouvés
        playTone('lost');
        onEchec('erreurs');
      }
    }

    function evaluerPrix() {
      if (verrouTransition) return;
      var val = parseFloat(priceInput.value);
      if (isNaN(val) || val <= 0) {
        if (feedbackBox) {
          feedbackBox.className = 'jp-feedback is-neutral';
          feedbackBox.textContent = '⚠️ Veuillez entrer un prix supérieur à 0 €.';
        }
        priceInput.focus();
        return;
      }

      var p = serieProduits[indexProduit];
      if (!p) return;

      var vraiPrix = decoderPrix(p.sec, p.id);
      var tolerance = vraiPrix * 0.05;
      var borneBasse = vraiPrix - tolerance;
      var borneHaute = vraiPrix + tolerance;

      if (val >= borneBasse && val <= borneHaute) {
        // Trouvé dans la fourchette ±5%
        verrouTransition = true;
        btnSubmit.disabled = true;
        priceInput.disabled = true;
        produitsTrouves++;
        majHUD();

        playTone('win');
        speak("C'est gagné !");
        if (feedbackBox) {
          feedbackBox.className = 'jp-feedback is-won';
          feedbackBox.innerHTML = '🎯 <b>C’est gagné !</b> Le juste prix était de <b>' + formaterEuros(vraiPrix) + '</b> (estimé ' + formaterEuros(val) + ').';
        }

        setTimeout(function () {
          indexProduit++;
          essaiCourant = 0;
          if (indexProduit < serieProduits.length && produitsPerdus <= MAX_PERTES_AUTORISEES) {
            afficherProduit();
          } else {
            conclurePartie();
          }
        }, 1800);

      } else {
        // Erreur
        essaiCourant++;
        majPointsEssais();

        if (val < borneBasse) {
          playTone('more');
          speak("C'est plus !");
          if (feedbackBox) {
            feedbackBox.className = 'jp-feedback is-more';
            feedbackBox.innerHTML = '👆 <b>C’est plus !</b> (' + formaterEuros(val) + ' est trop bas)';
          }
        } else {
          playTone('less');
          speak("C'est moins !");
          if (feedbackBox) {
            feedbackBox.className = 'jp-feedback is-less';
            feedbackBox.innerHTML = '👇 <b>C’est moins !</b> (' + formaterEuros(val) + ' est trop élevé)';
          }
        }

        if (essaiCourant >= ESSAIS_PAR_PRODUIT) {
          // 3 erreurs : le produit est perdu et le vrai prix est affiché
          verrouTransition = true;
          btnSubmit.disabled = true;
          priceInput.disabled = true;
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
            if (produitsPerdus > MAX_PERTES_AUTORISEES || indexProduit >= serieProduits.length) {
              conclurePartie();
            } else {
              afficherProduit();
            }
          }, 2200);
        } else {
          enregistrerEtatCourant();
          priceInput.select();
        }
      }
    }

    // Gestion des clics boutons
    host.querySelectorAll('.jp-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (verrouTransition) return;
        var add = parseFloat(this.dataset.add || '0');
        var cur = parseFloat(priceInput.value || '0');
        if (isNaN(cur)) cur = 0;
        priceInput.value = Math.max(0, Math.round(cur + add));
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
      btnSubmit.addEventListener('click', evaluerPrix);
    }

    if (priceInput) {
      priceInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          evaluerPrix();
        }
      });
    }

    // Chargement du catalogue et reprise / démarrage
    function demarrerAvecCatalogue(catalogue) {
      if (!Array.isArray(catalogue) || catalogue.length === 0) {
        host.innerHTML =
          '<div class="status-banner warning" style="margin:20px 0;padding:16px;">'
          + '⚠️ <b>Catalogue indisponible.</b> La liste des produits du Juste Prix est vide ou n’a pas pu être chargée.<br><br>'
          + '<button type="button" class="btn" id="btnJpRetry" style="padding:10px 18px;border-radius:10px;background:var(--fnac,#f5b027);color:#111;font-weight:900;cursor:pointer;">🔄 Réessayer le chargement</button>'
          + '</div>';
        var b = host.querySelector('#btnJpRetry');
        if (b) b.addEventListener('click', function () { init(host, options); });
        return;
      }

      catalogueComplet = catalogue;
      var etatSauve = chargerEtat(equipeCode);

      if (etatSauve && Array.isArray(etatSauve.ids) && etatSauve.ids.length === NB_PRODUITS_PARTIE) {
        // Restauration de session en cours
        serieProduits = etatSauve.ids.map(function (id) {
          return catalogueComplet.find(function (p) { return p.id === id; });
        }).filter(Boolean);

        if (serieProduits.length === NB_PRODUITS_PARTIE) {
          indexProduit = etatSauve.indexProduit || 0;
          produitsTrouves = etatSauve.produitsTrouves || 0;
          produitsPerdus = etatSauve.produitsPerdus || 0;
          essaiCourant = etatSauve.essaiCourant || 0;
          t0Partie = etatSauve.t0Partie || Date.now();
          afficherProduit();
          return;
        }
      }

      // Nouvelle partie : tirage de 10 produits aléatoires
      serieProduits = melanger(catalogueComplet).slice(0, NB_PRODUITS_PARTIE);
      indexProduit = 0;
      produitsTrouves = 0;
      produitsPerdus = 0;
      essaiCourant = 0;
      t0Partie = Date.now();
      afficherProduit();
    }

    fetch('produits.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        demarrerAvecCatalogue(data);
      })
      .catch(function (_) {
        // Fallback si fetch échoue
        demarrerAvecCatalogue([]);
      });

    return {
      arreter: function () {
        sauverEtat(equipeCode, null);
      }
    };
  }

  window.NautilusJustePrix = {
    init: init,
    decoderPrix: decoderPrix
  };
})();
