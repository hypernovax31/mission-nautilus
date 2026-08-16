/* =============================================================
   RÉSERVE D'OXYGÈNE — bandeau du haut, COMMUN À TOUS LES PALIERS
   (reserve-o2.js)

   Extrait de palier1.html (où le code vivait en dur), pour être
   PARTAGÉ avec tous les paliers : la « jauge » de la Réserve O₂
   reste visible tout en haut de la page, sous la barre de titre,
   pendant TOUTE la mission — zone scellée (sas QR), briefing du
   capitaine et mini-jeu compris.

   Ce que fait ce module, sans que la page n'ait rien à câbler :

   1. Il injecte le bandeau `.o2-bar` en tout premier élément de
      <main>, puis l'écran d'alarme de fin (`.oxygen-end-alarm`) en
      fin de <body>. Les styles vivent dans css/palier1.css (chargée
      par toutes les pages de palier) — mêmes classes, mêmes teintes
      que le Palier 1.

   2. Il lit la configuration commune de la mission
      (game/config : missionStartedAt, missionDurationMs) :
      • d'abord depuis la mémoire de l'appareil
        (localStorage « nautilusMissionConfig », posée par l'accueil),
        pour afficher la jauge IMMÉDIATEMENT, sans attendre le réseau ;
      • puis depuis Firestore, en la corrigeant dès la réponse.
      La lecture Firestore passe par le canal déjà mutualisé :
      window.Nautilus.getMissionConfig (palier1.html) ou
      window.NautilusBlocages.db() (paliers ≥ 2, matelot-blocages.js).

   3. Il rafraîchit la jauge toutes les 30 s et re-vérifie la date de
      départ toutes les 2 min (un autre équipage peut lancer la
      mission pendant la partie).

   4. Quand la réserve atteint 0 : alarme de fin (écran rouge +
      Submarine_alarm.mp3 en boucle, sauf sonar coupé — règle absolue)
      puis remontée générale vers classement.html après 5 s.

   A GARDER EN PHASE avec la jauge d'oxygène de l'accueil (index.html)
   et les styles .o2-* de css/palier1.css.

   Utilisation (aucun appel nécessaire) :
     <script src="reserve-o2.js?v=1"></script>
   ============================================================= */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.NautilusO2) return;

  var MISSION_CFG_KEY = 'nautilusMissionConfig';
  var REDIRECTION_FIN = 'classement.html';

  var _o2Config = null;
  var _endShown = null;
  var _endTimer = null;

  /* ===== SON ACTIF ? — centralisé dans son-partage.js ===== */
  function sonActif() {
    if (window.NautilusSon && typeof window.NautilusSon.sonActif === 'function') {
      return window.NautilusSon.sonActif();
    }
    try { return localStorage.getItem('nautilusSoundOn') !== '0'; }
    catch (e) { return true; }
  }

  /* ===== MÉMOIRE (dernière config connue de l'appareil) =====
     La jauge restait CACHEE tant que le serveur n'avait pas répondu :
     au lancement, elle apparaissait brutalement une seconde plus tard
     et décalait toute la page. On repart donc de la dernière config
     connue — posée par l'accueil, que le matelot vient de traverser —
     puis on la corrige dès la réponse du serveur. */
  function configDepuisMemoire() {
    try {
      var brut = localStorage.getItem(MISSION_CFG_KEY);
      if (!brut) return null;
      var cfg = JSON.parse(brut);
      if (cfg && (cfg.missionStartedAt === null || typeof cfg.missionStartedAt === 'string')) {
        return cfg;
      }
    } catch (e) { /* mémoire indisponible */ }
    return null;
  }

  /* ===== CONFIG SERVEUR (game/config) ===== */
  function lireConfigServeur() {
    /* palier1.html expose window.Nautilus.getMissionConfig. */
    if (window.Nautilus && typeof window.Nautilus.getMissionConfig === 'function') {
      return Promise.resolve().then(function () { return window.Nautilus.getMissionConfig(); });
    }
    /* Paliers ≥ 2 : Firebase mutualisé via matelot-blocages.js. */
    var B = window.NautilusBlocages;
    if (B && typeof B.db === 'function') {
      return B.db().then(function (x) {
        return x.fs.getDoc(x.fs.doc(x.db, 'game', 'config'));
      }).then(function (snap) {
        return (snap && snap.exists()) ? snap.data() : {};
      }).catch(function () { return null; });
    }
    return Promise.resolve(null);
  }

  function chargerConfigO2() {
    return lireConfigServeur().then(function (frais) {
      /* Une lecture ratée (réseau coupé) renvoie null : dans ce cas on
         GARDE la valeur mémorisée plutôt que d'effacer la jauge. */
      if (frais) {
        _o2Config = frais;
        try {
          localStorage.setItem(MISSION_CFG_KEY, JSON.stringify({
            missionStartedAt: frais.missionStartedAt ?? null,
            missionDurationMs: frais.missionDurationMs ?? null
          }));
        } catch (e) { /* sans conséquence */ }
      }
      return frais;
    });
  }

  /* ===== ÉCHELLE DE COULEUR (même que l'accueil) =====
     50 paliers du bleu très foncé (0 %) au bleu franc (50 %), puis
     au blanc (100 %). */
  var OXYGEN_COLOR_LEVEL_COUNT = 50;
  var OXYGEN_COLOR_ANCHORS = [
    [0,   [3, 18, 50]],
    [50,  [43, 136, 222]],
    [100, [255, 255, 255]]
  ];

  function buildOxygenGradient() {
    var colorAt = function (percent) {
      var low = OXYGEN_COLOR_ANCHORS[0];
      var high = OXYGEN_COLOR_ANCHORS[OXYGEN_COLOR_ANCHORS.length - 1];
      for (var i = 0; i < OXYGEN_COLOR_ANCHORS.length - 1; i++) {
        if (percent >= OXYGEN_COLOR_ANCHORS[i][0] && percent <= OXYGEN_COLOR_ANCHORS[i + 1][0]) {
          low = OXYGEN_COLOR_ANCHORS[i];
          high = OXYGEN_COLOR_ANCHORS[i + 1];
          break;
        }
      }
      var ratio = (percent - low[0]) / Math.max(1, high[0] - low[0]);
      return low[1].map(function (channel, index) {
        return Math.round(channel + (high[1][index] - channel) * ratio);
      });
    };
    var stops = [];
    for (var index = 0; index < OXYGEN_COLOR_LEVEL_COUNT; index++) {
      var rgb = colorAt((index / (OXYGEN_COLOR_LEVEL_COUNT - 1)) * 100);
      var start = (index / OXYGEN_COLOR_LEVEL_COUNT * 100).toFixed(3);
      var end = ((index + 1) / OXYGEN_COLOR_LEVEL_COUNT * 100).toFixed(3);
      var color = 'rgb(' + rgb.join(',') + ')';
      stops.push(color + ' ' + start + '%,' + color + ' ' + end + '%');
    }
    return 'linear-gradient(90deg,' + stops.join(',') + ')';
  }

  var OXYGEN_GRADIENT_50_LEVELS = buildOxygenGradient();

  function applyOxygenGradient(fill, percent) {
    if (!fill) return;
    var remaining = Math.max(0.1, Math.min(100, Number(percent) || 0));
    fill.style.background = OXYGEN_GRADIENT_50_LEVELS;
    fill.style.backgroundSize = ((10000 / remaining).toFixed(3)) + '% 100%';
    fill.style.backgroundPosition = 'left center';
  }

  /* ===== ALARME DE FIN D'OXYGÈNE : son préparé en silence =====
     Même recette que partout (palier-annonces.js) : on télécharge et
     décode Submarine_alarm.mp3 au premier geste, jamais de play() muet
     (parasite mobile). La lecture, déclenchée plus tard par le
     minuteur, reste autorisée. */
  var _finAlarmCtx = null;
  var _finAlarmBuf = null;
  var _finAlarmLoading = null;
  var _finAlarmLiveSrc = null;
  var _finAlarmFallbackAudio = null;

  function _finAlarmAudioCtx() {
    if (_finAlarmCtx) return _finAlarmCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { _finAlarmCtx = new AC(); } catch (e) { return null; }
    if (window.NautilusSon && window.NautilusSon.registerContexte) {
      window.NautilusSon.registerContexte(_finAlarmCtx);
    }
    if (_finAlarmCtx.state === 'suspended') _finAlarmCtx.resume().catch(function () {});
    return _finAlarmCtx;
  }

  function primeFinalAlarm() {
    if (_finAlarmBuf || _finAlarmLoading) return;
    var ctx = _finAlarmAudioCtx();
    if (!ctx) return;   // Web Audio indisponible : le repli <audio> suffira
    _finAlarmLoading = fetch('assets/Submarine_alarm.mp3')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (buf) { return ctx.decodeAudioData(buf); })
      .then(function (dec) { _finAlarmBuf = dec; })
      .catch(function () { _finAlarmLoading = null; });
  }
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(function (type) {
    document.addEventListener(type, primeFinalAlarm, { capture: true, passive: true });
  });

  function showOxygenEndAlarm(endAt) {
    var key = String(endAt);
    if (_endShown === key) return;
    _endShown = key;
    var overlay = document.getElementById('oxygenEndAlarm');
    var count = document.getElementById('oxygenEndCount');
    if (!overlay || !count) return;
    clearInterval(_endTimer);
    var remaining = 5;
    count.textContent = remaining;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    /* Coupe tous les sons déjà joués par la page avant l'alarme. */
    var audios = document.querySelectorAll('audio');
    for (var i = 0; i < audios.length; i++) {
      try { audios[i].pause(); audios[i].muted = true; audios[i].currentTime = 0; } catch (e) {}
    }
    /* RÈGLE ABSOLUE : sonar coupé = SILENCE TOTAL, même pour l'alarme
       de fin d'O₂ — l'écran rouge et le compte à rebours restent
       affichés, mais AUCUN son ne part. */
    var finJouee = false;
    var finCtx = sonActif() ? _finAlarmAudioCtx() : null;
    if (finCtx && _finAlarmBuf) {
      try {
        var src = finCtx.createBufferSource();
        src.buffer = _finAlarmBuf;
        src.loop = true;
        var g = finCtx.createGain();
        g.gain.value = 0.82;
        src.connect(g);
        g.connect(finCtx.destination);
        src.start();
        _finAlarmLiveSrc = src;
        finJouee = true;
      } catch (e) { finJouee = false; }
    }
    if (!finJouee && sonActif()) {
      _finAlarmFallbackAudio = new Audio('assets/Submarine_alarm.mp3');
      _finAlarmFallbackAudio.loop = true;
      _finAlarmFallbackAudio.preload = 'auto';
      _finAlarmFallbackAudio.volume = 0.82;
      _finAlarmFallbackAudio.play().catch(function () {});
    }
    _endTimer = setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(_endTimer);
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
        if (_finAlarmLiveSrc) {
          try { _finAlarmLiveSrc.stop(); } catch (e) {}
          _finAlarmLiveSrc = null;
        }
        if (_finAlarmFallbackAudio) {
          _finAlarmFallbackAudio.pause();
          _finAlarmFallbackAudio.currentTime = 0;
          _finAlarmFallbackAudio = null;
        }
        window.location.href = REDIRECTION_FIN;
        return;
      }
      count.textContent = remaining;
    }, 1000);
  }

  /* ===== MISE À JOUR DE LA JAUGE ===== */
  function majReserveO2() {
    var bar = document.getElementById('o2Bar');
    if (!bar) return;
    var depart = _o2Config && _o2Config.missionStartedAt;
    if (!depart) { bar.hidden = true; return; }

    var duree = (typeof _o2Config.missionDurationMs === 'number' && _o2Config.missionDurationMs > 0)
      ? _o2Config.missionDurationMs
      : 7 * 24 * 60 * 60 * 1000;

    var fin = new Date(depart).getTime() + duree;
    if (Date.now() >= fin) showOxygenEndAlarm(fin);
    var reste = Math.max(0, fin - Date.now());
    /* MÊME CALCUL QUE L'ACCUEIL, au chiffre près : arrondi au plus
       proche, mais jamais « 100 % » si du temps a été consommé, ni
       « 0 % » s'il en reste. */
    var ratio = reste / duree;
    var pctBrut = ratio * 100;
    var pct = pctBrut >= 100 ? 100
            : pctBrut <= 0   ? 0
            : Math.min(99, Math.max(1, Math.round(pctBrut)));
    /* La barre suit la valeur non arrondie : descente continue. */
    var pctPrecis = Math.max(0, Math.min(100, ratio * 100));

    var j = Math.floor(reste / 86400000); reste -= j * 86400000;
    var h = Math.floor(reste / 3600000);  reste -= h * 3600000;
    var m = Math.floor(reste / 60000);    reste -= m * 60000;
    var s = Math.floor(reste / 1000);

    bar.hidden = false;
    var fill = document.getElementById('o2Fill');
    fill.style.width = pctPrecis.toFixed(3) + '%';
    applyOxygenGradient(fill, pctPrecis);
    document.getElementById('o2Pct').textContent = pct + '%';
    /* MÊME FORMAT QUE L'ACCUEIL : « 7J 00h00m00s », secondes comprises —
       la jauge des paliers affiche exactement le même temps que l'accueil. */
    document.getElementById('o2Time').textContent = j + 'J ' + ('0' + h).slice(-2) + 'h' + ('0' + m).slice(-2) + 'm' + ('0' + s).slice(-2) + 's';
    /* MÊMES SEUILS QUE L'ACCUEIL : la jauge passe à l'orange à 50 %
       et au rouge à 20 %. */
    bar.classList.toggle('warn', pct <= 50 && pct > 20);
    bar.classList.toggle('crit', pct <= 20);
    /* Contour d'alerte : clignote en 5 s ; sous 5 %, chaque % restant
       accélère le clignotement (1 % = 1 s, plancher 1 s). */
    var tube = bar.querySelector('.o2-tube');
    if (tube) {
      tube.style.animationDuration = pct <= 20
        ? (pct < 5 ? Math.max(1, pct) : 5) + 's'
        : '';
    }
  }

  /* ===== INJECTION DU HTML ===== */
  function injecterHtml() {
    var main = document.querySelector('main') || document.body;
    if (!document.getElementById('o2Bar')) {
      var bar = document.createElement('div');
      bar.className = 'o2-bar';
      bar.id = 'o2Bar';
      bar.hidden = true;
      bar.innerHTML =
        '<div class="o2-label">Réserve O₂</div>' +
        '<div class="o2-tube">' +
          '<div class="o2-fill" id="o2Fill"></div>' +
          '<span class="o2-pct" id="o2Pct">—</span>' +
        '</div>' +
        '<div class="o2-time" id="o2Time">—</div>';
      main.insertBefore(bar, main.firstChild);
    }
    if (!document.getElementById('oxygenEndAlarm')) {
      var alarm = document.createElement('div');
      alarm.className = 'oxygen-end-alarm';
      alarm.id = 'oxygenEndAlarm';
      alarm.setAttribute('aria-live', 'assertive');
      alarm.setAttribute('aria-hidden', 'true');
      alarm.innerHTML =
        '<div class="oxygen-end-panel">' +
          '<div class="oxygen-end-title">RÉSERVES ÉPUISÉES</div>' +
          '<p>Tous les équipages remontent à la surface.</p>' +
          '<div class="oxygen-end-count" id="oxygenEndCount">5</div>' +
          '<p class="oxygen-end-sub">Remontée générale dans…</p>' +
        '</div>';
      document.body.appendChild(alarm);
    }
  }

  /* ===== BOOT ===== */
  function boot() {
    injecterHtml();
    /* Affichage IMMÉDIAT depuis la mémoire, avant toute lecture réseau. */
    _o2Config = configDepuisMemoire();
    if (_o2Config) majReserveO2();

    chargerConfigO2().then(function () {
      majReserveO2();
      /* MÊME CADENCE QUE L'ACCUEIL : rafraîchissement chaque seconde, pour
         que les secondes défilent à l'identique et que la jauge reste
         exactement synchronisée avec celle de l'accueil. */
      setInterval(majReserveO2, 1000);
      /* La date de départ peut être posée pendant la partie (un autre
         équipage lance la mission) : on la reverifie de temps en temps. */
      setInterval(function () { chargerConfigO2().then(majReserveO2); }, 120000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.NautilusO2 = { boot: boot, majReserveO2: majReserveO2 };
})();
