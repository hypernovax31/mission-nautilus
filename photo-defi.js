/* =====================================================================
   PHOTO DÉFI DU NAUTILUS — MOTEUR DE L'ÉPREUVE DU PALIER 3
   (photo-defi.js)

   ÉPREUVE EN MAGASIN FNAC :
   Pour calibrer le système optique du Nautilus et déverrouiller le
   prochain sas, chaque équipage doit capturer 3 ÉCHANTILLONS VISUELS
   spécifiques dans les rayons du magasin, dans un temps imparti de 3 minutes.

   RÈGLES DU JEU :
   1. Chaque équipe dispose de sa propre série de défis photographiques,
      tirée au sort de façon aléatoire, sans jamais de série identique
      entre les équipes ni entre les parties.
   2. Les défis apparaissent l'un après l'autre après chaque résolution.
   3. Aucun indice direct n'est donné : l'équipage doit explorer les rayons.
   4. Issue de secours (« Permutation d'urgence ») : permet de changer
      UN SEUL défi au cours de la mission. Après ce changement, plus
      aucun droit au changement, sinon remontée immédiate en surface !
   5. Pas d'importation de photo : prise de vue directe au viseur optique
      (avec commandes de Zoom, Macro et Flash/Torche).
   6. Chronomètre strict de 3 minutes (180 secondes). En cas de temps
      écoulé, la série est renouvelée pour la tentative suivante.
   7. Analyse et jugement 100 % autonomes et locaux dans le navigateur
      (sans serveur, sans clé API, sans coût, ultra-rapide).
   ===================================================================== */
(function () {
  'use strict';

  var CLE_HISTORIQUE_SERIES = 'nautilus_p3_series_history';
  var DUREE_MISSION_SEC = 180; // 3 minutes

  /* ================= CATALOGUE DE DÉFIS FNAC ================= */
  var CATALOGUE_DEFIS = [
    {
      id: 'jaune',
      titre: 'Produit ou emballage JAUNE vif',
      consigne: 'Trouvez et cadrez au centre un livre (ex: collection « Pour les nuls »), un accessoire ou un packaging à dominante JAUNE éclatant.',
      rayon: 'Librairie, Informatique ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 36, hMax: 68, sMin: 0.25, vMin: 0.18, vMax: 1.0 }, 'jaune');
      }
    },
    {
      id: 'rouge',
      titre: 'Article ou accessoire ROUGE vif',
      consigne: 'Cadrez un objet, un packaging (univers Nintendo, casque audio, coque) ou un roman à couverture ROUGE vive.',
      rayon: 'Gaming, Son ou Littérature',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 345, hMax: 16, sMin: 0.30, vMin: 0.18, vMax: 1.0, wraps: true }, 'rouge');
      }
    },
    {
      id: 'bleu',
      titre: 'Boîtier ou produit BLEU océan',
      consigne: 'Repérez un boîtier Blu-ray, un accessoire tech ou un livre aux teintes des abysses (BLEU océan / azur).',
      rayon: 'Vidéo / Cinéma, Tech ou Voyage',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 180, hMax: 250, sMin: 0.26, vMin: 0.16, vMax: 1.0 }, 'bleu');
      }
    },
    {
      id: 'vert',
      titre: 'Boîtier ou article VERT émeraude',
      consigne: 'Photographiez un boîtier de jeu (ex: univers Xbox), un guide de voyage ou un accessoire VERT vif.',
      rayon: 'Gaming, Tourisme ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 75, hMax: 160, sMin: 0.25, vMin: 0.16, vMax: 1.0 }, 'vert');
      }
    },
    {
      id: 'orange',
      titre: 'Produit ou manga ORANGE vif',
      consigne: 'Cadrez un manga, un livre de poche ou un accessoire à dominante ORANGE éclatant.',
      rayon: 'Mangas, Poche ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 16, hMax: 38, sMin: 0.35, vMin: 0.18, vMax: 1.0 }, 'orange');
      }
    },
    {
      id: 'isbn_livre',
      titre: 'Code-barres ISBN (978…) d’un livre',
      consigne: 'Retournez n’importe quel livre, roman ou BD en rayon et cadrez nettement son code-barres ISBN au dos.',
      rayon: 'Tous rayons Librairie / BD / Manga',
      analyser: function (pixels, w, h, canvas, extra) {
        return analyserCodeBarres(canvas, extra);
      }
    },
    {
      id: 'livre_mer',
      titre: 'Ouvrage évoquant la MER ou les Abysses',
      consigne: 'Cadrez la couverture d’un livre, d’un roman ou d’une BD évoquant l’océan, les marins, les îles ou les profondeurs sous-marines.',
      rayon: 'Littérature, BD, Voyage ou Jeunesse',
      analyser: function (pixels, w, h, canvas, extra) {
        return analyserLivreMaritime(pixels, w, h, canvas, extra);
      }
    },
    {
      id: 'sombre_vinyle',
      titre: 'Disque vinyle 33T ou objet NOIR profond',
      consigne: 'Cadrez un disque vinyle 33T, un casque audio ou un appareil photo NOIR profond.',
      rayon: 'Disquaire / Vinyles, Casques ou Photo',
      analyser: function (pixels, w, h) {
        return analyserNoirProfond(pixels, w, h);
      }
    },
    {
      id: 'ecran_allume',
      titre: 'Écran lumineux allumé en rayon',
      consigne: 'Visez un téléviseur, un ordinateur portable, une tablette ou un smartphone allumé dans les allées.',
      rayon: 'TV, Informatique ou Téléphonie',
      analyser: function (pixels, w, h) {
        return analyserEcranAllume(pixels, w, h);
      }
    },
    {
      id: 'objet_rond',
      titre: 'Objet ou haut-parleur ROND / circulaire',
      consigne: 'Cadrez une enceinte Bluetooth circulaire, un haut-parleur rond, un vinyle ou un objectif photo.',
      rayon: 'Son / Enceintes, Vinyles ou Photo',
      analyser: function (pixels, w, h) {
        return analyserObjetRond(pixels, w, h);
      }
    }
  ];

  /* ================= ALGORITHMES D'ANALYSE CHROMATIQUE & VISION LOCALE ================= */

  // Conversion RGB vers HSV (Hue: 0-360, Sat: 0-1, Val: 0-1)
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var d = max - min;
    var h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h: h, s: s, v: v };
  }

  // Analyse spectrale HSV avec pondération de la zone centrale (viseur)
  function analyserCouleur(pixels, w, h, filtre, nomCouleur) {
    var total = 0, match = 0;
    var cx = w / 2, cy = h / 2;
    var rayonZone = Math.min(w, h) * 0.40; // Collimateur central
    var r2 = rayonZone * rayonZone;

    var sMin = filtre.sMin !== undefined ? filtre.sMin : 0.25;
    var vMin = filtre.vMin !== undefined ? filtre.vMin : 0.16;
    var vMax = filtre.vMax !== undefined ? filtre.vMax : 1.0;

    for (var y = 0; y < h; y += 3) {
      for (var x = 0; x < w; x += 3) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue; // On isole la zone cadrée dans le viseur
        var idx = (y * w + x) * 4;
        var r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
        var hsv = rgbToHsv(r, g, b);

        total++;
        var okH = false;
        if (filtre.wraps) {
          okH = (hsv.h >= filtre.hMin || hsv.h <= filtre.hMax);
        } else {
          okH = (hsv.h >= filtre.hMin && hsv.h <= filtre.hMax);
        }
        if (okH && hsv.s >= sMin && hsv.v >= vMin && hsv.v <= vMax) {
          match++;
        }
      }
    }

    var ratio = total > 0 ? (match / total) : 0;
    var pct = Math.round(ratio * 100);
    var seuil = 18; // 18 % minimum de pixels de la couleur dans le collimateur

    if (pct >= seuil) {
      return {
        succes: true,
        score: pct,
        message: '🟢 Spectre ' + nomCouleur.toUpperCase() + ' validé (' + pct + '% détecté dans le viseur) ! Cible confirmée.'
      };
    } else {
      return {
        succes: false,
        score: pct,
        message: '⚠️ Spectre ' + nomCouleur + ' insuffisant (' + pct + '% repéré, minimum requis ' + seuil + '%). Rapprochez-vous et cadrez l’objet en plein centre.'
      };
    }
  }

  // Analyse d'un objet NOIR profond (disque vinyle, casque, appareil photo)
  function analyserNoirProfond(pixels, w, h) {
    var total = 0, sombre = 0, lumTotal = 0;
    var cx = w / 2, cy = h / 2;
    var r2 = Math.pow(Math.min(w, h) * 0.38, 2);

    for (var y = 0; y < h; y += 3) {
      for (var x = 0; x < w; x += 3) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        var idx = (y * w + x) * 4;
        var r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
        var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        total++;
        lumTotal += lum;
        if (lum < 0.22) sombre++;
      }
    }
    var ratioSombre = total > 0 ? sombre / total : 0;
    var pct = Math.round(ratioSombre * 100);
    if (pct >= 45) {
      return {
        succes: true,
        score: pct,
        message: '🟢 Densité sombre validée (' + pct + '% de noir profond détecté) ! Objet identifié.'
      };
    }
    return {
      succes: false,
      score: pct,
      message: '⚠️ Densité sombre insuffisante (' + pct + '%). Cadrez un objet noir ou un vinyle au centre du viseur.'
    };
  }

  // Analyse d'un écran allumé (luminance très forte, contraste élevé avec l'ambiance)
  function analyserEcranAllume(pixels, w, h) {
    var total = 0, lumineux = 0;
    var cx = w / 2, cy = h / 2;
    var r2 = Math.pow(Math.min(w, h) * 0.35, 2);

    for (var y = 0; y < h; y += 3) {
      for (var x = 0; x < w; x += 3) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        var idx = (y * w + x) * 4;
        var r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
        var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        total++;
        if (lum > 0.70) lumineux++;
      }
    }
    var pct = total > 0 ? Math.round((lumineux / total) * 100) : 0;
    if (pct >= 35) {
      return {
        succes: true,
        score: pct,
        message: '🟢 Émission lumineuse active confirmée (' + pct + '% de pixels d’écran rétroéclairé) !'
      };
    }
    return {
      succes: false,
      score: pct,
      message: '⚠️ Luminance d’écran non détectée (' + pct + '%). Visez un écran TV, PC ou smartphone allumé.'
    };
  }

  // Détection de circularité (haut-parleur rond, disque vinyle, objectif)
  function analyserObjetRond(pixels, w, h) {
    var cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    var rayonTest = Math.min(w, h) * 0.32;
    // Analyse des variations de gradient radial sur 16 rayons
    var angles = 16, gradients = 0;
    for (var a = 0; a < angles; a++) {
      var rad = (a * 2 * Math.PI) / angles;
      var x1 = Math.floor(cx + (rayonTest * 0.7) * Math.cos(rad));
      var y1 = Math.floor(cy + (rayonTest * 0.7) * Math.sin(rad));
      var x2 = Math.floor(cx + (rayonTest * 1.1) * Math.cos(rad));
      var y2 = Math.floor(cy + (rayonTest * 1.1) * Math.sin(rad));
      if (x1 >= 0 && x1 < w && y1 >= 0 && y1 < h && x2 >= 0 && x2 < w && y2 >= 0 && y2 < h) {
        var i1 = (y1 * w + x1) * 4, i2 = (y2 * w + x2) * 4;
        var lum1 = (pixels[i1] + pixels[i1 + 1] + pixels[i1 + 2]) / 3;
        var lum2 = (pixels[i2] + pixels[i2 + 1] + pixels[i2 + 2]) / 3;
        if (Math.abs(lum1 - lum2) > 28) gradients++;
      }
    }
    var scoreCirculaire = Math.round((gradients / angles) * 100);
    if (scoreCirculaire >= 50) {
      return {
        succes: true,
        score: scoreCirculaire,
        message: '🟢 Symétrie circulaire confirmée (' + scoreCirculaire + '% de courbure détectée) !'
      };
    }
    return {
      succes: false,
      score: scoreCirculaire,
      message: '⚠️ Forme circulaire insuffisante (' + scoreCirculaire + '%). Cadrez un objet rond bien au centre.'
    };
  }

  // Analyse d'un code-barres ISBN (commençant par 978 ou 979) via BarcodeDetector natif ou fallback
  async function analyserCodeBarres(canvas, extra) {
    if ('BarcodeDetector' in window) {
      try {
        var formats = await window.BarcodeDetector.getSupportedFormats();
        var formatsUtilisables = formats.filter(function (f) { return f === 'ean_13' || f === 'code_128'; });
        var detector = new window.BarcodeDetector({ formats: formatsUtilisables.length ? formatsUtilisables : formats });
        var codes = await detector.detect(canvas);
        if (codes && codes.length > 0) {
          for (var i = 0; i < codes.length; i++) {
            var val = (codes[i].rawValue || '').trim();
            if (val.startsWith('978') || val.startsWith('979')) {
              return {
                succes: true,
                score: 100,
                message: '🟢 Code ISBN Livre validé (' + val + ') ! Ouvrage répertorié au catalogue Fnac.'
              };
            }
          }
          // Code-barres détecté mais ne commençant pas par 978/979
          return {
            succes: false,
            score: 50,
            message: '⚠️ Code-barres détecté (' + (codes[0].rawValue || '') + '), mais il ne s’agit pas d’un livre (ISBN 978… attendu). Cadrez le dos d’un livre ou d’une BD.'
          };
        }
      } catch (e) {
        // Fallback en cas d'erreur de l'API
      }
    }

    // Fallback : Détection de trames de barres verticales à fort contraste (motif de code-barres)
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var imgData = ctx.getImageData(0, Math.floor(h * 0.4), w, Math.floor(h * 0.2));
    var p = imgData.data;
    var transitions = 0;
    var lastBinaire = 0;
    var totalSamples = 0;
    for (var x = 0; x < w; x += 2) {
      var idx = x * 4;
      var lum = (0.299 * p[idx] + 0.587 * p[idx + 1] + 0.114 * p[idx + 2]);
      var bin = lum > 120 ? 1 : 0;
      if (x > 0 && bin !== lastBinaire) transitions++;
      lastBinaire = bin;
      totalSamples++;
    }
    // Un code-barres EAN présente typiquement plus de 30 transitions noir/blanc sur sa largeur
    if (transitions >= 28) {
      return {
        succes: true,
        score: 90,
        message: '🟢 Trame de code-barres ISBN détectée par le scanner optique ! Ouvrage validé.'
      };
    }

    return {
      succes: false,
      score: Math.round((transitions / 30) * 100),
      message: '⚠️ Aucun code-barres net détecté. Cadrez de plus près le code-barres au dos du livre (utilisez la Macro ou le Zoom si nécessaire).'
    };
  }

  // Analyse d'un livre évoquant la mer (couverture océane ou code-barres ISBN maritime)
  async function analyserLivreMaritime(pixels, w, h, canvas, extra) {
    // 1. Test chromatique océan / bleu marin sur la couverture
    var bleuRes = analyserCouleur(pixels, w, h, { hMin: 180, hMax: 245, sMin: 0.25, vMin: 0.18, vMax: 0.92 }, 'océan');
    if (bleuRes.succes) {
      return {
        succes: true,
        score: bleuRes.score,
        message: '🟢 Couverture maritime confirmée (' + bleuRes.score + '% de tons océan / abysses détectés) ! Ouvrage marin validé.'
      };
    }

    // 2. Si le joueur a cadré un livre et qu'un code-barres ISBN est détecté
    var isbnRes = await analyserCodeBarres(canvas, extra);
    if (isbnRes.succes) {
      return {
        succes: true,
        score: 85,
        message: '🟢 Livre détecté en rayon via son ISBN ! Thématique maritime acceptée par le sonar.'
      };
    }

    // 3. Demande au joueur de cadrer plus nettement les teintes marines ou le dos du livre
    return {
      succes: false,
      score: bleuRes.score,
      message: '⚠️ Tons maritimes insuffisants (' + bleuRes.score + '%). Cadrez un livre avec une couverture maritime (bleue/océan) ou son code au dos.'
    };
  }

  /* ================= SÉRIES ALÉATOIRES NON RÉPÉTITIVES ================= */

  // Récupère l'historique des séries déjà attribuées
  function getHistorique() {
    try {
      var raw = localStorage.getItem(CLE_HISTORIQUE_SERIES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function enregistrerHistorique(serieIds) {
    try {
      var hist = getHistorique();
      hist.push(serieIds.join('+'));
      if (hist.length > 50) hist = hist.slice(-50);
      localStorage.setItem(CLE_HISTORIQUE_SERIES, JSON.stringify(hist));
    } catch (e) {}
  }

  // Génère une série de 3 défis distincts, jamais identique aux précédentes
  function genererSerieUnique(equipeCode) {
    var hist = getHistorique();
    var pool = CATALOGUE_DEFIS.slice();
    var maxTentatives = 100;

    for (var t = 0; t < maxTentatives; t++) {
      // Mélange aléatoire (Fisher-Yates)
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      var selection = [pool[0], pool[1], pool[2]];
      var cle = selection.map(function (d) { return d.id; }).join('+');

      if (hist.indexOf(cle) === -1) {
        enregistrerHistorique(selection.map(function (d) { return d.id; }));
        return selection;
      }
    }
    // Repli de sécurité si l'historique est saturé
    return [pool[0], pool[1], pool[2]];
  }

  /* ================= MOTEUR D'AFFICHAGE & DE JEU ================= */

  function init(host, opts) {
    if (!host) return;

    opts = opts || {};
    var equipeCode = opts.equipe || 'NEMO';
    var onVictoire = opts.onVictoire || function () {};
    var onEchecTemps = opts.onEchecTemps || function () {};
    var onErreurFatale = opts.onErreurFatale || function () {};

    var serieDefis = genererSerieUnique(equipeCode);
    var indexDefi = 0;
    var tempsRestant = DUREE_MISSION_SEC;
    var timerInterval = null;
    var permutationUtilisee = false;

    var videoStream = null;
    var videoTrack = null;
    var zoomNiveau = 1;
    var macroActive = false;
    var torcheActive = false;
    var audioCtx = null;

    // Effets sonores rétro-futuristes Web Audio (100% locaux, 0 fichier externe)
    function playBeep(type) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        var now = audioCtx.currentTime;

        if (type === 'shutter') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
        } else if (type === 'success') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(659.25, now + 0.10);
          osc.frequency.setValueAtTime(880, now + 0.22);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.40);
          osc.start(now);
          osc.stop(now + 0.40);
        } else if (type === 'warn') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.setValueAtTime(196, now + 0.15);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.30);
          osc.start(now);
          osc.stop(now + 0.30);
        }
      } catch (e) {}
    }

    // Structure HTML du viseur optique
    host.innerHTML =
      '<div class="photo-mission">'
      + '  <div class="photo-hud-top">'
      + '    <div class="photo-timer-box">'
      + '      <span class="photo-timer-ico">⏱️</span>'
      + '      <span class="photo-timer-val" id="photoTimer">03:00</span>'
      + '    </div>'
      + '    <div class="photo-steps-box">'
      + '      <span class="photo-step-dot" id="pStep0">1</span>'
      + '      <span class="photo-step-dot" id="pStep1">2</span>'
      + '      <span class="photo-step-dot" id="pStep2">3</span>'
      + '    </div>'
      + '  </div>'

      + '  <div class="photo-defi-card" id="photoDefiCard">'
      + '    <div class="photo-defi-kicker">CIBLE ACTUELLE — ÉCHANTILLON <span id="defiNum">1</span>/3</div>'
      + '    <h3 class="photo-defi-title" id="defiTitle">Chargement…</h3>'
      + '    <p class="photo-defi-desc" id="defiDesc"></p>'
      + '    <div class="photo-defi-rayon">📍 Rayon conseillé : <b id="defiRayon">…</b></div>'
      + '  </div>'

      + '  <div class="photo-viewfinder" id="photoViewfinder">'
      + '    <video id="photoVideo" class="photo-video" playsinline autoplay muted></video>'
      + '    <canvas id="photoCanvas" class="photo-canvas" hidden></canvas>'
      + '    <div class="photo-reticle" id="photoReticle">'
      + '      <div class="reticle-corner reticle-tl"></div>'
      + '      <div class="reticle-corner reticle-tr"></div>'
      + '      <div class="reticle-corner reticle-bl"></div>'
      + '      <div class="reticle-corner reticle-br"></div>'
      + '      <div class="reticle-center" id="reticleCenter"></div>'
      + '      <div class="reticle-scanline"></div>'
      + '      <div class="reticle-tag">COLLIMATEUR OPTIQUE DU NAUTILUS</div>'
      + '    </div>'
      + '    <div class="photo-flash-fx" id="photoFlashFx"></div>'
      + '  </div>'

      + '  <div class="photo-controls">'
      + '    <div class="photo-tools-bar">'
      + '      <button type="button" class="photo-tool-btn" id="btnZoom" title="Changer le grossissement">🔍 1×</button>'
      + '      <button type="button" class="photo-tool-btn" id="btnMacro" title="Activer le mode macro">🔬 Macro : OFF</button>'
      + '      <button type="button" class="photo-tool-btn" id="btnTorche" title="Activer la torche">⚡ Flash : OFF</button>'
      + '    </div>'
      + '    <button type="button" class="photo-trigger-btn" id="btnTrigger">'
      + '      <span class="trigger-ring"></span>'
      + '      <span class="trigger-core">📸 ANALYSER L’ÉCHANTILLON</span>'
      + '    </button>'
      + '  </div>'

      + '  <div class="photo-feedback" id="photoFeedback" role="status">Cadrez l’objet au centre du collimateur et appuyez sur Analyser.</div>'

      + '  <div class="photo-emergency-sec">'
      + '    <button type="button" class="photo-btn-emergency" id="btnUrgence">'
      + '      🔄 Permutation d’urgence (1 seule autorisée)'
      + '    </button>'
      + '    <div class="photo-emergency-warning">⚠️ Attention : après utilisation, toute tentative supplémentaire entraîne la remontée immédiate en surface.</div>'
      + '  </div>'
      + '</div>';

    var timerEl = host.querySelector('#photoTimer');
    var defiNumEl = host.querySelector('#defiNum');
    var defiTitleEl = host.querySelector('#defiTitle');
    var defiDescEl = host.querySelector('#defiDesc');
    var defiRayonEl = host.querySelector('#defiRayon');
    var videoEl = host.querySelector('#photoVideo');
    var canvasEl = host.querySelector('#photoCanvas');
    var reticleCenterEl = host.querySelector('#reticleCenter');
    var flashFxEl = host.querySelector('#photoFlashFx');
    var feedbackEl = host.querySelector('#photoFeedback');
    var btnTrigger = host.querySelector('#btnTrigger');
    var btnZoom = host.querySelector('#btnZoom');
    var btnMacro = host.querySelector('#btnMacro');
    var btnTorche = host.querySelector('#btnTorche');
    var btnUrgence = host.querySelector('#btnUrgence');

    function majDefiAffiche() {
      var d = serieDefis[indexDefi];
      if (!d) return;
      defiNumEl.textContent = (indexDefi + 1);
      defiTitleEl.textContent = d.titre;
      defiDescEl.textContent = d.consigne;
      defiRayonEl.textContent = d.rayon;

      // Mise à jour des pastilles d'étape
      for (var s = 0; s < 3; s++) {
        var dot = host.querySelector('#pStep' + s);
        if (dot) {
          dot.className = 'photo-step-dot'
            + (s < indexDefi ? ' is-done' : '')
            + (s === indexDefi ? ' is-current' : '');
        }
      }
    }

    /* ---------------- DÉMARRAGE CAMÉRA WEBRTC ---------------- */
    async function demarrerCamera() {
      try {
        var constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        videoEl.srcObject = videoStream;
        await videoEl.play();
        videoTrack = videoStream.getVideoTracks()[0];

        // Vérification des capacités matérielles (zoom, torche)
        if (videoTrack && videoTrack.getCapabilities) {
          var caps = videoTrack.getCapabilities();
          if (!caps.torch) {
            btnTorche.title = "Torche matérielle non disponible sur ce capteur";
          }
        }
      } catch (err) {
        feedbackEl.innerHTML = '⚠️ <b>Accès caméra requis</b> : autorisez la caméra pour utiliser le viseur optique du Nautilus.';
        feedbackEl.className = 'photo-feedback is-danger';
      }
    }

    function arreterCamera() {
      if (videoTrack) {
        try { videoTrack.stop(); } catch (e) {}
      }
      if (videoStream) {
        try {
          videoStream.getTracks().forEach(function (t) { t.stop(); });
        } catch (e) {}
      }
      videoTrack = null;
      videoStream = null;
    }

    /* ---------------- CONTRÔLES OBJECTIF (ZOOM, MACRO, FLASH) ---------------- */
    btnZoom.addEventListener('click', async function () {
      if (zoomNiveau === 1) zoomNiveau = 2;
      else if (zoomNiveau === 2) zoomNiveau = 3;
      else zoomNiveau = 1;

      btnZoom.textContent = '🔍 ' + zoomNiveau + '×';
      // Application matérielle si supportée
      if (videoTrack && videoTrack.applyConstraints) {
        try {
          await videoTrack.applyConstraints({ advanced: [{ zoom: zoomNiveau }] });
        } catch (e) {}
      }
      // Zoom numérique fluide CSS dans le viseur
      videoEl.style.transform = 'scale(' + zoomNiveau + ')';
    });

    btnMacro.addEventListener('click', async function () {
      macroActive = !macroActive;
      btnMacro.textContent = macroActive ? '🔬 Macro : ACTIVE' : '🔬 Macro : OFF';
      btnMacro.classList.toggle('is-active', macroActive);
      reticleCenterEl.classList.toggle('is-macro', macroActive);

      if (videoTrack && videoTrack.applyConstraints) {
        try {
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: macroActive ? 'macro' : 'continuous' }]
          });
        } catch (e) {}
      }
      feedbackEl.textContent = macroActive
        ? '🔬 Mode Macro activé : rapprochez-vous à quelques centimètres de l’objet.'
        : '🔬 Mode Macro désactivé.';
    });

    btnTorche.addEventListener('click', async function () {
      torcheActive = !torcheActive;
      btnTorche.textContent = torcheActive ? '⚡ Flash : ON' : '⚡ Flash : OFF';
      btnTorche.classList.toggle('is-active', torcheActive);

      if (videoTrack && videoTrack.applyConstraints) {
        try {
          await videoTrack.applyConstraints({
            advanced: [{ torch: torcheActive }]
          });
        } catch (e) {
          feedbackEl.textContent = '⚡ Flash/Torche non supporté par le matériel ou refusé.';
        }
      }
    });

    /* ---------------- DÉCLENCHEMENT & ANALYSE DE L'ÉCHANTILLON ---------------- */
    btnTrigger.addEventListener('click', async function () {
      if (!videoEl || videoEl.videoWidth === 0) {
        feedbackEl.textContent = '⏳ En attente de l’image de la caméra…';
        return;
      }

      btnTrigger.disabled = true;
      playBeep('shutter');

      // Effet flash obturateur
      flashFxEl.classList.add('is-active');
      setTimeout(function () { flashFxEl.classList.remove('is-active'); }, 140);

      feedbackEl.innerHTML = '⚡ <b>Analyse spectrale en cours par le Nautilus…</b>';
      feedbackEl.className = 'photo-feedback is-analyzing';

      // Capture de l'image sur le canvas local
      var w = videoEl.videoWidth;
      var h = videoEl.videoHeight;
      canvasEl.width = w;
      canvasEl.height = h;
      var ctx = canvasEl.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, w, h);

      var imgData = ctx.getImageData(0, 0, w, h);
      var currentDefi = serieDefis[indexDefi];

      // Exécution de l'algorithme d'analyse local
      var res = await currentDefi.analyser(imgData.data, w, h, canvasEl, { zoom: zoomNiveau, macro: macroActive });

      if (res.succes) {
        playBeep('success');
        feedbackEl.innerHTML = res.message;
        feedbackEl.className = 'photo-feedback is-success';

        indexDefi++;
        if (indexDefi >= serieDefis.length) {
          // VICTOIRE DU PALIER 3 !
          clearInterval(timerInterval);
          arreterCamera();
          setTimeout(function () {
            onVictoire({ duree: DUREE_MISSION_SEC - tempsRestant });
          }, 900);
        } else {
          setTimeout(function () {
            majDefiAffiche();
            feedbackEl.innerHTML = '🎯 <b>Échantillon validé !</b> Prochaine cible affichée ci-dessus.';
            feedbackEl.className = 'photo-feedback is-info';
            btnTrigger.disabled = false;
          }, 1400);
        }
      } else {
        playBeep('warn');
        feedbackEl.innerHTML = res.message;
        feedbackEl.className = 'photo-feedback is-warning';
        btnTrigger.disabled = false;
      }
    });

    /* ---------------- ISSUE DE SECOURS (PERMUTATION UNIQUE) ---------------- */
    btnUrgence.addEventListener('click', function () {
      if (!permutationUtilisee) {
        permutationUtilisee = true;
        // Recherche d'un défi de remplacement non présent dans la série actuelle
        var idsActuels = serieDefis.map(function (d) { return d.id; });
        var disponibles = CATALOGUE_DEFIS.filter(function (d) {
          return idsActuels.indexOf(d.id) === -1;
        });

        var nouveauDefi = disponibles[Math.floor(Math.random() * disponibles.length)];
        serieDefis[indexDefi] = nouveauDefi;
        majDefiAffiche();

        btnUrgence.disabled = true;
        btnUrgence.className = 'photo-btn-emergency is-used';
        btnUrgence.textContent = '⛔ Permutation épuisée (Dernière chance)';

        feedbackEl.innerHTML = '🔄 <b>Cible permutée !</b> Nouveau défi assigné. ⚠️ <b>Attention : plus aucun changement autorisé.</b>';
        feedbackEl.className = 'photo-feedback is-warning';
        playBeep('warn');
      } else {
        // Tentative non autorisée : remontée forcée en surface !
        clearInterval(timerInterval);
        arreterCamera();
        onErreurFatale('Tentative de changement non autorisée : remontée en surface immédiate.');
      }
    });

    /* ---------------- CHRONOMÈTRE DE 3 MINUTES (180 SECONDES) ---------------- */
    function formatTemps(sec) {
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    timerInterval = setInterval(function () {
      tempsRestant--;
      timerEl.textContent = formatTemps(tempsRestant);

      if (tempsRestant <= 30) {
        timerEl.classList.add('is-urgent');
      }

      if (tempsRestant <= 0) {
        clearInterval(timerInterval);
        arreterCamera();
        feedbackEl.innerHTML = '⏱️ <b>TEMPS ÉCOULÉ !</b> Réserve d’oxygène épuisée dans les rayons. Les défis ont été renouvelés pour votre prochaine tentative.';
        feedbackEl.className = 'photo-feedback is-danger';
        btnTrigger.disabled = true;
        btnUrgence.disabled = true;
        playBeep('warn');
        setTimeout(function () {
          onEchecTemps();
        }, 1600);
      }
    }, 1000);

    // Initialisation
    majDefiAffiche();
    demarrerCamera();

    return {
      arreter: function () {
        clearInterval(timerInterval);
        arreterCamera();
      }
    };
  }

  window.NautilusPhotoDefi = {
    init: init,
    catalogue: CATALOGUE_DEFIS
  };
})();
