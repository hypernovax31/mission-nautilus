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
     interactive (iOS) et masquage du joystick sur mobile.
   - Minuteur de 1 minute maximum (60s) — compte à rebours sans compteur qui monte.
   - Rendu de la bille en 3D sphérique texturée avec ombrage dynamique et traînée.
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
    options = options || {};
    var onVictoire = options.onVictoire || function () {};
    var onDefaite = options.onDefaite || function () {};

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

      + '  <div class="laby-brief-holder" id="labyBriefHolder">'
      + '    <a href="palier7-briefing.html" class="laby-brief-link" id="labyBriefLink">📖 Voir le briefing du capitaine</a>'
      + '  </div>'

      + '  <div class="laby-controls-bar" id="labyControlsBar" hidden>'
      + '    <div class="laby-sensor-chip" id="labySensorChip">'
      + '      <span class="laby-sensor-dot" id="labySensorDot"></span>'
      + '      <span id="labySensorLabel">Commandes actives</span>'
      + '    </div>'
      + '    <div class="laby-actions">'
      + '      <button type="button" class="laby-btn" id="btnCalibGyro" title="Calibrer l’inclinaison neutre">🎯 Calibrer</button>'
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

    var container = host.querySelector('#labyContainer');
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
    var briefHolderEl = host.querySelector('#labyBriefHolder');
    var controlsBarEl = host.querySelector('#labyControlsBar');
    var briefLinkEl = host.querySelector('#labyBriefLink');
    if (briefLinkEl) {
      briefLinkEl.setAttribute('href', 'palier7-briefing.html' + (location.search || ''));
    }

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

    /* Gyroscope / Accéléromètre */
    var rawGamma = 0;
    var rawBeta = 0;
    var calibGamma = 0;
    var calibBeta = 30; // Position de préhension naturelle
    var inputX = 0;
    var inputY = 0;

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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

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

    /* ================= GESTION DU GYROSCOPE ET DU JOYSTICK ================= */
    function onDeviceOrientation(ev) {
      if (ev.gamma != null && ev.beta != null) {
        if (!aRecuGyro) {
          aRecuGyro = true;
          calibGamma = ev.gamma;
          calibBeta = (ev.beta > 15 && ev.beta < 60) ? ev.beta : 30;
          if (startOverlayEl && jeuDemarre) startOverlayEl.hidden = true;
          activerModeGyro();
        }
        rawGamma = ev.gamma;
        rawBeta = ev.beta;
      }
    }

    function activerModeGyro() {
      modeActif = 'gyro';
      joystickZone.hidden = true;
      sensorLabelEl.textContent = '🧭 Gyroscope actif (inclinez le mobile)';
      btnToggleMode.textContent = '🕹️ Joystick';
      btnToggleMode.style.display = '';
      if (jeuDemarre) {
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
      } else {
        activerModeJoystick();
      }
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
      if (briefHolderEl) briefHolderEl.hidden = true;
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
      calibGamma = rawGamma;
      calibBeta = rawBeta;
      tenterVerrouillagePortrait();
      statusEl.textContent = '🎯 Horizon calibré sur la position actuelle.';
      statusEl.className = 'laby-status';
      setTimeout(function () {
        statusEl.textContent = 'Inclinez votre appareil pour diriger la bille dans le labyrinthe.';
      }, 1500);
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

    function enregistrerImpact(v) {
      if (v > 12) {
        collisionsCount++;
        collisionsEl.textContent = collisionsCount;
        jouerSonChoc(Math.min(3, v / 45));
      }
    }

    /* ================= MISE À JOUR DE LA PHYSIQUE ================= */
    var lastTime = performance.now();

    function updatePhysics(dt) {
      if (estTermine) return;

      // 1. Calcul du vecteur d'entrée
      if (modeActif === 'gyro') {
        var dGamma = rawGamma - calibGamma;
        var dBeta = rawBeta - calibBeta;
        var rawX = Math.max(-1, Math.min(1, dGamma / 22));
        var rawY = Math.max(-1, Math.min(1, dBeta / 22));

        // Compensation stricte de rotation d'écran si l'appareil bascule
        var angleDeg = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        if (angleDeg !== 0) {
          var rad = -angleDeg * (Math.PI / 180);
          inputX = rawX * Math.cos(rad) - rawY * Math.sin(rad);
          inputY = rawX * Math.sin(rad) + rawY * Math.cos(rad);
        } else {
          inputX = rawX;
          inputY = rawY;
        }
      } else {
        inputX = joyX;
        inputY = joyY;

        if (keysDown['ArrowLeft'] || keysDown['q'] || keysDown['a']) inputX = -1;
        if (keysDown['ArrowRight'] || keysDown['d']) inputX = 1;
        if (keysDown['ArrowUp'] || keysDown['z'] || keysDown['w']) inputY = -1;
        if (keysDown['ArrowDown'] || keysDown['s']) inputY = 1;
      }

      // 2. Inclinaison 3D du plateau
      var tiltDegX = inputY * 7;
      var tiltDegY = -inputX * 7;
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

    /* ================= RENDU DU LABYRINTHE ================= */
    function render() {
      ctx.clearRect(0, 0, size, size);

      // 1. Fond du labyrinthe circulaire
      ctx.save();
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

      // 2. Cœur central du Nautilus (Objectif final)
      var tNow = performance.now() * 0.003;
      var pulse = 0.85 + 0.15 * Math.sin(tNow * 3.5);
      var coeurGrad = ctx.createRadialGradient(center, center, 2, center, center, rInner * pulse);
      coeurGrad.addColorStop(0, '#ffffff');
      coeurGrad.addColorStop(0.28, '#8ee7ff');
      coeurGrad.addColorStop(0.65, '#0ea5e9');
      coeurGrad.addColorStop(1, 'rgba(4, 20, 36, 0.95)');
      ctx.fillStyle = coeurGrad;
      ctx.beginPath();
      ctx.arc(center, center, rInner * 0.85, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffd36c';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(center, center, rInner * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#020b14';
      ctx.font = 'bold ' + Math.round(rInner * 0.38) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ CŒUR', center, center);

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

      ctx.restore();
    }

    /* ================= BOUCLE DE JEU (GAME LOOP) ================= */
    function gameLoop(now) {
      if (estTermine) return;
      var dt = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;

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

      statusEl.textContent = '🚨 Minuteur de 1 min écoulé ! Remontée en surface du matelot.';
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
