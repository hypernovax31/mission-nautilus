/* Reprise des animations de l'accueil sans modifier leur apparence habituelle.
   Le choix système « mouvements réduits » reste actif par défaut. Les boutons
   de secours ne s'affichent que si ce réglage est actif ou si le navigateur
   refuse la lecture automatique de la vidéo du hublot. */
(function () {
  'use strict';
  if (window.NautilusAnimations) return;

  var CLE = 'nautilusAnimationsAutorisees';
  var racine = document.documentElement;
  var porte = document.getElementById('ecoutille');
  var film = porte && porte.querySelector('.ec-film');
  var boutonFilm = document.getElementById('ecAnimationControl');
  var boutonRadar = document.getElementById('radarAnimationControl');
  var media = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var autorise = false;
  var lectureBloquee = false;
  var tentative = 0;
  try { autorise = localStorage.getItem(CLE) === '1'; } catch (_) {}
  if (!autorise) {
    try { autorise = sessionStorage.getItem(CLE) === '1'; } catch (_) {}
  }

  function systemeReduit() { return !!(media && media.matches); }
  function reduit() { return systemeReduit() && !autorise; }
  function filmActif() { return !!(film && film.isConnected && porte && porte.isConnected); }

  function afficherCommandes() {
    if (boutonFilm) {
      // Une fois le choix fait, le bouton d'activation disparaît. Seul un
      // éventuel bouton distinct de reprise vidéo reste si la lecture échoue.
      boutonFilm.hidden = !filmActif() || (!reduit() && !lectureBloquee);
      if (lectureBloquee && !reduit()) {
        boutonFilm.textContent = film && film.error ? '↻ Réessayer la vidéo' : '▶ Lancer la vidéo';
        boutonFilm.title = film && film.error ? 'La vidéo est indisponible ; appuie pour réessayer.' : 'Le navigateur demande un geste pour lancer la vidéo.';
      } else {
        boutonFilm.textContent = '▶ Activer les animations';
        boutonFilm.title = 'Activer les animations sur cet appareil malgré le réglage système.';
      }
      boutonFilm.removeAttribute('aria-pressed');
      boutonFilm.setAttribute('aria-label', boutonFilm.title);
    }
    if (boutonRadar) {
      boutonRadar.hidden = !reduit();
      boutonRadar.textContent = '▶ Activer les animations';
      boutonRadar.title = 'Activer les animations sur cet appareil malgré le réglage système.';
      boutonRadar.removeAttribute('aria-pressed');
      boutonRadar.setAttribute('aria-label', boutonRadar.title);
    }
  }

  function essayerFilm() {
    if (!filmActif() || reduit() || document.visibilityState === 'hidden') return;
    film.muted = true;
    film.defaultMuted = true;
    film.playsInline = true;
    film.loop = true;
    var numero = ++tentative;
    try {
      var resultat = film.play();
      if (resultat && typeof resultat.then === 'function') {
        resultat.then(function () {
          if (numero !== tentative) return;
          lectureBloquee = false;
          afficherCommandes();
        }).catch(function () {
          if (numero !== tentative || !filmActif() || reduit() || document.visibilityState === 'hidden') return;
          lectureBloquee = true;
          afficherCommandes();
        });
      }
    } catch (_) {
      lectureBloquee = true;
      afficherCommandes();
    }
  }

  /* En mode système réduit, certains Safari ne relancent pas une animation
     CSS même après l'autorisation explicite. Le balayage utilise alors un
     seul transform piloté par requestAnimationFrame, indépendant de Firebase.
     Il est arrêté hors écran et en arrière-plan pour préserver la batterie. */
  var radarElement = null;
  var radarTransformeInitial = '';
  var radarImage = null;
  var radarEnMarche = false;
  var radarDernierTemps = null;
  var radarAngle = 0;
  var radarObservation = null;
  var radarObserve = null;
  var radarControle = null;

  function estDansLaFenetre(element) {
    if (!element || document.visibilityState === 'hidden') return false;
    var rect = element.getBoundingClientRect();
    var vue = window.visualViewport;
    var haut = vue ? vue.offsetTop : 0;
    var gauche = vue ? vue.offsetLeft : 0;
    var hauteur = vue ? vue.height : (window.innerHeight || document.documentElement.clientHeight || 0);
    var largeur = vue ? vue.width : (window.innerWidth || document.documentElement.clientWidth || 0);
    return !!(hauteur && largeur && rect.width && rect.height && rect.bottom > haut &&
      rect.top < haut + hauteur && rect.right > gauche && rect.left < gauche + largeur);
  }

  function ecoutilleDevant() {
    return !!(porte && porte.isConnected && !porte.classList.contains('ec-passee') &&
      !porte.classList.contains('ec-sortie') && !racine.classList.contains('ec-passee') &&
      !racine.classList.contains('ec-arrivee'));
  }

  function arreterRadar() {
    if (radarImage !== null) {
      if (window.cancelAnimationFrame) window.cancelAnimationFrame(radarImage);
      else clearTimeout(radarImage);
    }
    radarImage = null;
    radarDernierTemps = null;
    radarEnMarche = false;
  }

  function imageRadar(maintenant) {
    if (!radarEnMarche || !radarElement) return;
    if (radarDernierTemps !== null) {
      var delta = Math.max(0, Math.min(1000, maintenant - radarDernierTemps));
      radarAngle = (radarAngle + delta * 360 / 1400) % 360;
    }
    radarDernierTemps = maintenant;
    radarElement.style.transform = 'rotate(' + radarAngle.toFixed(3) + 'deg)';
    radarImage = window.requestAnimationFrame
      ? window.requestAnimationFrame(imageRadar)
      : setTimeout(function () { imageRadar(Date.now()); }, 32);
  }

  function retirerPiloteRadar() {
    arreterRadar();
    if (radarElement) {
      radarElement.classList.remove('nautilus-radar-js');
      radarElement.style.transform = radarTransformeInitial;
    }
    radarElement = null;
    radarAngle = 0;
  }

  function synchroniserRadar() {
    var element = document.querySelector('#radarStage .radar-sweep-big');
    if (!autorise || !systemeReduit() || !element) {
      if (radarElement) retirerPiloteRadar();
      return;
    }
    if (radarElement !== element) {
      retirerPiloteRadar();
      radarElement = element;
      radarTransformeInitial = element.style.transform;
      element.classList.add('nautilus-radar-js');
    }
    var visible = !ecoutilleDevant() && estDansLaFenetre(document.querySelector('#radarStage .radar-screen-big'));
    if (visible && !radarEnMarche) {
      radarEnMarche = true;
      radarDernierTemps = null;
      radarImage = window.requestAnimationFrame
        ? window.requestAnimationFrame(imageRadar)
        : setTimeout(function () { imageRadar(Date.now()); }, 32);
      window.dispatchEvent(new Event('nautilus:radar-visibilite'));
    } else if (!visible && radarEnMarche) {
      arreterRadar();
      window.dispatchEvent(new Event('nautilus:radar-visibilite'));
    }
  }

  function observerRadar() {
    var ecran = document.querySelector('#radarStage .radar-screen-big');
    if (ecran !== radarObserve) {
      if (radarObservation && radarObserve) radarObservation.unobserve(radarObserve);
      radarObserve = ecran;
      if (radarObservation && ecran) radarObservation.observe(ecran);
    }
    synchroniserRadar();
  }

  function programmerRadar() {
    if ((!autorise || !systemeReduit()) && !radarElement) return;
    if (radarControle !== null) return;
    radarControle = window.requestAnimationFrame
      ? window.requestAnimationFrame(function () { radarControle = null; synchroniserRadar(); })
      : setTimeout(function () { radarControle = null; synchroniserRadar(); }, 32);
  }

  function appliquer(choix) {
    autorise = !!choix;
    racine.classList.toggle('nautilus-motion-enabled', autorise);
    try {
      if (autorise) localStorage.setItem(CLE, '1');
      else localStorage.removeItem(CLE);
    } catch (_) {}
    try {
      if (autorise) sessionStorage.setItem(CLE, '1');
      else sessionStorage.removeItem(CLE);
    } catch (_) {}
    ++tentative; // ne pas appliquer le résultat tardif d'une ancienne lecture
    lectureBloquee = false;
    if (filmActif()) {
      film.autoplay = !reduit();
      if (reduit()) film.pause();
      else essayerFilm();
    }
    afficherCommandes();
    observerRadar();
    window.dispatchEvent(new Event('nautilus:animations-changees'));
  }

  function action(source) {
    if (source === 'film' && lectureBloquee && !reduit()) {
      lectureBloquee = false;
      if (film && film.error) film.load();
      essayerFilm();
      afficherCommandes();
      return;
    }
    if (reduit()) appliquer(true);
    else if (source === 'film') essayerFilm();
  }

  window.NautilusAnimations = {
    action: action,
    reduit: reduit,
    sonarAnime: function () { return radarEnMarche; },
    reinitialiser: function () { appliquer(false); }
  };
  racine.classList.toggle('nautilus-motion-enabled', autorise);
  if (film) {
    film.addEventListener('playing', function () {
      if (film.paused) return;
      lectureBloquee = false;
      if (porte) porte.classList.add('ec-film-pret');
      afficherCommandes();
    });
    film.addEventListener('error', function () {
      if (porte) porte.classList.remove('ec-film-pret');
      if (!reduit()) lectureBloquee = true;
      afficherCommandes();
    });
    if (reduit()) {
      film.autoplay = false;
      film.pause();
    } else {
      film.autoplay = true;
      essayerFilm();
    }
    // Certains moteurs ne rejettent pas la promesse quand la lecture est
    // suspendue : proposer une action manuelle plutôt qu'une image figée.
    setTimeout(function () {
      if (filmActif() && !reduit() && document.visibilityState === 'visible' && film.paused) {
        lectureBloquee = true;
        afficherCommandes();
      }
    }, 2500);
  }
  afficherCommandes();

  if (boutonRadar) boutonRadar.addEventListener('click', function () { action('radar'); });
  if (window.IntersectionObserver) {
    try { radarObservation = new IntersectionObserver(observerRadar, { threshold: [0, 0.01] }); } catch (_) {}
  }
  observerRadar();
  if (window.MutationObserver) {
    var zoneRadar = document.getElementById('equipagesEnMer');
    if (zoneRadar) {
      new MutationObserver(function () {
        if (document.querySelector('#radarStage .radar-screen-big') !== radarObserve) observerRadar();
      }).observe(zoneRadar, { childList: true, subtree: true });
    }
  }
  window.addEventListener('scroll', programmerRadar, { passive: true });
  window.addEventListener('resize', programmerRadar, { passive: true });
  window.addEventListener('nautilus:ecoutille-ouverte', observerRadar);
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('scroll', programmerRadar, { passive: true });
    window.visualViewport.addEventListener('resize', programmerRadar, { passive: true });
  }
  document.addEventListener('visibilitychange', function () {
    if (filmActif()) {
      if (document.visibilityState === 'hidden') {
        ++tentative;
        film.pause();
      } else essayerFilm();
    }
    synchroniserRadar();
  });
  window.addEventListener('pageshow', function () { essayerFilm(); observerRadar(); });
  var minuterieFormat = null;
  function verifierFormat() {
    clearTimeout(minuterieFormat);
    minuterieFormat = setTimeout(function () {
      if (!filmActif()) return;
      var portrait = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;
      var voulu = portrait ? 'assets/film-nautilus-P.mp4?v=2' : 'assets/film-nautilus-L.mp4?v=2';
      if (film.getAttribute('src') !== voulu) {
        if (porte) porte.classList.remove('ec-film-pret');
        film.setAttribute('src', voulu);
        film.load();
      }
      if (!reduit() && film.paused) essayerFilm();
    }, 180);
  }
  // Sur certains téléphones le media query change après orientationchange ;
  // resize couvre aussi cette mise à jour tardive sans toucher à la mise en page.
  window.addEventListener('orientationchange', verifierFormat);
  window.addEventListener('resize', verifierFormat);
  if (media) {
    var changementSysteme = function () {
      ++tentative;
      lectureBloquee = false;
      if (filmActif()) {
        film.autoplay = !reduit();
        if (reduit()) film.pause();
        else essayerFilm();
      }
      afficherCommandes();
      observerRadar();
    };
    if (media.addEventListener) media.addEventListener('change', changementSysteme);
    else if (media.addListener) media.addListener(changementSysteme);
  }
})();
