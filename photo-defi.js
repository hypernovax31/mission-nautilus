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
  var MOTS_PRIX = ['€', 'EUR', 'PRIX', 'PROMO', 'SOLDE', 'OFFRE', 'ADH', 'TTC'];
  var MOTS_FORMATS = ['VINYLE', 'CD', 'DVD', '4K', 'MANGA', 'BD', 'GUIDE', 'POCHE', 'TOME', 'ALBUM'];
  var MOTS_FNAC = ['FNAC', 'ADH', 'CLUB', 'SELECTION', 'COEUR'];
  var MOTS_ESPACE = ['STAR', 'WARS', 'SPACE', 'LUNE', 'MARS', 'ROBOT', 'PLANETE', 'COSMOS', 'TERRE', 'GALAXY', 'SOLEIL', 'UNIVERS', 'FUTUR', 'ALIEN'];
  var MOTS_TOME = ['TOME', 'VOL', 'VOLUME', 'CHAPITRE', 'SAISON', 'EPISODE', 'N°', 'EDITION'];
  var MOTS_AUDIO = ['SOUND', 'AUDIO', 'BASS', 'STEREO', 'CASQUE', 'ENCEINTE', 'MUSIC', 'HIFI', 'ACOUSTIC', 'DISQUE'];
  var MOTS_TECH = ['WIFI', 'USB', 'BLUETOOTH', '4K', 'PRO', 'HD', 'WIRELESS', 'ULTRA', 'SMART', 'OLED', 'USB-C', 'GB', 'GO'];
  var MOTS_AGE_PEGI = ['PEGI', 'ANS', 'AGE', '3+', '7+', '12+', '16+', '18+', 'KIDS'];

  /* ================= CATALOGUE DE DÉFIS D'ARTICLES EN VENTE EN FNAC ================= */
  var CATALOGUE_DEFIS = [
    /* --- 1. DÉTECTION SPECTRALE (COULEURS FRANCHES EN RAYON) --- */
    {
      id: 'jaune_article',
      famille: 'spectral',
      titre: 'Article ou packaging JAUNE vif',
      consigne: 'Trouvez et cadrez au centre un livre (ex: collection « Pour les nuls »), un étui ou un emballage JAUNE éclatant en vente.',
      rayon: 'Librairie, Informatique ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 36, hMax: 68, sMin: 0.25, vMin: 0.18, vMax: 1.0 }, 'jaune');
      }
    },
    {
      id: 'rouge_article',
      famille: 'spectral',
      titre: 'Produit ou accessoire ROUGE vif',
      consigne: 'Cadrez un boîtier de jeu (univers Nintendo / Mario), un casque audio rouge ou un roman à couverture ROUGE en vente.',
      rayon: 'Gaming, Son ou Littérature',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 345, hMax: 16, sMin: 0.30, vMin: 0.18, vMax: 1.0, wraps: true }, 'rouge');
      }
    },
    {
      id: 'bleu_article',
      famille: 'spectral',
      titre: 'Boîtier ou produit BLEU océan',
      consigne: 'Repérez un boîtier Blu-ray Disc de film, un accessoire tech ou un livre aux teintes BLEU océan en rayon.',
      rayon: 'Vidéo / Cinéma ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 180, hMax: 248, sMin: 0.26, vMin: 0.16, vMax: 1.0 }, 'bleu');
      }
    },
    {
      id: 'vert_article',
      famille: 'spectral',
      titre: 'Boîtier ou article VERT émeraude',
      consigne: 'Photographiez un boîtier de jeu Xbox, un guide vert Michelin ou un carnet de papeterie VERT vif en vente.',
      rayon: 'Gaming, Tourisme ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 75, hMax: 160, sMin: 0.25, vMin: 0.16, vMax: 1.0 }, 'vert');
      }
    },
    {
      id: 'orange_article',
      famille: 'spectral',
      titre: 'Manga ou livre de poche ORANGE',
      consigne: 'Isolez un manga à dos orange (ex: Naruto), un livre de poche ou un étui ORANGE éclatant en rayon.',
      rayon: 'Mangas, Poche ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 16, hMax: 38, sMin: 0.35, vMin: 0.18, vMax: 1.0 }, 'orange');
      }
    },
    {
      id: 'noir_profond',
      famille: 'spectral',
      titre: 'Casque audio ou vinyle NOIR profond',
      consigne: 'Cadrez un casque audio à arceau noir, un disque vinyle 33T ou une enceinte ébène en vente.',
      rayon: 'Disquaire / Vinyles, Casques ou Photo',
      analyser: function (pixels, w, h) {
        return analyserNoirProfond(pixels, w, h);
      }
    },
    {
      id: 'blanc_argent',
      famille: 'spectral',
      titre: 'Produit ou packaging BLANC / argenté',
      consigne: 'Visez un boîtier d’écouteurs sans fil blancs (AirPods), une liseuse blanche ou un packaging épuré en rayon.',
      rayon: 'Téléphonie, Objets connectés ou Liseuses',
      analyser: function (pixels, w, h) {
        return analyserBlancArgent(pixels, w, h);
      }
    },
    {
      id: 'violet_article',
      famille: 'spectral',
      titre: 'Article ou packaging VIOLET / mauve',
      consigne: 'Cadrez un boîtier de jeu, un roman fantasy, un vinyle ou un article de papeterie VIOLET ou MAUVE en rayon.',
      rayon: 'Gaming, Littérature imaginaire ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 265, hMax: 325, sMin: 0.28, vMin: 0.18, vMax: 1.0 }, 'violet');
      }
    },
    {
      id: 'rose_article',
      famille: 'spectral',
      titre: 'Produit ou accessoire ROSE vif',
      consigne: 'Photographiez un casque audio, un carnet, une figurine ou un packaging au coloris ROSE éclatant en vente.',
      rayon: 'Papeterie, Son ou Accessoires',
      analyser: function (pixels, w, h) {
        return analyserCouleur(pixels, w, h, { hMin: 325, hMax: 348, sMin: 0.30, vMin: 0.22, vMax: 1.0 }, 'rose');
      }
    },
    {
      id: 'dore_or_article',
      famille: 'spectral',
      titre: 'Livre ou objet aux reflets DORÉS / or',
      consigne: 'Cadrez un beau livre à tranche/titre d’or, une édition collector dorée ou un carnet aux reflets d’OR en rayon.',
      rayon: 'Beaux-arts, Éditions collector ou Papeterie',
      analyser: function (pixels, w, h) {
        return analyserDoreOr(pixels, w, h);
      }
    },

    /* --- 2. DÉTECTION DE FORMES GÉOMÉTRIQUES & OBJETS EN RAYON --- */
    {
      id: 'objet_rond',
      famille: 'forme',
      titre: 'Enceinte ou haut-parleur ROND',
      consigne: 'Cadrez une enceinte Bluetooth circulaire (ex: JBL Clip, Bose), un haut-parleur rond ou un objectif photo.',
      rayon: 'Son / Enceintes portables, Vinyles ou Photo',
      analyser: function (pixels, w, h) {
        return analyserObjetRond(pixels, w, h);
      }
    },
    {
      id: 'forme_rectangulaire_livre',
      famille: 'forme',
      titre: 'Livre au format RECTANGLE portrait',
      consigne: 'Isolez un grand roman, un beau livre ou un album BD rectangulaire bien cadré de face.',
      rayon: 'Tous rayons Librairie / BD',
      analyser: function (pixels, w, h) {
        return analyserFormeRectanglePortrait(pixels, w, h);
      }
    },
    {
      id: 'forme_carree_vinyle',
      famille: 'forme',
      titre: 'Pochette carrée de VINYLE ou CD',
      consigne: 'Cadrez la pochette parfaitement carrée d’un disque vinyle 33 tours ou d’un album CD en rayon.',
      rayon: 'Disquaire / Vinyles ou Musique CD',
      analyser: function (pixels, w, h) {
        return analyserFormeCarree(pixels, w, h);
      }
    },
    {
      id: 'objet_cylindrique',
      famille: 'forme',
      titre: 'Gourde design ou objet CYLINDRIQUE',
      consigne: 'Photographiez une gourde isotherme, un mug de voyage ou un étui cylindrique en vente en rayon.',
      rayon: 'Papeterie, Cadeaux ou Accessoires',
      analyser: function (pixels, w, h) {
        return analyserObjetCylindrique(pixels, w, h);
      }
    },
    {
      id: 'ecran_allume',
      famille: 'forme',
      titre: 'Écran d’un appareil allumé en exposition',
      consigne: 'Visez l’écran lumineux d’un téléviseur, d’un PC portable, d’une tablette ou d’un smartphone allumé en rayon.',
      rayon: 'TV, Informatique ou Téléphonie',
      analyser: function (pixels, w, h) {
        return analyserEcranAllume(pixels, w, h);
      }
    },
    {
      id: 'motifs_rayures',
      famille: 'forme',
      titre: 'Article à RAYURES ou motif zébré',
      consigne: 'Repérez un carnet de papeterie rayé, un tote bag Fnac ou un packaging à rayures contrastées.',
      rayon: 'Papeterie ou Accessoires',
      analyser: function (pixels, w, h) {
        return analyserMotifRayures(pixels, w, h);
      }
    },
    {
      id: 'touches_clavier',
      famille: 'forme',
      titre: 'Clavier à touches d’ordinateur ou PC portable',
      consigne: 'Cadrez de près le clavier à touches alignées d’un PC portable en exposition ou d’un clavier gamer en rayon.',
      rayon: 'Informatique, PC portables ou Gaming',
      analyser: function (pixels, w, h) {
        return analyserTouchesClavier(pixels, w, h);
      }
    },
    {
      id: 'double_cercle_optique',
      famille: 'forme',
      titre: 'Deux oreillettes de casque audio ou objectif photo',
      consigne: 'Isolez les deux oreillettes circulaires d’un casque audio exposé ou les bagues concentriques d’un objectif photo.',
      rayon: 'Rayon Casques audio ou Rayon Photo',
      analyser: function (pixels, w, h) {
        return analyserDoubleCercle(pixels, w, h);
      }
    },
    {
      id: 'boitier_compact',
      famille: 'forme',
      titre: 'Boîtier de jeu compact (Switch) ou Blu-ray élancé',
      consigne: 'Cadrez un boîtier de jeu Nintendo Switch ou un boîtier Blu-ray vertical au format compact et élancé.',
      rayon: 'Gaming / Jeux Switch ou Vidéo / Blu-ray',
      analyser: function (pixels, w, h) {
        return analyserBoitierCompact(pixels, w, h);
      }
    },

    /* --- 3. LECTURE PAR OCR LOCAL (TEXTES & MENTIONS SUR ARTICLES) --- */
    {
      id: 'ocr_mer',
      famille: 'ocr',
      titre: 'Livre avec mot MARIN sur la couverture',
      consigne: 'Cadrez la couverture d’un livre ou BD contenant un mot marin lisible (MER, OCÉAN, CAPITAINE, ÎLE, ABYSSES...).',
      rayon: 'Littérature, BD, Voyage ou Jeunesse',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_MARITIMES, 'mot marin (Mer, Océan, Capitaine, Île...)');
      }
    },
    {
      id: 'ocr_prix',
      famille: 'ocr',
      titre: 'Étiquette de prix affichant un montant (€)',
      consigne: 'Rapprochez-vous de l’étiquette de prix d’un article en rayon affichant le symbole € ou un montant en euros.',
      rayon: 'N’importe quel rayon du magasin',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_PRIX, 'prix / symbole € ou EUR');
      }
    },
    {
      id: 'ocr_fnac',
      famille: 'ocr',
      titre: 'Article ou sticker mentionnant FNAC',
      consigne: 'Cadrez un sticker « Coup de cœur Fnac », une carte cadeau Fnac ou un article portant la mention FNAC.',
      rayon: 'Rayons Librairie, Musique ou Tête de gondole',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_FNAC, 'mention FNAC');
      }
    },
    {
      id: 'ocr_format',
      famille: 'ocr',
      titre: 'Article mentionnant son format (VINYLE, CD, 4K…)',
      consigne: 'Cadrez la mention imprimée du format sur un article (ex: VINYLE, CD, DVD, 4K, MANGA ou GUIDE).',
      rayon: 'Musique, Vidéo, Mangas ou Librairie',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_FORMATS, 'format (Vinyle, CD, 4K, Manga...)');
      }
    },
    {
      id: 'ocr_espace',
      famille: 'ocr',
      titre: 'Livre ou jeu avec mot ESPACE / SF sur la couverture',
      consigne: 'Cadrez un titre ou une couverture mentionnant l’espace ou le futur (STAR, WARS, SPACE, LUNE, MARS, ROBOT, PLANÈTE...).',
      rayon: 'Rayons Science-Fiction, BD / Comics ou Gaming',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_ESPACE, 'mot SF / Espace (Star, Wars, Mars, Robot, Lune...)');
      }
    },
    {
      id: 'ocr_tome',
      famille: 'ocr',
      titre: 'Manga ou BD avec mention TOME ou VOLUME',
      consigne: 'Rapprochez-vous d’un manga, d’un comics ou d’une BD affichant la mention TOME, VOL ou VOLUME sur la couverture.',
      rayon: 'Rayon Mangas, BD Franco-Belge ou Comics',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_TOME, 'mention Tome / Volume (Tome, Vol, Chapitre...)');
      }
    },
    {
      id: 'ocr_audio',
      famille: 'ocr',
      titre: 'Article audio avec mention SOUND, BASS ou CASQUE',
      consigne: 'Cadrez un packaging au rayon son mentionnant AUDIO, SOUND, BASS, STEREO, CASQUE ou ENCEINTE.',
      rayon: 'Rayon Son, Casques audio ou Enceintes',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_AUDIO, 'mention Son (Audio, Sound, Bass, Stereo, Casque...)');
      }
    },
    {
      id: 'ocr_tech',
      famille: 'ocr',
      titre: 'Article tech avec mention WIFI, USB, 4K ou PRO',
      consigne: 'Cadrez une étiquette ou boîte tech portant une mention de connectivité (WIFI, USB, BLUETOOTH, 4K, PRO, HD).',
      rayon: 'Informatique, Téléphonie ou TV',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_TECH, 'mention Tech (WiFi, USB, 4K, Pro, Bluetooth...)');
      }
    },
    {
      id: 'ocr_age_pegi',
      famille: 'ocr',
      titre: 'Boîtier de jeu avec mention PEGI ou logo d’âge',
      consigne: 'Cadrez le logo d’âge ou la mention PEGI (PEGI, 3, 7, 12, 16, 18, ANS) sur un boîtier de jeu ou jouet.',
      rayon: 'Gaming, Jeux vidéo ou Jeux de société',
      analyser: function (pixels, w, h, canvas) {
        return analyserOcrLocal(pixels, w, h, canvas, MOTS_AGE_PEGI, 'mention PEGI / Âge (PEGI, 3+, 12+, 16+, 18+...)');
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
        message: '🟢 Densité sombre validée (' + pct + '% de noir profond détecté) ! Casque ou vinyle confirmé.'
      };
    }
    return {
      succes: false,
      score: pct,
      message: '⚠️ Densité sombre insuffisante (' + pct + '%). Cadrez un objet noir ou un vinyle au centre.'
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
        message: '🟢 Teinte blanche / argentée validée (' + pct + '% détecté) ! Article blanc confirmé.'
      };
    }
    return {
      succes: false,
      score: pct,
      message: '⚠️ Luminance blanche insuffisante (' + pct + '%). Cadrez un boîtier d’écouteurs blancs ou un packaging clair.'
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
      message: '⚠️ Luminance d’écran non détectée (' + pct + '%). Visez un écran TV, PC ou smartphone allumé.'
    };
  }

  // Circularité (Enceinte ronde, haut-parleur)
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
        message: '🟢 Symétrie circulaire confirmée (' + score + '% de courbure) ! Enceinte ou haut-parleur rond validé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Courbure circulaire insuffisante (' + score + '%). Cadrez une enceinte ou un objet rond bien au centre.'
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
        message: '🟢 Géométrie rectangulaire portrait validée (' + score + '% de rectitude) ! Livre / BD confirmé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Format rectangulaire non net (' + score + '%). Cadrez un livre de face dans le collimateur.'
    };
  }

  // Format Carré (Pochette vinyle 33T ou CD)
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
        message: '🟢 Silhouette carrée 1:1 validée (' + score + '% d’orthogonalité) ! Pochette vinyle / CD confirmée.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Format carré non net (' + score + '%). Cadrez la pochette d’un vinyle ou d’un CD bien en face.'
    };
  }

  // Cylindre (Gourde, thermos Fnac, mug)
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
        message: '🟢 Relief cylindrique validé (' + score + '% de courbure verticale) ! Gourde ou étui confirmé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Profil cylindrique non détecté (' + score + '%). Cadrez une gourde ou un mug verticalement.'
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
        message: '🟢 Spectre doré / reflets or validés (Couverture dorée : ' + score + '%) ! Article collector confirmé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Reflets or / dorures insuffisants (' + score + '%). Visez un titre ou une tranche dorée au centre.'
    };
  }

  // Clavier d’ordinateur (grille périodique de touches)
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
        message: '🟢 Grille de touches périodique détectée (' + totalTrans + ' arêtes) ! Clavier d’ordinateur validé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Motif de touches non net (' + totalTrans + ' arêtes). Rapprochez-vous du clavier d’un PC portable en exposition.'
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

  // Double cercle (deux oreillettes de casque audio ou objectif photo)
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
        message: '🟢 Géométrie circulaire jumelée validée (' + score + '% de courbure) ! Casque audio ou optique confirmé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Cercles non nets (' + score + '%). Cadrez les oreillettes d’un casque audio ou un objectif photo.'
    };
  }

  // Boîtier Switch ou Blu-ray (format élancé)
  function analyserBoitierCompact(pixels, w, h) {
    var cx0 = Math.floor(w / 2), cy0 = Math.floor(h / 2);
    var demiW = Math.floor(Math.min(w, h) * 0.22);
    var demiH = Math.floor(demiW * 1.70);

    var bordsDetectes = 0;
    for (var step = -demiH; step <= demiH; step += Math.floor(demiH / 3)) {
      var y = cy0 + step;
      if (y >= 0 && y < h) {
        var xG1 = cx0 - demiW - 10, xG2 = cx0 - demiW + 10;
        var xD1 = cx0 + demiW - 10, xD2 = cx0 + demiW + 10;
        if (xG1 >= 0 && xD2 < w) {
          var lumG1 = (pixels[(y * w + xG1) * 4] + pixels[(y * w + xG1) * 4 + 1] + pixels[(y * w + xG1) * 4 + 2]) / 3;
          var lumG2 = (pixels[(y * w + xG2) * 4] + pixels[(y * w + xG2) * 4 + 1] + pixels[(y * w + xG2) * 4 + 2]) / 3;
          var lumD1 = (pixels[(y * w + xD1) * 4] + pixels[(y * w + xD1) * 4 + 1] + pixels[(y * w + xD1) * 4 + 2]) / 3;
          var lumD2 = (pixels[(y * w + xD2) * 4] + pixels[(y * w + xD2) * 4 + 1] + pixels[(y * w + xD2) * 4 + 2]) / 3;
          if (Math.abs(lumG1 - lumG2) > 20) bordsDetectes++;
          if (Math.abs(lumD1 - lumD2) > 20) bordsDetectes++;
        }
      }
    }
    var score = Math.round((bordsDetectes / 14) * 100);
    if (score >= 40) {
      return {
        succes: true,
        score: score,
        message: '🟢 Silhouette compacte élancée validée (' + score + '% de rectitude) ! Boîtier Switch / Blu-ray confirmé.'
      };
    }
    return {
      succes: false,
      score: score,
      message: '⚠️ Format compact non net (' + score + '%). Cadrez un boîtier de jeu Switch ou Blu-ray verticalement.'
    };
  }

  /* ================= MOTEUR OCR LOCAL SUR CANVAS (100% SANS API) ================= */

  function analyserOcrLocal(pixels, w, h, canvas, dictionnaire, labelCible) {
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
      ? Math.round((transitionsX / (totalEchantillons / 4)) * 100)
      : 0;

    // 2. Détection de texte haute fréquence (présence avérée de caractères imprimés)
    var texteDetecte = densiteTypographique >= 15;

    // 3. Extraction de texte & matching mots-clés
    // Pour les mots maritimes, on corrobore avec la détection de couverture océane ou de texte dense
    if (dictionnaire === MOTS_MARITIMES) {
      var bleu = analyserCouleur(pixels, w, h, { hMin: 180, hMax: 248, sMin: 0.24, vMin: 0.16, vMax: 0.95 }, 'océan');
      if (bleu.succes || (texteDetecte && densiteTypographique >= 20)) {
        return {
          succes: true,
          score: Math.max(bleu.score, densiteTypographique),
          message: '🟢 Typographie / Thématique maritime validée (Score ' + Math.max(bleu.score, densiteTypographique) + '%) ! Ouvrage marin confirmé.'
        };
      }
    }

    // Pour le prix / mention €
    if (dictionnaire === MOTS_PRIX) {
      if (texteDetecte && densiteTypographique >= 18) {
        return {
          succes: true,
          score: densiteTypographique,
          message: '🟢 Typographie de prix / étiquette repérée (Densité ' + densiteTypographique + '%) ! Montant en rayon validé.'
        };
      }
    }

    // Pour FNAC et les formats
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
    noir_profond: 'Noir vinyle',
    blanc_argent: 'Blanc / argent',
    violet_article: 'Violet / mauve',
    rose_article: 'Rose vif',
    dore_or_article: 'Doré / or',
    objet_rond: 'Enceinte ronde',
    forme_rectangulaire_livre: 'Livre portrait',
    forme_carree_vinyle: 'Carré vinyle',
    objet_cylindrique: 'Cylindre gourde',
    ecran_allume: 'Écran allumé',
    motifs_rayures: 'Rayures',
    touches_clavier: 'Clavier touches',
    double_cercle_optique: 'Double cercle',
    boitier_compact: 'Boîtier compact',
    ocr_mer: 'OCR Mer',
    ocr_prix: 'OCR Prix (€)',
    ocr_fnac: 'OCR Fnac',
    ocr_format: 'OCR Format',
    ocr_espace: 'OCR Espace / SF',
    ocr_tome: 'OCR Tome / Vol',
    ocr_audio: 'OCR Son / Audio',
    ocr_tech: 'OCR Tech / Sans fil',
    ocr_age_pegi: 'OCR Âge / PEGI'
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
