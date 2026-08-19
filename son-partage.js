/* =============================================================================
   NAUTILUS — NOYAU SONORE PARTAGE (son-partage.js)
   -----------------------------------------------------------------------------
   Charge EN PREMIER sur chaque page du jeu (avant sonar-button.js et
   palier-annonces.js). Deux services minuscules, une seule source de verite :

   1. LA REGLE D'OR DU SON, centralisee
      Le joueur a coupe le sonar (bouton en haut des pages) => SILENCE TOTAL
      sur toute l'application : ambiance, alarmes, bips, jingles. Le choix
      vit dans localStorage sous 'nautilusSoundOn' ('0' = coupe) et suit le
      joueur de page en page.
      SEULE EXCEPTION (demande explicite) : le signal morse du palier 1,
      qui EST l'epreuve — sans lui le mot est introuvable. Il joue toujours,
      mais uniquement a la demande (bouton « Ecouter le signal »).

   1 bis. SOURDINE QUAND L'ONGLET QUITTE L'ECRAN (demande explicite)
      Des que la page n'est plus visible (autre onglet, application en
      arriere-plan, ecran verrouille), le son se coupe net. Au retour, il
      reprend — sauf si le joueur avait coupe le sonar. C'est une sourdine
      TEMPORAIRE, propre a la visibilite de l'onglet : elle ne touche JAMAIS
      au choix persistant (localStorage).

   2. LE REGISTRE DES CONTEXTES WEB AUDIO
      Les elements <audio> savent etre mis en pause ; PAS les contextes Web
      Audio : une fois un jingle ou une alarme demarre dedans, seul un
      suspend() l'arrete. Chaque contexte cree dans la page est donc
      catalogue ici, ce qui rend l'extinction generale REELLEMENT totale :
      meme un son deja en cours de lecture se tait dans la meme seconde.
   ============================================================================= */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.NautilusSon) return;

  var KEY = 'nautilusSoundOn';

  /* Tous les contextes Web Audio crees par la page (hublots, frappe clavier,
     alarmes de fin d'O2, jingles de palier, signal morse...). */
  var contextes = [];

  /* Le son est autorise SAUF refus explicite. On teste l'inverse de '0'
     et non "=== '1'" : a la toute premiere visite rien n'est enregistre,
     et le jeu doit rester audible par defaut. */
  function sonActif() {
    try { return localStorage.getItem(KEY) !== '0'; }
    catch (e) { return true; }
  }

  /* Catalogue un contexte des sa creation. Idempotent. */
  function registerContexte(ctx) {
    if (ctx && contextes.indexOf(ctx) === -1) contextes.push(ctx);
    return ctx;
  }

  /* EXTINCTION GENERALE : suspend CHAQUE contexte. Un son deja en cours
     (jingle de victoire, alarme O2, ecoute morse en train de jouer) se tait
     net, sans attendre sa fin. Les <audio>, eux, sont coupes a cote par
     silenceEverything() (accueil) ou silence() (sonar-button.js). */
  function suspendreContextes() {
    contextes.forEach(function (c) {
      try { if (c.state === 'running') c.suspend(); } catch (e) { /* signe */ }
    });
  }

  /* Rallumage : on ne reveille que si le son est a nouveau autorise, et
     uniquement les contextes ENDORMIS — un contexte referme (close(), ex. :
     celui de la frappe clavier apres l'alarme de fin) est definitif, un
     resume() dessus echouerait. L'exception morse repart d'elle-meme a la
     prochaine ecoute : listenTransmission() fait toujours un resume()
     avant d'emetre. */
  function relancerContextes() {
    if (!sonActif()) return;
    contextes.forEach(function (c) {
      try { if (c.state === 'suspended') c.resume(); } catch (e) { /* signe */ }
    });
  }

  /* ===== SOURDINE QUAND L'ONGLET N'EST PLUS VISIBLE =====
     Demande explicite : des que la page quitte l'ecran (autre onglet, app
     en arriere-plan, ecran verrouille), le son se coupe. Au retour, il
     reprend — sauf si le sonar est coupe (sonActif() = false). Sourdine
     temporaire : le choix persistant (localStorage) n'est jamais touche.
     On ne coupe que les <audio> QUI JOUAIENT (muted=false) et on retient
     lesquels, pour ne demuter qu'eux au retour : on ne reveille jamais un
     <audio> volontairement muet (amorce, alarme en attente…). */
  var _ongletMasque = false;
  var _audiosCoupes = [];   // <audio> dont on a coupe le son en quittant l'ecran

  function _couperOnglet() {
    _audiosCoupes = [];
    var list = document.querySelectorAll('audio');
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a.muted) {
        try { a.muted = true; _audiosCoupes.push(a); } catch (e) { /* pas pret */ }
      }
    }
    suspendreContextes();   // contextes Web Audio (jingle, morse…) : taises net
  }

  function _retablirOnglet() {
    if (!sonActif()) { _audiosCoupes = []; return; }
    for (var i = 0; i < _audiosCoupes.length; i++) {
      try { _audiosCoupes[i].muted = false; } catch (e) { /* pas pret */ }
    }
    _audiosCoupes = [];
    relancerContextes();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        if (_ongletMasque) { _ongletMasque = false; _retablirOnglet(); }
      } else {
        _ongletMasque = true;
        _couperOnglet();
      }
    });
  }

  window.NautilusSon = {
    CLE: KEY,
    sonActif: sonActif,
    registerContexte: registerContexte,
    suspendreContextes: suspendreContextes,
    relancerContextes: relancerContextes,
    /* Expose pour les tests : la liste vivante des contextes suivis. */
    contextes: contextes
  };
})();
