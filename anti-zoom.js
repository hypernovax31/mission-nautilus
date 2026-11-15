/* anti-zoom.js — bloque le zoom automatique du téléphone sur les champs texte/chiffres
   Sans ça, iOS/Android agrandit la page quand on tape dans une case <16px (mots croisés,
   artefact, embarquement, code matelot) et on ne voit plus la grille.
   Stratégie : 1) le viewport est verrouillé (maximum-scale=1) tant qu'un input est focus,
   2) le font-size est forcé à 16px même si le CSS tente 12-13px. */
(function(){
  var viewport = document.querySelector('meta[name="viewport"]');
  var original = viewport ? viewport.getAttribute('content') : '';
  var locked = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  function lock(){ if(viewport) viewport.setAttribute('content', locked); }
  function unlock(){ if(viewport) viewport.setAttribute('content', original || 'width=device-width, initial-scale=1.0'); }
  document.addEventListener('focusin', function(e){
    if(e.target.matches('input, textarea, select, [contenteditable]')) lock();
  });
  document.addEventListener('focusout', function(e){
    // petit délai : si on passe d'un input à un autre, on reste verrouillé
    setTimeout(function(){
      var a = document.activeElement;
      if(!a || !a.matches('input, textarea, select, [contenteditable]')) unlock();
    }, 50);
  });
  // iOS : empêche le double-tap zoom sur les cases
  var lastTouch = 0;
  document.addEventListener('touchend', function(e){
    var now = Date.now();
    if(now - lastTouch < 300 && e.target.closest('.mc-case, .af-saisie, .af-manuel, .mc-input')){
      e.preventDefault();
    }
    lastTouch = now;
  }, {passive:false});
})();
