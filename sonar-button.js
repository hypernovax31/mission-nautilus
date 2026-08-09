/* =============================================================================
   Mission Nautilus — bouton d'ambiance sonore, partage par TOUTES les pages
   =============================================================================

   BUT
   Poser le meme bouton "sonar" (musique d'ambiance) sur n'importe quelle page
   du jeu, existante ou future, en UNE seule ligne :

       <script src="sonar-button.js" defer></script>

   Le script se charge de tout : il cree le lecteur audio, le bouton, ses
   styles, et il retient le choix du joueur.

   UN SON DIFFERENT PAR PAGE
   Chaque page peut avoir sa propre ambiance :

       <script src="sonar-button.js" data-src="assets/mon-ambiance.mp3" defer></script>

   Sans precision, c'est l'ambiance par defaut du jeu qui est utilisee.

   OU SE PLACE LE BOUTON
   - Si la page a une barre en haut (.topbar) ou un emplacement marque
     data-sonar-slot, le bouton s'y INSERE : il ne recouvre rien.
   - Sinon il flotte en haut a droite.
   Pour choisir soi-meme l'endroit, il suffit d'ajouter data-sonar-slot sur
   l'element qui doit l'accueillir.

   POURQUOI UN FICHIER SEPARE
   La page d'accueil embarquait sa propre copie de ce mecanisme. Chaque
   nouvelle page aurait du la recopier, avec le risque de versions qui
   divergent. Ici il n'y a qu'une source.

   ATTENTION — la page d'accueil (index.html) garde SA propre implementation :
   elle y est melee a d'autres reglages (bouton d'installation, alarmes du
   jeu). Ce script le detecte et ne fait rien, pour eviter deux boutons.

   REGLE DU SON, identique partout :
     - allume : ambiance + bruitages audibles
     - eteint : silence total sur toute la page
   Le choix est memorise dans localStorage sous 'nautilusSoundOn' et suit le
   joueur d'une page a l'autre.
============================================================================= */

(function () {
  'use strict';

  // La page d'accueil gere deja son bouton : on ne double pas.
  if (document.getElementById('sonarToggleBtn')) return;

  var KEY = 'nautilusSoundOn';
  var VOLUME = 0.42;
  var audio = null;
  var btn = null;
  var primed = false;      // lecture muette lancee (deblocage anticipe)
  var audible = false;     // le son sort vraiment

  function soundAllowed() {
    // Autorise par defaut : seul un refus explicite coupe le son.
    try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; }
  }
  function remember(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* mode prive */ }
  }

  /* ---------- Styles (injectes une seule fois) ---------- */
  function injectStyles() {
    if (document.getElementById('sonarBtnStyles')) return;
    var css = ''
      + '.nx-sonar-bar{position:fixed;top:14px;right:14px;z-index:10000;pointer-events:none}'
      + '.nx-sonar-bar>*{pointer-events:auto}'
      + '.nx-sonar-toggle{box-sizing:border-box;padding:9px 14px;border:2px solid rgba(245,176,39,.45);'
      + 'border-radius:999px;font-family:inherit;font-size:clamp(10px,2.5vw,12px);font-weight:1000;'
      + 'letter-spacing:.02em;line-height:1.15;text-transform:uppercase;display:inline-flex;'
      + 'align-items:center;justify-content:center;gap:5px;white-space:nowrap;cursor:pointer;'
      + 'background:rgba(0,0,0,.62);color:rgba(255,255,255,.88);box-shadow:0 8px 18px rgba(0,0,0,.18);'
      + 'margin:0;min-height:auto}'
      /* Deux etats seulement, aucun effet de survol : eteint = noir, allume = vert. */
      + '.nx-sonar-toggle:hover,.nx-sonar-toggle:focus,.nx-sonar-toggle:active{'
      + 'background:rgba(0,0,0,.62);color:rgba(255,255,255,.88);border-color:rgba(245,176,39,.45);'
      + 'filter:none;transform:none}'
      + '.nx-sonar-toggle.active,.nx-sonar-toggle.active:hover,.nx-sonar-toggle.active:focus,'
      + '.nx-sonar-toggle.active:active{background:rgba(18,138,90,.85);color:#fff;'
      + 'border-color:rgba(255,255,255,.3);filter:none;transform:none}'
      + '.nx-sonar-toggle .nx-ico{flex:0 0 auto;line-height:1}'
      /* Insere dans une barre existante : plus petit, aligne avec le reste. */
      + '.nx-sonar-toggle.nx-inline{padding:6px 12px;font-size:11px;flex:0 0 auto}'
      + '@media(max-width:520px){.nx-sonar-bar{top:7px;right:7px}'
      + '.nx-sonar-toggle{padding:7px 10px;font-size:clamp(8px,2.05vw,9.6px);border-width:1.5px}}';
    var st = document.createElement('style');
    st.id = 'sonarBtnStyles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- Elements ---------- */
  /* Quel fichier son pour CETTE page ?
     Chaque page peut avoir sa propre ambiance. Trois facons de la choisir,
     de la plus prioritaire a la moins :

       1. un attribut sur la balise du script :
            <script src="sonar-button.js" data-src="assets/ambiance-morse.mp3" defer></script>
       2. une variable posee avant le script :
            <script>window.NAUTILUS_AMBIANCE = 'assets/ambiance-morse.mp3';</script>
       3. rien : on retombe sur l'ambiance par defaut du jeu.

     Ainsi une nouvelle page peut avoir sa musique sans toucher a ce
     fichier, et sans imposer celle de la page d'accueil. */
  function ambianceSrc() {
    var tag = document.currentScript
           || document.querySelector('script[src*="sonar-button.js"]');
    var fromTag = tag && tag.getAttribute('data-src');
    if (fromTag) return fromTag;
    if (window.NAUTILUS_AMBIANCE) return window.NAUTILUS_AMBIANCE;
    return 'assets/ambiance-sonar.mp3';
  }

  function buildAudio() {
    // Une page peut fournir son propre lecteur : on le respecte tel quel.
    audio = document.getElementById('ambianceAudio');
    if (audio) return;
    audio = document.createElement('audio');
    audio.id = 'ambianceAudio';
    audio.loop = true;
    audio.preload = 'auto';
    audio.muted = true;              // une lecture MUETTE est toujours autorisee
    audio.setAttribute('playsinline', '');
    var src = document.createElement('source');
    // Chemin relatif : fonctionne aussi sur GitHub Pages (sous-dossier).
    src.src = ambianceSrc();
    src.type = 'audio/mpeg';
    audio.appendChild(src);
    document.body.appendChild(audio);
  }

  function buildButton() {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'sonarToggleBtn';
    btn.className = 'nx-sonar-toggle';
    btn.innerHTML = '<span class="nx-ico" aria-hidden="true">🔇</span>'
                  + '<span class="nx-label">Activer le sonar</span>';
    btn.addEventListener('click', toggle);

    /* PLACEMENT
       Si la page possede deja une barre en haut (data-sonar-slot, ou la
       .topbar des pages palier), on INSERE le bouton dedans : il se range
       a cote du reste au lieu de flotter par-dessus et de masquer le
       contenu.
       Sinon seulement, on le pose en flottant en haut a droite. */
    var slot = document.querySelector('[data-sonar-slot]')
            || document.querySelector('.topbar .topbar-info')
            || document.querySelector('.topbar');
    if (slot) {
      btn.classList.add('nx-inline');
      slot.appendChild(btn);
      return;
    }
    var bar = document.createElement('div');
    bar.className = 'nx-sonar-bar';
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  function paint(on) {
    audible = on;
    if (!btn) return;
    btn.classList.toggle('active', on);
    btn.querySelector('.nx-ico').textContent = on ? '🔊' : '🔇';
    btn.querySelector('.nx-label').textContent = on ? 'Sonar activé' : 'Activer le sonar';
  }

  /* ---------- Lecture ---------- */

  /* Lecture en sourdine : toujours acceptee, meme sans geste du joueur.
     Elle sert de rampe de lancement — il ne restera qu'a couper la
     sourdine, ce qui n'est bloque par aucun navigateur. */
  function prime() {
    if (!audio || primed || audible || !soundAllowed()) return;
    audio.muted = true;
    audio.volume = 0;
    var p = audio.play();
    if (p && p.then) p.then(function () { primed = true; }).catch(function () { primed = false; });
  }

  function start() {
    if (!audio || !soundAllowed()) return Promise.resolve(false);
    audio.muted = false;
    audio.volume = VOLUME;
    if (primed && !audio.paused) { paint(true); return Promise.resolve(true); }
    return audio.play().then(function () {
      paint(true);
      return true;
    }).catch(function () {
      // Refus : on remet la sourdine pour rester pret pour le prochain geste.
      audio.muted = true;
      audio.volume = 0;
      paint(false);
      return false;
    });
  }

  function silence() {
    // Coupe TOUS les sons de la page, pas seulement l'ambiance.
    var list = document.querySelectorAll('audio');
    for (var i = 0; i < list.length; i++) {
      try { list[i].pause(); list[i].muted = true; } catch (e) { /* pas pret */ }
    }
    primed = false;
    paint(false);
  }

  function toggle() {
    if (audible) {
      remember(false);
      silence();
    } else {
      remember(true);
      var list = document.querySelectorAll('audio');
      for (var i = 0; i < list.length; i++) list[i].muted = false;
      start();
    }
  }

  /* Reprend l'ambiance à chaque retour sur la page (chargement, retour du
     cache navigateur, mise au premier plan). Un refus d'autoplay ne crée
     jamais de bruit parasite : on amorce seulement la lecture muette puis
     le scroll ou le clic suivant la rend audible. */
  function wakeAmbiance() {
    if (audible || !soundAllowed()) return;
    start().then(function (ok) {
      if (!ok) prime();
    });
  }

  /* ---------- Demarrage ---------- */
  function init() {
    injectStyles();
    buildAudio();
    buildButton();

    /* Tous les chemins de navigation doivent tenter l'ambiance : premier
       chargement, retour depuis le cache, retour sur l'onglet et activité
       réelle (scroll/clic, gérée plus bas). */
    audio.addEventListener('pause', function () { paint(false); });
    window.addEventListener('pageshow', wakeAmbiance, { passive: true });
    window.addEventListener('focus', wakeAmbiance, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') wakeAmbiance();
    });

    if (!soundAllowed()) { silence(); return; }

    // 1) On tente le son audible tout de suite. Accorde si l'appareil connait
    //    deja le site (app installee, visites repetees).
    start().then(function (ok) {
      if (ok) return;
      // 2) Refuse : lecture muette prete a etre demasquee au premier geste.
      prime();
      var events = ['scroll', 'wheel', 'touchmove', 'pointerdown', 'touchstart',
                    'mousedown', 'click', 'keydown', 'mousemove'];
      var wake = function () {
        if (audible || !soundAllowed()) return;
        start().then(function (started) {
          if (!started) return;
          for (var i = 0; i < events.length; i++) {
            document.removeEventListener(events[i], wake, true);
          }
        });
      };
      for (var i = 0; i < events.length; i++) {
        document.addEventListener(events[i], wake, { passive: true, capture: true });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
