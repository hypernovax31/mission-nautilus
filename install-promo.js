/* =============================================================================
   Mission Nautilus — ANIMATION D'INCITATION À L'INSTALLATION (PWA)
   =============================================================================

   BUT
   Montrer UNE fois par période (3 jours) un plein-écran animé qui oppose
   la TEMPÊTE (utiliser le site dans un simple onglet = tumultes de
   l'océan : réseau capricieux, page perdue, plein écran impossible) aux
   EAUX SEREINES (application installée sur l'écran d'accueil). Le bouton
   « Installer » fait littéralement passer la scène de la tempête au calme.

   AFFICHAGE
   - Jamais si l'app tourne déjà en mode application (standalone).
   - Jamais si l'utilisateur a reporté il y a moins de 3 jours
     (« Continuer dans les tumultes »).
   - Pas si ?pwa=install ouvre déjà les instructions.
   - Apparaît 3,5 s après le chargement, au-dessus de tout.

   INSTALLATION PAR PLATEFORME
   - Android / Chrome PC / Mac : le prompt natif du navigateur est déclenché
     (capturé ici ET partagé avec la page d'accueil si elle l'a déjà via
     window.PWAInstall.prendrePrompt()).
   - iOS / Mac Safari / autres : après le passage au calme, le module ouvre
     la modale d'instructions existante de la page d'accueil (une seule
     source de contenu) — ou affiche une consigne générique si la page ne
     la fournit pas.

   AUTONOME
   Une seule ligne suffit sur n'importe quelle page :
       <script src="install-promo.js" defer></script>
   Le sous-marin, la mer, la pluie, l'éclair, le soleil et les bulles sont
   dessinés en pur HTML/CSS : aucune image à télécharger.
   ========================================================================== */
(function () {
  'use strict';

  var CLE_SNOOZE = 'nautilusInstallPromoSnooze';
  var SNOOZE_MS = 3 * 24 * 3600 * 1000;   // 3 jours de répit après un report
  var DELAI_AFFICHAGE_MS = 3500;          // pages sans machine à écrire
  var GARDEFOU_TYPEWRITER_MS = 15000;     // si le signal n'arrive jamais
  var DUREE_CALME_MS = 3000;              /* « EAUX SEREINES » : 3 secondes
     EN TOUT avant d'envoyer le reste (instructions ou fermeture). */

  /* ---------- conditions d'affichage ---------- */
  function estInstallee() {
    try {
      if (window.PWAInstall && typeof window.PWAInstall.estInstallee === 'function') {
        return window.PWAInstall.estInstallee();
      }
    } catch (e) {}
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true;
  }
  function lireSnooze() {
    try { return Number(localStorage.getItem(CLE_SNOOZE) || 0); }
    catch (e) { return 0; }
  }
  function ecrireSnooze() {
    try { localStorage.setItem(CLE_SNOOZE, String(Date.now())); } catch (e) {}
  }
  /* Regle PURE (testable) : faut-il montrer l'animation maintenant ? */
  function doitAfficher(opts) {
    opts = opts || {};
    if (opts.installee) return false;                 // déjà en appli
    if (opts.instructionsEnCours) return false;       // ?pwa=install ouvre la modale
    return (opts.maintenant - (opts.snooze || 0)) >= SNOOZE_MS;
  }

  /* ---------- prompt natif (capture locale, partagé avec la page) ---------- */
  var promptLocal = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    promptLocal = e;
  });
  function consommerPrompt() {
    if (window.PWAInstall && typeof window.PWAInstall.prendrePrompt === 'function') {
      var partage = window.PWAInstall.prendrePrompt();
      if (partage) { promptLocal = null; return partage; }
    }
    var p = promptLocal; promptLocal = null; return p;
  }
  function promptDisponible() {
    if (promptLocal) return true;
    return !!(window.PWAInstall && typeof window.PWAInstall.aUnPrompt === 'function' && window.PWAInstall.aUnPrompt());
  }

  /* ---------- dessin : le sous-marin Nautilus (SVG inline, aucune image) --- */
  var SUB_SVG = '<svg viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<defs><linearGradient id="ipg1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#f5b027"/><stop offset="100%" stop-color="#c8861b"/></linearGradient>'
    + '<linearGradient id="ipg2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#d89020"/><stop offset="100%" stop-color="#a06b15"/></linearGradient></defs>'
    + '<ellipse cx="100" cy="50" rx="78" ry="18" fill="url(#ipg1)" stroke="#5c4630" stroke-width="2"/>'
    + '<rect x="80" y="22" width="40" height="22" rx="4" fill="#5c4630"/>'
    + '<circle cx="88" cy="33" r="3" fill="#8ee7ff"/><circle cx="100" cy="33" r="3" fill="#8ee7ff"/><circle cx="112" cy="33" r="3" fill="#8ee7ff"/>'
    + '<ellipse cx="180" cy="50" rx="14" ry="9" fill="url(#ipg2)" stroke="#5c4630" stroke-width="2"/>'
    + '<path d="M 20 60 Q 50 56 80 60 T 140 60" stroke="#8ee7ff" stroke-width="2" fill="none" opacity="0.4"/>'
    + '<path d="M 20 68 Q 50 64 80 68 T 140 68" stroke="#8ee7ff" stroke-width="2" fill="none" opacity="0.3"/></svg>';

  /* Vague agitée (dents de scie) et vague douce (houle), en data-URI. */
  var VAGUE_TEMPETE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='18' viewBox='0 0 120 18'%3E%3Cpath d='M0 13 L15 3 L30 13 L45 5 L60 13 L75 4 L90 13 L105 5 L120 13 L120 18 L0 18Z' fill='%2354728a'/%3E%3C/svg%3E\")";
  var VAGUE_TEMPETE2 = VAGUE_TEMPETE.replace('%2354728a', '%233a5470');
  var VAGUE_CALME = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='18' viewBox='0 0 120 18'%3E%3Cpath d='M0 10 Q15 3 30 10 T60 10 T90 10 T120 10 L120 18 L0 18Z' fill='%232e7d84'/%3E%3C/svg%3E\")";
  var VAGUE_CALME2 = VAGUE_CALME.replace('%232e7d84', '%231f5963');

  /* ---------- styles injectés ---------- */
  var CSS = ''
    /* LAYOUT 100 % FLEX, sans dependre d'aucun heritage de la page :
       overlay = flex centre, carte = colonne centree, et CHAQUE texte
       porte son propre text-align:center. (Correctif : le texte
       apparaissait decale quand la page hote imposait son alignement.) */
    + '.ip-overlay{position:fixed;inset:0;z-index:99970;display:flex;align-items:center;justify-content:center;'
    + 'padding:18px;box-sizing:border-box;width:100vw;height:100vh;margin:0;'
    + 'background:radial-gradient(ellipse at 50% 20%,rgba(6,22,38,.55),rgba(2,6,14,.9));'
    + 'opacity:0;transition:opacity .45s ease;}'
    + '.ip-overlay.ip-in{opacity:1}'
    + '.ip-overlay.ip-out{opacity:0}'
    + '.ip-card{display:flex;flex-direction:column;align-items:center;'
    + 'width:min(94vw,430px);max-width:100%;box-sizing:border-box;text-align:center;'
    + 'border-radius:20px;padding:20px 20px 14px;'
    + 'background:linear-gradient(160deg,rgba(8,26,44,.97),rgba(4,12,24,.97));'
    + 'border:1px solid rgba(245,176,39,.55);box-shadow:0 26px 60px rgba(0,0,0,.6),inset 0 0 40px rgba(142,231,255,.05);'
    + 'transform:translateY(14px) scale(.97);transition:transform .45s cubic-bezier(.2,.9,.3,1.15);'
    + 'color:#dff3fb;font-family:inherit;margin:0}'
    + '.ip-overlay.ip-in .ip-card{transform:translateY(0) scale(1)}'

    /* Le hublot : scène ronde, cerclage laiton, deux mers superposées */
    + '.ip-scene{position:relative;width:min(58vw,215px);aspect-ratio:1;margin:0 auto 14px;flex:0 0 auto;'
    + 'border-radius:50%;overflow:hidden;'
    + 'border:10px solid #6b5122;box-shadow:0 0 0 3px #3a2c10,0 10px 30px rgba(0,0,0,.55),inset 0 0 34px rgba(0,0,0,.55);background:#0a1a2a}'
    + '.ip-mer-scene{position:absolute;inset:0;transition:opacity 1.3s ease}'

    /* --- TEMPÊTE --- */
    + '.ip-tempete{background:linear-gradient(180deg,#233442 0%,#2c4256 42%,#14202e 43%,#0c1723 100%)}'
    + '.ip-eclair{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(190,220,255,.35));'
    + 'opacity:0;animation:ipEclair 4.5s linear infinite;pointer-events:none}'
    + '.ip-pluie{position:absolute;inset:-40% 0 0 0;pointer-events:none;'
    + 'background:repeating-linear-gradient(78deg,rgba(200,225,255,.30) 0 1.5px,transparent 1.5px 14px);'
    + 'background-size:34px 46px;animation:ipPluie .5s linear infinite}'
    + '.ip-vague{position:absolute;left:0;right:0;bottom:0;height:46%;background-repeat:repeat-x;background-size:120px 18px}'
    + '.ip-tempete .ip-vague.v1{background-image:' + VAGUE_TEMPETE + ';animation:ipDefile 2.1s linear infinite;bottom:26%;opacity:.95}'
    + '.ip-tempete .ip-vague.v2{background-image:' + VAGUE_TEMPETE2 + ';animation:ipDefile 1.5s linear infinite reverse;bottom:18%}'
    /* Le sub marin balloté : roulis sec et saccadé */
    + '.ip-sub{position:absolute;left:50%;width:62%;margin-left:-31%;top:47%}'
    + '.ip-sub svg{display:block;width:100%;height:auto;filter:drop-shadow(0 4px 4px rgba(0,0,0,.4))}'
    + '.ip-tempete .ip-sub{animation:ipRoulis 1.7s ease-in-out infinite}'

    /* --- EAUX SEREINES --- */
    + '.ip-calme{opacity:0;background:linear-gradient(180deg,#17526b 0%,#1d627f 42%,#123f52 43%,#0b2e3e 100%)}'
    + '.ip-soleil{position:absolute;top:8%;left:50%;width:30%;aspect-ratio:1;margin-left:-15%;border-radius:50%;'
    + 'background:radial-gradient(circle,rgba(255,224,140,.95) 0%,rgba(245,176,39,.55) 45%,rgba(245,176,39,0) 72%);'
    + 'animation:ipSoleil 6s ease-in-out infinite}'
    + '.ip-calme .ip-vague.v1{background-image:' + VAGUE_CALME + ';animation:ipDefile 9s linear infinite;bottom:26%;opacity:.9}'
    + '.ip-calme .ip-vague.v2{background-image:' + VAGUE_CALME2 + ';animation:ipDefile 13s linear infinite reverse;bottom:18%}'
    + '.ip-calme .ip-sub{animation:ipHoule 5.2s ease-in-out infinite}'
    + '.ip-bulle{position:absolute;bottom:26%;width:6px;height:6px;border-radius:50%;background:rgba(210,240,255,.75);'
    + 'animation:ipBulle 3.4s ease-in infinite}'
    + '.ip-bulle.b2{width:4px;height:4px;animation-delay:1.1s}.ip-bulle.b3{width:8px;height:8px;animation-delay:2.2s}'

    /* Quand la carte passe au CALME : la tempête s'efface en fondu */
    + '.ip-card.ip-est-calme .ip-tempete{opacity:0}'
    + '.ip-card.ip-est-calme .ip-calme{opacity:1}'

    /* Textes et actions : centre explicitement, largeur bridee pour que
       les lignes restent equilibrees. ATTENTION : le texte s'appelle
       .ip-intro — PAS .ip-sub : cette classe designe le sous-marin et sa
       position:absolute cassait la mise en page (texte flottant au
       milieu de l'ecran ). */
    + '.ip-titre{margin:2px auto 6px;width:100%;max-width:360px;text-align:center;color:#fff;font-size:clamp(18px,5vw,23px);line-height:1.15}'
    + '.ip-intro{margin:0 auto 14px;width:100%;max-width:330px;text-align:center;color:#bfe0ee;font-size:13.5px;line-height:1.5}'
    + '.ip-intro b{color:#ffe2a0}'
    + '.ip-cta{display:block;width:100%;box-sizing:border-box;padding:13px 14px;border:0;border-radius:13px;cursor:pointer;text-align:center;'
    + 'background:linear-gradient(135deg,#f5b027,#d89020);color:#111;font-size:15px;font-weight:1000;letter-spacing:.01em;'
    + 'box-shadow:0 8px 22px rgba(245,176,39,.35);animation:ipCta 1.8s ease-in-out infinite}'
    + '.ip-later{display:block;margin:10px auto 0;padding:4px 8px;border:0;background:none;cursor:pointer;text-align:center;'
    + 'color:#8fb6c8;font-size:12.5px;font-weight:700;text-decoration:underline dotted}'
    + '.ip-later:hover{color:#cfe8f4}'

    /* Keyframes */
    + '@keyframes ipDefile{from{background-position-x:0}to{background-position-x:-120px}}'
    + '@keyframes ipPluie{from{background-position-y:0}to{background-position-y:46px}}'
    + '@keyframes ipEclair{0%,7%,11%,15%,100%{opacity:0}8%,10%{opacity:.85}13%{opacity:.55}14%{opacity:.9}}'
    + '@keyframes ipRoulis{0%,100%{transform:translate(0,2px) rotate(-9deg)}25%{transform:translate(-4%,-8%) rotate(6deg)}'
    + '50%{transform:translate(2%,6%) rotate(-11deg)}75%{transform:translate(-3%,-6%) rotate(8deg)}}'
    + '@keyframes ipHoule{0%,100%{transform:translate(0,0) rotate(-2deg)}50%{transform:translate(0,-4%) rotate(2deg)}}'
    + '@keyframes ipSoleil{0%,100%{transform:scale(1);opacity:.92}50%{transform:scale(1.07);opacity:1}}'
    + '@keyframes ipBulle{0%{transform:translate(0,0);opacity:0}12%{opacity:.8}60%{transform:translate(6px,-46px)}'
    + '100%{transform:translate(-4px,-78px);opacity:0}}'
    + '@keyframes ipCta{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.025);filter:brightness(1.12)}}'
    + '@media (prefers-reduced-motion:reduce){.ip-overlay *{animation:none!important;transition-duration:.01s!important}}'
  ;

  /* ---------- construction ---------- */
  var overlay = null;

  function injecterStyles() {
    if (document.getElementById('ip-styles')) return;
    var st = document.createElement('style');
    st.id = 'ip-styles';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function sceneHtml() {
    return '<div class="ip-scene">'
      + '<div class="ip-mer-scene ip-tempete">'
      +   '<div class="ip-eclair"></div><div class="ip-pluie"></div>'
      +   '<div class="ip-vague v2"></div><div class="ip-vague v1"></div>'
      +   '<div class="ip-sub">' + SUB_SVG + '</div>'
      + '</div>'
      + '<div class="ip-mer-scene ip-calme">'
      +   '<div class="ip-soleil"></div>'
      +   '<div class="ip-vague v2"></div><div class="ip-vague v1"></div>'
      +   '<div class="ip-sub">' + SUB_SVG + '</div>'
      +   '<i class="ip-bulle" style="left:40%"></i><i class="ip-bulle b2" style="left:52%"></i><i class="ip-bulle b3" style="left:64%"></i>'
      + '</div>'
      + '</div>';
  }

  function ouvrir() {
    if (overlay || !document.body) return;
    injecterStyles();
    overlay = document.createElement('div');
    overlay.className = 'ip-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Installer l’application Mission Nautilus');
    overlay.innerHTML = '<div class="ip-card">'
      + sceneHtml()
      + '<h2 class="ip-titre">🌊 Évite les tumultes de l’océan</h2>'
      + '<p class="ip-intro">Installe l’appli sur ton écran d’accueil pour naviguer en eaux sereines.</p>'
      + '<button type="button" class="ip-cta">⚓ Installer l’appli</button>'
      + '<button type="button" class="ip-later">Continuer dans les tumultes</button>'
      + '</div>';
    document.body.appendChild(overlay);
    var cta = overlay.querySelector('.ip-cta');
    var later = overlay.querySelector('.ip-later');
    if (cta) cta.addEventListener('click', installer);
    if (later) later.addEventListener('click', function () { ecrireSnooze(); fermer(); });
    /* Apparition douce (la transition CSS a besoin d'un temps de pose) */
    setTimeout(function () { if (overlay) overlay.classList.add('ip-in'); }, 30);
  }

  function fermer() {
    if (!overlay) return;
    var cible = overlay;
    cible.classList.add('ip-out');
    overlay = null;
    setTimeout(function () { if (cible && cible.remove) cible.remove(); }, 500);
  }

  /* ---------- déclenchement, calé sur la fin de la machine à écrire --- */
  var declenche = false;
  function signalerFinTypewriter() {
    /* Appelé par la page (événement 'nautilus:fin-typewriter') ou par la
       ceinture de sécurité : la promo ne surgit qu'UNE fois, exactement
       à la fin de l'ordre de mission. */
    if (declenche) return;
    declenche = true;
    if (!estInstallee()) ouvrir();
  }

  /* Passage à la mer calme + suite selon la plateforme */
  function passerAuCalme(titre, sousTitre, autoFermerMs) {
    if (!overlay) return;
    var card = overlay.querySelector('.ip-card');
    if (card) card.classList.add('ip-est-calme');
    var t = overlay.querySelector('.ip-titre');
    var s = overlay.querySelector('.ip-intro');
    var cta = overlay.querySelector('.ip-cta');
    if (titre && t) t.textContent = titre;
    if (sousTitre && s) s.innerHTML = sousTitre;
    if (cta) { cta.style.display = 'none'; }
    if (autoFermerMs) setTimeout(fermer, autoFermerMs);
  }

  async function installer() {
    /* 1) Prompt natif disponible (Android, Chrome/Edge PC & Mac) */
    var p = consommerPrompt();
    if (p && typeof p.prompt === 'function') {
      passerAuCalme('🌞 Eaux sereines en vue…', 'Confirme dans la boîte du navigateur.');
      try {
        p.prompt();
        var choix = await p.userChoice;
        if (choix && choix.outcome === 'accepted') {
          passerAuCalme('⚓ Application installée !', 'Le Nautilus t’attend sur ton écran d’accueil.', DUREE_CALME_MS);
          ecrireSnooze();
          return;
        }
      } catch (e) { /* le navigateur a refusé : on retombe sur les instructions */ }
    }
    /* 2) Instructions manuelles (iOS, macOS Safari, autres) : on reutilise
          la modale detaillee de la page d'accueil — jamais de copie.
          La mer calme reste 3 secondes EN TOUT (DUREE_CALME_MS) avant
          d'envoyer le reste. */
    passerAuCalme('🌞 Cap mis sur les eaux sereines !', 'La suite s’affiche juste après.');
    ecrireSnooze();
    setTimeout(function () {
      fermer();
      if (window.PWAInstall && typeof window.PWAInstall.showInstallInstructions === 'function') {
        window.PWAInstall.showInstallInstructions();
      } else if (window.PWAInstall && typeof window.PWAInstall.openInstallModal === 'function') {
        window.PWAInstall.openInstallModal();
      }
    }, DUREE_CALME_MS);
  }

  /* ---------- déclenchement ---------- */
  function demarrer() {
    var snooze = lireSnooze();
    var paramsEnCours = false;
    try {
      paramsEnCours = new URLSearchParams(window.location.search).get('pwa') === 'install';
    } catch (e) {}
    if (!doitAfficher({
      installee: estInstallee(),
      snooze: snooze,
      maintenant: Date.now(),
      instructionsEnCours: paramsEnCours
    })) return;
    if (window.nautilusAttendreTypewriter) {
      /* La page d'accueil le demande : la promo surgit JUSTE a la fin de
         la machine a ecrire (evenement 'nautilus:fin-typewriter'), pas
         selon un minuteur aveugle. Ceinture de securite : si l'ordre est
         annule (ou le signal perdu), affichage de repli a 15 s. */
      window.addEventListener('nautilus:fin-typewriter', signalerFinTypewriter);
      setTimeout(signalerFinTypewriter, GARDEFOU_TYPEWRITER_MS);
    } else {
      setTimeout(signalerFinTypewriter, DELAI_AFFICHAGE_MS);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

  /* Export minimal : tests + pilotage manuel éventuel. */
  window.NautilusInstallPromo = {
    ouvrir: ouvrir, fermer: fermer, doitAfficher: doitAfficher,
    estInstallee: estInstallee, promptDisponible: promptDisponible,
    signalerFinTypewriter: signalerFinTypewriter,
    SNOOZE_MS: SNOOZE_MS, DELAI_AFFICHAGE_MS: DELAI_AFFICHAGE_MS,
    DUREE_CALME_MS: DUREE_CALME_MS, GARDEFOU_TYPEWRITER_MS: GARDEFOU_TYPEWRITER_MS,
    CLE_SNOOZE: CLE_SNOOZE
  };
})();
