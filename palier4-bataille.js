/* =============================================================
   PALIER 4 — « TRAQUE SONAR : LES MONSTRES DES ABYSSES »
   Moteur de Bataille Navale sous-marine moderne & cinématographique
   (palier4-bataille.js)

   • Radar tactique 8×8 (A-H / 1-8).
   • 4 léviathans abyssaux colossaux (style Jules Verne / 20 000 Lieues) :
     - Kraken Légendaire (4 cases) 🐙
     - Calmar Géant (3 cases) 🦑
     - Anguille Abyssale (2 cases) ⚡
     - Manta des Profondeurs (1 case) 🌊
   • Positionnement déterministe unique par équipage via aleaSeed.
   • Relais d'équipage : l'avancée de la grille (tirs, touches, monstres neutralisés)
     est partagée et persistée entre tous les matelots d'une même équipe.
   • Règle des 3 erreurs cumulées : chaque tir dans l'eau allume un voyant d'alerte.
     À 3 tirs manqués, le matelot est éjecté en surface (remontée en surface standard),
     laissant la grille intacte pour le relais immédiat d'un coéquipier !
   • Effets sensationnels : balayage sonar radar, explosions et pings
     Web Audio synthétisés, secousse de coque et alertes immersives.
   ============================================================= */
(function () {
  'use strict';

  var COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  var ROWS = [1, 2, 3, 4, 5, 6, 7, 8];
  var TAILLE_GRILLE = 8;
  var MAX_ECHECS_MATELOT = 3;

  var DEFS_FLOTTE = [
    { id: 'kraken',   nom: 'Kraken Légendaire',     taille: 4, ico: '🐙', desc: 'Léviathan colossal des abysses' },
    { id: 'calmar',   nom: 'Calmar Géant',          taille: 3, ico: '🦑', desc: 'Monstre tentaculaire des fosses' },
    { id: 'anguille', nom: 'Anguille Abyssale',     taille: 2, ico: '⚡', desc: 'Prédateur bio-électrique furtif' },
    { id: 'manta',    nom: 'Manta des Profondeurs', taille: 1, ico: '🌊', desc: 'Spectre marin insaisissable' }
  ];

  /* PRNG déterministe (Mulberry32) */
  function aleaSeed(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  /* Génération de la flotte pour un équipage donné */
  function getFlottePourEquipe(equipeCode) {
    var rnd = aleaSeed('palier4_bataille_' + String(equipeCode || 'NEMO').toUpperCase());
    var grilleOccupee = {}; // coord -> idNavire
    var navires = [];

    DEFS_FLOTTE.forEach(function (def) {
      var place = false;
      var tentatives = 0;

      while (!place && tentatives < 500) {
        tentatives++;
        var horizontal = rnd() > 0.5;
        var rMax = horizontal ? TAILLE_GRILLE : (TAILLE_GRILLE - def.taille + 1);
        var cMax = horizontal ? (TAILLE_GRILLE - def.taille + 1) : TAILLE_GRILLE;

        var r = Math.floor(rnd() * rMax);
        var c = Math.floor(rnd() * cMax);

        var coords = [];
        var collision = false;

        for (var k = 0; k < def.taille; k++) {
          var cr = horizontal ? r : (r + k);
          var cc = horizontal ? (c + k) : c;
          var cleCoord = COLS[cc] + ROWS[cr];

          if (grilleOccupee[cleCoord]) {
            collision = true;
            break;
          }
          coords.push(cleCoord);
        }

        if (!collision) {
          coords.forEach(function (coord) {
            grilleOccupee[coord] = def.id;
          });
          navires.push({
            id: def.id,
            nom: def.nom,
            taille: def.taille,
            ico: def.ico,
            desc: def.desc,
            coords: coords,
            horizontal: horizontal
          });
          place = true;
        }
      }
    });

    return navires;
  }

  /* Synthétiseur Web Audio sensationnel (pings, torpilles, explosions, alertes) */
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function sonBataille(type) {
    var ctx = getAudioCtx();
    if (!ctx) return;
    try {
      var t = ctx.currentTime;
      if (type === 'ping') {
        // Ping Sonar résonant
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.35);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.6);
      } else if (type === 'splash') {
        // Tir manqué / Dans l'eau
        var osc2 = ctx.createOscillator();
        var gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(260, t);
        osc2.frequency.exponentialRampToValueAtTime(90, t + 0.28);
        gain2.gain.setValueAtTime(0.20, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc2.start(t); osc2.stop(t + 0.32);
      } else if (type === 'touche') {
        // Impact / Explosion de torpille
        var osc3 = ctx.createOscillator();
        var gain3 = ctx.createGain();
        osc3.type = 'sawtooth';
        osc3.frequency.setValueAtTime(180, t);
        osc3.frequency.exponentialRampToValueAtTime(45, t + 0.45);
        gain3.gain.setValueAtTime(0.35, t);
        gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc3.connect(gain3); gain3.connect(ctx.destination);
        osc3.start(t); osc3.stop(t + 0.52);
      } else if (type === 'coule') {
        // Détonation majeure / Navire coulé
        var osc4 = ctx.createOscillator();
        var gain4 = ctx.createGain();
        osc4.type = 'square';
        osc4.frequency.setValueAtTime(220, t);
        osc4.frequency.exponentialRampToValueAtTime(30, t + 0.85);
        gain4.gain.setValueAtTime(0.40, t);
        gain4.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc4.connect(gain4); gain4.connect(ctx.destination);
        osc4.start(t); osc4.stop(t + 0.95);
      } else if (type === 'alerte') {
        // Klaxon d'évacuation de coque
        var oscA = ctx.createOscillator();
        var gainA = ctx.createGain();
        oscA.type = 'sawtooth';
        oscA.frequency.setValueAtTime(440, t);
        oscA.frequency.setValueAtTime(330, t + 0.15);
        oscA.frequency.setValueAtTime(440, t + 0.30);
        gainA.gain.setValueAtTime(0.30, t);
        gainA.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        oscA.connect(gainA); gainA.connect(ctx.destination);
        oscA.start(t); oscA.stop(t + 0.58);
      }
    } catch (e) {}
  }

  /* Persistance de la progression d'équipe */
  function chargerProgressionLocale(equipeCode) {
    try {
      var raw = localStorage.getItem('nautilusP4Partie:' + equipeCode);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { tirs: [], touches: [], coules: [] };
  }

  function sauverProgressionLocale(equipeCode, data) {
    try {
      localStorage.setItem('nautilusP4Partie:' + equipeCode, JSON.stringify(data));
    } catch (e) {}
  }

  /* Moteur interactif */
  function init(host, options) {
    if (!host) return null;
    var opts = options || {};
    var equipeCode = String(opts.equipe || 'NEMO').toUpperCase();
    var matelotNom = opts.matelot || 'Matelot';
    var onVictoire = opts.onVictoire || function () {};
    var onEchec = opts.onEchec || function () {};

    var flotte = getFlottePourEquipe(equipeCode);
    var mapCasesNavire = {}; // coord -> navire
    var totalCasesNavires = 0;

    flotte.forEach(function (nav) {
      totalCasesNavires += nav.coords.length;
      nav.coords.forEach(function (c) {
        mapCasesNavire[c] = nav;
      });
    });

    // Chargement de l'état partagé d'équipe
    var etatPartage = chargerProgressionLocale(equipeCode);
    var tirsEnregistres = new Set(etatPartage.tirs || []);
    var echecsSessionCourante = 0;
    var verrouille = false;

    // Synchronisation Firestore en temps réel si disponible
    if (window.NautilusBlocages && window.NautilusBlocages.db) {
      window.NautilusBlocages.db().then(function (x) {
        var docRef = x.fs.doc(x.db, 'teams', equipeCode);
        x.fs.getDoc(docRef).then(function (snap) {
          if (snap.exists()) {
            var data = snap.data();
            if (data && data.batailleNavale && Array.isArray(data.batailleNavale.tirs)) {
              data.batailleNavale.tirs.forEach(function (coord) {
                tirsEnregistres.add(coord);
              });
              sauverProgressionLocale(equipeCode, { tirs: Array.from(tirsEnregistres) });
              rafraichirTouteLaGrille();
              verifierVictoireImmediate();
            }
          }
        }).catch(function () {});
      }).catch(function () {});
    }

    // Construction du DOM immersif
    host.innerHTML = ''
      + '<div class="bt-container">'
      + '  <!-- 1. HUD & Jauge torpilles -->'
      + '  <div class="bt-hud">'
      + '    <div class="bt-hud-top">'
      + '      <div class="bt-step-badge">RADAR TACTIQUE <b>ABYSSAL</b></div>'
      + '      <div class="bt-voyants" id="btVoyantsBox" title="3 tirs manqués maximum par matelot">'
      + '        <span class="bt-voyant" id="btVoyant1"></span>'
      + '        <span class="bt-voyant" id="btVoyant2"></span>'
      + '        <span class="bt-voyant" id="btVoyant3"></span>'
      + '        <span class="bt-voyants-lbl">ÉCHECS (3 MAX)</span>'
      + '      </div>'
      + '    </div>'
      + '    <div class="bt-relais-info">'
      + '      <span>⚓ Équipage : <b>' + equipeCode + '</b></span>'
      + '      <span id="btTouchesCompteur">Impacts : <b>0 / ' + totalCasesNavires + '</b></span>'
      + '    </div>'
      + '  </div>'

      + '  <!-- 2. État de la flotte ennemie -->'
      + '  <div class="bt-fleet-box" id="btFleetBox">'
      +      flotte.map(function (nav) {
               return '<div class="bt-ship-card" id="btShipCard-' + nav.id + '">'
                 + '<div class="bt-ship-head">'
                 + '  <span class="bt-ship-ico">' + nav.ico + '</span>'
                 + '  <div class="bt-ship-meta">'
                 + '    <span class="bt-ship-nom">' + nav.nom + '</span>'
                 + '    <span class="bt-ship-desc">' + nav.desc + ' (' + nav.taille + ' cases)</span>'
                 + '  </div>'
                 + '</div>'
                 + '<div class="bt-ship-pips">'
                 +    nav.coords.map(function (c, i) {
                        return '<span class="bt-ship-pip" data-ship="' + nav.id + '" data-coord="' + c + '"></span>';
                      }).join('')
                 + '</div>'
                 + '</div>';
             }).join('')
      + '  </div>'

      + '  <!-- 3. Radar Sonar 8x8 -->'
      + '  <div class="bt-radar-wrap">'
      + '    <div class="bt-radar-sweep" aria-hidden="true"></div>'
      + '    <div class="bt-radar-grid" id="btRadarGrid">'
      + '      <div class="bt-corner-cell">🧭</div>'
      +        COLS.map(function (c) { return '<div class="bt-header-col">' + c + '</div>'; }).join('')
      +        ROWS.map(function (r) {
                 return '<div class="bt-header-row">' + r + '</div>'
                   + COLS.map(function (c) {
                       var coord = c + r;
                       return '<button type="button" class="bt-cell" data-coord="' + coord + '" aria-label="Coordonnée ' + coord + '">'
                         + '<span class="bt-cell-inner"></span>'
                         + '</button>';
                     }).join('');
               }).join('')
      + '    </div>'
      + '  </div>'

      + '  <!-- 4. Journal tactique instantané -->'
      + '  <div class="bt-log-status" id="btLogStatus">Visez les coordonnées sur le radar pour lancer une torpille acoustique.</div>'
      + '</div>';

    var gridEl = host.querySelector('#btRadarGrid');
    var logStatusEl = host.querySelector('#btLogStatus');
    var touchesCompteurEl = host.querySelector('#btTouchesCompteur');
    var voyant1 = host.querySelector('#btVoyant1');
    var voyant2 = host.querySelector('#btVoyant2');
    var voyant3 = host.querySelector('#btVoyant3');

    function majVoyantsUI() {
      if (voyant1) voyant1.classList.toggle('active', echecsSessionCourante >= 1);
      if (voyant2) voyant2.classList.toggle('active', echecsSessionCourante >= 2);
      if (voyant3) voyant3.classList.toggle('active', echecsSessionCourante >= 3);
    }

    function rafraichirTouteLaGrille() {
      var nbTouches = 0;
      var shipsSunken = {};

      flotte.forEach(function (nav) {
        var touchesNav = 0;
        nav.coords.forEach(function (c) {
          var pip = host.querySelector('.bt-ship-pip[data-coord="' + c + '"]');
          if (tirsEnregistres.has(c)) {
            touchesNav++;
            nbTouches++;
            if (pip) pip.classList.add('hit');
          }
        });
        if (touchesNav === nav.coords.length) {
          shipsSunken[nav.id] = true;
          var card = host.querySelector('#btShipCard-' + nav.id);
          if (card) card.classList.add('is-sunk');
        }
      });

      if (touchesCompteurEl) {
        touchesCompteurEl.innerHTML = 'Impacts : <b>' + nbTouches + ' / ' + totalCasesNavires + '</b>';
      }

      var cells = host.querySelectorAll('.bt-cell');
      cells.forEach(function (cell) {
        var coord = cell.getAttribute('data-coord');
        if (tirsEnregistres.has(coord)) {
          cell.disabled = true;
          var navire = mapCasesNavire[coord];
          if (navire) {
            var estCoule = !!shipsSunken[navire.id];
            cell.classList.add('is-hit');
            if (estCoule) cell.classList.add('is-sunk');
            cell.innerHTML = '<span class="bt-cell-ico">' + (estCoule ? '💥' : '🔥') + '</span>';
          } else {
            cell.classList.add('is-miss');
            cell.innerHTML = '<span class="bt-cell-ico">💧</span>';
          }
        }
      });
    }

    function synchroniserVersFirestore() {
      var arr = Array.from(tirsEnregistres);
      sauverProgressionLocale(equipeCode, { tirs: arr });

      if (window.NautilusBlocages && window.NautilusBlocages.db) {
        window.NautilusBlocages.db().then(function (x) {
          x.fs.updateDoc(x.fs.doc(x.db, 'teams', equipeCode), {
            batailleNavale: {
              tirs: arr,
              derniersTirsPar: matelotNom,
              updatedAt: new Date().toISOString()
            }
          }).catch(function () {});
        }).catch(function () {});
      }
    }

    function verifierVictoireImmediate() {
      var tousCoules = flotte.every(function (nav) {
        return nav.coords.every(function (c) {
          return tirsEnregistres.has(c);
        });
      });

      if (tousCoules && !verrouille) {
        verrouille = true;
        sonBataille('coule');
        if (logStatusEl) {
          logStatusEl.innerHTML = '🏆 <b>FOSSE SÉCURISÉE ! LES 4 LÉVIATHANS SONT NEUTRALISÉS !</b>';
          logStatusEl.className = 'bt-log-status is-win';
        }
        setTimeout(function () {
          onVictoire({
            tirsTotaux: tirsEnregistres.size,
            flotte: flotte.length
          });
        }, 1200);
      }
    }

    /* Traitement d'un tir sur une case */
    function tirer(coord) {
      if (verrouille || tirsEnregistres.has(coord)) return;

      tirsEnregistres.add(coord);
      var navire = mapCasesNavire[coord];

      // Animation d'impact
      var cell = host.querySelector('.bt-cell[data-coord="' + coord + '"]');

      if (navire) {
        // TOUCHÉ !
        var navCoule = navire.coords.every(function (c) {
          return tirsEnregistres.has(c);
        });

        if (navCoule) {
          sonBataille('coule');
          declencherSecousse('forte');
          if (logStatusEl) {
            logStatusEl.innerHTML = '💥 <b>TERRASSÉ !</b> Le ' + navire.nom + ' ' + navire.ico + ' sombre dans la fosse abyssale !';
            logStatusEl.className = 'bt-log-status is-hit';
          }
        } else {
          sonBataille('touche');
          declencherSecousse('legere');
          if (logStatusEl) {
            logStatusEl.innerHTML = '🔥 <b>TOUCHÉ !</b> Le ' + navire.nom + ' ' + navire.ico + ' est atteint en <b>' + coord + '</b> !';
            logStatusEl.className = 'bt-log-status is-hit';
          }
        }
      } else {
        // DANS L'EAU (ERREUR)
        sonBataille('splash');
        echecsSessionCourante++;
        majVoyantsUI();

        if (logStatusEl) {
          logStatusEl.innerHTML = '💧 <b>DANS L’EAU…</b> Aucun écho en <b>' + coord + '</b> (' + (MAX_ECHECS_MATELOT - echecsSessionCourante) + ' torpille(s) restante(s)).';
          logStatusEl.className = 'bt-log-status is-miss';
        }

        if (echecsSessionCourante >= MAX_ECHECS_MATELOT) {
          // 3 erreurs -> ÉJECTION EN SURFACE
          verrouille = true;
          sonBataille('alerte');
          declencherSecousse('forte');
          synchroniserVersFirestore();
          rafraichirTouteLaGrille();

          if (logStatusEl) {
            logStatusEl.innerHTML = '🚨 <b>ALERTE BRÈCHE DE COQUE : 3 TIRS MANQUÉS !</b> Éjection du matelot. Relais d’équipage requis !';
            logStatusEl.className = 'bt-log-status is-danger';
          }

          setTimeout(function () {
            onEchec('3_erreurs');
          }, 1500);
          return;
        }
      }

      synchroniserVersFirestore();
      rafraichirTouteLaGrille();
      verifierVictoireImmediate();
    }

    function declencherSecousse(intensite) {
      host.classList.remove('bt-shake-soft', 'bt-shake-hard');
      void host.offsetWidth; // trigger reflow
      host.classList.add(intensite === 'forte' ? 'bt-shake-hard' : 'bt-shake-soft');
    }

    /* Écouteur d'impact sur le radar */
    if (gridEl) {
      gridEl.addEventListener('click', function (e) {
        var cell = e.target.closest('.bt-cell');
        if (!cell || cell.disabled || verrouille) return;
        var coord = cell.getAttribute('data-coord');
        if (coord) tirer(coord);
      });
    }

    // Affichage initial
    sonBataille('ping');
    rafraichirTouteLaGrille();
    majVoyantsUI();

    return {
      abandonner: function () {
        verrouille = true;
      }
    };
  }

  // Export pour les tirages et le panneau admin
  window.NautilusBataille = {
    init: init,
    getFlottePourEquipe: getFlottePourEquipe,
    DEFS_FLOTTE: DEFS_FLOTTE
  };
})();
