/* anti-zoom.js — bloque le zoom automatique et le double-tap zoom sur tout le site
   Seul le pincement à deux doigts (pinch-to-zoom) reste actif.
   1) Empêche le zoom au double-tap sur écran tactile (touchend intervalle ≤ 320ms).
   2) Verrouille le zoom automatique lors du focus dans les champs de saisie (maximum-scale=1).
   3) Préserve intégralement le zoom par pincement à deux doigts. */
(function () {
  'use strict';

  var viewport = document.querySelector('meta[name="viewport"]');
  var original = viewport ? viewport.getAttribute('content') : '';
  var locked = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

  function lock() {
    if (viewport) viewport.setAttribute('content', locked);
  }

  function unlock() {
    if (viewport) viewport.setAttribute('content', original || 'width=device-width, initial-scale=1.0');
  }

  // Verrouillage pendant le focus dans les inputs pour empêcher le recadrage auto mobile
  document.addEventListener('focusin', function (e) {
    if (e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable]')) {
      lock();
    }
  });

  document.addEventListener('focusout', function () {
    setTimeout(function () {
      var a = document.activeElement;
      if (!a || !a.matches || !a.matches('input, textarea, select, [contenteditable]')) {
        unlock();
      }
    }, 60);
  });

  // Empêche le zoom au double-tap sur l'écran tactile de tout le site.
  // Les gestes multi-touch (pincement à 2 doigts) ne sont PAS bloqués.
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    // Si plusieurs doigts sont encore en contact, geste de pincement en cours -> ne pas bloquer
    if (e.touches && e.touches.length > 0) return;

    var now = Date.now();
    var delta = now - lastTouchEnd;

    if (delta > 0 && delta <= 320) {
      // Double-tap détecté : neutralise le zoom du navigateur
      e.preventDefault();

      // Assure le déclenchement du clic sans latence
      if (e.target) {
        var cliquable = e.target.closest('button, a, input, select, textarea, [role="button"], label, .code, .jp-chip');
        if (cliquable && typeof cliquable.click === 'function') {
          cliquable.click();
        }
      }
    }
    lastTouchEnd = now;
  }, { passive: false });
})();
