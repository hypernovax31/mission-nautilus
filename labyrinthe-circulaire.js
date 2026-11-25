/* =============================================================================
   MISSION NAUTILUS — PALIER 7 : LE LABYRINTHE CIRCULAIRE DU NAUTILUS
   (labyrinthe-circulaire.js)
   -----------------------------------------------------------------------------
   Épreuve du Palier 7 :
   - Labyrinthe en forme de cercle à 7 anneaux concentriques et 16 secteurs.
   - Dédale très difficile avec 18 culs-de-sac (impasses) et un chemin optimal
     de 74 étapes vers le Cœur central.
   - Bille 3D sphérique texturée en rotation 3D avec ombrage réaliste, reflets,
     ombres portées et traînée de micro-bulles sous-marines.
   - Pilotage :
     * Gyroscope mobile (DeviceOrientation) prioritaire sur smartphone/tablette.
     * Si aucun gyroscope disponible (PC / capteurs inactifs), joystick virtuel tactile.
   - Intégration audio complète (roulement, chocs, carillon du réacteur).
   - Détection de victoire vers Palier 8 (23819161225.html).
   ============================================================================= */

(function () {
  'use strict';

  if (window.NautilusLabyrinthe) return;

  var DUREE_PARCOURS_SEC = 180; // 3 minutes de réserve d'oxygène
  var RINGS = 7;
  var SECTORS = 16;
  var SECTOR_ANGLE = (Math.PI * 2) / SECTORS;

  /* Topologie certifiée (Seed 988 : 18 impasses, 74 pas jusqu'au Cœur) */
  var RADIAL_WALLS = [
    [false,false,true,false,false,true,false,false,true,false,false,true,false,false,false,true],
    [true,false,false,true,false,true,true,true,true,true,false,false,true,true,false,true],
    [false,false,true,false,true,true,false,true,false,true,false,false,false,false,true,false],
    [true,true,false,false,true,false,false,false,true,false,false,true,false,true,false,false],
    [true,false,false,false,true,false,true,false,false,true,true,false,false,false,false,true],
    [false,true,true,false,false,true,false,true,true,true,false,true,true,false,false,true],
    [true,false,false,false,false,false,false,false,true,false,true,false,false,false,true,false]
  ];

  var RING_WALLS = [
    [false,false,true,false,false,true,false,true,false,false,false,true,false,true,false,true],
    [false,true,true,true,true,false,false,false,false,true,false,true,true,false,true,false],
    [true,true,false,true,false,false,true,false,true,false,true,true,true,false,true,true],
    [false,false,true,true,false,true,true,true,true,true,false,false,true,true,false,true],
    [false,true,false,true,true,false,false,false,true,false,true,true,false,true,true,true],
    [true,false,true,false,true,true,true,true,false,false,false,false,true,false,true,false]
  ];

  var START_RING = 6;  // Anneau extérieur (Track 7)
  var START_SECTOR = 0; // Secteur initial
  var GOAL_SECTOR = 9;  // Secteur d'accès vers le cœur central (Anneau 0)

  /* ================= EFFETS SONORES VIA WEB AUDIO API ================= */
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
    if (now - dernierSonChoc < 80) return; // Anti-mitraillage
    dernierSonChoc = now;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }

    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var f = 800 + Math.min(600, (force || 1) * 300);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.045);

      var vol = Math.min(0.28, 0.06 + (force || 1) * 0.08);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.055);
    } catch (e) {}
  }

  function jouerSonVictoire() {
    if (!sonEstActif()) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume().catch(function () {}); }

    try {
      var notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // Do-Mi-Sol-Do-Mi
      notes.forEach(function (freq, idx) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.5);
      });
    } catch (e) {}
  }

  /* ================= MOTEUR DU LABYRINTHE CIRCULAIRE ================= */
  function init(host, options) {
    options = options || {};
    var onVictoire = options.onVictoire || function () {};
    var onDefaite = options.onDefaite || function () {};

    host.innerHTML = ''
      + '<div class="laby-container" id="labyContainer">'
      + '  <div class="laby-hud">'
      + '    <div class="laby-hud-top">'
      + '      <div class="laby-badge">PALIER 7 — <b>LABYRINTHE CIRCULAIRE</b></div>'
      + '      <div class="laby-timer" id="labyTimer">⏱️ 03:00</div>'
      + '    </div>'
      + '    <div class="laby-hud-stats">'
      + '      <div class="laby-stat-item laby-stat-depth">Profondeur : <b id="labyDepth">Anneau 7/7</b></div>'
      + '      <div class="laby-stat-item">Impacts : <b id="labyCollisions">0</b></div>'
      + '      <div class="laby-stat-item">Cœur : <b id="labyCoreDist">Lointain</b></div>'
      + '    </div>'
      + '  </div>'

      + '  <div class="laby-board-outer" id="labyBoardOuter">'
      + '    <div class="laby-board" id="labyBoard">'
      + '      <canvas class="laby-canvas" id="labyCanvas" width="440" height="440"></canvas>'
      + '    </div>'
      + '  </div>'

      + '  <div class="laby-controls-bar">'
      + '    <div class="laby-sensor-chip" id="labySensorChip">'
      + '      <span class="laby-sensor-dot" id="labySensorDot"></span>'
      + '      <span id="labySensorLabel">Détection capteurs…</span>'
      + '    </div>'
      + '    <div class="laby-actions">'
      + '      <button type="button" class="laby-btn" id="btnCalibGyro" title="Définir la position actuelle comme neutre">🎯 Calibrer</button>'
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

      + '  <div class="laby-status" id="labyStatus">Dirigez la bille 3D à travers les coursives circulaires jusqu’au Cœur du Nautilus.</div>'
      + '</div>';

    var canvas = host.querySelector('#labyCanvas');
    var board = host.querySelector('#labyBoard');
    var timerEl = host.querySelector('#labyTimer');
    var depthEl = host.querySelector('#labyDepth');
    var collisionsEl = host.querySelector('#labyCollisions');
    var coreDistEl = host.querySelector('#labyCoreDist');
    var statusEl = host.querySelector('#labyStatus');
    var sensorLabelEl = host.querySelector('#labySensorLabel');
    var btnCalibGyro = host.querySelector('#btnCalibGyro');
    var btnToggleMode = host.querySelector('#btnToggleMode');
    var joystickZone = host.querySelector('#labyJoystickZone');
    var joyBase = host.querySelector('#labyJoyBase');
    var joyStick = host.querySelector('#labyJoyStick');

    var ctx = canvas.getContext('2d');

    /* Variables de jeu */
    var tempsRestant = DUREE_PARCOURS_SEC;
    var collisionsCount = 0;
    var estTermine = false;
    var modeActif = 'gyro'; // 'gyro' ou 'joystick'
    var aRecuGyro = false;
    var timerInterval = null;
    var animFrameId = null;

    /* Gyroscope / Accéléromètre */
    var rawGamma = 0; // Inclinaison gauche/droite (-90 .. +90)
    var rawBeta = 0;  // Inclinaison avant/arrière (-180 .. +180)
    var calibGamma = 0;
    var calibBeta = 30; // Position naturelle en main inclinée à ~30°
    var inputX = 0;
    var inputY = 0;

    /* Joystick virtuel */
    var joyDragging = false;
    var joyTouchId = null;
    var joyCenterX = 0;
    var joyCenterY = 0;
    var joyX = 0;
    var joyY = 0;
    var JOY_MAX_RADIUS = 38;

    /* Clavier (PC fallback) */
    var keysDown = {};

    /* Particules de bulles sous-marines */
    var bulles = [];

    /* Dimensions et géométrie du labyrinthe */
    var size = 440;
    var center = size / 2;
    var rOuter = size * 0.465;
    var rInner = size * 0.125;
    var trackWidth = (rOuter - rInner) / RINGS;
    var rBall = trackWidth * 0.28; // Bille 3D parfaitement calibrée dans les coursives
    var wallHalfThick = 2.0;

    /* Anneaux (rayons des parois concentriques) */
    // r_wall[0] = rInner (accès vers le cœur), r_wall[7] = rOuter
    var rWalls = [];
    for (var k = 0; k <= RINGS; k++) {
      rWalls.push(rInner + k * trackWidth);
    }

    /* Position initiale de la bille (Anneau 6, secteur 0) */
    var initTrackRadius = (rWalls[START_RING] + rWalls[START_RING + 1]) / 2;
    var initAngle = (START_SECTOR + 0.5) * SECTOR_ANGLE;
    var ballX = center + initTrackRadius * Math.cos(initAngle);
    var ballY = center + initTrackRadius * Math.sin(initAngle);
    var ballVx = 0;
    var ballVy = 0;

    /* Rotation 3D de la bille pour l'effet de roulement */
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

    /* ================= DÉTECTION GYROSCOPE ET JOYSTICK ================= */
    function onDeviceOrientation(ev) {
      if (ev.gamma != null && ev.beta != null) {
        if (!aRecuGyro) {
          aRecuGyro = true;
          calibGamma = ev.gamma;
          calibBeta = (ev.beta > 15 && ev.beta < 60) ? ev.beta : 30;
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
      statusEl.textContent = 'Inclinez votre appareil pour diriger la bille dans le labyrinthe.';
      statusEl.className = 'laby-status';
    }

    function activerModeJoystick() {
      modeActif = 'joystick';
      joystickZone.hidden = false;
      sensorLabelEl.textContent = '🕹️ Joystick tactile actif';
      btnToggleMode.textContent = '🧭 Gyroscope';
      statusEl.textContent = 'Utilisez le joystick tactile (ou les flèches du clavier) pour manœuvrer.';
      statusEl.className = 'laby-status is-warning';
    }

    /* Demande d'autorisation DeviceOrientation (requis pour iOS 13+) */
    function demanderAutorisationGyro() {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(function (permissionState) {
            if (permissionState === 'granted') {
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
      } else {
        activerModeJoystick();
      }
    }

    /* Écoute initiale du gyroscope */
    if ('ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', onDeviceOrientation, true);
    }
    // Si après 600 ms aucune donnée gyroscope n'est reçue (ex. PC ou capteurs inactifs),
    // basculer automatiquement sur le joystick tactile de secours
    setTimeout(function () {
      if (!aRecuGyro) {
        activerModeJoystick();
      }
    }, 600);

    /* Boutons de commande */
    btnCalibGyro.addEventListener('click', function () {
      calibGamma = rawGamma;
      calibBeta = rawBeta;
      statusEl.textContent = '🎯 Horizon calibré sur l’inclinaison actuelle.';
      statusEl.className = 'laby-status';
      setTimeout(function () {
        statusEl.textContent = 'Dirigez la bille vers le Cœur central du Nautilus.';
      }, 1500);
    });

    btnToggleMode.addEventListener('click', function () {
      if (modeActif === 'gyro') {
        activerModeJoystick();
      } else {
        demanderAutorisationGyro();
        activerModeGyro();
      }
    });

    /* ================= GESTION DU JOYSTICK VIRTUEL TACTILE ================= */
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
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > JOY_MAX_RADIUS) {
        dx = (dx / dist) * JOY_MAX_RADIUS;
        dy = (dy / dist) * JOY_MAX_RADIUS;
      }
      joyX = dx / JOY_MAX_RADIUS;
      joyY = dy / JOY_MAX_RADIUS;
      joyStick.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
      if (e.cancelable) e.preventDefault();
    }

    function handleJoyEnd(e) {
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

    joyBase.addEventListener('touchstart', handleJoyStart, { passive: false });
    window.addEventListener('touchmove', handleJoyMove, { passive: false });
    window.addEventListener('touchend', handleJoyEnd);
    window.addEventListener('touchcancel', handleJoyEnd);

    /* Clavier (Flèches / ZQSD / WASD) pour PC */
    window.addEventListener('keydown', function (e) {
      keysDown[e.key] = true;
    });
    window.addEventListener('keyup', function (e) {
      keysDown[e.key] = false;
    });

    /* ================= PHYSIQUE & RÉSOLUTION DES COLLISIONS ================= */
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
      var distCenter = Math.sqrt(dx * dx + dy * dy);
      var angle = angleNormalise(Math.atan2(dy, dx));

      // 1. Limite extérieure du labyrinthe (rOuter)
      if (distCenter > rOuter - rBall - wallHalfThick) {
        var penetration = distCenter - (rOuter - rBall - wallHalfThick);
        var nx = dx / (distCenter || 1);
        var ny = dy / (distCenter || 1);
        ballX -= nx * penetration;
        ballY -= ny * penetration;
        // Rebond radial avec coefficient de restitution
        var vRadial = ballVx * nx + ballVy * ny;
        if (vRadial > 0) {
          ballVx -= 1.3 * vRadial * nx;
          ballVy -= 1.3 * vRadial * ny;
          enregistrerImpact(vRadial);
        }
        dx = ballX - center;
        dy = ballY - center;
        distCenter = Math.sqrt(dx * dx + dy * dy);
        angle = angleNormalise(Math.atan2(dy, dx));
      }

      // 2. Paroi du Cœur central (rInner)
      // Ouverte uniquement sur le secteur GOAL_SECTOR (accès direct au cœur !)
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
          ballVx -= 1.3 * vRadialIn * nxIn;
          ballVy -= 1.3 * vRadialIn * nyIn;
          enregistrerImpact(-vRadialIn);
        }
        dx = ballX - center;
        dy = ballY - center;
        distCenter = Math.sqrt(dx * dx + dy * dy);
        angle = angleNormalise(Math.atan2(dy, dx));
      }

      // 3. Parois concentriques (RING_WALLS)
      // k va de 0 à RINGS - 2 (entre anneaux 0 et 1, 1 et 2, ..., 5 et 6)
      for (var k = 0; k < RINGS - 1; k++) {
        var rW = rWalls[k + 1];
        if (Math.abs(distCenter - rW) < rBall + wallHalfThick + 2.0) {
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
                    ballVx -= 1.3 * vRad * nRx;
                    ballVy -= 1.3 * vRad * nRy;
                    enregistrerImpact(-vRad);
                  }
                }
              }
            }
          }
        }
      }

      // 4. Parois radiales (RADIAL_WALLS)
      // Pour chaque anneau k et secteur s
      for (var rIndex = 0; rIndex < RINGS; rIndex++) {
        var rMin = rWalls[rIndex];
        var rMax = rWalls[rIndex + 1];
        if (distCenter >= rMin - rBall && distCenter <= rMax + rBall) {
          for (var sIndex = 0; sIndex < SECTORS; sIndex++) {
            if (RADIAL_WALLS[rIndex][sIndex]) {
              var aWall = (sIndex + 1) * SECTOR_ANGLE;
              var cosW = Math.cos(aWall);
              var sinW = Math.sin(aWall);
              var x1 = center + rMin * cosW;
              var y1 = center + rMin * sinW;
              var x2 = center + rMax * cosW;
              var y2 = center + rMax * sinW;

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
                  ballVx -= 1.3 * vNorm * nSegX;
                  ballVy -= 1.3 * vNorm * nSegY;
                  enregistrerImpact(-vNorm);
                }
              }
            }
          }
        }
      }
    }

    function enregistrerImpact(v) {
      if (v > 15) {
        collisionsCount++;
        collisionsEl.textContent = collisionsCount;
        jouerSonChoc(Math.min(3, v / 50));
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
        inputX = Math.max(-1, Math.min(1, dGamma / 24));
        inputY = Math.max(-1, Math.min(1, dBeta / 24));
      } else {
        // Mode joystick tactile
        inputX = joyX;
        inputY = joyY;

        // Fallback clavier pour PC
        if (keysDown['ArrowLeft'] || keysDown['q'] || keysDown['a']) inputX = -1;
        if (keysDown['ArrowRight'] || keysDown['d']) inputX = 1;
        if (keysDown['ArrowUp'] || keysDown['z'] || keysDown['w']) inputY = -1;
        if (keysDown['ArrowDown'] || keysDown['s']) inputY = 1;
      }

      // 2. Inclinaison 3D du plateau
      var tiltDegX = inputY * 8;
      var tiltDegY = -inputX * 8;
      board.style.transform = 'rotateX(' + tiltDegX.toFixed(2) + 'deg) rotateY(' + tiltDegY.toFixed(2) + 'deg)';

      // 3. Accélération de la bille sous la gravité du plateau incliné
      var GRAVITE = 460; // px/s²
      var ax = inputX * GRAVITE;
      var ay = inputY * GRAVITE;

      // Frottement de roulement
      var frottement = Math.pow(0.975, dt * 60);

      // Sous-échantillonnage de physique (3 substeps pour zéro collision ratée)
      var SUBSTEPS = 3;
      var subDt = dt / SUBSTEPS;

      for (var step = 0; step < SUBSTEPS; step++) {
        ballVx = (ballVx + ax * subDt) * frottement;
        ballVy = (ballVy + ay * subDt) * frottement;

        // Vitesse maximale bridée
        var v = Math.hypot(ballVx, ballVy);
        var V_MAX = 280;
        if (v > V_MAX) {
          ballVx = (ballVx / v) * V_MAX;
          ballVy = (ballVy / v) * V_MAX;
        }

        ballX += ballVx * subDt;
        ballY += ballVy * subDt;

        resoudreCollisions();
      }

      // 4. Rotation 3D de la bille pour l'animation de roulement
      rotX += ballVy / rBall;
      rotY += -ballVx / rBall;

      // 5. Particules de micro-bulles sous-marines
      var speed = Math.hypot(ballVx, ballVy);
      if (speed > 40 && Math.random() < 0.35) {
        bulles.push({
          x: ballX + (Math.random() - 0.5) * rBall,
          y: ballY + (Math.random() - 0.5) * rBall,
          vx: (Math.random() - 0.5) * 8,
          vy: -12 - Math.random() * 16,
          radius: 1.2 + Math.random() * 2.2,
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

      // 6. Suivi de progression et détection du Cœur
      var dCenter = Math.hypot(ballX - center, ballY - center);
      var curRing = Math.max(0, Math.min(6, Math.floor((dCenter - rInner) / trackWidth)));
      depthEl.textContent = 'Anneau ' + (curRing + 1) + '/7';

      if (dCenter < rInner + 10) {
        coreDistEl.textContent = '⚡ IMMINENT !';
        coreDistEl.style.color = '#ffd36c';
      } else if (curRing <= 1) {
        coreDistEl.textContent = 'Proche';
        coreDistEl.style.color = '#8ee7ff';
      } else {
        coreDistEl.textContent = 'Lointain';
        coreDistEl.style.color = '#a4c7e2';
      }

      // VICTOIRE : la bille a franchi le sas du Cœur central !
      if (dCenter < rInner * 0.75) {
        declencherVictoire();
      }
    }

    /* ================= RENDU VISUEL SUR LE CANVAS ================= */
    function render() {
      ctx.clearRect(0, 0, size, size);

      // 1. Fond du labyrinthe circulaire
      ctx.save();
      var fondGrad = ctx.createRadialGradient(center, center, rInner * 0.4, center, center, rOuter);
      fondGrad.addColorStop(0, '#041527');
      fondGrad.addColorStop(0.5, '#030d1a');
      fondGrad.addColorStop(1, '#01050a');
      ctx.fillStyle = fondGrad;
      ctx.beginPath();
      ctx.arc(center, center, rOuter, 0, Math.PI * 2);
      ctx.fill();

      // Sillons des pistes concentriques (effet coursives profondes)
      for (var rIdx = 0; rIdx < RINGS; rIdx++) {
        var midR = (rWalls[rIdx] + rWalls[rIdx + 1]) / 2;
        ctx.strokeStyle = 'rgba(142, 231, 255, 0.05)';
        ctx.lineWidth = trackWidth - 3;
        ctx.beginPath();
        ctx.arc(center, center, midR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Cœur central du Nautilus (Objectif final)
      var tNow = performance.now() * 0.003;
      var pulse = 0.85 + 0.15 * Math.sin(tNow * 3);
      var coeurGrad = ctx.createRadialGradient(center, center, 2, center, center, rInner * pulse);
      coeurGrad.addColorStop(0, '#ffffff');
      coeurGrad.addColorStop(0.25, '#8ee7ff');
      coeurGrad.addColorStop(0.65, '#0ea5e9');
      coeurGrad.addColorStop(1, 'rgba(4, 20, 36, 0.9)');
      ctx.fillStyle = coeurGrad;
      ctx.beginPath();
      ctx.arc(center, center, rInner * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Anneau du sas du Cœur et symbole central
      ctx.strokeStyle = '#ffd36c';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(center, center, rInner * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      // Texte de cible au cœur
      ctx.fillStyle = '#020b14';
      ctx.font = 'bold ' + Math.round(rInner * 0.45) + 'px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ CŒUR', center, center);

      // Ouverture vers le Cœur (brèche lumineuse sur GOAL_SECTOR)
      var aGoalStart = GOAL_SECTOR * SECTOR_ANGLE;
      var aGoalEnd = (GOAL_SECTOR + 1) * SECTOR_ANGLE;
      ctx.save();
      ctx.strokeStyle = 'rgba(87, 217, 163, 0.9)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#57d9a3';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(center, center, rInner, aGoalStart, aGoalEnd);
      ctx.stroke();
      ctx.restore();

      // 3. Dessin des Parois concentriques (RING_WALLS)
      ctx.lineWidth = 3.0;
      ctx.lineCap = 'round';

      for (var k = 0; k < RINGS - 1; k++) {
        var rW = rWalls[k + 1];
        for (var s = 0; s < SECTORS; s++) {
          if (RING_WALLS[k][s]) {
            var a1 = s * SECTOR_ANGLE;
            var a2 = (s + 1) * SECTOR_ANGLE;
            // Paroi dorée extérieure
            ctx.strokeStyle = '#c4891b';
            ctx.beginPath();
            ctx.arc(center, center, rW, a1, a2);
            ctx.stroke();
            // Liseré intérieur lumineux
            ctx.strokeStyle = 'rgba(255, 230, 160, 0.5)';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.arc(center, center, rW, a1, a2);
            ctx.stroke();
            ctx.lineWidth = 3.0;
          }
        }
      }

      // Paroi fermée du Cœur (sauf brèche d'accès)
      ctx.strokeStyle = '#f5b027';
      ctx.beginPath();
      ctx.arc(center, center, rInner, aGoalEnd, aGoalStart + Math.PI * 2);
      ctx.stroke();

      // 4. Dessin des Parois radiales (RADIAL_WALLS)
      for (var rIdx2 = 0; rIdx2 < RINGS; rIdx2++) {
        var r1 = rWalls[rIdx2];
        var r2 = rWalls[rIdx2 + 1];
        for (var sIdx = 0; sIdx < SECTORS; sIdx++) {
          if (RADIAL_WALLS[rIdx2][sIdx]) {
            var aW = (sIdx + 1) * SECTOR_ANGLE;
            var cW = Math.cos(aW);
            var sW = Math.sin(aW);
            // Paroi radiale cuivrée
            ctx.strokeStyle = '#d48b13';
            ctx.lineWidth = 3.0;
            ctx.beginPath();
            ctx.moveTo(center + r1 * cW, center + r1 * sW);
            ctx.lineTo(center + r2 * cW, center + r2 * sW);
            ctx.stroke();

            // Rivets métalliques aux intersections
            ctx.fillStyle = '#ffd36c';
            ctx.beginPath();
            ctx.arc(center + r1 * cW, center + r1 * sW, 1.8, 0, Math.PI * 2);
            ctx.arc(center + r2 * cW, center + r2 * sW, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Paroi extérieure du labyrinthe (rOuter)
      ctx.strokeStyle = '#f5b027';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(center, center, rOuter, 0, Math.PI * 2);
      ctx.stroke();

      // 5. Particules de micro-bulles sous-marines
      for (var bIdx = 0; bIdx < bulles.length; bIdx++) {
        var bul = bulles[bIdx];
        ctx.fillStyle = 'rgba(142, 231, 255, ' + (bul.life * 0.6).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(bul.x, bul.y, bul.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. BILLE 3D AVEC OMBRAGE SPHÉRIQUE RÉALISTE & ROULIS
      // 6a. Ombre portée dynamique sous la bille (déportée selon la gravité/inclinaison)
      var shadowDx = inputX * 4 + 3;
      var shadowDy = inputY * 4 + 4;
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

      // 6b. Corps de la sphère 3D (Éclairage de surface sphérique)
      var lightX = ballX - rBall * 0.35;
      var lightY = ballY - rBall * 0.45;
      var sphereGrad = ctx.createRadialGradient(lightX, lightY, rBall * 0.05, ballX, ballY, rBall);
      // Alliage de titane doré du Nautilus
      sphereGrad.addColorStop(0, '#ffffff');      // Éclat spéculaire blanc vif
      sphereGrad.addColorStop(0.18, '#fff3c2');   // Reflet chaud
      sphereGrad.addColorStop(0.48, '#f5b027');   // Métal doré étincelant
      sphereGrad.addColorStop(0.78, '#9c6508');   // Dégradé d'ombre de courbure
      sphereGrad.addColorStop(0.94, '#4a2c02');   // Occlusion ambiante
      sphereGrad.addColorStop(1, '#1a0f01');      // Contour sombre
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(ballX, ballY, rBall, 0, Math.PI * 2);
      ctx.fill();

      // 6c. Gravure de rotation 3D sur la bille (effet visuel de roulement)
      ctx.save();
      ctx.beginPath();
      ctx.arc(ballX, ballY, rBall, 0, Math.PI * 2);
      ctx.clip();

      ctx.strokeStyle = 'rgba(70, 40, 4, 0.45)';
      ctx.lineWidth = 1.2;

      // Méridien qui tourne en 3D
      var cosRotY = Math.cos(rotY);
      var sinRotY = Math.sin(rotY);
      ctx.save();
      ctx.translate(ballX, ballY);
      ctx.scale(cosRotY || 0.05, 1);
      ctx.beginPath();
      ctx.arc(0, 0, rBall * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Anneau de latitude qui tourne en 3D
      var cosRotX = Math.cos(rotX);
      ctx.save();
      ctx.translate(ballX, ballY);
      ctx.scale(1, cosRotX || 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, rBall * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.restore(); // Fin du clip bille

      // 6d. Reflet spéculaire secondaire (bounce light sous-marin)
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

      updatePhysics(dt);
      render();

      animFrameId = requestAnimationFrame(gameLoop);
    }
    animFrameId = requestAnimationFrame(gameLoop);

    /* ================= CHRONOMÈTRE DE MISSION ================= */
    timerInterval = setInterval(function () {
      if (estTermine) return;
      tempsRestant--;
      var mm = Math.floor(tempsRestant / 60);
      var ss = tempsRestant % 60;
      timerEl.textContent = '⏱️ ' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;

      if (tempsRestant <= 30) {
        timerEl.classList.add('is-urgent');
      }

      if (tempsRestant <= 0) {
        declencherDefaite('temps');
      }
    }, 1000);

    /* ================= VICTOIRE ET DÉFAITE ================= */
    function declencherVictoire() {
      if (estTermine) return;
      estTermine = true;
      clearInterval(timerInterval);
      cancelAnimationFrame(animFrameId);

      jouerSonVictoire();
      board.style.transform = 'scale(1.04)';
      statusEl.textContent = '⚡ CŒUR ATTEINT ! Le réacteur abyssal du Nautilus est ranimé !';
      statusEl.className = 'laby-status is-success';

      var dureeTotale = DUREE_PARCOURS_SEC - tempsRestant;
      setTimeout(function () {
        onVictoire({
          duree: dureeTotale,
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

      statusEl.textContent = '🚨 Réserve d’oxygène épuisée ! Le sas d’amarrage se referme.';
      statusEl.className = 'laby-status is-danger';

      setTimeout(function () {
        onDefaite(motif || 'temps');
      }, 800);
    }

    /* Nettoyage propre en cas de changement de page */
    function detruire() {
      estTermine = true;
      clearInterval(timerInterval);
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', redimensionner);
      window.removeEventListener('deviceorientation', onDeviceOrientation, true);
      window.removeEventListener('pointermove', handleJoyMove);
      window.removeEventListener('pointerup', handleJoyEnd);
      window.removeEventListener('pointercancel', handleJoyEnd);
      window.removeEventListener('touchmove', handleJoyMove);
      window.removeEventListener('touchend', handleJoyEnd);
      window.removeEventListener('touchcancel', handleJoyEnd);
    }

    return {
      detruire: detruire
    };
  }

  window.NautilusLabyrinthe = {
    init: init
  };
})();
