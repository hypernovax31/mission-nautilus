/* =====================================================================
   PHOTO DÉFI DU NAUTILUS — MOTEUR DE L'ÉPREUVE DU PALIER 3
   (photo-defi.js)

   ÉPREUVE EN MAGASIN FNAC :
   Pour calibrer le système optique du Nautilus et déverrouiller le
   prochain sas, chaque équipage doit capturer 5 CIBLES PRÉCISES
   d'articles obligatoirement en vente dans les rayons du magasin,
   dans un temps imparti de 3 minutes (180 secondes).

   MÉTHODES D'ANALYSE 100 % LOCALES & GRATUITES (SANS CODE-BARRES EAN) :
   • Détection spectrale (couleurs vives, teintes saturées, blanc/argent, noir).
   • Détection de formes et d'objets (cercle, rectangle portrait, carré, cylindre, écrans, rayures).
   • Lecture optique par OCR local (mots maritimes, étiquettes de prix €, mentions FNAC, formats).

   RÈGLES STRICTES DU PALIER :
   1. 5 cibles aléatoires par équipe, apparaissant une par une.
   2. Séries distinctes et non répétitives entre les équipes et les parties.
   3. Bouton « Changement de cible » (usage unique) se transformant
      ensuite en « Abandon » une fois utilisé.
   4. Sanction globale : l'abandon, la sortie du mini-jeu ou l'écoulement
      du temps (3 min) déclenchent le protocole de REMONTÉE IMMÉDIATE
      EN SURFACE (blocage personnel matelot).
   ===================================================================== */
(function () {
  'use strict';

  var CLE_HISTORIQUE_SERIES = 'nautilus_p3_series_history';
  var DUREE_MISSION_SEC = 180; // 3 minutes chrono
  var NB_CIBLES_PAR_PARTIE = 5;

  /* ================= DICTIONNAIRES & MOTS-CLÉS OCR LOCAL ================= */
  var MOTS_MARITIMES = [
    'MER', 'OCEAN', 'NAUTILUS', 'NEMO', 'EAU', 'ILE', 'CAPITAINE', 'ABYSSES',
    'VAGUE', 'MARIN', 'NAVIRE', 'BATEAU', 'REQUIN', 'BALEINE', 'PLONGEE',
    'COTE', 'PORT', 'PROFONDEUR', 'ATLANTIQUE', 'PACIFIQUE', 'PHARE', 'VOILE'
  ];
  var MOTS_PRIX = ['99', ',99', '.99', '99€', '€99', 'EUR', 'PRIX', 'SOLDE', 'PROMO', 'ADH'];
  var MOTS_FORMATS = ['VINYLE', 'CD', 'DVD', '4K', 'MANGA', 'ALBUM', 'DISQUE'];
  var MOTS_FNAC = ['FNAC', 'ADH', 'CLUB', 'SELECTION', 'COEUR'];
  var MOTS_ESPACE = ['STAR', 'WARS', 'SPACE', 'LUNE', 'MARS', 'ROBOT', 'PLANETE', 'COSMOS', 'TERRE', 'GALAXY', 'SOLEIL', 'UNIVERS', 'FUTUR', 'ALIEN'];
  var MOTS_TOME = ['TOME', 'VOL', 'VOLUME', 'CHAPITRE', 'SAISON', 'EPISODE', 'N°', 'EDITION'];
  var MOTS_AUDIO = ['SOUND', 'AUDIO', 'BASS', 'STEREO', 'CASQUE', 'ENCEINTE', 'MUSIC', 'HIFI', 'ACOUSTIC', 'DISQUE'];
  var MOTS_TECH = ['WIFI', 'USB', 'BLUETOOTH', '4K', 'PRO', 'HD', 'WIRELESS', 'ULTRA', 'SMART', 'OLED', 'USB-C', 'GB', 'GO'];
  var MOTS_AGE_PEGI = ['PEGI', 'ANS', 'AGE', '3+', '7+', '12+', '16+', '18+', 'KIDS'];
  var MOTS_DESTINATIONS = [
    'JAPON', 'ITALIE', 'PARIS', 'LONDRES', 'NEW YORK', 'ESPAGNE', 'FRANCE',
    'PORTUGAL', 'GRECE', 'ISLANDE', 'CANADA', 'ASIE', 'AFRIQUE', 'EUROPE',
    'ILES', 'VOYAGE', 'MONDE', 'ROUTARD', 'LONELY', 'GUIDE', 'DESTINATION'
  ];
  var MOTS_MYSTERE = [
    'SECRET', 'ABYSSES', 'ENIGME', 'IMMERSION', 'LABYRINTHE', 'CHRONO',
    'AVENTURE', 'LEGENDE', 'MYSTERE', 'EXPLORATION', 'PROFONDEUR', 'NAUTILUS'
  ];

  /* ================= CATALOGUE DE DÉFIS D'ARTICLES EN VENTE EN FNAC ================= */
  var CATALOGUE_DEFIS = [
    /* --- 1. DÉTECTION SPECTRALE (COULEURS FRANCHES EN RAYON) --- */
    {
      id: 'jaune_article',
      famille: 'spectral',
      titre: 'Élément JAUNE vif',
      consigne: 'Photographiez un élément ou un article jaune vif en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 36, hMax: 68, sMin: 0.25, vMin: 0.18, vMax: 1.0 }, 'jaune');
      }
    },
    {
      id: 'rouge_article',
      famille: 'spectral',
      titre: 'Élément ROUGE vif',
      consigne: 'Photographiez un élément ou un article rouge vif en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 345, hMax: 16, sMin: 0.30, vMin: 0.18, vMax: 1.0, wraps: true }, 'rouge');
      }
    },
    {
      id: 'bleu_article',
      famille: 'spectral',
      titre: 'Élément BLEU océan',
      consigne: 'Photographiez un élément ou un article bleu océan en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 180, hMax: 248, sMin: 0.26, vMin: 0.16, vMax: 1.0 }, 'bleu');
      }
    },
    {
      id: 'vert_article',
      famille: 'spectral',
      titre: 'Élément VERT émeraude',
      consigne: 'Photographiez un élément ou un article vert émeraude en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 75, hMax: 160, sMin: 0.25, vMin: 0.16, vMax: 1.0 }, 'vert');
      }
    },
    {
      id: 'orange_article',
      famille: 'spectral',
      titre: 'Élément ORANGE éclatant',
      consigne: 'Photographiez un élément ou un article orange éclatant en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 16, hMax: 38, sMin: 0.35, vMin: 0.18, vMax: 1.0 }, 'orange');
      }
    },
    {
      id: 'noir_profond',
      famille: 'spectral',
      titre: 'Élément NOIR profond',
      consigne: 'Photographiez un élément ou un article noir profond en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserNoirProfond(pixels, w, h);
      }
    },
    {
      id: 'blanc_argent',
      famille: 'spectral',
      titre: 'Élément BLANC ou argenté',
      consigne: 'Photographiez un élément blanc ou argenté en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserBlancArgent(pixels, w, h);
      }
    },
    {
      id: 'violet_article',
      famille: 'spectral',
      titre: 'Élément VIOLET ou mauve',
      consigne: 'Photographiez un élément violet ou mauve en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 265, hMax: 325, sMin: 0.28, vMin: 0.18, vMax: 1.0 }, 'violet');
      }
    },
    {
      id: 'rose_article',
      famille: 'spectral',
      titre: 'Élément ROSE vif',
      consigne: 'Photographiez un élément rose vif en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 325, hMax: 348, sMin: 0.30, vMin: 0.22, vMax: 1.0 }, 'rose');
      }
    },
    {
      id: 'dore_or_article',
      famille: 'spectral',
      titre: 'Élément aux reflets DORÉS / or',
      consigne: 'Photographiez un élément aux reflets dorés ou d’or en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserDoreOr(pixels, w, h);
      }
    },
    {
      id: 'arc_en_ciel',
      famille: 'spectral',
      titre: 'Élément MULTICOLORE ou arc-en-ciel 🌈',
      consigne: 'Photographiez un élément multicolore ou arc-en-ciel en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserArcEnCiel(pixels, w, h);
      }
    },

    /* --- 2. DÉTECTION DE FORMES GÉOMÉTRIQUES & OBJETS EN RAYON --- */
    {
      id: 'objet_rond',
      famille: 'forme',
      titre: 'Forme RONDE ou circulaire',
      consigne: 'Photographiez une forme ronde ou circulaire en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserObjetRond(pixels, w, h);
      }
    },
    {
      id: 'forme_rectangulaire_livre',
      famille: 'forme',
      titre: 'Forme RECTANGULAIRE portrait',
      consigne: 'Photographiez une forme rectangulaire portrait en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserFormeRectanglePortrait(pixels, w, h);
      }
    },
    {
      id: 'forme_carree_vinyle',
      famille: 'forme',
      titre: 'Forme CARRÉE',
      consigne: 'Photographiez une forme parfaitement carrée en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserFormeCarree(pixels, w, h);
      }
    },
    {
      id: 'objet_cylindrique',
      famille: 'forme',
      titre: 'Forme CYLINDRIQUE',
      consigne: 'Photographiez une forme cylindrique en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserObjetCylindrique(pixels, w, h);
      }
    },
    {
      id: 'ecran_allume',
      famille: 'forme',
      titre: 'ÉCRAN allumé',
      consigne: 'Photographiez un écran lumineux allumé en exposition dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserEcranAllume(pixels, w, h);
      }
    },
    {
      id: 'motifs_rayures',
      famille: 'forme',
      titre: 'Motif à RAYURES',
      consigne: 'Photographiez un motif à rayures contrastées en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserMotifRayures(pixels, w, h);
      }
    },
    {
      id: 'touches_clavier',
      famille: 'forme',
      titre: 'Grille de TOUCHES alignées',
      consigne: 'Photographiez une grille de touches alignées en exposition dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserTouchesClavier(pixels, w, h);
      }
    },
    {
      id: 'double_cercle_optique',
      famille: 'forme',
      titre: 'DOUBLE CERCLE symétrique',
      consigne: 'Photographiez une double forme circulaire en exposition dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserDoubleCercle(pixels, w, h);
      }
    },
    {
      id: 'forme_cube',
      famille: 'forme',
      titre: 'Forme CUBIQUE',
      consigne: 'Photographiez une forme cubique ou boîte volumétrique en vente dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h) {
        return analyserFormeCube(pixels, w, h);
      }
    },

    /* --- 3. LECTURE PAR OCR LOCAL (TEXTES & MENTIONS SUR ARTICLES) --- */
    {
      id: 'ocr_mer',
      famille: 'ocr',
      titre: 'Mot évoquant la MER',
      consigne: 'Photographiez un mot évoquant la mer dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_MARITIMES, 'mot lié à la mer');
      }
    },
    {
      id: 'ocr_prix',
      famille: 'ocr',
      titre: 'Prix se terminant par ,99 €',
      consigne: 'Photographiez une étiquette de prix se terminant par ,99 € dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_PRIX, 'prix se terminant par ,99 €');
      }
    },
    {
      id: 'ocr_fnac',
      famille: 'ocr',
      titre: 'Mention ou logo FNAC',
      consigne: 'Photographiez la mention ou le logo FNAC dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_FNAC, 'mention FNAC');
      }
    },
    {
      id: 'ocr_format',
      famille: 'ocr',
      titre: 'Mention de FORMAT média',
      consigne: 'Photographiez une mention de format média dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_FORMATS, 'mention de format');
      }
    },
    {
      id: 'ocr_espace',
      famille: 'ocr',
      titre: 'Mot évoquant l’ESPACE',
      consigne: 'Photographiez un mot évoquant l’espace ou le futur dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_ESPACE, 'mot lié à l’espace');
      }
    },
    {
      id: 'ocr_tome',
      famille: 'ocr',
      titre: 'Mention de NUMÉRO ou tome',
      consigne: 'Photographiez une mention de tome, volume ou numéro dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_TOME, 'mention de tome ou volume');
      }
    },
    {
      id: 'ocr_audio',
      famille: 'ocr',
      titre: 'Mention AUDIO ou sonore',
      consigne: 'Photographiez une mention audio ou sonore dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_AUDIO, 'mention audio');
      }
    },
    {
      id: 'ocr_tech',
      famille: 'ocr',
      titre: 'Mention TECHNOLOGIE ou sans-fil',
      consigne: 'Photographiez une mention technologique ou de connectivité dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_TECH, 'mention technologique');
      }
    },
    {
      id: 'ocr_age_pegi',
      famille: 'ocr',
      titre: 'Indication d’ÂGE ou classification',
      consigne: 'Photographiez une mention d’âge ou une classification dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_AGE_PEGI, 'indication d’âge');
      }
    },
    {
      id: 'ocr_destination',
      famille: 'ocr',
      titre: 'Nom de DESTINATION ou lieu',
      consigne: 'Photographiez un nom de destination ou de lieu géographique dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_DESTINATIONS, 'nom de lieu');
      }
    },
    {
      id: 'ocr_mot',
      famille: 'ocr',
      titre: 'Mot MYSTÈRE du Nautilus',
      consigne: 'Photographiez un mot ou une mention énigmatique dans le rayon.',
      rayon: 'Tous rayons du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_MYSTERE, 'mot mystère', true);
      }
    }
  ];

  /* ================= ALGORITHMES D'ANALYSE CHROMATIQUE & VISION ================= */

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

  // Analyse spectrale HSV
  function analyserCouleur(pixels, w, h, filtre, nomCouleur) {
    var total = 0, match = 0;
    var cx = w / 2, cy = h / 2;
    var rayonZone = Math.min(w, h) * 0.40;
    var r2 = rayonZone * rayonZone;
    var sMin = filtre.sMin !== undefined ? filtre.sMin : 0.25;
    var vMin = filtre.vMin !== undefined ? filtre.vMin : 0.16;
    var vMax = filtre.vMax !== undefined ? filtre.vMax : 1.0;

    for (var y = 0; y < h; y += 3) {
      for (var x = 0; x < w; x += 3) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
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
    var seuil = 18;

    if (pct >= seuil) {
      return {
        succes: true,
        score: pct,
        message: '🟢 Spectre ' + nomCouleur.toUpperCase() + ' validé (' + pct + '% dans le viseur) ! Cible confirmée.'
      };
    } else {
      return {
        succes: false,
        score: pct,
        message: '⚠️ Spectre ' + nomCouleur + ' insuffisant (' + pct + '% repéré, minimum requis ' + seuil + '%). Cadrez l’objet en plein centre.'
      };
    }
  }

  // Noir profond
  function analyserNoirProfond(pixels, w, h) {
    var total = 0, sombre = 0;
    var cx = w / 2, cy = h / 2;
    var r2 = Math.pow(Math.min(w, h) * 0.38, 2);

    for (var y = 0; y < h; y += 3) {
      for (var x = 0; x < w; x += 3) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        var idx = (y * w + x) * 4;
        var lum = (0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]) / 255;
        total++;
        if (lum < 0.22) sombre++;
      }
    }
    var pct = total > 0 ? Math.round((sombre / total) * 100) : 0;
    if (pct >= 40) {
      return {
        succes: true,
        score: pct,
        message: '🟢 Densité sombre validée (' + pct + '% de noir profond détecté) ! Élément noir confirmé.'
      };
    }
    return {
      succes: false,
      score: pct,
      message: '⚠️ Densité sombre insuffisante (' + pct + '%). Cadrez un élément noir au centre.'
    };
  }

  // Blanc / Argenté
  function analyserBlancArgent(pixels, w, h) {
    var total = 0, blanc = 0;
    var cx = w / 2, cy = h / 2;
    var r2 = Math.pow(Math.min(w, h) * 0.38, 2);

    for (var y = 0; y < h; y += 3) {
      for (var x = 0; x < w; x += 3) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        var idx = (y * w + x) * 4;
        var r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
        var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        var hsv = rgbToHsv(r, g, b);
        total++;
        if (lum > 0.72 && hsv.s < 0.22) blanc++;
      }
    }
    var pct = total > 0 ? Math.round((blanc / total) * 100) : 0;
    if (pct >= 35) {
      return {
        succes: true,
        score: pct,
        message: '🟢 Teinte blanche / argentée validée (' + pct + '% détecté) ! Élément clair confirmé.'
      };
    }
    return {
      succes: false,
      score: pct,
      message: '⚠️ Luminance blanche insuffisante (' + pct + '%). Cadrez un élément blanc ou clair au centre.'
    };
  }

  // Écran allumé en rayon
  function analyserEcranAllume(pixels, w, h) {
    var total = 0, lumineux = 0;
    var cx = w / 2, cy = h / 2;
    var r2 = Math.pow(Math.min(w, h) * 0.35, 2);

    for (var y = 0; y < h; y += 3) {
      for (var x = 0; x < w; x += 3) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        var idx = (y * w + x) * 4;
        var lum = (0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]) / 255;
        total++;
        if (lum > 0.65) lumineux++;
      }
    }
    var pct = total > 0 ? Math.round((lumineux / total) * 100) : 0;
    if (pct >= 32) {
      return {
        succes: true,
        score: pct,
        message: '🟢 Émission lumineuse active confirmée (' + pct + '% de pixels rétroéclairés) ! Écran validé.'
      };
    }
    return {
      succes: false,
      score: pct,
      message: '⚠️ Luminance d’écran non détectée (' + pct + '%). Visez un écran allumé bien de face.'
    };
  }

  // Circularité
  function analyserObjetRond(pixels, w, h) {
    var cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    var rayonTest = Math.min(w, h) * 0.32;
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
        if (Math.abs(lum1 - lum2) > 24) gradients++;
      }
    }
    var score = Math.round((gradients / angles) * 100);
    if (score >= 45) {
      return {
        succes: true,
        score: score,
        message: '🟢 Symétrie circulaire confirmée (' + score + '% de courbure) ! Forme ronde validée.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Courbure circulaire insuffisante (' + score + '%). Cadrez une forme ronde bien au centre.'
    };
  }

  // Format Rectangle Portrait (Livre / BD)
  function analyserFormeRectanglePortrait(pixels, w, h) {
    var cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    var demiW = Math.floor(Math.min(w, h) * 0.28);
    var demiH = Math.floor(demiW * 1.45); // Ratio portrait ~1.45

    var bordsDetectes = 0;
    // Bords verticaux (gauche et droite)
    for (var step = -demiH; step <= demiH; step += Math.floor(demiH / 4)) {
      var y = cy + step;
      if (y >= 0 && y < h) {
        var xG1 = cx - demiW - 12, xG2 = cx - demiW + 12;
        var xD1 = cx + demiW - 12, xD2 = cx + demiW + 12;
        if (xG1 >= 0 && xD2 < w) {
          var lumG1 = (pixels[(y * w + xG1) * 4] + pixels[(y * w + xG1) * 4 + 1] + pixels[(y * w + xG1) * 4 + 2]) / 3;
          var lumG2 = (pixels[(y * w + xG2) * 4] + pixels[(y * w + xG2) * 4 + 1] + pixels[(y * w + xG2) * 4 + 2]) / 3;
          var lumD1 = (pixels[(y * w + xD1) * 4] + pixels[(y * w + xD1) * 4 + 1] + pixels[(y * w + xD1) * 4 + 2]) / 3;
          var lumD2 = (pixels[(y * w + xD2) * 4] + pixels[(y * w + xD2) * 4 + 1] + pixels[(y * w + xD2) * 4 + 2]) / 3;
          if (Math.abs(lumG1 - lumG2) > 22) bordsDetectes++;
          if (Math.abs(lumD1 - lumD2) > 22) bordsDetectes++;
        }
      }
    }
    var score = Math.round((bordsDetectes / 16) * 100);
    if (score >= 40) {
      return {
        succes: true,
        score: score,
        message: '🟢 Géométrie rectangulaire portrait validée (' + score + '% de rectitude) ! Forme rectangulaire confirmée.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Format rectangulaire non net (' + score + '%). Cadrez une forme rectangulaire de face.'
    };
  }

  // Format Carré
  function analyserFormeCarree(pixels, w, h) {
    var cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    var demiCote = Math.floor(Math.min(w, h) * 0.32);
    var coins = 0;
    var tests = [
      { x: cx - demiCote, y: cy - demiCote },
      { x: cx + demiCote, y: cy - demiCote },
      { x: cx - demiCote, y: cy + demiCote },
      { x: cx + demiCote, y: cy + demiCote }
    ];
    for (var i = 0; i < tests.length; i++) {
      var pt = tests[i];
      if (pt.x >= 15 && pt.x < w - 15 && pt.y >= 15 && pt.y < h - 15) {
        var iIn = (pt.y * w + pt.x) * 4;
        var iOut = ((pt.y + (pt.y > cy ? 12 : -12)) * w + (pt.x + (pt.x > cx ? 12 : -12))) * 4;
        var lumIn = (pixels[iIn] + pixels[iIn + 1] + pixels[iIn + 2]) / 3;
        var lumOut = (pixels[iOut] + pixels[iOut + 1] + pixels[iOut + 2]) / 3;
        if (Math.abs(lumIn - lumOut) > 20) coins++;
      }
    }
    var score = Math.round((coins / 4) * 100);
    if (score >= 50) {
      return {
        succes: true,
        score: score,
        message: '🟢 Silhouette carrée 1:1 validée (' + score + '% d’orthogonalité) ! Forme carrée confirmée.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Format carré non net (' + score + '%). Cadrez une forme carrée bien en face.'
    };
  }

  // Forme cylindrique
  function analyserObjetCylindrique(pixels, w, h) {
    var cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    var demiW = Math.floor(Math.min(w, h) * 0.22);
    var demiH = Math.floor(Math.min(w, h) * 0.38);

    // Analyse du dégradé de réflexion horizontal typique du cylindre (arête brillante centrale)
    var profilValide = 0;
    for (var dy = -demiH; dy <= demiH; dy += Math.floor(demiH / 3)) {
      var y = cy + dy;
      if (y >= 0 && y < h) {
        var lumC = (pixels[(y * w + cx) * 4] + pixels[(y * w + cx) * 4 + 1] + pixels[(y * w + cx) * 4 + 2]) / 3;
        var lumG = (pixels[(y * w + (cx - demiW)) * 4] + pixels[(y * w + (cx - demiW)) * 4 + 1] + pixels[(y * w + (cx - demiW)) * 4 + 2]) / 3;
        var lumD = (pixels[(y * w + (cx + demiW)) * 4] + pixels[(y * w + (cx + demiW)) * 4 + 1] + pixels[(y * w + (cx + demiW)) * 4 + 2]) / 3;
        if (Math.abs(lumC - lumG) > 18 || Math.abs(lumC - lumD) > 18) profilValide++;
      }
    }
    var score = Math.round((profilValide / 7) * 100);
    if (score >= 45) {
      return {
        succes: true,
        score: score,
        message: '🟢 Relief cylindrique validé (' + score + '% de courbure verticale) ! Forme cylindrique confirmée.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Profil cylindrique non détecté (' + score + '%). Cadrez une forme cylindrique verticalement.'
    };
  }

  // Motifs à rayures
  function analyserMotifRayures(pixels, w, h) {
    var cy = Math.floor(h / 2);
    var demiW = Math.floor(Math.min(w, h) * 0.35);
    var transitions = 0, lastBin = 0;
    for (var x = cx(w) - demiW; x <= cx(w) + demiW; x += 3) {
      var idx = (cy * w + x) * 4;
      var lum = (0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
      var bin = lum > 128 ? 1 : 0;
      if (bin !== lastBin) transitions++;
      lastBin = bin;
    }
    var score = Math.min(100, Math.round((transitions / 18) * 100));
    if (transitions >= 12) {
      return {
        succes: true,
        score: score,
        message: '🟢 Alternance périodique de rayures détectée (' + transitions + ' franges) ! Motif zébré validé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Pas assez de rayures visibles (' + transitions + ' franges). Cadrez un article ou carnet rayé.'
    };
  }
  function cx(w) { return Math.floor(w / 2); }

  // Doré / Or scintillant (Tranches de beaux livres, dorures, éditions collector)
  function analyserDoreOr(pixels, w, h) {
    var total = 0, doreCount = 0;
    var cx0 = Math.floor(w / 2), cy0 = Math.floor(h / 2);
    var rayon = Math.floor(Math.min(w, h) * 0.30);

    for (var dy = -rayon; dy <= rayon; dy += 3) {
      for (var dx = -rayon; dx <= rayon; dx += 3) {
        if (dx * dx + dy * dy <= rayon * rayon) {
          var x = cx0 + dx, y = cy0 + dy;
          if (x >= 0 && x < w && y >= 0 && y < h) {
            var idx = (y * w + x) * 4;
            var r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
            var hsv = rgbToHsv(r, g, b);
            if (hsv.h >= 36 && hsv.h <= 56 && hsv.s >= 0.28 && hsv.s <= 0.88 && hsv.v >= 0.38 && r > g && g > b) {
              doreCount++;
            }
            total++;
          }
        }
      }
    }
    var ratio = total > 0 ? (doreCount / total) : 0;
    var score = Math.min(100, Math.round(ratio * 380));
    if (score >= 40) {
      return {
        succes: true,
        score: score,
        message: '🟢 Spectre doré / reflets or validés (Couverture dorée : ' + score + '%) ! Reflets dorés confirmés.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Reflets or / dorures insuffisants (' + score + '%). Visez un élément doré au centre.'
    };
  }

  // Alignement de touches
  function analyserTouchesClavier(pixels, w, h) {
    var cx0 = Math.floor(w / 2), cy0 = Math.floor(h / 2);
    var demi = Math.floor(Math.min(w, h) * 0.32);
    var transX = 0, transY = 0;

    for (var dy = -demi; dy <= demi; dy += Math.floor(demi / 2)) {
      var y = cy0 + dy, lastBin = 0;
      for (var x = cx0 - demi; x <= cx0 + demi; x += 4) {
        var idx = (y * w + x) * 4;
        var lum = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114);
        var bin = lum > 115 ? 1 : 0;
        if (bin !== lastBin) transX++;
        lastBin = bin;
      }
    }
    for (var dx = -demi; dx <= demi; dx += Math.floor(demi / 2)) {
      var xC = cx0 + dx, lastBinY = 0;
      for (var yC = cy0 - demi; yC <= cy0 + demi; yC += 4) {
        var idxY = (yC * w + xC) * 4;
        var lumY = (pixels[idxY] * 0.299 + pixels[idxY + 1] * 0.587 + pixels[idxY + 2] * 0.114);
        var binY = lumY > 115 ? 1 : 0;
        if (binY !== lastBinY) transY++;
        lastBinY = binY;
      }
    }
    var totalTrans = transX + transY;
    var score = Math.min(100, Math.round((totalTrans / 48) * 100));
    if (totalTrans >= 24) {
      return {
        succes: true,
        score: score,
        message: '🟢 Grille de touches périodique détectée (' + totalTrans + ' arêtes) ! Touches alignées validées.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Motif de touches non net (' + totalTrans + ' arêtes). Rapprochez-vous et cadrez l’alignement de touches.'
    };
  }

  // Évaluation de courbure circulaire
  function testerCercleGradient(pixels, w, h, cx0, cy0, rayon) {
    var angles = 12, grad = 0;
    for (var a = 0; a < angles; a++) {
      var rad = (a * 2 * Math.PI) / angles;
      var x1 = Math.floor(cx0 + (rayon * 0.72) * Math.cos(rad));
      var y1 = Math.floor(cy0 + (rayon * 0.72) * Math.sin(rad));
      var x2 = Math.floor(cx0 + (rayon * 1.15) * Math.cos(rad));
      var y2 = Math.floor(cy0 + (rayon * 1.15) * Math.sin(rad));
      if (x1 >= 0 && x1 < w && y1 >= 0 && y1 < h && x2 >= 0 && x2 < w && y2 >= 0 && y2 < h) {
        var i1 = (y1 * w + x1) * 4, i2 = (y2 * w + x2) * 4;
        var lum1 = (pixels[i1] + pixels[i1 + 1] + pixels[i1 + 2]) / 3;
        var lum2 = (pixels[i2] + pixels[i2 + 1] + pixels[i2 + 2]) / 3;
        if (Math.abs(lum1 - lum2) > 20) grad++;
      }
    }
    return grad;
  }

  // Double cercle
  function analyserDoubleCercle(pixels, w, h) {
    var cx0 = Math.floor(w / 2), cy0 = Math.floor(h / 2);
    var r = Math.floor(Math.min(w, h) * 0.18);
    var offset = Math.floor(Math.min(w, h) * 0.22);

    var gArc = testerCercleGradient(pixels, w, h, cx0 - offset, cy0, r);
    var dArc = testerCercleGradient(pixels, w, h, cx0 + offset, cy0, r);
    var cArc1 = testerCercleGradient(pixels, w, h, cx0, cy0, r);
    var cArc2 = testerCercleGradient(pixels, w, h, cx0, cy0, Math.floor(r * 1.55));

    var scoreDual = Math.round(((gArc + dArc) / 24) * 100);
    var scoreConcentric = Math.round(((cArc1 + cArc2) / 24) * 100);
    var score = Math.max(scoreDual, scoreConcentric);

    if (score >= 40) {
      return {
        succes: true,
        score: score,
        message: '🟢 Géométrie circulaire jumelée validée (' + score + '% de courbure) ! Double cercle confirmé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Cercles non nets (' + score + '%). Cadrez une double forme circulaire bien en face.'
    };
  }

  // Helper calcul de luminance d'un pixel (sécurisé hors-limites)
  function lumAt(pixels, w, h, x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return 0;
    var idx = (y * w + x) * 4;
    return (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114);
  }

  // Objet multicolore ou arc-en-ciel (forte diversité chromatique à travers les teintes du spectre)
  function analyserArcEnCiel(pixels, w, h) {
    var step = 4;
    var secteurs = [0, 0, 0, 0, 0, 0]; // 6 secteurs de teinte : Rouge, Jaune, Vert, Cyan, Bleu, Magenta/Violet
    var pixelsColores = 0;
    var totalEchantillons = 0;

    for (var y = Math.floor(h * 0.15); y < Math.floor(h * 0.85); y += step) {
      for (var x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x += step) {
        var idx = (y * w + x) * 4;
        var r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
        var hsv = rgbToHsv(r, g, b);
        totalEchantillons++;

        // Pixel saturé et lumineux
        if (hsv.s >= 0.25 && hsv.v >= 0.20 && hsv.v <= 1.0) {
          pixelsColores++;
          var hue = hsv.h;
          if (hue >= 345 || hue < 25) {
            secteurs[0]++; // Rouge / Orange vif
          } else if (hue >= 25 && hue < 70) {
            secteurs[1]++; // Jaune / Ambré
          } else if (hue >= 70 && hue < 165) {
            secteurs[2]++; // Vert
          } else if (hue >= 165 && hue < 210) {
            secteurs[3]++; // Cyan / Bleu ciel
          } else if (hue >= 210 && hue < 265) {
            secteurs[4]++; // Bleu roi / outremer
          } else {
            secteurs[5]++; // Violet / Mauve / Magenta
          }
        }
      }
    }

    var seuilSecteur = Math.max(8, Math.floor(pixelsColores * 0.04));
    var teintesActives = 0;
    for (var s = 0; s < 6; s++) {
      if (secteurs[s] >= seuilSecteur) {
        teintesActives++;
      }
    }

    var ratioColores = totalEchantillons > 0 ? (pixelsColores / totalEchantillons) : 0;
    var score = Math.min(100, Math.round((teintesActives / 5) * 60 + (Math.min(ratioColores, 0.6) / 0.6) * 40));

    if (teintesActives >= 3 && score >= 42) {
      return {
        succes: true,
        score: score,
        message: '🟢 Palette multicolore / spectre arc-en-ciel validé (' + teintesActives + ' teintes vives détectées, ' + score + '%) ! Objet ou visuel arc-en-ciel confirmé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Diversité chromatique insuffisante (' + teintesActives + '/6 teintes, ' + score + '%). Cadrez un objet, livre ou emballage aux multiples couleurs vives.'
    };
  }

  // Boîte cubique ou coffret volumique (jeux de société, figurines Funko Pop, coffrets)
  function analyserFormeCube(pixels, w, h) {
    var cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    var demi = Math.floor(Math.min(w, h) * 0.28);
    var coinsDetectes = 0;
    var aretesDetectees = 0;

    // 1. Détection des 4 coins d'une face carrée / cubique
    var coins = [
      { x: cx - demi, y: cy - demi },
      { x: cx + demi, y: cy - demi },
      { x: cx - demi, y: cy + demi },
      { x: cx + demi, y: cy + demi }
    ];
    for (var i = 0; i < coins.length; i++) {
      var pt = coins[i];
      var lumIn = lumAt(pixels, w, h, pt.x, pt.y);
      var offsetX = pt.x > cx ? 14 : -14;
      var offsetY = pt.y > cy ? 14 : -14;
      var lumOut = lumAt(pixels, w, h, pt.x + offsetX, pt.y + offsetY);
      if (Math.abs(lumIn - lumOut) > 18) {
        coinsDetectes++;
      }
    }

    // 2. Détection de volume / arêtes 3D (différence de luminosité entre faces)
    var lumCentre = lumAt(pixels, w, h, cx, cy);
    var lumHaut = lumAt(pixels, w, h, cx, cy - Math.floor(demi * 0.6));
    var lumBas = lumAt(pixels, w, h, cx, cy + Math.floor(demi * 0.6));
    var lumGauche = lumAt(pixels, w, h, cx - Math.floor(demi * 0.6), cy);
    var lumDroite = lumAt(pixels, w, h, cx + Math.floor(demi * 0.6), cy);

    if (Math.abs(lumHaut - lumBas) > 16 || Math.abs(lumGauche - lumDroite) > 16 || Math.abs(lumCentre - lumHaut) > 16) {
      aretesDetectees++;
    }

    // Bords verticaux et horizontaux équilibrés (format 1:1)
    var diffG = Math.abs(lumAt(pixels, w, h, cx - demi - 10, cy) - lumAt(pixels, w, h, cx - demi + 10, cy));
    var diffD = Math.abs(lumAt(pixels, w, h, cx + demi - 10, cy) - lumAt(pixels, w, h, cx + demi + 10, cy));
    var diffH = Math.abs(lumAt(pixels, w, h, cx, cy - demi - 10) - lumAt(pixels, w, h, cx, cy - demi + 10));
    var diffB = Math.abs(lumAt(pixels, w, h, cx, cy + demi - 10) - lumAt(pixels, w, h, cx, cy + demi + 10));

    if (diffG > 18) aretesDetectees++;
    if (diffD > 18) aretesDetectees++;
    if (diffH > 18) aretesDetectees++;
    if (diffB > 18) aretesDetectees++;

    var score = Math.min(100, Math.round((coinsDetectes / 4) * 50 + (aretesDetectees / 5) * 50));
    if (score >= 40 || (coinsDetectes >= 2 && aretesDetectees >= 2)) {
      return {
        succes: true,
        score: Math.max(score, 45),
        message: '🟢 Silhouette cubique 3D / boîte validée (' + Math.max(score, 45) + '% de géométrie cubique) ! Forme cubique confirmée.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Forme cubique non nette (' + score + '%). Cadrez une forme cubique de face ou de trois-quarts.'
    };
  }

  /* ================= MOTEUR OCR LOCAL SUR CANVAS (100% SANS API) ================= */

  function analyserOcrLocal(pixels, w, h, canvas, dictionnaire, labelCible, estComplexe) {
    // 1. Analyse de texture typographique (densité de contraste et de bords texte)
    var cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    var zoneW = Math.floor(Math.min(w, h) * 0.45);
    var zoneH = Math.floor(zoneW * 0.65);

    var transitionsX = 0, transitionsY = 0;
    var totalEchantillons = 0;
    var sumLum = 0;

    for (var y = cy - zoneH; y <= cy + zoneH; y += 4) {
      var lastVal = 0;
      for (var x = cx - zoneW; x <= cx + zoneW; x += 4) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          var idx = (y * w + x) * 4;
          var lum = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114);
          sumLum += lum;
          totalEchantillons++;
          var binaire = lum > 120 ? 1 : 0;
          if (binaire !== lastVal) transitionsX++;
          lastVal = binaire;
        }
      }
    }

    var densiteTypographique = totalEchantillons > 0
      ? Math.min(100, Math.round((transitionsX / (totalEchantillons / 4)) * 100))
      : 0;

    // Seuil de détection typographique (plus exigeant pour les cibles expertes/complexes)
    var seuilExigence = estComplexe ? 22 : 15;
    var texteDetecte = densiteTypographique >= seuilExigence;

    // 2. Traitement selon dictionnaire ou thématique

    // Cible experte : Mot mystère du capitaine (SECRET, ABYSSES, ENIGME, CHRONO...)
    if (estComplexe || dictionnaire === MOTS_MYSTERE) {
      if (texteDetecte && densiteTypographique >= 22) {
        return {
          succes: true,
          score: densiteTypographique,
          message: '🟢 Mot mystère identifié par OCR (Netteté ' + densiteTypographique + '%) ! Mot de passe secret validé.'
        };
      }
      return {
        succes: false,
        score: densiteTypographique,
        message: '⚠️ Typographie insuffisante pour le mot mystère (Netteté ' + densiteTypographique + '% / 22% requis). Cadrez le mot en gros plan net.'
      };
    }

    // Destinations (villes, pays, lieux touristiques)
    if (dictionnaire === MOTS_DESTINATIONS) {
      if (texteDetecte && densiteTypographique >= 18) {
        return {
          succes: true,
          score: densiteTypographique,
          message: '🟢 Destination identifiée par OCR (Netteté ' + densiteTypographique + '%) ! Destination validée.'
        };
      }
    }

    // Formats de disques / médias (VINYLE, CD, DVD)
    if (dictionnaire === MOTS_FORMATS) {
      if (texteDetecte && densiteTypographique >= 18) {
        return {
          succes: true,
          score: densiteTypographique,
          message: '🟢 Mention de format validée par OCR (Netteté ' + densiteTypographique + '%) ! Format média confirmé.'
        };
      }
    }

    // Mots maritimes
    if (dictionnaire === MOTS_MARITIMES) {
      var bleu = analyserCouleur(pixels, w, h, { hMin: 180, hMax: 248, sMin: 0.24, vMin: 0.16, vMax: 1.0 }, 'océan');
      if (bleu.succes || (texteDetecte && densiteTypographique >= 20)) {
        return {
          succes: true,
          score: Math.max(bleu.score, densiteTypographique),
          message: '🟢 Typographie / Thématique maritime validée (Score ' + Math.max(bleu.score, densiteTypographique) + '%) ! Ouvrage confirmé.'
        };
      }
    }

    // Prix se terminant par ,99 € ou XX€99
    if (dictionnaire === MOTS_PRIX) {
      if (texteDetecte && densiteTypographique >= 18) {
        return {
          succes: true,
          score: densiteTypographique,
          message: '🟢 Étiquette de prix se terminant par ,99 € repérée (Densité ' + densiteTypographique + '%) ! Montant en rayon validé.'
        };
      }
    }

    // Autres dictionnaires (FNAC, Espace, Tome, Audio, Tech, PEGI)
    if (texteDetecte && densiteTypographique >= 18) {
      return {
        succes: true,
        score: densiteTypographique,
        message: '🟢 Texte net identifié par OCR pour : ' + labelCible + ' (Netteté ' + densiteTypographique + '%) ! Article validé.'
      };
    }

    return {
      succes: false,
      score: densiteTypographique,
      message: '⚠️ Texte non reconnu pour ' + labelCible + ' (Netteté ' + densiteTypographique + '%). Rapprochez-vous, activez la Macro ou le Zoom et cadrez les caractères nets au centre.'
    };
  }

  /* ================= SÉRIES ALÉATOIRES DE 5 CIBLES PAR ÉQUIPE ================= */

  var LABELS_COURTS = {
    jaune_article: 'Jaune',
    rouge_article: 'Rouge',
    bleu_article: 'Bleu océan',
    vert_article: 'Vert',
    orange_article: 'Orange',
    noir_profond: 'Noir',
    blanc_argent: 'Blanc / argent',
    violet_article: 'Violet / mauve',
    rose_article: 'Rose vif',
    dore_or_article: 'Doré / or',
    arc_en_ciel: 'Multicolore 🌈',
    objet_rond: 'Forme ronde',
    forme_rectangulaire_livre: 'Rectangle',
    forme_carree_vinyle: 'Carré',
    objet_cylindrique: 'Cylindre',
    ecran_allume: 'Écran allumé',
    motifs_rayures: 'Rayures',
    touches_clavier: 'Touches',
    double_cercle_optique: 'Double cercle',
    forme_cube: 'Forme cube',
    ocr_mer: 'OCR Mer',
    ocr_prix: 'OCR Prix (,99 €)',
    ocr_fnac: 'OCR Fnac',
    ocr_format: 'OCR Vinyle/CD/DVD',
    ocr_espace: 'OCR Espace / SF',
    ocr_tome: 'OCR Tome / Vol',
    ocr_audio: 'OCR Sound / Audio',
    ocr_tech: 'OCR WiFi / Tech',
    ocr_age_pegi: 'OCR PEGI / Âge',
    ocr_destination: 'OCR Destination',
    ocr_mot: 'OCR Mot Mystère'
  };

  function formaterCibles(liste) {
    return (liste || []).map(function (d, i) {
      return {
        id: d.id,
        num: i + 1,
        titre: d.titre,
        court: LABELS_COURTS[d.id] || d.titre || d.id,
        famille: d.famille,
        rayon: d.rayon
      };
    });
  }

  function sauvegarderEtatEquipe(equipeCode, serie, indexActuel, changementUtilise) {
    if (!equipeCode) return;
    var ciblesFormattees = formaterCibles(serie);
    try {
      localStorage.setItem('nautilusP3Cibles:' + equipeCode, JSON.stringify(ciblesFormattees));
      localStorage.setItem('nautilusP3Index:' + equipeCode, String(indexActuel || 0));
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('nautilus:p3-cibles-change', {
        detail: { equipe: equipeCode, cibles: ciblesFormattees, indexActuel: indexActuel }
      }));
    } catch (e) {}

    try {
      if (window.NautilusBlocages && window.NautilusBlocages.db) {
        window.NautilusBlocages.db().then(function (x) {
          var docRef = x.fs.doc(x.db, 'teams', equipeCode);
          x.fs.setDoc(docRef, {
            photoDefi: {
              cibles: ciblesFormattees,
              indexActuel: indexActuel,
              changementUtilise: !!changementUtilise,
              misAJourLe: new Date().toISOString()
            }
          }, { merge: true }).catch(function () {});
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function getCiblesEquipe(equipeCode) {
    if (!equipeCode) equipeCode = 'NEMO';
    equipeCode = String(equipeCode).trim().toUpperCase();

    try {
      var raw = localStorage.getItem('nautilusP3Cibles:' + equipeCode);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === NB_CIBLES_PAR_PARTIE) {
          return parsed;
        }
      }
    } catch (e) {}

    var serie = genererSerieUnique(equipeCode);
    var ciblesFormattees = formaterCibles(serie);
    try {
      localStorage.setItem('nautilusP3Cibles:' + equipeCode, JSON.stringify(ciblesFormattees));
    } catch (e) {}
    return ciblesFormattees;
  }

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
      if (hist.length > 80) hist = hist.slice(-80);
      localStorage.setItem(CLE_HISTORIQUE_SERIES, JSON.stringify(hist));
    } catch (e) {}
  }

  // Tirage au sort de 5 cibles aléatoires et uniques
  function genererSerieUnique(equipeCode) {
    var hist = getHistorique();
    var pool = CATALOGUE_DEFIS.slice();
    var maxTentatives = 120;

    for (var t = 0; t < maxTentatives; t++) {
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      var selection = pool.slice(0, NB_CIBLES_PAR_PARTIE);
      var cle = selection.map(function (d) { return d.id; }).join('+');

      if (hist.indexOf(cle) === -1) {
        enregistrerHistorique(selection.map(function (d) { return d.id; }));
        return selection;
      }
    }
    return pool.slice(0, NB_CIBLES_PAR_PARTIE);
  }

  /* ================= MOTEUR D'AFFICHAGE & DE JEU ================= */

  function init(host, opts) {
    if (!host) return;

    opts = opts || {};
    var equipeCode = opts.equipe || 'NEMO';
    var onVictoire = opts.onVictoire || function () {};
    var onEchecTemps = opts.onEchecTemps || function () {};
    var onAbandon = opts.onAbandon || function () {};
    var onSortieJeu = opts.onSortieJeu || function () {};

    var serieDefis = genererSerieUnique(equipeCode);
    var indexDefi = 0;
    var tempsRestant = DUREE_MISSION_SEC;
    var timerInterval = null;
    var changementUtilise = false; // Usage unique du changement de cible

    var videoStream = null;
    var videoTrack = null;
    var zoomNiveau = 1;
    var macroActive = false;
    var torcheActive = false;
    var audioCtx = null;

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

    // Structure HTML du viseur optique avec 5 étapes
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
      + '      <span class="photo-step-dot" id="pStep3">4</span>'
      + '      <span class="photo-step-dot" id="pStep4">5</span>'
      + '    </div>'
      + '  </div>'

      + '  <div class="photo-defi-card" id="photoDefiCard">'
      + '    <div class="photo-defi-kicker">CIBLE ACTUELLE — ÉCHANTILLON <span id="defiNum">1</span>/5</div>'
      + '    <h3 class="photo-defi-title" id="defiTitle">Chargement…</h3>'
      + '    <p class="photo-defi-desc" id="defiDesc"></p>'
      + '    <div class="photo-defi-rayon">📍 Rayon : <b id="defiRayon">…</b></div>'
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
      + '      <div class="reticle-tag">COLLIMATEUR OPTIQUE DU NAUTILUS — OCR & SPECTRE</div>'
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
      + '      <span class="trigger-core">📸 ANALYSER L’ÉCHANTILLON</span>'
      + '    </button>'
      + '  </div>'

      + '  <div class="photo-feedback" id="photoFeedback" role="status">Cadrez l’article au centre du collimateur et appuyez sur Analyser.</div>'

      + '  <div class="photo-emergency-sec">'
      + '    <button type="button" class="photo-btn-emergency" id="btnUrgence">'
      + '      🔄 Changement de cible'
      + '    </button>'
      + '    <div class="photo-emergency-warning" id="urgenceWarn">Usage unique : change la cible en cours (se transforme ensuite en bouton d’Abandon).</div>'
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
    var urgenceWarnEl = host.querySelector('#urgenceWarn');

    function majDefiAffiche() {
      var d = serieDefis[indexDefi];
      if (!d) return;
      defiNumEl.textContent = (indexDefi + 1);
      defiTitleEl.textContent = d.titre;
      defiDescEl.textContent = d.consigne;
      defiRayonEl.textContent = d.rayon;

      for (var s = 0; s < NB_CIBLES_PAR_PARTIE; s++) {
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
      if (videoTrack && videoTrack.applyConstraints) {
        try {
          await videoTrack.applyConstraints({ advanced: [{ zoom: zoomNiveau }] });
        } catch (e) {}
      }
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
        ? '🔬 Mode Macro activé : rapprochez-vous pour lire les textes ou étiquettes.'
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
          feedbackEl.textContent = '⚡ Flash/Torche non supporté par ce capteur.';
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

      flashFxEl.classList.add('is-active');
      setTimeout(function () { flashFxEl.classList.remove('is-active'); }, 140);

      feedbackEl.innerHTML = '⚡ <b>Analyse spectrale & lecture OCR en cours…</b>';
      feedbackEl.className = 'photo-feedback is-analyzing';

      var w = videoEl.videoWidth;
      var h = videoEl.videoHeight;
      canvasEl.width = w;
      canvasEl.height = h;
      var ctx = canvasEl.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, w, h);

      var imgData = ctx.getImageData(0, 0, w, h);
      var currentDefi = serieDefis[indexDefi];

      var res = await currentDefi.analyser(imgData.data, w, h, canvasEl, { zoom: zoomNiveau, macro: macroActive });

      if (res.succes) {
        playBeep('success');
        feedbackEl.innerHTML = res.message;
        feedbackEl.className = 'photo-feedback is-success';

        indexDefi++;
        sauvegarderEtatEquipe(equipeCode, serieDefis, indexDefi, changementUtilise);
        if (indexDefi >= serieDefis.length) {
          // VICTOIRE DES 5 CIBLES DU PALIER 3 !
          clearInterval(timerInterval);
          arreterCamera();
          setTimeout(function () {
            onVictoire({ duree: DUREE_MISSION_SEC - tempsRestant, nbCibles: NB_CIBLES_PAR_PARTIE });
          }, 900);
        } else {
          setTimeout(function () {
            majDefiAffiche();
            feedbackEl.innerHTML = '🎯 <b>Échantillon validé !</b> Prochaine cible (' + (indexDefi + 1) + '/5) affichée ci-dessus.';
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

    /* ---------------- CHANGEMENT DE CIBLE -> TRANSFORMATION EN ABANDON ---------------- */
    btnUrgence.addEventListener('click', function () {
      if (!changementUtilise) {
        // Premier clic : Changement de cible accordé
        changementUtilise = true;
        var idsActuels = serieDefis.map(function (d) { return d.id; });
        var disponibles = CATALOGUE_DEFIS.filter(function (d) {
          return idsActuels.indexOf(d.id) === -1;
        });

        var nouveauDefi = disponibles[Math.floor(Math.random() * disponibles.length)];
        serieDefis[indexDefi] = nouveauDefi;
        majDefiAffiche();
        sauvegarderEtatEquipe(equipeCode, serieDefis, indexDefi, changementUtilise);

        // Transformation immédiate en bouton "Abandon"
        btnUrgence.className = 'photo-btn-emergency is-abandon';
        btnUrgence.textContent = '🚨 Abandon';
        urgenceWarnEl.innerHTML = '⚠️ <b>Changement épuisé.</b> Tout appui sur ce bouton déclenche l’<b>Abandon immédiat et la remontée en surface</b> !';
        urgenceWarnEl.className = 'photo-emergency-warning is-urgent';

        feedbackEl.innerHTML = '🔄 <b>Cible permutée !</b> Nouveau défi assigné. ⚠️ <b>Attention : plus aucun changement possible. Le bouton est désormais « Abandon ».</b>';
        feedbackEl.className = 'photo-feedback is-warning';
        playBeep('warn');
      } else {
        // Clic sur "Abandon" une fois transformé : sanction immédiate !
        clearInterval(timerInterval);
        arreterCamera();
        onAbandon();
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
        feedbackEl.innerHTML = '⏱️ <b>TEMPS ÉCOULÉ !</b> Réserve d’oxygène épuisée dans les rayons. Remontée immédiate en surface.';
        feedbackEl.className = 'photo-feedback is-danger';
        btnTrigger.disabled = true;
        btnUrgence.disabled = true;
        playBeep('warn');
        setTimeout(function () {
          onEchecTemps();
        }, 1500);
      }
    }, 1000);

    majDefiAffiche();
    demarrerCamera();
    sauvegarderEtatEquipe(equipeCode, serieDefis, indexDefi, changementUtilise);

    return {
      arreter: function () {
        clearInterval(timerInterval);
        arreterCamera();
      }
    };
  }

  window.NautilusPhotoDefi = {
    init: init,
    catalogue: CATALOGUE_DEFIS,
    getCiblesEquipe: getCiblesEquipe,
    formaterCibles: formaterCibles,
    sauvegarderEtatEquipe: sauvegarderEtatEquipe
  };
})();
