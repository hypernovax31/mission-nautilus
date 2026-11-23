/* Secours local pour l'ordre de mission si le module Firebase ne demarre
   pas ou si le chargement de la page reste bloque. Le module principal reste
   prioritaire : les deux chemins utilisent data-typed comme verrou. */
(function () {
  'use strict';

  function planifier() {
    var ordre = document.getElementById('missionOrderText');
    var texte = document.getElementById('missionOrderTyping');
    if (!ordre || !texte) return;

    // Le module principal demarre normalement une seconde apres le chargement.
    // Ce delai lui laisse la priorite, sans laisser l'ordre vide indefiniment.
    setTimeout(function () {
      if (ordre.dataset.typed === 'true') return;
      ordre.dataset.typed = 'true';
      var anneeDisparition = 1870;
      var annees = Math.max(0, (new Date()).getFullYear() - anneeDisparition);
      var complet = ordre.dataset.text || '';
      if (complet.indexOf('1870') !== -1) {
        complet = complet.replace(/\b\d+\s+ans plus tard\b/, annees + ' ans plus tard');
        ordre.dataset.text = complet;
      }
      var mouvementReduit = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function terminer() {
        // L'invitation PWA attend ce signal, comme avec le module principal.
        window.dispatchEvent(new Event('nautilus:fin-typewriter'));
      }

      if (mouvementReduit || !complet) {
        texte.textContent = complet;
        terminer();
        return;
      }

      // Meme superposition que le module principal : la hauteur reservee ne
      // bouge pas pendant la frappe, y compris sur un petit ecran.
      var fantome = document.createElement('span');
      fantome.className = 'typewriter-ghost';
      fantome.setAttribute('aria-hidden', 'true');
      fantome.textContent = complet;
      ordre.insertBefore(fantome, texte);
      texte.classList.add('typewriter-live');
      texte.textContent = '';
      var noeud = document.createTextNode('');
      texte.appendChild(noeud);
      var curseur = document.createElement('span');
      curseur.className = 'typewriter-caret';
      curseur.textContent = '▌';
      texte.appendChild(curseur);
      var i = 0;

      function ecrire() {
        if (!ordre.isConnected) return;
        i++;
        noeud.nodeValue = complet.slice(0, i);
        if (i < complet.length) {
          setTimeout(ecrire, 18);
          return;
        }
        curseur.remove();
        texte.classList.remove('typewriter-live');
        fantome.remove();
        terminer();
      }
      setTimeout(ecrire, 40);
    }, 2500);
  }

  /* Sur la version avec page de garde, la frappe doit attendre l'ouverture
     de l'ecoutille. Sur les autres versions il n'y a pas de porte a attendre. */
  function quandEcoutilleOuverte() {
    var porte = document.getElementById('ecoutille');
    function ouverte() {
      var racine = document.documentElement;
      return !document.getElementById('ecoutille') || window.__ecoutilleJouer === false ||
        racine.classList.contains('ec-arrivee') || racine.classList.contains('ec-passee') ||
        (porte && porte.classList.contains('ec-passee'));
    }
    if (ouverte()) { planifier(); return; }

    var observer = null;
    var dejaPlanifie = false;
    function verifier() {
      if (dejaPlanifie || !ouverte()) return;
      dejaPlanifie = true;
      window.removeEventListener('nautilus:ecoutille-ouverte', verifier);
      if (observer) observer.disconnect();
      planifier();
    }
    window.addEventListener('nautilus:ecoutille-ouverte', verifier);
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(verifier);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      if (porte) observer.observe(porte, { attributes: true, attributeFilter: ['class'] });
      if (document.body) observer.observe(document.body, { childList: true });
    }
    verifier(); // couvre une ouverture survenue pendant l'installation du suivi
  }

  // Le script est defer : le DOM existe deja meme si un module distant tarde.
  if (document.getElementById('missionOrderText')) quandEcoutilleOuverte();
  else document.addEventListener('DOMContentLoaded', quandEcoutilleOuverte, { once: true });
})();
