/* =============================================================
   CLUEDO DES ABYSSES — moteur de l'épreuve du Palier 3
   (cluedo-palier3.js)

   ÉPREUVE DE DÉDUCTION (adaptée du Cluedo), « très complexe » :
   découvrir où le Nautilus a scellé le QR Code du palier suivant.
   La réponse est un TRIPLET (PRODUIT repère · RAYON · EMPLACEMENT),
   parmi 6 × 6 × 6 = 216 combinaisons. La configuration (cartes
   « hors de cause », témoignages « exactement k affirmations vraies
   parmi n », réserve) est GÉNÉRÉE ET VALIDÉE par
   tools/generer_cluedo.py : l'ensemble des indices ne laisse qu'UNE
   SEULE solution, jamais de contradiction.

   Mécanique :
     • DOSSIER DU CAPITAINE : cartes « hors de cause » (éliminations) ;
     • TÉMOIGNAGES : « parmi ces n affirmations, exactement k sont
       vraies » — le cœur de la déduction ;
     • SONAR : 3 sondages, chacun donne un verdict ✅/❌ PAR CATÉGORIE
       et révèle une carte de la réserve ;
     • ACCUSATION : proposer le triplet complet. Juste = victoire ;
       faux = 1 erreur + une carte de réserve (3 erreurs = remontée).

   Utilisation (mêmes conventions que mots-croises.js du Palier 2) :
     window.NautilusCluedo.init(hote, {
       config: CLUEDO,          // const générée par generer_cluedo.py
       maxErreurs: 3,
       onErreur: function (n, max) { … },
       onVictoire: function () { … }
     });
   ============================================================= */
(function () {
  'use strict';
  if (window.NautilusCluedo) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Libellé d'un identifiant (les ids des trois catégories sont tous
     distincts : un seul dictionnaire suffit). */
  function construireLabels(cfg) {
    var map = {};
    ['produit', 'rayon', 'emplacement'].forEach(function (cat) {
      (cfg.categories[cat].items || []).forEach(function (it) {
        map[it.id] = it.label;
      });
    });
    return map;
  }

  /* Humanise un atome logique (partagé avec le générateur Python). */
  function atomLabel(a, labels) {
    function l(x) { return labels[x] || String(x); }
    switch (a.t) {
      case 'prod_is':   return 'le produit est « ' + l(a.x) + ' »';
      case 'prod_not':  return 'le produit n’est pas « ' + l(a.x) + ' »';
      case 'rayon_is':  return 'le QR est au rayon « ' + l(a.x) + ' »';
      case 'rayon_not': return 'le QR n’est pas au rayon « ' + l(a.x) + ' »';
      case 'empl_is':   return 'l’emplacement est « ' + l(a.x) + ' »';
      case 'empl_not':  return 'l’emplacement n’est pas « ' + l(a.x) + ' »';
      case 'pair_is':   return '« ' + l(a.x) + ' » est au rayon « ' + l(a.r) + ' »';
      case 'pair_not':  return '« ' + l(a.x) + ' » n’est pas au rayon « ' + l(a.r) + ' »';
      default: return String(a.t);
    }
  }

  function temLabel(t) {
    var n = (t.atoms || []).length;
    if (t.k === 0) return 'Aucune de ces ' + n + ' affirmations n’est vraie :';
    if (t.k === n) return 'Ces ' + n + ' affirmations sont TOUTES vraies :';
    return 'Parmi ces ' + n + ' affirmations, exactement ' + t.k + ' sont vraies :';
  }

  var state = null;

  function render(host) {
    var cfg = state.cfg;
    var labels = state.labels;
    var S = state.secret;

    var cols = ['produit', 'rayon', 'emplacement'].map(function (cat) {
      var items = cfg.categories[cat].items.map(function (it) {
        var cle = cat + ':' + it.id;
        var marque = state.marques[cle] || '';
        var cls = 'cluedo-item' + (marque ? ' ' + marque : '');
        return '<button type="button" class="' + cls + '" data-action="item"'
          + ' data-cat="' + esc(cat) + '" data-id="' + esc(it.id) + '">'
          + esc(it.label) + '</button>';
      }).join('');
      return '<div class="cluedo-col">'
        + '<div class="cluedo-col-head">' + esc(cfg.categories[cat].label) + '</div>'
        + items
        + '</div>';
    }).join('');

    var cartes = cfg.cartes.map(function (a) {
      return '<span class="cluedo-chip">✓ ' + esc(atomLabel(a, labels)) + '</span>';
    }).join('');
    var revelees = state.revelees.map(function (a) {
      return '<span class="cluedo-chip cluedo-chip--new">🃏 ' + esc(atomLabel(a, labels)) + '</span>';
    }).join('');

    var tems = cfg.temoignages.map(function (t, i) {
      var list = t.atoms.map(function (a) {
        return '<li>' + esc(atomLabel(a, labels)) + '</li>';
      }).join('');
      return '<li class="cluedo-tem">'
        + '<div class="cluedo-tem-head">📜 Témoignage ' + (i + 1) + '</div>'
        + '<div class="cluedo-tem-rule">' + esc(temLabel(t)) + '</div>'
        + '<ul class="cluedo-tem-atoms">' + list + '</ul>'
        + '</li>';
    }).join('');

    var optsProduit = '<option value="">— choisir —</option>'
      + cfg.categories.produit.items.map(function (it) {
          return '<option value="' + esc(it.id) + '">' + esc(it.label) + '</option>';
        }).join('');
    var optsRayon = '<option value="">— choisir —</option>'
      + cfg.categories.rayon.items.map(function (it) {
          return '<option value="' + esc(it.id) + '">' + esc(it.label) + '</option>';
        }).join('');
    var optsEmpl = '<option value="">— choisir —</option>'
      + cfg.categories.emplacement.items.map(function (it) {
          return '<option value="' + esc(it.id) + '">' + esc(it.label) + '</option>';
        }).join('');

    var sonde = state.sondages > 0
      ? '📡 Sonder le sonar (' + state.sondages + ')'
      : '📡 Plus de sondage';
    var sondeDisabled = state.sondages <= 0 ? ' disabled' : '';
    var erreurs = state.erreurs + ' / ' + state.maxErreurs;

    host.innerHTML =
      '<div class="cluedo">'
      + '<div class="cluedo-intro">🔍 <b>Le QR Code est scellé quelque part dans le magasin.</b>'
      + ' Trois choses le désignent : un <b>PRODUIT</b> repère, le <b>RAYON</b> où il est caché,'
      + ' et l’<b>EMPLACEMENT</b> précis. Déduis-les — rien ne te sera dit en clair.</div>'
      + '<div class="cluedo-grid">' + cols + '</div>'
      + '<div class="cluedo-legende">Touche une case pour la <b>rayer</b> (hors de cause) ou la <b>surligner</b> (suspecte).</div>'
      + '<div class="cluedo-section">'
      +   '<div class="cluedo-section-head">🃏 DOSSIER DU CAPITAINE — cartes hors de cause</div>'
      +   '<div class="cluedo-cards">' + (cartes || '<span class="cluedo-empty">Aucune carte.</span>') + revelees + '</div>'
      + '</div>'
      + '<div class="cluedo-section">'
      +   '<div class="cluedo-section-head">📜 TÉMOIGNAGES DES MATELOTS</div>'
      +   '<ol class="cluedo-tems">' + tems + '</ol>'
      + '</div>'
      + '<div class="cluedo-section">'
      +   '<div class="cluedo-section-head">📡 SONAR &amp; ACCUSATION <span class="cluedo-erreurs">Erreurs : ' + esc(erreurs) + '</span></div>'
      +   '<div class="cluedo-selects">'
      +     '<label>Produit<select id="clu-p">' + optsProduit + '</select></label>'
      +     '<label>Rayon<select id="clu-r">' + optsRayon + '</select></label>'
      +     '<label>Emplacement<select id="clu-e">' + optsEmpl + '</select></label>'
      +   '</div>'
      +   '<div class="cluedo-actions">'
      +     '<button type="button" class="cluedo-btn cluedo-btn--probe" data-action="probe"' + sondeDisabled + '>' + esc(sonde) + '</button>'
      +     '<button type="button" class="cluedo-btn cluedo-btn--accuse" data-action="accuse">⚖️ Accuser !</button>'
      +   '</div>'
      +   '<div class="cluedo-feedback" id="clu-feedback">' + (state.feedback || '') + '</div>'
      + '</div>'
      + '</div>';
  }

  function lireChoix(host) {
    var p = host.querySelector('#clu-p').value;
    var r = host.querySelector('#clu-r').value;
    var e = host.querySelector('#clu-e').value;
    if (!p || !r || !e) return null;
    return { produit: p, rayon: r, emplacement: e };
  }

  function prochaineCarte() {
    if (state.reserveIndex < state.cfg.reserve.length) {
      var c = state.cfg.reserve[state.reserveIndex++];
      state.revelees.push(c);
      return c;
    }
    return null;
  }

  function verdictCategorie(juste) {
    return juste ? '✅ exact' : '❌ rejeté';
  }

  function sonder(host) {
    if (state.sondages <= 0) {
      state.feedback = '<div class="cluedo-feedback-msg warn">📡 Plus aucun sondage disponible.</div>';
      render(host);
      return;
    }
    var choix = lireChoix(host);
    if (!choix) {
      state.feedback = '<div class="cluedo-feedback-msg warn">Choisis un produit, un rayon ET un emplacement.</div>';
      render(host);
      return;
    }
    state.sondages--;
    var S = state.secret;
    var lignes = [
      'Produit : ' + verdictCategorie(choix.produit === S.produit),
      'Rayon : ' + verdictCategorie(choix.rayon === S.rayon),
      'Emplacement : ' + verdictCategorie(choix.emplacement === S.emplacement)
    ];
    var tout = (choix.produit === S.produit) && (choix.rayon === S.rayon) && (choix.emplacement === S.emplacement);

    if (tout) {
      state.feedback = '';
      state.onVictoire();
      return;
    }
    var carte = prochaineCarte();
    if (carte) {
      lignes.push('🃏 Le dossier du capitaine révèle : « ' + atomLabel(carte, state.labels) + ' »');
    }
    state.feedback = '<div class="cluedo-feedback-msg">' + lignes.map(esc).join('<br>') + '</div>';
    render(host);
  }

  function accuser(host) {
    var choix = lireChoix(host);
    if (!choix) {
      state.feedback = '<div class="cluedo-feedback-msg warn">Choisis un produit, un rayon ET un emplacement.</div>';
      render(host);
      return;
    }
    var S = state.secret;
    var juste = (choix.produit === S.produit) && (choix.rayon === S.rayon) && (choix.emplacement === S.emplacement);
    if (juste) {
      state.feedback = '';
      state.onVictoire();
      return;
    }
    state.erreurs++;
    var carte = prochaineCarte();
    state.feedback = '<div class="cluedo-feedback-msg danger">⚖️ Accusation rejetée — le QR n’est pas là.'
      + (carte ? ' Le dossier révèle : « ' + atomLabel(carte, state.labels) + ' ».' : '')
      + '</div>';
    state.onErreur(state.erreurs, state.maxErreurs);
    render(host);
  }

  function toggleMarque(host, cat, id) {
    var cle = cat + ':' + id;
    var courant = state.marques[cle] || '';
    var suivant = courant === '' ? 'elim' : (courant === 'elim' ? 'suspect' : '');
    if (suivant) state.marques[cle] = suivant;
    else delete state.marques[cle];
    render(host);
  }

  function init(host, opts) {
    if (!host || !opts || !opts.config) return;
    state = {
      cfg: opts.config,
      labels: construireLabels(opts.config),
      secret: opts.config.secret,
      maxErreurs: Number(opts.maxErreurs) || 3,
      onErreur: opts.onErreur || function () {},
      onVictoire: opts.onVictoire || function () {},
      sondages: 3,
      erreurs: 0,
      reserveIndex: 0,
      revelees: [],
      marques: {},
      feedback: ''
    };
    host.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn || !host.contains(btn)) return;
      var action = btn.getAttribute('data-action');
      if (action === 'item') toggleMarque(host, btn.getAttribute('data-cat'), btn.getAttribute('data-id'));
      else if (action === 'probe') sonder(host);
      else if (action === 'accuse') accuser(host);
    });
    render(host);
  }

  window.NautilusCluedo = { init: init };
})();
