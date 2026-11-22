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
    return parseFloat(out.join(''));
  }

  /* Test d'une proposition avec tolérance ±5% */
  function testerProposition(p, val) {
    var vraiPrix = decoderPrix(p);
    var tolerance = vraiPrix * 0.05;
    var borneBasse = vraiPrix - tolerance;
    var borneHaute = vraiPrix + tolerance;
    if (val >= borneBasse && val <= borneHaute) {
      return { valide: true, message: "C'est le juste prix !", prixVrai: vraiPrix };
    }
    if (val < borneBasse) {
      return { valide: false, tropBas: true, message: "C'est plus ! 👆", prixVrai: vraiPrix };
    }
    return { valide: false, tropHaut: true, message: "C'est moins ! 👇", prixVrai: vraiPrix };
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

      if (type === 'up') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.18);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === 'down') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.24);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        osc.frequency.setValueAtTime(1046.50, now + 0.24);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.48);
      } else if (type === 'lost') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
        osc.start(now);
        osc.stop(now + 0.42);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch (_) {}
  }

  function speak(text) {
    if (!sonEstActif()) return;
    try {
      if (window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined') {
        window.speechSynthesis.cancel();
        var u = new window.SpeechSynthesisUtterance(text);
        u.lang = 'fr-FR';
        u.rate = 1.1;
        u.pitch = 1.0;
        window.speechSynthesis.speak(u);
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
      + '      <span class="jp-hud-label">Succès</span>'
      + '      <span class="jp-hud-val is-cyan" id="jpHudScore">0</span>'
      + '    </div>'
      + '    <div class="jp-hud-stat">'
      + '      <span class="jp-hud-label">Pertes</span>'
      + '      <span class="jp-hud-val is-red" id="jpHudPertes">0 / 2 max</span>'
      + '    </div>'
      + '  </div>'
      + '  <div class="jp-card">'
      + '    <div class="jp-badge-ray" id="jpProdCat">Rayon Fnac</div>'
      + '    <div class="jp-photo-box">'
      + '      <img class="jp-photo" id="jpProdImg" src="assets/icon.svg" alt="Article Fnac à estimer">'
      + '    </div>'
      + '    <div class="jp-title" id="jpProdTitle">Chargement du produit...</div>'
      + '    <div class="jp-tries">'
      + '      <span class="jp-tries-label">Essais restants :</span>'
      + '      <div class="jp-dots" id="jpDots">'
      + '        <span class="jp-dot active" title="Essai 1"></span>'
      + '        <span class="jp-dot active" title="Essai 2"></span>'
      + '        <span class="jp-dot active" title="Essai 3"></span>'
      + '      </div>'
      + '    </div>'
      + '    <div class="jp-feedback is-neutral" id="jpFeedback" role="status" aria-live="polite">'
      + '      Estimez le prix régulier de ce produit Fnac (tolérance de ±5%).'
      + '    </div>'
      + '    <form class="jp-form" id="jpForm" onsubmit="return false;">'
      + '      <div class="jp-input-group">'
      + '        <input class="jp-input" id="jpInputPrix" type="number" step="0.01" min="0" placeholder="Ex: 49.99" inputmode="decimal" autocomplete="off" required>'
      + '        <span class="jp-currency">€</span>'
      + '      </div>'
      + '      <div class="jp-chips" role="group" aria-label="Ajustements rapides du prix">'
      + '        <button type="button" class="jp-chip" data-add="-50">-50€</button>'
      + '        <button type="button" class="jp-chip" data-add="-10">-10€</button>'
      + '        <button type="button" class="jp-chip" data-add="-1">-1€</button>'
      + '        <button type="button" class="jp-chip" data-add="1">+1€</button>'
      + '        <button type="button" class="jp-chip" data-add="10">+10€</button>'
      + '        <button type="button" class="jp-chip" data-add="50">+50€</button>'
      + '      </div>'
      + '      <button class="jp-btn-submit" id="jpBtnValider" type="submit">VALIDER LE PRIX ⚓</button>'
      + '    </form>'
      + '  </div>'
      + '</div>';

    var hudIndex = host.querySelector('#jpHudIndex');
    var hudScore = host.querySelector('#jpHudScore');
    var hudPertes = host.querySelector('#jpHudPertes');
    var prodCat = host.querySelector('#jpProdCat');
    var prodImg = host.querySelector('#jpProdImg');
    var prodTitle = host.querySelector('#jpProdTitle');
    var dotsContainer = host.querySelector('#jpDots');
    var feedbackBox = host.querySelector('#jpFeedback');
    var form = host.querySelector('#jpForm');
    var priceInput = host.querySelector('#jpInputPrix');
    var btnSubmit = host.querySelector('#jpBtnValider');

    var catalogueComplet = [];
    var serieProduits = [];
    var indexProduit = 0;
    var essaiCourant = 0;
    var produitsTrouves = 0;
    var produitsPerdus = 0;
    var t0Partie = null;
    var verrouTransition = false;

    function majHUD() {
      if (hudIndex) hudIndex.textContent = (Math.min(indexProduit + 1, NB_PRODUITS_PARTIE)) + ' / ' + NB_PRODUITS_PARTIE;
      if (hudScore) hudScore.textContent = String(produitsTrouves);
      if (hudPertes) hudPertes.textContent = produitsPerdus + ' / ' + MAX_PERTES_AUTORISEES + ' max';
    }

    function majPointsEssais() {
      if (!dotsContainer) return;
      var restants = Math.max(0, ESSAIS_PAR_PRODUIT - essaiCourant);
      var dots = dotsContainer.querySelectorAll('.jp-dot');
      dots.forEach(function (d, idx) {
        if (idx < restants) {
          d.className = 'jp-dot active';
        } else {
          d.className = 'jp-dot used';
        }
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
          reussite: true,
          articlesTrouves: produitsTrouves,
          articlesTotal: serieProduits.length,
          score: produitsTrouves + ' / ' + serieProduits.length,
          pourcentage: Math.round((produitsTrouves / serieProduits.length) * 100),
          duree: dureeSec
        });
      } else {
        // N'a pas atteint les 80%
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

      var vraiPrix = decoderPrix(p);
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
          if (indexProduit >= serieProduits.length) {
            conclurePartie();
          } else {
            afficherProduit();
          }
        }, delaiTransitionMs);
      } else {
        // Erreur
        essaiCourant++;
        majPointsEssais();

        var estMoins = val > borneHaute;
        playTone(estMoins ? 'down' : 'up');
        speak(estMoins ? "C'est moins !" : "C'est plus !");

        if (feedbackBox) {
          feedbackBox.className = 'jp-feedback ' + (estMoins ? 'is-down' : 'is-up');
          feedbackBox.innerHTML = estMoins
            ? '👇 <b>C’est moins !</b> Votre estimation (' + formaterEuros(val) + ') est trop haute.'
            : '👆 <b>C’est plus !</b> Votre estimation (' + formaterEuros(val) + ') est trop basse.';
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
          }, delaiTransitionMs);
        } else {
          enregistrerEtatCourant();
          if (priceInput && priceInput.select) priceInput.select();
        }
      }
    }

    // Gestion des clics boutons
    host.querySelectorAll('.jp-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (verrouTransition) return;
        var add = parseFloat(btn.dataset.add || '0');
        var cur = parseFloat(priceInput.value || '0');
        if (isNaN(cur)) cur = 0;
        var next = Math.max(0, cur + add);
        priceInput.value = next.toFixed(2);
        playTone('click');
        priceInput.focus();
      });
    });

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
        sauverEtat(equipeCode, null);
      },
      getEtat: function () {
        return {
          score: produitsTrouves,
          produitsPerdus: produitsPerdus,
          indexCourant: indexProduit,
          essaisRestants: Math.max(0, ESSAIS_PAR_PRODUIT - essaiCourant),
          total: serieProduits ? serieProduits.length : NB_PRODUITS_PARTIE
        };
      },
      getProduitCourant: function () {
        return (serieProduits && serieProduits[indexProduit]) || null;
      },
      getEssaisRestants: function () {
        return Math.max(0, ESSAIS_PAR_PRODUIT - essaiCourant);
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

      // Nouvelle partie : tirage de 10 produits aléatoires
      serieProduits = melanger(catalogueComplet).slice(0, NB_PRODUITS_PARTIE);
      indexProduit = 0;
      produitsTrouves = 0;
      produitsPerdus = 0;
      essaiCourant = 0;
      t0Partie = Date.now();
      afficherProduit();
      return instance;
    }

    return fetch('produits.json')
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
    verifierProposition: testerProposition,
    getEtatPartie: function () {
      return instanceCourante ? instanceCourante.getEtat() : null;
    },
    getProduitCourant: function () {
      return instanceCourante ? instanceCourante.getProduitCourant() : null;
    },
    getEssaisRestants: function () {
      return instanceCourante ? instanceCourante.getEssaisRestants() : 0;
    }
  };
})();
