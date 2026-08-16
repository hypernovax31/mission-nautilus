/* =============================================================
   BRIEFING DU CAPITAINE — CODE COMMUN À TOUS LES PALIERS ≥ 2
   (palier-briefing.js)

   ENCHAÎNEMENT IMPOSÉ SUR TOUTE LA MISSION (Palier 2 → final) :

       ZONE SCELLÉE      →      BRIEFING DU CAPITAINE      →   ÉPREUVE
       (sas QR, palier-sas.js)   (CETTE VUE)                  (mini-jeu)

   Demande explicite : le briefing du capitaine est une explication
   IMPLICITE et IMMERSIVE du thème du mini-jeu, SANS dévoiler le
   contenu (aucun mot, aucune réponse, aucune donnée de la grille).
   Il arrive APRÈS le déverrouillage par QR Code (fin de la ZONE
   SCELLÉE) et AVANT la page qui joue au mini-jeu, sur TOUS les
   paliers de la mission globale, du Palier 2 au palier final.

   La mise en page est CELLE DU PALIER 1 : mêmes classes
   .brief / .brief-signature / .brief-list / .brief-intro /
   .brief-cta (styles dans css/palier1.css, chargée par TOUTES les
   pages de palier), mêmes formules « ⚓ BRIEFING DU CAPITAINE » et
   « ⚓ PRENDRE LES COMMANDES » — bloc repris de renderIdleScreen()
   de palier1.html. Ce module ne fait que rendre ce bloc à partir
   des textes fournis par la page : AUCUNE dépendance, AUCUN réseau.

   BLOC HTML ATTENDU sur chaque page de palier ≥ 2, entre le sas QR
   (#gateCard) et l'épreuve (#gateUnlocked) :

     <section class="card" id="briefCard" hidden>
       <div class="body"><div id="briefHost"></div></div>
     </section>
     <script src="palier-briefing.js?v=1"></script>

   La page appelle AVANT de choisir sa vue :

     window.NautilusBriefing.afficher(hote, {
       intro: '…',                 // thème immersif, implicite,
                                   // sans contenu (HTML autorisé)
       consignes: [
         { ico: '⏱️', html: '…' },          // consigne simple
         { ico: '❌', html: '…', warn: true } // warn = liseré ambre
       ],
       cta: '⚓ PRENDRE LES COMMANDES',     // (défaut)
       onDepart: function () { … }          // arme la partie
     });

   …puis pilote TROIS vues : afficherVueScellee() (héros + journal +
   sas), afficherVueBriefing() (journal + CE briefing, montré dès que
   le sas est ouvert — scan réussi, sas mémorisé, aperçu admin) et
   afficherVueEpreuve() (SEULE la carte du mini-jeu) — voir le script
   de 1721310619.html, l'exemple de référence.

   Les chaînes intro/html/cta sont écrites par l'organisation dans le
   code de chaque page (JAMAIS une saisie joueur) : le HTML y est
   autorisé (<b>…</b> notamment).
   ============================================================= */
(function () {
  'use strict';

  /* Formules EXACTES du Palier 1 — reprise à l'identique pour que le
     briefing se lise pareil sur tous les paliers. */
  var SIGNATURE = '⚓ BRIEFING DU CAPITAINE';
  var CTA_DEFAUT = '⚓ PRENDRE LES COMMANDES';

  function afficher(hote, cfg) {
    if (!hote) return null;
    cfg = cfg || {};
    var lis = '';
    var consignes = cfg.consignes || [];
    for (var i = 0; i < consignes.length; i++) {
      var c = consignes[i] || {};
      lis += '<li' + (c.warn ? ' class="warn"' : '') + '>'
           + '<span class="ico" aria-hidden="true">' + (c.ico || '•') + '</span>'
           + '<span>' + (c.html || '') + '</span>'
           + '</li>';
    }
    var ctaId = cfg.ctaId || 'briefCtaBtn';
    hote.innerHTML = ''
      + '<div class="brief">'
      +   '<div class="brief-signature">' + SIGNATURE + '</div>'
      +   '<p class="brief-intro">' + (cfg.intro || '') + '</p>'
      +   '<ul class="brief-list">' + lis + '</ul>'
      +   '<button class="brief-cta" id="' + ctaId + '" type="button">'
      +     (cfg.cta || CTA_DEFAUT)
      +   '</button>'
      + '</div>';
    var btn = document.getElementById(ctaId);
    if (btn && typeof cfg.onDepart === 'function') {
      btn.addEventListener('click', function (ev) {
        /* Clics répétés d'un joueur impatient : le départ ne peut pas
           partir deux fois (même réflexe que le « PRENDRE LES
           COMMANDES » du Palier 1). Le bouton se réarme tout seul au
           cas où le départ serait refusé sans changer de vue — sinon
           il resterait mort. */
        if (btn.disabled) return;
        btn.disabled = true;
        try { cfg.onDepart(ev); } finally {
          setTimeout(function () { btn.disabled = false; }, 3000);
        }
      });
    }
    return btn;
  }

  window.NautilusBriefing = { afficher: afficher };
})();
