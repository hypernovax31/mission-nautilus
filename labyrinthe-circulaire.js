/* =============================================================================
   MISSION NAUTILUS — PALIER 7 : LE LABYRINTHE CIRCULAIRE DU NAUTILUS
   (labyrinthe-circulaire.js)
   -----------------------------------------------------------------------------
   Épreuve du Palier 7 (Version Haute Complexité 10x24) :
   - Labyrinthe circulaire à 10 anneaux concentriques et 24 secteurs (240 cellules).
   - Dédale très difficile avec 33 culs-de-sac (impasses) et un parcours optimal
     de 53 étapes vers le Cœur central (1491 px de trajet direct).
   - Verrouillage de l'orientation portrait et compensation de rotation d'écran.
   - Priorité absolue au Gyroscope mobile : activation directe, demande d'autorisation
     interactive (iOS) et calibrage automatique sur l'inclinaison initiale naturelle.
   - Rotation du labyrinthe de 180° tous les 20 impacts contre les parois.
   - Minuteur de 1 minute maximum (60s) — compte à rebours sans compteur qui monte.
   - Rendu de la bille en 3D sphérique texturée avec ombrage dynamique et traînée.
   - Au centre : Cœur jaune vectoriel avec pulsations dégradé de rouge vers orange
     (aucun mot textuel « cœur »).
   ============================================================================= */

(function () {
  'use strict';

  if (window.NautilusLabyrinthe) return;

  var DUREE_PARCOURS_SEC = 60; // Minuteur de 1 minute maximum
  var RINGS = 10;
  var SECTORS = 24;
  var SECTOR_ANGLE = (Math.PI * 2) / SECTORS;

  /* Topologie certifiée haute complexité (10 anneaux x 24 secteurs = 240 cellules, 33 impasses, 53 pas) */
  var RADIAL_WALLS = [
    [false,false,false,true,false,false,false,false,true,false,false,true,false,false,false,false,false,false,true,false,true,false,false,true],
    [true,true,false,true,true,true,true,false,true,true,true,false,false,false,true,true,false,true,false,true,false,true,true,true],
    [true,true,true,false,true,true,false,true,true,false,true,false,true,false,true,false,true,true,true,false,true,true,false,false],
    [false,true,true,false,false,false,true,true,false,true,true,true,true,false,true,true,false,true,false,true,false,false,false,true],
    [true,true,true,false,false,true,true,false,false,false,false,true,false,true,false,true,false,true,false,false,true,true,true,false],
    [false,false,false,true,false,false,true,true,false,true,false,true,true,false,true,true,true,false,false,true,false,true,false,true],
    [true,true,false,false,true,false,true,false,true,true,true,false,true,true,false,true,true,false,true,false,false,true,true,true],
    [true,true,true,false,true,true,false,true,true,false,false,true,true,true,false,false,true,false,true,true,false,true,false,true],
    [false,true,false,true,false,true,true,true,false,false,true,false,false,true,false,false,false,false,true,false,false,true,true,false],
    [false,false,false,true,false,false,false,true,true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true]
  ];

  var RING_WALLS = [
    [false,false,true,true,false,true,false,true,false,false,true,false,true,true,true,false,true,true,false,false,true,false,false,false],
    [false,false,false,false,false,false,false,true,false,false,false,true,true,true,false,false,false,false,false,true,false,true,false,true],
    [true,false,false,true,true,false,true,false,false,true,false,false,false,false,true,false,true,false,true,false,true,false,true,true],
    [false,false,false,true,true,false,false,false,true,true,false,false,false,true,false,true,false,true,false,true,true,false,false,true],
    [true,true,false,false,true,true,true,false,true,true,true,true,false,true,true,false,false,false,true,true,false,false,true,false],
    [false,true,true,true,false,true,false,true,false,false,false,false,false,false,false,false,false,true,false,true,true,false,false,false],
    [false,false,false,true,true,false,true,false,true,false,true,true,false,false,true,true,false,false,true,false,true,true,false,true],
    [false,false,false,true,false,false,false,false,false,true,true,false,true,false,true,true,true,true,false,false,true,false,true,false],
    [true,true,true,false,false,true,true,false,false,false,true,true,true,true,false,true,true,true,true,true,true,false,false,true]
  ];

  var START_RING = 9;  // Anneau le plus extérieur (Ring 10)
  var START_SECTOR = 0; // Départ à theta = 0
  var GOAL_SECTOR = 11; // Brèche unique vers le Cœur au secteur 11 (opposé)

  /* ================= VERROUILLAGE D'ORIENTATION PORTRAIT ================= */
  function tenterVerrouillagePortrait() {
    try {
      if (screen.orientation && typeof screen.orientation.lock === 'function') {
        screen.orientation.lock('portrait').catch(function () {});
      } else if (screen.lockOrientation) {
        screen.lockOrientation('portrait');
      } else if (screen.mozLockOrientation) {
        screen.mozLockOrientation('portrait');
      } else if (screen.msLockOrientation) {
        screen.msLockOrientation('portrait');
      }
    } catch (e) {}
  }
  tenterVerrouillagePortrait();

  /* ================= EFFETS SONORES (WEB AUDIO API) ================= */
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      try {
        var AudioCtor = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioCtor();
        if (window.NautilusSon && window.NautilusSon.registerContexte) {
          window.NautilusSon.registerContexte(audioCtx);
        }
      } catch (e) {}
    }
    return audioCtx;
  }

  function sonEstActif() {
    if (window.NautilusSon && typeof window.NautilusSon.sonActif === 'function') {
      return window.NautilusSon.sonActif();
    }
    try { return localStorage.getItem('nautilusSoundOn') !== '0'; } catch (e) { return true; }
  }

  var dernierSonChoc = 0;
  function jouerSonChoc(force) {
    if (!sonEstActif()) return;
    var now = Date.now();
    if (now - dernierSonChoc < 75) return;
    dernierSonChoc = now;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }

    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var f = 850 + Math.min(650, (force || 1) * 320);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.045);

      var vol = Math.min(0.26, 0.05 + (force || 1) * 0.08);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.048);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
  }

  function jouerSonVictoire() {
    if (!sonEstActif()) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }

    try {
      var notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
      notes.forEach(function (freq, idx) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.075);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.075);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + idx * 0.075 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.075 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.075);
        osc.stop(ctx.currentTime + idx * 0.075 + 0.5);
      });
    } catch (e) {}
  }

  function jouerSonDepart() {
    if (!sonEstActif()) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  function jouerSonAlerteCompteRebours(sec) {
    if (!sonEstActif()) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      var freq = 880 + Math.max(0, 5 - sec) * 90;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.085);
    } catch (e) {}
  }

  /* ================= MOTEUR DU LABYRINTHE ================= */
  function init(host, options) {
    var opts = options || {};
    var onVictoire = opts.onVictoire || function () {};
    var onDefaite = opts.onDefaite || function () {};

    tenterVerrouillagePortrait();

    var estMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Overlay d'alerte des 5 dernières secondes (clignotement latéral de l'écran)
    var edgeAlarmEl = document.getElementById('labyEdgeAlarm');
    if (!edgeAlarmEl) {
      edgeAlarmEl = document.createElement('div');
      edgeAlarmEl.id = 'labyEdgeAlarm';
      edgeAlarmEl.className = 'laby-edge-alarm';
      edgeAlarmEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(edgeAlarmEl);
    }

    host.innerHTML = ''
      + '<div class="laby-container" id="labyContainer">'
      + '  <div class="laby-hud">'
      + '    <div class="laby-hud-top">'
      + '      <div class="laby-timer laby-minuteur" id="labyTimer" title="Minuteur : 1 min avant remontée du matelot">'
      + '        <span class="laby-timer-ico">⏳</span>'
      + '        <span class="laby-timer-lbl">Minuteur :</span>'
      + '        <b id="labyTimerVal">01:00</b>'
      + '      </div>'
      + '    </div>'
      + '    <div class="laby-hud-stats" id="labyHudStats" hidden>'
      + '      <div class="laby-stat-item laby-stat-depth">Profondeur : <b id="labyDepth">Anneau 10/10</b></div>'
      + '      <div class="laby-stat-item">Impacts : <b id="labyCollisions">0</b></div>'
      + '      <div class="laby-stat-item">Cœur : <b id="labyCoreDist">Lointain</b></div>'
      + '    </div>'
      + '  </div>'

      + '  <div class="laby-board-outer" id="labyBoardOuter">'
      + '    <div class="laby-board" id="labyBoard">'
      + '      <canvas class="laby-canvas" id="labyCanvas" width="440" height="440"></canvas>'
      + '    </div>'
      + '    <div class="laby-start-overlay" id="labyStartOverlay">'
      + '      <div class="laby-start-card">'
      + '        <div class="laby-start-title">Lancer le Labyrinthe</div>'
      + '        <div class="laby-start-sub">Activez le minuteur (1 min) pour démarrer :</div>'
      + '        <div class="laby-start-actions" id="labyStartActions">'
      + '          <button type="button" class="laby-btn-start laby-btn-start-gyro" id="btnStartGyro">'
      + '            <span class="laby-btn-start-ico">🧭</span>'
      + '            <span class="laby-btn-start-txt">'
      + '              <b>GYROSCOPE</b>'
      + '              <small>Inclinez votre smartphone</small>'
      + '            </span>'
      + '          </button>'
      + '          <button type="button" class="laby-btn-start laby-btn-start-joy" id="btnStartJoy">'
      + '            <span class="laby-btn-start-ico">🕹️</span>'
      + '            <span class="laby-btn-start-txt">'
      + '              <b>JOYSTICK</b>'
      + '              <small>Commandes tactiles ou clavier</small>'
      + '            </span>'
      + '          </button>'
      + '        </div>'
      + '      </div>'
      + '    </div>'
      + '  </div>'

      + '  <div class="laby-controls-bar" id="labyControlsBar" hidden>'
      + '    <div class="laby-sensor-chip" id="labySensorChip">'
      + '      <span class="laby-sensor-dot" id="labySensorDot"></span>'
      + '      <span id="labySensorLabel">Commandes actives</span>'
      + '    </div>'
      + '    <div class="laby-actions">'
      + '      <button type="button" class="laby-btn" id="btnCalibGyro" title="Calibrer le niveau 0 sur l’inclinaison actuelle">🎯 Recalibrer</button>'
      + '      <button type="button" class="laby-btn" id="btnToggleMode" title="Basculer entre Gyroscope et Joystick">🕹️ Joystick</button>'
      + '    </div>'
      + '  </div>'

      + '  <div class="laby-joystick-zone" id="labyJoystickZone" hidden>'
      + '    <div class="laby-joystick-hint">Joystick tactile de secours</div>'
      + '    <div class="laby-joy-base" id="labyJoyBase">'
      + '      <div class="laby-joy-cross"></div>'
      + '      <div class="laby-joy-stick" id="labyJoyStick"></div>'
      + '    </div>'
      + '  </div>'

      + '  <div class="laby-status" id="labyStatus" hidden></div>'
      + '</div>';

    var canvas = host.querySelector('#labyCanvas');
    var board = host.querySelector('#labyBoard');
    var timerEl = host.querySelector('#labyTimer');
    var timerValEl = host.querySelector('#labyTimerVal');
    var depthEl = host.querySelector('#labyDepth');
    var collisionsEl = host.querySelector('#labyCollisions');
    var coreDistEl = host.querySelector('#labyCoreDist');
    var statusEl = host.querySelector('#labyStatus');
    var sensorLabelEl = host.querySelector('#labySensorLabel');
    var startOverlayEl = host.querySelector('#labyStartOverlay');
    var btnStartGyro = host.querySelector('#btnStartGyro');
    var btnStartJoy = host.querySelector('#btnStartJoy');
    var btnCalibGyro = host.querySelector('#btnCalibGyro');
    var btnToggleMode = host.querySelector('#btnToggleMode');
    var joystickZone = host.querySelector('#labyJoystickZone');
    var joyBase = host.querySelector('#labyJoyBase');
    var joyStick = host.querySelector('#labyJoyStick');
    var hudStatsEl = host.querySelector('#labyHudStats');
    var controlsBarEl = host.querySelector('#labyControlsBar');

    var ctx = canvas.getContext('2d');

    /* Variables de jeu */
    var tempsRestant = DUREE_PARCOURS_SEC;
    var collisionsCount = 0;
    var estTermine = false;
    var jeuDemarre = false;
    var modeActif = 'gyro'; // 'gyro' par défaut prioritaire
    var aRecuGyro = false;
    var animFrameId = null;
    var timerInterval = null;

    /* Gyroscope / Accéléromètre avec calibrage automatique stable du niveau 0 */
    var rawGamma = 0;
    var rawBeta = 0;
    var calibGamma = 0;
    var calibBeta = 0;
    var calibEffectuee = false;
    var calibrant = false;
    var calibSamples = [];
    var CALIB_SAMPLE_COUNT = 6; // Nombre d'échantillons stables (~100ms) pour fixer le niveau 0

    var inputX = 0;
    var inputY = 0;
    var screenInputX = 0;
    var screenInputY = 0;

    /* Rotation du labyrinthe de 180° tous les 20 impacts */
    var currentMazeRotation = 0;
    var targetMazeRotation = 0;

    /* Joystick virtuel */
    var joyDragging = false;
    var joyCenterX = 0;
    var joyCenterY = 0;
    var joyX = 0;
    var joyY = 0;
    var JOY_MAX_RADIUS = 38;

    /* Clavier (PC) */
    var keysDown = {};

    /* Particules */
    var bulles = [];

    /* Dimensions et géométrie */
    var size = 440;
    var center = size / 2;
    var rOuter = size * 0.465;
    var rInner = size * 0.125;
    var trackWidth = (rOuter - rInner) / RINGS;
    var rBall = trackWidth * 0.28;
    var wallHalfThick = 1.6;

    var rWalls = [];
    for (var k = 0; k <= RINGS; k++) {
      rWalls.push(rInner + k * trackWidth);
    }

    /* Position initiale : Anneau 9 (Ring 10), secteur 0 */
    var initTrackRadius = (rWalls[START_RING] + rWalls[START_RING + 1]) / 2;
    var initAngle = (START_SECTOR + 0.5) * SECTOR_ANGLE;
    var ballX = center + initTrackRadius * Math.cos(initAngle);
    var ballY = center + initTrackRadius * Math.sin(initAngle);
    var ballVx = 0;
    var ballVy = 0;

    var rotX = 0;
    var rotY = 0;

    /* Dimensionnement Retina / HD */
    function redimensionner() {
      var dpr = window.devicePixelRatio || 1;
      var rect = board.getBoundingClientRect();
      var displayW = rect.width || 440;
      var displayH = rect.height || 440;

      canvas.width = Math.round(displayW * dpr);
      canvas.height = Math.round(displayH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      size = displayW;
      center = size / 2;
      rOuter = size * 0.465;
      rInner = size * 0.125;
      trackWidth = (rOuter - rInner) / RINGS;
      rBall = trackWidth * 0.28;

      rWalls = [];
      for (var i = 0; i <= RINGS; i++) {
        rWalls.push(rInner + i * trackWidth);
      }
    }
    redimensionner();
    window.addEventListener('resize', redimensionner);

    /* ================= GESTION DU GYROSCOPE ET CALIBRAGE NIVEAU 0 ================= */
    function lancerCalibrageGyro() {
      calibrant = true;
      calibSamples = [];
      calibEffectuee = false;
      if (statusEl) {
        statusEl.textContent = '🧭 Calibrage du niveau 0… Tenez votre appareil naturellement.';
        statusEl.className = 'laby-status is-active';
        statusEl.hidden = false;
      }
      // Sécurité : si aucun événement gyro n'arrive après 600ms, utiliser la dernière valeur disponible
      setTimeout(function () {
        if (calibrant) {
          if (calibSamples.length > 0) {
            finaliserCalibrage();
          } else if (rawBeta !== 0 || rawGamma !== 0) {
            calibBeta = rawBeta;
            calibGamma = rawGamma;
            calibrant = false;
            calibEffectuee = true;
            confirmerCalibrage();
          }
        }
      }, 600);
    }

    function finaliserCalibrage() {
      var sumBeta = 0;
      var sumGamma = 0;
      for (var i = 0; i < calibSamples.length; i++) {
        sumBeta += calibSamples[i].beta;
        sumGamma += calibSamples[i].gamma;
      }
      calibBeta = sumBeta / calibSamples.length;
      calibGamma = sumGamma / calibSamples.length;
      calibrant = false;
      calibEffectuee = true;
      confirmerCalibrage();
    }

    function confirmerCalibrage() {
      if (statusEl && !estTermine) {
        statusEl.textContent = '🎯 Niveau 0 calibré (' + Math.round(calibBeta) + '°). Inclinez pour diriger la bille.';
        statusEl.className = 'laby-status is-active';
        statusEl.hidden = false;
        setTimeout(function () {
          if (!estTermine && statusEl && statusEl.className.indexOf('is-danger') === -1) {
            statusEl.textContent = 'Inclinez votre appareil pour diriger la bille dans le labyrinthe.';
            statusEl.className = 'laby-status';
          }
        }, 1800);
      }
    }

    function onDeviceOrientation(ev) {
      if (ev.gamma == null || ev.beta == null) return;
      // Éliminer les zéros factices initiaux émis par certains navigateurs lors de l'activation
      if (ev.beta === 0 && ev.gamma === 0 && ev.alpha == null) return;

      if (!aRecuGyro) {
        aRecuGyro = true;
        activerModeGyro();
      }

      rawGamma = ev.gamma;
      rawBeta = ev.beta;

      if (calibrant) {
        calibSamples.push({ beta: ev.beta, gamma: ev.gamma });
        if (calibSamples.length >= CALIB_SAMPLE_COUNT) {
          finaliserCalibrage();
        }
      }
    }

    function activerModeGyro() {
      modeActif = 'gyro';
      joystickZone.hidden = true;
      sensorLabelEl.textContent = '🧭 Gyroscope actif (inclinez le mobile)';
      btnToggleMode.textContent = '🕹️ Joystick';
      btnToggleMode.style.display = '';
      if (jeuDemarre && calibEffectuee) {
        statusEl.textContent = 'Inclinez votre appareil pour diriger la bille dans le labyrinthe.';
        statusEl.className = 'laby-status is-active';
      }
    }

    function activerModeJoystick() {
      modeActif = 'joystick';
      joystickZone.hidden = false;
      sensorLabelEl.textContent = '🕹️ Joystick tactile actif';
      btnToggleMode.textContent = '🧭 Gyroscope';
      if (jeuDemarre) {
        statusEl.textContent = 'Utilisez le joystick tactile (ou les flèches du clavier) pour manœuvrer.';
        statusEl.className = 'laby-status is-warning';
      }
    }

    function demanderAutorisationGyro() {
      tenterVerrouillagePortrait();
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(function (perm) {
            if (perm === 'granted') {
              window.addEventListener('deviceorientation', onDeviceOrientation, true);
              activerModeGyro();
              lancerCalibrageGyro();
            } else {
              activerModeJoystick();
            }
          })
          .catch(function () {
            activerModeJoystick();
          });
      } else if ('ondeviceorientation' in window) {
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
        activerModeGyro();
        lancerCalibrageGyro();
      } else {
        activerModeJoystick();
      }
    }

    // Écoute précoce des capteurs si permission non requise
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      try {
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
      } catch (_) {}
    }

    /* Détection intelligente des capteurs & activation manuelle par le joueur */
    var supporteGyro = estMobile && (typeof DeviceOrientationEvent !== 'undefined' || 'ondeviceorientation' in window);

    if (supporteGyro) {
      btnStartGyro.hidden = false;
      btnStartJoy.classList.add('is-secondary');
      sensorLabelEl.textContent = '🧭 Prêt : appuyez sur le bouton Gyroscope';
    } else {
      btnStartGyro.hidden = true;
      btnStartJoy.hidden = false;
      btnStartJoy.classList.add('is-primary');
      sensorLabelEl.textContent = '🕹️ Prêt : appuyez sur le bouton Joystick';
    }

    /* Activation du minuteur et démarrage du mini-jeu lors du clic joueur */
    function demarrerPartie(mode) {
      if (jeuDemarre || estTermine) return;
      jeuDemarre = true;

      if (startOverlayEl) startOverlayEl.hidden = true;
      if (hudStatsEl) hudStatsEl.hidden = false;
      if (controlsBarEl) controlsBarEl.hidden = false;
      tenterVerrouillagePortrait();

      if (mode === 'gyro') {
        demanderAutorisationGyro();
      } else {
        activerModeJoystick();
      }

      lancerMinuteur();
      jouerSonDepart();

      if (typeof opts.onStart === 'function') {
        try { opts.onStart({ mode: mode }); } catch (_) {}
      }
    }

    btnStartGyro.addEventListener('click', function () {
      demarrerPartie('gyro');
    });

    btnStartJoy.addEventListener('click', function () {
      demarrerPartie('joystick');
    });

    joyBase.addEventListener('pointerdown', function () {
      if (!jeuDemarre) demarrerPartie('joystick');
    });

    /* Boutons de commande */
    btnCalibGyro.addEventListener('click', function () {
      tenterVerrouillagePortrait();
      lancerCalibrageGyro();
    });

    btnToggleMode.addEventListener('click', function () {
      tenterVerrouillagePortrait();
      if (modeActif === 'gyro') {
        activerModeJoystick();
      } else {
        demanderAutorisationGyro();
        activerModeGyro();
      }
    });

    /* ================= JOYSTICK TACTILE ================= */
    function handleJoyStart(e) {
      if (modeActif !== 'joystick') return;
      var point = e.touches ? e.touches[0] : e;
      var rect = joyBase.getBoundingClientRect();
      joyCenterX = rect.left + rect.width / 2;
      joyCenterY = rect.top + rect.height / 2;
      joyDragging = true;
      handleJoyMove(e);
      if (e.cancelable) e.preventDefault();
    }

    function handleJoyMove(e) {
      if (!joyDragging) return;
      var point = e.touches ? e.touches[0] : e;
      var dx = point.clientX - joyCenterX;
      var dy = point.clientY - joyCenterY;
      var dist = Math.hypot(dx, dy);
      if (dist > JOY_MAX_RADIUS) {
        dx = (dx / dist) * JOY_MAX_RADIUS;
        dy = (dy / dist) * JOY_MAX_RADIUS;
      }
      joyX = dx / JOY_MAX_RADIUS;
      joyY = dy / JOY_MAX_RADIUS;
      joyStick.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
      if (e.cancelable) e.preventDefault();
    }

    function handleJoyEnd() {
      if (!joyDragging) return;
      joyDragging = false;
      joyX = 0;
      joyY = 0;
      joyStick.style.transform = 'translate(0px, 0px)';
    }

    joyBase.addEventListener('pointerdown', handleJoyStart);
    window.addEventListener('pointermove', handleJoyMove);
    window.addEventListener('pointerup', handleJoyEnd);
    window.addEventListener('pointercancel', handleJoyEnd);

    window.addEventListener('keydown', function (e) { keysDown[e.key] = true; });
    window.addEventListener('keyup', function (e) { keysDown[e.key] = false; });

    /* ================= RÉSOLUTION DES COLLISIONS ================= */
    function distancePointSegment(px, py, x1, y1, x2, y2) {
      var dx = x2 - x1;
      var dy = y2 - y1;
      var l2 = dx * dx + dy * dy;
      if (l2 === 0) return { dist: Math.hypot(px - x1, py - y1), cx: x1, cy: y1 };
      var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
      var cx = x1 + t * dx;
      var cy = y1 + t * dy;
      return { dist: Math.hypot(px - cx, py - cy), cx: cx, cy: cy };
    }

    function angleNormalise(a) {
      while (a < 0) a += Math.PI * 2;
      while (a >= Math.PI * 2) a -= Math.PI * 2;
      return a;
    }

    function resoudreCollisions() {
      var dx = ballX - center;
      var dy = ballY - center;
      var distCenter = Math.hypot(dx, dy);
      var angle = angleNormalise(Math.atan2(dy, dx));

      // 1. Limite extérieure du labyrinthe (rOuter)
      if (distCenter > rOuter - rBall - wallHalfThick) {
        var penetration = distCenter - (rOuter - rBall - wallHalfThick);
        var nx = dx / (distCenter || 1);
        var ny = dy / (distCenter || 1);
        ballX -= nx * penetration;
        ballY -= ny * penetration;
        var vRadial = ballVx * nx + ballVy * ny;
        if (vRadial > 0) {
          ballVx -= 1.35 * vRadial * nx;
          ballVy -= 1.35 * vRadial * ny;
          enregistrerImpact(vRadial);
        }
        dx = ballX - center;
        dy = ballY - center;
        distCenter = Math.hypot(dx, dy);
        angle = angleNormalise(Math.atan2(dy, dx));
      }

      // 2. Paroi du Cœur central (rInner)
      // Ouverte uniquement sur le secteur GOAL_SECTOR (brèche unique)
      var secteurActuel = Math.floor(angle / SECTOR_ANGLE);
      var accesCoeur = (secteurActuel === GOAL_SECTOR);

      if (!accesCoeur && distCenter < rInner + rBall + wallHalfThick) {
        var penIn = (rInner + rBall + wallHalfThick) - distCenter;
        var nxIn = dx / (distCenter || 1);
        var nyIn = dy / (distCenter || 1);
        ballX += nxIn * penIn;
        ballY += nyIn * penIn;
        var vRadialIn = ballVx * nxIn + ballVy * nyIn;
        if (vRadialIn < 0) {
          ballVx -= 1.35 * vRadialIn * nxIn;
          ballVy -= 1.35 * vRadialIn * nyIn;
          enregistrerImpact(-vRadialIn);
        }
        dx = ballX - center;
        dy = ballY - center;
        distCenter = Math.hypot(dx, dy);
        angle = angleNormalise(Math.atan2(dy, dx));
      }

      // 3. Parois concentriques (RING_WALLS)
      for (var k = 0; k < RINGS - 1; k++) {
        var rW = rWalls[k + 1];
        if (Math.abs(distCenter - rW) < rBall + wallHalfThick + 2.5) {
          for (var s = 0; s < SECTORS; s++) {
            if (RING_WALLS[k][s]) {
              var aStart = s * SECTOR_ANGLE;
              var aEnd = (s + 1) * SECTOR_ANGLE;
              if (angle >= aStart && angle <= aEnd) {
                var dRing = distCenter - rW;
                if (Math.abs(dRing) < rBall + wallHalfThick) {
                  var signe = dRing >= 0 ? 1 : -1;
                  var penRing = (rBall + wallHalfThick) - Math.abs(dRing);
                  var nRx = (dx / (distCenter || 1)) * signe;
                  var nRy = (dy / (distCenter || 1)) * signe;
                  ballX += nRx * penRing;
                  ballY += nRy * penRing;
                  var vRad = ballVx * nRx + ballVy * nRy;
                  if (vRad < 0) {
                    ballVx -= 1.35 * vRad * nRx;
                    ballVy -= 1.35 * vRad * nRy;
                    enregistrerImpact(-vRad);
                  }
                }
              }
            }
          }
        }
      }

      // 4. Parois radiales (RADIAL_WALLS)
      for (var rIdx = 0; rIdx < RINGS; rIdx++) {
        var r1 = rWalls[rIdx];
        var r2 = rWalls[rIdx + 1];
        if (distCenter >= r1 - rBall && distCenter <= r2 + rBall) {
          for (var sIdx = 0; sIdx < SECTORS; sIdx++) {
            if (RADIAL_WALLS[rIdx][sIdx]) {
              var aWall = (sIdx + 1) * SECTOR_ANGLE;
              var cosW = Math.cos(aWall);
              var sinW = Math.sin(aWall);
              var x1 = center + r1 * cosW;
              var y1 = center + r1 * sinW;
              var x2 = center + r2 * cosW;
              var y2 = center + r2 * sinW;

              var proj = distancePointSegment(ballX, ballY, x1, y1, x2, y2);
              var seuil = rBall + wallHalfThick;
              if (proj.dist < seuil) {
                var pDist = proj.dist || 0.001;
                var nSegX = (ballX - proj.cx) / pDist;
                var nSegY = (ballY - proj.cy) / pDist;
                var penSeg = seuil - proj.dist;
                ballX += nSegX * penSeg;
                ballY += nSegY * penSeg;

                var vNorm = ballVx * nSegX + ballVy * nSegY;
                if (vNorm < 0) {
                  ballVx -= 1.35 * vNorm * nSegX;
                  ballVy -= 1.35 * vNorm * nSegY;
                  enregistrerImpact(-vNorm);
                }
              }
            }
          }
        }
      }
    }

    function declencherRotationLabyrinthe() {
      targetMazeRotation += Math.PI;
      // Amortir la vitesse de la bille lors du basculement pour éviter les franchissements de paroi
      ballVx *= 0.35;
      ballVy *= 0.35;
      if (statusEl) {
        statusEl.textContent = '🔄 Alerte secousses : le labyrinthe pivote !';
        statusEl.className = 'laby-status is-warning';
        statusEl.hidden = false;
        setTimeout(function () {
          if (!estTermine && statusEl) {
            statusEl.textContent = 'Inclinez votre appareil pour diriger la bille dans le labyrinthe.';
            statusEl.className = 'laby-status';
          }
        }, 1800);
      }
      try {
        if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
      } catch (_) {}
    }

    var dernierImpactTemps = 0;
    function enregistrerImpact(v) {
      var now = performance.now();
      // Cooldown de 160ms entre deux impacts distincts pour éviter l'emballement sur frottement
      if (now - dernierImpactTemps < 160) return;

      if (v > 12) {
        dernierImpactTemps = now;
        collisionsCount++;
        collisionsEl.textContent = collisionsCount;
        jouerSonChoc(Math.min(3, v / 45));

        // Règle du Palier 7 : tous les 20 contacts avec les parois, le labyrinthe tourne de 180°
        if (collisionsCount % 20 === 0 && collisionsCount <= 100) {
          declencherRotationLabyrinthe();
        }

        if (collisionsCount > 100) {
          declencherDefaite('collisions');
        }
      }
    }

    /* ================= MISE À JOUR DE LA PHYSIQUE ================= */
    var lastTime = performance.now();

    function updatePhysics(dt) {
      if (estTermine) return;

      // Pendant la phase de calibrage initiale (quelques centièmes de seconde), la bille reste immobile
      if (calibrant || !calibEffectuee) {
        screenInputX = 0;
        screenInputY = 0;
        inputX = 0;
        inputY = 0;
      } else if (modeActif === 'gyro') {
        // Calcul des écarts par rapport au niveau 0 calibré
        var dGamma = rawGamma - calibGamma;
        var dBeta = rawBeta - calibBeta;

        // Zone morte fine (1.0°) pour éviter les micro-tremblements au repos
        if (Math.abs(dGamma) < 1.0) dGamma = 0;
        else dGamma = (dGamma > 0 ? dGamma - 1.0 : dGamma + 1.0);

        if (Math.abs(dBeta) < 1.0) dBeta = 0;
        else dBeta = (dBeta > 0 ? dBeta - 1.0 : dBeta + 1.0);

        var rawX = Math.max(-1, Math.min(1, dGamma / 18));
        var rawY = Math.max(-1, Math.min(1, dBeta / 18));

        // Compensation stricte de rotation d'écran si l'appareil bascule
        var angleDeg = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        if (angleDeg !== 0) {
          var rad = -angleDeg * (Math.PI / 180);
          screenInputX = rawX * Math.cos(rad) - rawY * Math.sin(rad);
          screenInputY = rawX * Math.sin(rad) + rawY * Math.cos(rad);
        } else {
          screenInputX = rawX;
          screenInputY = rawY;
        }

        // Projection de la gravité dans le repère orienté du labyrinthe (rotation inverse)
        var rotRad = -currentMazeRotation;
        var cosRot = Math.cos(rotRad);
        var sinRot = Math.sin(rotRad);
        inputX = screenInputX * cosRot - screenInputY * sinRot;
        inputY = screenInputX * sinRot + screenInputY * cosRot;
      } else {
        var jX = joyX;
        var jY = joyY;

        if (keysDown['ArrowLeft'] || keysDown['q'] || keysDown['a']) jX = -1;
        if (keysDown['ArrowRight'] || keysDown['d']) jX = 1;
        if (keysDown['ArrowUp'] || keysDown['z'] || keysDown['w']) jY = -1;
        if (keysDown['ArrowDown'] || keysDown['s']) jY = 1;

        screenInputX = jX;
        screenInputY = jY;

        var rotRadJoy = -currentMazeRotation;
        var cosRotJoy = Math.cos(rotRadJoy);
        var sinRotJoy = Math.sin(rotRadJoy);
        inputX = screenInputX * cosRotJoy - screenInputY * sinRotJoy;
        inputY = screenInputX * sinRotJoy + screenInputY * cosRotJoy;
      }

      // 2. Inclinaison 3D subtile du plateau face au joueur
      var tiltDegX = screenInputY * 7;
      var tiltDegY = -screenInputX * 7;
      board.style.transform = 'rotateX(' + tiltDegX.toFixed(2) + 'deg) rotateY(' + tiltDegY.toFixed(2) + 'deg)';

      // 3. Accélération de la bille
      var GRAVITE = 460;
      var ax = inputX * GRAVITE;
      var ay = inputY * GRAVITE;

      var frottement = Math.pow(0.975, dt * 60);

      var SUBSTEPS = 4;
      var subDt = dt / SUBSTEPS;

      for (var step = 0; step < SUBSTEPS; step++) {
        ballVx = (ballVx + ax * subDt) * frottement;
        ballVy = (ballVy + ay * subDt) * frottement;

        var v = Math.hypot(ballVx, ballVy);
        var V_MAX = 220;
        if (v > V_MAX) {
          ballVx = (ballVx / v) * V_MAX;
          ballVy = (ballVy / v) * V_MAX;
        }

        ballX += ballVx * subDt;
        ballY += ballVy * subDt;

        resoudreCollisions();
      }

      // 4. Rotation 3D de la sphère
      rotX += ballVy / rBall;
      rotY += -ballVx / rBall;

      // 5. Particules de micro-bulles
      var speed = Math.hypot(ballVx, ballVy);
      if (speed > 35 && Math.random() < 0.35) {
        bulles.push({
          x: ballX + (Math.random() - 0.5) * rBall,
          y: ballY + (Math.random() - 0.5) * rBall,
          vx: (Math.random() - 0.5) * 6,
          vy: -10 - Math.random() * 14,
          radius: 1.0 + Math.random() * 2.0,
          life: 1.0
        });
      }
      for (var b = bulles.length - 1; b >= 0; b--) {
        var bulle = bulles[b];
        bulle.x += bulle.vx * dt;
        bulle.y += bulle.vy * dt;
        bulle.life -= dt * 1.8;
        if (bulle.life <= 0) bulles.splice(b, 1);
      }

      // 6. Suivi de profondeur et distance au cœur
      var dCenter = Math.hypot(ballX - center, ballY - center);
      var curRing = Math.max(0, Math.min(RINGS - 1, Math.floor((dCenter - rInner) / trackWidth)));
      depthEl.textContent = 'Anneau ' + (curRing + 1) + '/' + RINGS;

      if (dCenter < rInner + 14) {
        coreDistEl.textContent = '⚡ IMMINENT !';
        coreDistEl.style.color = '#ffd36c';
      } else if (curRing <= 2) {
        coreDistEl.textContent = 'Approche';
        coreDistEl.style.color = '#8ee7ff';
      } else {
        coreDistEl.textContent = 'Lointain';
        coreDistEl.style.color = '#a4c7e2';
      }

      // Détection de victoire (franchissement de la brèche vers le Cœur)
      if (dCenter < rInner * 0.75) {
        declencherVictoire();
      }
    }

    /* ================= DESSIN DU CŒUR JAUNE AU CENTRE ================= */
    function dessinerCoeurJaune(cx, cy, hSize) {
      var s = hSize / 30;
      ctx.save();
      // Centrage optique du cœur
      ctx.translate(cx, cy - s * 3.5);

      ctx.beginPath();
      ctx.moveTo(0, s * 4);
      // Lobe gauche
      ctx.bezierCurveTo(-s * 10, -s * 9, -s * 18, s * 3, 0, s * 16);
      // Lobe droit
      ctx.bezierCurveTo(s * 18, s * 3, s * 10, -s * 9, 0, s * 4);
      ctx.closePath();

      // Remplissage jaune éclatant
      var gradCoeur = ctx.createLinearGradient(0, -s * 9, 0, s * 16);
      gradCoeur.addColorStop(0, '#ffffff');
      gradCoeur.addColorStop(0.25, '#fff76a');
      gradCoeur.addColorStop(0.65, '#ffd700');
      gradCoeur.addColorStop(1, '#f59e0b');

      ctx.fillStyle = gradCoeur;
      ctx.shadowColor = 'rgba(255, 230, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.fill();

      ctx.strokeStyle = '#fffbeb';
      ctx.lineWidth = Math.max(1.2, s * 1.0);
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Reflet spéculaire éclatant
      ctx.beginPath();
      ctx.ellipse(-s * 5, -s * 1, s * 3.5, s * 1.8, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();

      ctx.restore();
    }

    /* ================= RENDU DU LABYRINTHE ================= */
    function render() {
      var dpr = window.devicePixelRatio || 1;
      // Réinitialisation stricte du transform pour garantir l'absence totale de dérive matricielle
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(currentMazeRotation);
      ctx.translate(-center, -center);

      // 1. Fond du labyrinthe circulaire
      var fondGrad = ctx.createRadialGradient(center, center, rInner * 0.4, center, center, rOuter);
      fondGrad.addColorStop(0, '#04172a');
      fondGrad.addColorStop(0.65, '#020b16');
      fondGrad.addColorStop(1, '#010408');
      ctx.fillStyle = fondGrad;
      ctx.beginPath();
      ctx.arc(center, center, rOuter, 0, Math.PI * 2);
      ctx.fill();

      // Sillons des pistes concentriques
      for (var rIdx = 0; rIdx < RINGS; rIdx++) {
        var midR = (rWalls[rIdx] + rWalls[rIdx + 1]) / 2;
        ctx.strokeStyle = 'rgba(142, 231, 255, 0.04)';
        ctx.lineWidth = trackWidth - 2;
        ctx.beginPath();
        ctx.arc(center, center, midR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Cœur central du Nautilus : pulsations dégradé rouge vers orange + cœur jaune au centre (aucun mot "cœur")
      var tNow = performance.now() * 0.003;
      var pulseCycle = (Math.sin(tNow * 3.8) + 1) / 2;
      var auraR = rInner * (0.80 + 0.18 * pulseCycle);

      // Pulsations dégradé de rouge vers orange
      var auraGrad = ctx.createRadialGradient(center, center, rInner * 0.12, center, center, auraR);
      auraGrad.addColorStop(0, 'rgba(255, 25, 20, 0.95)');    // Rouge intense au centre
      auraGrad.addColorStop(0.35, 'rgba(255, 60, 0, 0.90)');   // Rouge vermillon
      auraGrad.addColorStop(0.70, 'rgba(255, 140, 0, 0.75)');  // Orange flamboyant
      auraGrad.addColorStop(0.92, 'rgba(255, 185, 0, 0.40)');  // Orange doré
      auraGrad.addColorStop(1, 'rgba(255, 140, 0, 0.0)');     // Fondu translucide externe
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(center, center, auraR, 0, Math.PI * 2);
      ctx.fill();

      // Onde de pulsation secondaire rouge -> orange
      var waveProgress = ((tNow * 0.8) % 1.0);
      var waveR = rInner * (0.45 + 0.48 * waveProgress);
      var waveAlpha = Math.max(0, 1.0 - waveProgress);
      var waveGrad = ctx.createRadialGradient(center, center, waveR * 0.75, center, center, waveR);
      waveGrad.addColorStop(0, 'rgba(255, 30, 0, 0)');
      waveGrad.addColorStop(0.7, 'rgba(255, 75, 0, ' + (0.55 * waveAlpha).toFixed(2) + ')');
      waveGrad.addColorStop(1, 'rgba(255, 160, 0, 0)');
      ctx.fillStyle = waveGrad;
      ctx.beginPath();
      ctx.arc(center, center, waveR, 0, Math.PI * 2);
      ctx.fill();

      // Anneau du Cœur
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(center, center, rInner * 0.86, 0, Math.PI * 2);
      ctx.stroke();

      // Cœur jaune au centre (forme vectorielle dorée éclatante)
      var heartScale = 1.0 + 0.08 * Math.sin(tNow * 3.8);
      var hSize = rInner * 0.52 * heartScale;
      dessinerCoeurJaune(center, center, hSize);

      // Brèche lumineuse d'accès au Cœur (GOAL_SECTOR)
      var aGoalStart = GOAL_SECTOR * SECTOR_ANGLE;
      var aGoalEnd = (GOAL_SECTOR + 1) * SECTOR_ANGLE;
      ctx.save();
      ctx.strokeStyle = 'rgba(87, 217, 163, 0.95)';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#57d9a3';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(center, center, rInner, aGoalStart, aGoalEnd);
      ctx.stroke();
      ctx.restore();

      // 3. Parois concentriques (RING_WALLS)
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';

      for (var k = 0; k < RINGS - 1; k++) {
        var rW = rWalls[k + 1];
        for (var s = 0; s < SECTORS; s++) {
          if (RING_WALLS[k][s]) {
            var a1 = s * SECTOR_ANGLE;
            var a2 = (s + 1) * SECTOR_ANGLE;
            ctx.strokeStyle = '#c4891b';
            ctx.beginPath();
            ctx.arc(center, center, rW, a1, a2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 230, 160, 0.45)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(center, center, rW, a1, a2);
            ctx.stroke();
            ctx.lineWidth = 2.5;
          }
        }
      }

      // Paroi fermée du Cœur (sauf brèche)
      ctx.strokeStyle = '#f5b027';
      ctx.beginPath();
      ctx.arc(center, center, rInner, aGoalEnd, aGoalStart + Math.PI * 2);
      ctx.stroke();

      // 4. Parois radiales (RADIAL_WALLS)
      for (var rIdx2 = 0; rIdx2 < RINGS; rIdx2++) {
        var r1 = rWalls[rIdx2];
        var r2 = rWalls[rIdx2 + 1];
        for (var sIdx = 0; sIdx < SECTORS; sIdx++) {
          if (RADIAL_WALLS[rIdx2][sIdx]) {
            var aW = (sIdx + 1) * SECTOR_ANGLE;
            var cW = Math.cos(aW);
            var sW = Math.sin(aW);
            ctx.strokeStyle = '#d48b13';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(center + r1 * cW, center + r1 * sW);
            ctx.lineTo(center + r2 * cW, center + r2 * sW);
            ctx.stroke();

            // Rivets métalliques
            ctx.fillStyle = '#ffd36c';
            ctx.beginPath();
            ctx.arc(center + r1 * cW, center + r1 * sW, 1.4, 0, Math.PI * 2);
            ctx.arc(center + r2 * cW, center + r2 * sW, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Paroi extérieure
      ctx.strokeStyle = '#f5b027';
      ctx.lineWidth = 4.0;
      ctx.beginPath();
      ctx.arc(center, center, rOuter, 0, Math.PI * 2);
      ctx.stroke();

      // 5. Particules de bulles
      for (var bIdx = 0; bIdx < bulles.length; bIdx++) {
        var bul = bulles[bIdx];
        ctx.fillStyle = 'rgba(142, 231, 255, ' + (bul.life * 0.6).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(bul.x, bul.y, bul.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. BILLE 3D
      // 6a. Ombre portée dynamique
      var shadowDx = inputX * 3.5 + 2.5;
      var shadowDy = inputY * 3.5 + 3.0;
      ctx.save();
      ctx.translate(ballX + shadowDx, ballY + shadowDy);
      ctx.scale(1.15, 0.7);
      var shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rBall * 1.25);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
      shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, rBall * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 6b. Corps de la sphère 3D
      var lightX = ballX - rBall * 0.35;
      var lightY = ballY - rBall * 0.45;
      var sphereGrad = ctx.createRadialGradient(lightX, lightY, rBall * 0.05, ballX, ballY, rBall);
      sphereGrad.addColorStop(0, '#ffffff');
      sphereGrad.addColorStop(0.18, '#fff3c2');
      sphereGrad.addColorStop(0.48, '#f5b027');
      sphereGrad.addColorStop(0.78, '#9c6508');
      sphereGrad.addColorStop(0.94, '#4a2c02');
      sphereGrad.addColorStop(1, '#1a0f01');
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(ballX, ballY, rBall, 0, Math.PI * 2);
      ctx.fill();

      // 6c. Rotation 3D de la bille
      ctx.save();
      ctx.beginPath();
      ctx.arc(ballX, ballY, rBall, 0, Math.PI * 2);
      ctx.clip();

      ctx.strokeStyle = 'rgba(70, 40, 4, 0.45)';
      ctx.lineWidth = 1.0;

      var cosRotY = Math.cos(rotY);
      ctx.save();
      ctx.translate(ballX, ballY);
      ctx.scale(cosRotY || 0.05, 1);
      ctx.beginPath();
      ctx.arc(0, 0, rBall * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      var cosRotX = Math.cos(rotX);
      ctx.save();
      ctx.translate(ballX, ballY);
      ctx.scale(1, cosRotX || 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, rBall * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // 6d. Reflet spéculaire secondaire
      ctx.save();
      var bounceGrad = ctx.createRadialGradient(ballX + rBall * 0.4, ballY + rBall * 0.4, 0, ballX + rBall * 0.4, ballY + rBall * 0.4, rBall * 0.45);
      bounceGrad.addColorStop(0, 'rgba(142, 231, 255, 0.4)');
      bounceGrad.addColorStop(1, 'rgba(142, 231, 255, 0)');
      ctx.fillStyle = bounceGrad;
      ctx.beginPath();
      ctx.arc(ballX, ballY, rBall, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore(); // Restauration du contexte tourné
    }

    /* ================= BOUCLE DE JEU (GAME LOOP) ================= */
    function gameLoop(now) {
      if (estTermine) return;
      var dt = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;

      // Rotation fluide du labyrinthe de 180° tous les 20 impacts
      var diffRot = targetMazeRotation - currentMazeRotation;
      if (Math.abs(diffRot) > 0.001) {
        currentMazeRotation += diffRot * 0.08;
      } else {
        currentMazeRotation = targetMazeRotation;
      }

      if (jeuDemarre) {
        updatePhysics(dt);
      }
      render();

      animFrameId = requestAnimationFrame(gameLoop);
    }
    animFrameId = requestAnimationFrame(gameLoop);

    /* ================= MINUTEUR DE 1 MINUTE AVANT REMONTÉE DU MATELOT ================= */
    function lancerMinuteur() {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(function () {
        if (estTermine || !jeuDemarre) return;
        tempsRestant--;
        var mm = Math.floor(tempsRestant / 60);
        var ss = tempsRestant % 60;
        var str = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
        if (timerValEl) {
          timerValEl.textContent = str;
        } else {
          timerEl.textContent = '⏳ ' + str;
        }

        // Urgence 15s : clignotement rouge du badge minuteur
        if (tempsRestant <= 15) {
          timerEl.classList.add('is-urgent');
        }

        // Alerte critique 5 dernières secondes : écran qui clignote légèrement sur les côtés
        if (tempsRestant <= 5 && tempsRestant > 0) {
          timerEl.classList.add('is-critical');
          if (edgeAlarmEl) edgeAlarmEl.classList.add('is-active');
          jouerSonAlerteCompteRebours(tempsRestant);
          statusEl.textContent = '🚨 ALERTE : Moins de ' + tempsRestant + ' s avant remontée en surface !';
          statusEl.className = 'laby-status is-danger';
        }

        if (tempsRestant <= 0) {
          if (edgeAlarmEl) edgeAlarmEl.classList.remove('is-active');
          declencherDefaite('temps_ecoule');
        }
      }, 1000);
    }

    /* ================= VICTOIRE ET DÉFAITE ================= */
    function declencherVictoire() {
      if (estTermine) return;
      estTermine = true;
      clearInterval(timerInterval);
      cancelAnimationFrame(animFrameId);
      if (edgeAlarmEl) edgeAlarmEl.classList.remove('is-active');

      jouerSonVictoire();
      board.style.transform = 'scale(1.04)';
      statusEl.textContent = '⚡ CŒUR ATTEINT ! Le réacteur abyssal du Nautilus est ranimé !';
      statusEl.className = 'laby-status is-success';

      var dureeTotale = DUREE_PARCOURS_SEC - tempsRestant;
      var mm = Math.floor(dureeTotale / 60);
      var ss = dureeTotale % 60;
      var tempsStr = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;

      setTimeout(function () {
        onVictoire({
          duree: dureeTotale,
          tempsRestant: tempsRestant,
          temps: tempsStr,
          collisions: collisionsCount,
          pct: 100
        });
      }, 900);
    }

    function declencherDefaite(motif) {
      if (estTermine) return;
      estTermine = true;
      clearInterval(timerInterval);
      cancelAnimationFrame(animFrameId);
      if (edgeAlarmEl) edgeAlarmEl.classList.remove('is-active');

      if (motif === 'collisions') {
        statusEl.textContent = '🚨 Plus de 100 impacts contre les parois ! Le cœur s’est éteint.';
      } else {
        statusEl.textContent = '🚨 Minuteur de 1 min écoulé ! Remontée en surface du matelot.';
      }
      statusEl.className = 'laby-status is-danger';

      setTimeout(function () {
        onDefaite(motif || 'temps_ecoule');
      }, 800);
    }

    function detruire() {
      estTermine = true;
      clearInterval(timerInterval);
      cancelAnimationFrame(animFrameId);
      if (edgeAlarmEl) {
        edgeAlarmEl.classList.remove('is-active');
        if (edgeAlarmEl.parentNode) edgeAlarmEl.parentNode.removeChild(edgeAlarmEl);
      }
      window.removeEventListener('resize', redimensionner);
      window.removeEventListener('deviceorientation', onDeviceOrientation, true);
      window.removeEventListener('pointermove', handleJoyMove);
      window.removeEventListener('pointerup', handleJoyEnd);
      window.removeEventListener('pointercancel', handleJoyEnd);
    }

    return {
      detruire: detruire
    };
  }

  window.NautilusLabyrinthe = {
    init: init
  };
})();
