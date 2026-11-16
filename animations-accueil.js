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

  function systemeReduit() { return !!(media && media.matches); }
  function reduit() { return systemeReduit() && !autorise; }
  function filmActif() { return !!(film && film.isConnected && porte && porte.isConnected); }

  function afficherCommandes() {
    if (boutonFilm) {
      boutonFilm.hidden = !filmActif() || (!systemeReduit() && !lectureBloquee);
      if (lectureBloquee && !reduit()) {
        boutonFilm.textContent = film && film.error ? '↻ Réessayer la vidéo' : '▶ Lancer la vidéo';
        boutonFilm.title = film && film.error ? 'La vidéo est indisponible ; appuie pour réessayer.' : 'Le navigateur demande un geste pour lancer la vidéo.';
      } else if (autorise && systemeReduit()) {
        boutonFilm.textContent = '↺ Mouvements réduits';
        boutonFilm.title = 'Revenir au réglage de mouvement de cet appareil.';
      } else {
        boutonFilm.textContent = '▶ Activer les animations';
        boutonFilm.title = 'Activer les animations sur cet appareil malgré le réglage système.';
      }
      if (systemeReduit() && !(lectureBloquee && !reduit())) {
        boutonFilm.setAttribute('aria-pressed', autorise ? 'true' : 'false');
      } else boutonFilm.removeAttribute('aria-pressed');
      boutonFilm.setAttribute('aria-label', boutonFilm.title);
    }
    if (boutonRadar) {
      boutonRadar.hidden = !systemeReduit();
      boutonRadar.textContent = autorise ? '↺ Mouvements réduits' : '▶ Activer les animations';
      boutonRadar.title = autorise ? 'Revenir au réglage de mouvement de cet appareil.' : 'Activer les animations sur cet appareil malgré le réglage système.';
      boutonRadar.setAttribute('aria-pressed', autorise ? 'true' : 'false');
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

  function appliquer(choix) {
    autorise = !!choix;
    racine.classList.toggle('nautilus-motion-enabled', autorise);
    try {
      if (autorise) localStorage.setItem(CLE, '1');
      else localStorage.removeItem(CLE);
    } catch (_) {}
    ++tentative; // ne pas appliquer le résultat tardif d'une ancienne lecture
    lectureBloquee = false;
    if (filmActif()) {
      film.autoplay = !reduit();
      if (reduit()) film.pause();
      else essayerFilm();
    }
    afficherCommandes();
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
    if (systemeReduit()) appliquer(!autorise);
    else if (source === 'film') essayerFilm();
  }

  window.NautilusAnimations = { action: action, reduit: reduit };
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
  document.addEventListener('visibilitychange', function () {
    if (!filmActif()) return;
    if (document.visibilityState === 'hidden') {
      ++tentative;
      film.pause();
    } else essayerFilm();
  });
  window.addEventListener('pageshow', essayerFilm);
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
    };
    if (media.addEventListener) media.addEventListener('change', changementSysteme);
    else if (media.addListener) media.addListener(changementSysteme);
  }
})();
