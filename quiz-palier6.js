/* =============================================================
   PALIER 6 — « LE GRAND QUIZ DES ABYSSES »
   Moteur interactif du Quiz scientifique & vernien (quiz-palier6.js)

   RÈGLES OFFICIELLES (Gameplay épuré & ultra-ludique) :
   - Banque riche de 30 questions scientifiques, géographiques & verniennes.
   - Tirage déterministe de 10 questions uniques par équipage via aleaSeed.
   - Animation « Machine à écrire » (writescribe) pour l'énoncé (≤ 5 secondes).
   - Les 4 réponses apparaissent une fois la question entièrement tapée.
   - Chronomètre de 6 secondes pour répondre dès l'apparition des choix.
   - Enchaînement direct et nerveux après validation (aucun pavé explicatif,
     aucune pause de 6 secondes).
   - 3 jokers uniques par partie (1 de chaque) :
       ✂️ 50/50 : retire 2 fausses réponses.
       ⏳ +10s : ajoute 10 secondes de réflexion au chrono.
       ⏭️ Passe : saute la question sans erreur et en pioche une en réserve.
   - Règle des 3 erreurs max : à la 3ᵉ mauvaise réponse, éjection immédiate.
   - Seuil de réussite ≥ 80% (au moins 8/10) pour déverrouiller le Palier 7.
   ============================================================= */
(function () {
  'use strict';
  if (window.NautilusQuiz) return;

  var DUREE_QUESTION_SEC = 6;
  var NB_QUESTIONS_PARTIE = 10;
  var SEUIL_REUSSITE = 8; // 8 / 10 = 80%
  var MAX_ERREURS = 3;

  /* ================= BANQUE DES 30 QUESTIONS SCIENTIFIQUES & VERNIENNES ================= */
  var BANQUE_30_QUESTIONS = [
    {
      id: 'geo_vengeur',
      domaine: '🌍 GÉOGRAPHIE & HISTOIRE',
      q: "À quelles coordonnées Nemo immerge-t-il le Nautilus pour saluer l'épave du navire « Le Vengeur du Peuple » ?",
      reps: [
        "47° 24' N et 17° 28' O",
        "42° 15' N et 12° 40' O",
        "49° 10' N et 21° 05' O",
        "45° 50' N et 15° 12' O"
      ],
      ok: 0
    },
    {
      id: 'geo_tunnel',
      domaine: '🌍 GÉOGRAPHIE & DÉTROITS',
      q: "Quel passage sous-marin secret relie la mer Rouge à la Méditerranée sous l'isthme de Suez ?",
      reps: [
        "L'Arabian Tunnel",
        "Le détroit de Bab-el-Mandeb",
        "La passe de Péroïse",
        "Le siphon d'Ormuz"
      ],
      ok: 0
    },
    {
      id: 'geo_vigo',
      domaine: '🌍 GÉOGRAPHIE & TRÉSORS',
      q: "Quelle flotte chargée d'or échouée en 1702 fournit à Nemo son inépuisable trésor dans la baie de Vigo ?",
      reps: [
        "Les galions espagnols de la Plata",
        "L'Invincible Armada",
        "L'escadre royale des Indes",
        "La flotte marchande des Flandres"
      ],
      ok: 0
    },
    {
      id: 'geo_pole_sud',
      domaine: '🌍 GÉOGRAPHIE POLAIRE',
      q: "À quelle date historique le Capitaine Nemo prend-il possession du pôle Sud au nom de lui-même ?",
      reps: [
        "21 mars 1868 (équinoxe)",
        "1er janvier 1869",
        "14 juillet 1867",
        "21 décembre 1868 (solstice)"
      ],
      ok: 0
    },
    {
      id: 'geo_atlantide',
      domaine: '🌋 GÉOLOGIE & ABYSSES',
      q: "Vers quelles ruines sous-marines calcinées Nemo guide-t-il Aronnax en scaphandre dans l'Atlantique ?",
      reps: [
        "L'Atlantide engloutie",
        "Herculanum sous les eaux",
        "Les temples submergés d'Ylis",
        "La cité d'Ys"
      ],
      ok: 0
    },
    {
      id: 'geo_crespo',
      domaine: '🌿 BOTANIQUE & EXPLORATION',
      q: "Dans quelle forêt sous-marine se déroule la première partie de chasse au fusil pneumatique de Nemo ?",
      reps: [
        "L'île Crespo (laminaires géantes)",
        "Le grand banc des Bahamas",
        "Les récifs coralliens de Vanikoro",
        "La fosse abyssale des Kouriles"
      ],
      ok: 0
    },
    {
      id: 'math_dimensions',
      domaine: '📐 GÉOMÉTRIE DU NAUTILUS',
      q: "Quelles sont les dimensions de la coque cylindrique d'acier du Nautilus conçue par Nemo ?",
      reps: [
        "70 m de long sur 8 m de large",
        "100 m de long sur 12 m de large",
        "50 m de long sur 6 m de large",
        "85 m de long sur 10 m de large"
      ],
      ok: 0
    },
    {
      id: 'math_deplacement',
      domaine: '📐 PHYSIQUE & HYDRODYNAMIQUE',
      q: "Quel est le volume intérieur et le déplacement d'eau en surface de la double coque du Nautilus ?",
      reps: [
        "1 500 m³ et 1 507 tonnes",
        "2 500 m³ et 2 800 tonnes",
        "1 000 m³ et 1 000 tonnes",
        "3 200 m³ et 3 500 tonnes"
      ],
      ok: 0
    },
    {
      id: 'math_lieues',
      domaine: '📐 UNITÉS & MESURES',
      q: "À quelle distance métrique correspondent les « 20 000 lieues » sous les mers selon Jules Verne ?",
      reps: [
        "80 000 kilomètres (deux tours de la Terre)",
        "40 000 kilomètres (un tour de la Terre)",
        "100 000 kilomètres",
        "60 000 kilomètres"
      ],
      ok: 0
    },
    {
      id: 'math_vitesse',
      domaine: '📐 CALCUL CINÉMATIQUE',
      q: "Quelle vitesse de pointe maximale le loch électrique du Nautilus enregistre-t-il en plongée ?",
      reps: [
        "50 milles/h (environ 92,6 km/h)",
        "30 milles/h (environ 55,5 km/h)",
        "75 milles/h (environ 138 km/h)",
        "20 milles/h (environ 37 km/h)"
      ],
      ok: 0
    },
    {
      id: 'phys_energie',
      domaine: '⚡ PHYSIQUE & ÉLECTRICITÉ',
      q: "Quelle source chimique fournit l'électricité intégrale du Nautilus sans aucun charbon ?",
      reps: [
        "Le sodium extrait de l'eau de mer",
        "Le zinc alimenté par l'acide",
        "Le magnésium purifié",
        "Le pétrole brut des fonds marins"
      ],
      ok: 0
    },
    {
      id: 'phys_pression',
      domaine: '🌊 HYDROSTATIQUE DES ABYSSES',
      q: "À quelle profondeur record Aronnax observe-t-il le manomètre descendre dans l'Atlantique Sud ?",
      reps: [
        "16 000 mètres (4 lieues)",
        "11 000 mètres (Fosse des Mariannes)",
        "8 000 mètres (2 lieues)",
        "22 000 mètres (Abîme absolu)"
      ],
      ok: 0
    },
    {
      id: 'phys_air',
      domaine: '🫁 PNEUMATIQUE DU BORD',
      q: "À quelle pression les réservoirs du Nautilus emmagasinent-ils l'air pour 24 heures d'immersion ?",
      reps: [
        "15 atmosphères (environ 15 bars)",
        "50 atmosphères (environ 50 bars)",
        "5 atmosphères (environ 5 bars)",
        "100 atmosphères (environ 100 bars)"
      ],
      ok: 0
    },
    {
      id: 'phys_chaleur',
      domaine: '🌡️ THERMODYNAMIQUE',
      q: "Comment Nemo maintient-il la température des salons du Nautilus dans les eaux glaciales des pôles ?",
      reps: [
        "Par des calorifères électriques",
        "Par des fourneaux à vapeur",
        "Par la géothermie des évents",
        "Par combustion de phosphore"
      ],
      ok: 0
    },
    {
      id: 'phys_fanal',
      domaine: '💡 OPTIQUE SOUS-MARINE',
      q: "Quel dispositif optique permet au fanal électrique de projeter sa clarté à un demi-mille marin ?",
      reps: [
        "Lampe à arc et lentille biconvexe",
        "Réflecteur parabolique d'argent",
        "Lanterne au gaz oxhydrique",
        "Prisme de cristal de quartz"
      ],
      ok: 0
    },
    {
      id: 'bio_calmar',
      domaine: '🦑 BIOLOGIE ABYSSALE',
      q: "Quelle créature céphalopode géante attaque la plateforme du Nautilus au large des îles Lucayes ?",
      reps: [
        "Un calmar géant de 8 mètres",
        "Une pieuvre colossale de 15 mètres",
        "Un nautile royal préhistorique",
        "Un léviathan à pinces de fer"
      ],
      ok: 0
    },
    {
      id: 'bio_perle',
      domaine: '🦪 BIOLOGIE & MALACOLOGIE',
      q: "Quelle dimension prodigieuse possède la perle que Nemo élève en secret au banc de Manaar ?",
      reps: [
        "La grosseur d'un œuf de coco",
        "La taille d'une pomme de pin",
        "Le volume d'une tête d'enfant",
        "La dimension d'un pamplemousse"
      ],
      ok: 0
    },
    {
      id: 'bio_dugong',
      domaine: '🐋 FAUNE MARINE',
      q: "Quel mammifère marin herbivore de grande taille Ned Land harponne-t-il dans les eaux de la mer Rouge ?",
      reps: [
        "Un dugong de plus de sept mètres",
        "Une loutre de mer géante",
        "Un lamantin des Caraïbes",
        "Un morse boréal migrateur"
      ],
      ok: 0
    },
    {
      id: 'bio_biolumi',
      domaine: '✨ BIOLUMINESCENCE',
      q: "À quel phénomène Nemo attribue-t-il les féeriques « mers de lait » traversées par le Nautilus ?",
      reps: [
        "À des myriades de noctiluques luminescents",
        "À des remontées de soufre sous-marines",
        "À du corail blanc pulvérisé",
        "À de la mousse d'algues phosphatées"
      ],
      ok: 0
    },
    {
      id: 'bio_cachalots',
      domaine: '🌊 ÉCOLOGIE MARINE',
      q: "Pour quel motif éthique Nemo éperonne-t-il impitoyablement une troupe de cachalots dans le Pacifique ?",
      reps: [
        "Pour défendre les baleines franches et leurs petits",
        "Pour venger un navire marchand coulé",
        "Pour récolter du précieux blanc de baleine",
        "Pour éprouver la solidité de l'éperon d'acier"
      ],
      ok: 0
    },
    {
      id: 'hum_devise',
      domaine: '📜 PHILOSOPHIE & SYMBOLES',
      q: "Quelle est la célèbre devise latine gravée sur l'étendard et les instruments du Capitaine Nemo ?",
      reps: [
        "Mobilis in mobili (« Mobile dans l'élément mobile »)",
        "Fluctuat nec mergitur",
        "Per aspera ad astra",
        "Mare liberum imperium"
      ],
      ok: 0
    },
    {
      id: 'hum_aronnax',
      domaine: '📜 PERSONNAGES DU ROMAN',
      q: "Quelle fonction savante officielle Pierre Aronnax occupe-t-il avant d'être capturé par le Nautilus ?",
      reps: [
        "Professeur suppléant au Muséum d'histoire naturelle de Paris",
        "Conservateur des collections océaniques de Brest",
        "Directeur de l'Institut royal d'hydrographie",
        "Docteur en zoologie comparée à Leyde"
      ],
      ok: 0
    },
    {
      id: 'hum_conseil',
      domaine: '📜 PERSONNAGES DU ROMAN',
      q: "Quelle est la spécialité et la manie de Conseil, le flegmatique serviteur d'Aronnax ?",
      reps: [
        "Classification taxonomique méthodique des poissons",
        "Cartographie céleste des constellations",
        "Balistique navale et harponnage",
        "Chimie organique des algues marines"
      ],
      ok: 0
    },
    {
      id: 'hum_nedland',
      domaine: '📜 PERSONNAGES DU ROMAN',
      q: "D'où est originaire Ned Land, le redoutable roi des harponneurs embarqué à bord de la frégate ?",
      reps: [
        "De Québec (Canada francophone)",
        "De Boston (Massachusetts)",
        "D'Édimbourg (Écosse)",
        "D'Halifax (Nouvelle-Écosse)"
      ],
      ok: 0
    },
    {
      id: 'hum_dakkar',
      domaine: '👑 HISTOIRE & BIOGRAPHIE',
      q: "Quelle est la véritable identité royale de Nemo révélée par Jules Verne dans « L'Île mystérieuse » ?",
      reps: [
        "Le Prince Dakkar, fils d'un râja souverain d'Inde",
        "Un aristocrate polonais en révolte",
        "L'amiral d'Acre exilé de l'Empire ottoman",
        "Un noble descendant des doges de Venise"
      ],
      ok: 0
    },
    {
      id: 'hum_fregate',
      domaine: '🚢 NAVIRES HISTORIQUES',
      q: "Quel est le nom de la frégate américaine qui traque le Nautilus au début de l'aventure ?",
      reps: [
        "L'Abraham Lincoln",
        "Le Franklin Pierce",
        "Le George Washington",
        "L'Alexander Hamilton"
      ],
      ok: 0
    },
    {
      id: 'hum_peintres',
      domaine: '🎨 ARTS & HUMANITÉS',
      q: "Quels illustres maîtres ornent le musée privé de Nemo dans le grand salon du Nautilus ?",
      reps: [
        "Léonard de Vinci, Raphaël, Titien et Vélasquez",
        "Monet, Renoir, Degas et Cézanne",
        "Picasso, Braque, Matisse et Derain",
        "Goya, Turner, Delacroix et David"
      ],
      ok: 0
    },
    {
      id: 'hum_orgue',
      domaine: '🎵 MUSIQUE DU BORD',
      q: "Quel instrument monumental occupe le salon du Nautilus et permet à Nemo d'improviser la nuit ?",
      reps: [
        "Un grand orgue-harmonium à pédalier",
        "Un clavecin flamand doré",
        "Une harpe celtique à double pédale",
        "Un carillon à cloches de bronze"
      ],
      ok: 0
    },
    {
      id: 'terre_maelstrom',
      domaine: '🌀 OCÉANOGRAPHIE PHYSIQUE',
      q: "Près de quel archipel boréal norvégien le Nautilus est-il emporté par le gouffre du Maelström ?",
      reps: [
        "L'archipel des îles Lofoten",
        "Le détroit glaciaire du Svalbard",
        "L'archipel sauvage des Féroé",
        "Le golfe de Botnie"
      ],
      ok: 0
    },
    {
      id: 'terre_corail',
      domaine: '🪸 CORAIL & SÉPULTURE',
      q: "Où le Capitaine Nemo ensevelit-il solennellement ses marins morts en mission sous-marine ?",
      reps: [
        "Dans un cimetière de corail blanc par 300 m de fond",
        "Dans la fosse des Kouriles par 8 000 m de fond",
        "Au pied des colonnes d'Hercule",
        "Dans une caverne sous-marine volcanique"
      ],
      ok: 0
    }
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

  /* Audio Web Audio minimaliste & immersif */
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function jouerSon(type) {
    try {
      var ctx = getAudioCtx();
      if (!ctx) return;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      if (type === 'clic') {
        // Clic machine à écrire / télégraphe très doux
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000 + Math.random() * 400, ctx.currentTime);
        gain.gain.setValueAtTime(0.018, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.03);
      } else if (type === 'tick') {
        // Tic-tac alerte
        osc.type = 'sine';
        osc.frequency.setValueAtTime(950, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.09);
      } else if (type === 'ok') {
        // Carillon de succès
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.20, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.36);
      } else if (type === 'faux') {
        // Alerte erreur
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.33);
      } else if (type === 'joker') {
        // Activation joker
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(740, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.30);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.31);
      }
    } catch (e) {}
  }

  function declencherSecousse(intensite) {
    try {
      var cls = intensite === 'forte' ? 'screen-shake-heavy' : 'screen-shake-light';
      document.body.classList.add(cls);
      setTimeout(function () { document.body.classList.remove(cls); }, 450);
    } catch (_) {}
  }

  /* Sélection des 10 questions pour l'équipage */
  function tirerQuestionsPourEquipe(equipeCode) {
    var rnd = aleaSeed('palier6_' + String(equipeCode || 'NEMO').toUpperCase());
    var pool = BANQUE_30_QUESTIONS.slice();
    var selection = [];
    var reserve = [];

    // Tirage des 10 questions principales
    for (var i = 0; i < NB_QUESTIONS_PARTIE && pool.length > 0; i++) {
      var k = Math.floor(rnd() * pool.length);
      selection.push(pool.splice(k, 1)[0]);
    }
    // Les restantes servent de réserve pour le joker "Passe"
    reserve = pool;

    return { selection: selection, reserve: reserve };
  }

  /* Mélange reproductible des réponses pour une question */
  function preparerQuestionPourAffichage(qObj, qIndex, equipeCode) {
    var rnd = aleaSeed('palier6_rep_' + String(equipeCode || 'NEMO').toUpperCase() + '_' + qIndex + '_' + qObj.id);
    var indices = [0, 1, 2, 3];
    // Fisher-Yates
    for (var i = indices.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
    }
    var repMelangees = indices.map(function (idx) { return qObj.reps[idx]; });
    var indexBonneRep = indices.indexOf(qObj.ok);

    return {
      id: qObj.id,
      domaine: qObj.domaine,
      q: qObj.q,
      reponses: repMelangees,
      bonneRepIndex: indexBonneRep,
      bonneRepTexte: qObj.reps[qObj.ok]
    };
  }

  /* Initialisation de l'instance de jeu */
  function init(host, opts) {
    if (!host || !opts) return;
    var equipeCode = (opts.equipe || 'NEMO').toUpperCase();
    var onVictoire = opts.onVictoire || function () {};
    var onEchec = opts.onEchec || function () {};

    var tirage = tirerQuestionsPourEquipe(equipeCode);
    var listeQuestions = tirage.selection;
    var questionsReserve = tirage.reserve;

    var indexCourant = 0;
    var score = 0;
    var erreurs = 0;
    var fini = false;
    var t0 = Date.now();

    // État des 3 jokers (1 de chaque)
    var jokers = {
      cinquante: true, // 50/50
      temps: true,      // +10s
      passe: true       // Sauter la question
    };

    var timerId = null;
    var tempsRestant = DUREE_QUESTION_SEC;
    var frappeTimer = null;
    var enCoursDeFrappe = false;
    var questionPrete = null;
    var reponseVerrouillee = true;

    /* Injection du gabarit HTML minimaliste et immersif */
    host.innerHTML =
      '<div class="qz-container">'
      + '  <!-- 1. En-tête de bord -->'
      + '  <div class="qz-hud">'
      + '    <div class="qz-hud-top">'
      + '      <div class="qz-step-badge">QUESTION <b id="qzCurNum">1</b> / 10</div>'
      + '      <div class="nautilus-voyants-rack qz-voyants" id="qzVoyants" title="Voyants d\'alerte (3 erreurs max)">'
      + '        <span class="nautilus-voyant qz-voyant" id="qzV1"></span>'
      + '        <span class="nautilus-voyant qz-voyant" id="qzV2"></span>'
      + '        <span class="nautilus-voyant qz-voyant" id="qzV3"></span>'
      + '        <span class="nautilus-voyants-lbl qz-voyants-lbl">ERREURS</span>'
      + '      </div>'
      + '      <div class="qz-score-badge">SCORE : <b id="qzScoreVal">0</b> / 10 <span class="qz-target-sub">(≥ 8/10 requis)</span></div>'
      + '    </div>'
      + '    <div class="qz-progress-track">'
      + '      <div class="qz-progress-fill" id="qzProgressFill" style="width:0%"></div>'
      + '    </div>'
      + '  </div>'

      + '  <!-- 2. Chronomètre circulaire & Jauge dynamique -->'
      + '  <div class="qz-timer-row">'
      + '    <div class="qz-timer-badge" id="qzTimerBadge">'
      + '      <span class="qz-timer-ico">⏱️</span>'
      + '      <span class="qz-timer-val" id="qzTimerVal">6s</span>'
      + '    </div>'
      + '    <div class="qz-timer-track">'
      + '      <div class="qz-timer-bar" id="qzTimerBar" style="width:100%"></div>'
      + '    </div>'
      + '  </div>'

      + '  <!-- 3. Carte de la question (machine à écrire) -->'
      + '  <div class="qz-card" id="qzCard" title="Touchez pour afficher instantanément">'
      + '    <div class="qz-domaine" id="qzDomaine">—</div>'
      + '    <h3 class="qz-question-text" id="qzQuestion">—</h3>'
      + '  </div>'

      + '  <!-- 4. Grille des 4 réponses -->'
      + '  <div class="qz-grid" id="qzReponses" role="group" aria-label="Réponses au choix" style="display:none"></div>'

      + '  <!-- 5. Rack des 3 Indices (1 de chaque) -->'
      + '  <div class="nautilus-hints-rack qz-indices-box">'
      + '    <div class="nautilus-hints-title qz-indices-title">💡 AIDES DE BORD (1 DE CHAQUE PAR PLONGÉE) :</div>'
      + '    <div class="nautilus-hints-row qz-indices-row">'
      + '      <button type="button" class="nautilus-hint-btn qz-btn-joker" id="qzJoker50" title="Retire deux réponses fausses">'
      + '        <span class="qz-joker-ico">✂️</span>'
      + '        <span class="qz-joker-lbl"><b>50 / 50</b> <span class="qz-joker-sub" id="qzJoker50Sub">1 disponible</span></span>'
      + '      </button>'
      + '      <button type="button" class="nautilus-hint-btn qz-btn-joker" id="qzJokerTime" title="Ajoute 10 secondes au chronomètre">'
      + '        <span class="qz-joker-ico">⏳</span>'
      + '        <span class="qz-joker-lbl"><b>+10s TEMPS</b> <span class="qz-joker-sub" id="qzJokerTimeSub">1 disponible</span></span>'
      + '      </button>'
      + '      <button type="button" class="nautilus-hint-btn qz-btn-joker" id="qzJokerPass" title="Passe à une autre question sans compter d\'erreur">'
      + '        <span class="qz-joker-ico">⏭️</span>'
      + '        <span class="qz-joker-lbl"><b>PASSE</b> <span class="qz-joker-sub" id="qzJokerPassSub">1 disponible</span></span>'
      + '      </button>'
      + '    </div>'
      + '  </div>'
      + '</div>';

    var curNumEl = host.querySelector('#qzCurNum');
    var scoreValEl = host.querySelector('#qzScoreVal');
    var progressFillEl = host.querySelector('#qzProgressFill');
    var timerValEl = host.querySelector('#qzTimerVal');
    var timerBarEl = host.querySelector('#qzTimerBar');
    var timerBadgeEl = host.querySelector('#qzTimerBadge');
    var qzCardEl = host.querySelector('#qzCard');
    var domaineEl = host.querySelector('#qzDomaine');
    var questionEl = host.querySelector('#qzQuestion');
    var reponsesGrid = host.querySelector('#qzReponses');
    var joker50Btn = host.querySelector('#qzJoker50');
    var jokerTimeBtn = host.querySelector('#qzJokerTime');
    var jokerPassBtn = host.querySelector('#qzJokerPass');
    var joker50Sub = host.querySelector('#qzJoker50Sub');
    var jokerTimeSub = host.querySelector('#qzJokerTimeSub');
    var jokerPassSub = host.querySelector('#qzJokerPassSub');
    var v1 = host.querySelector('#qzV1');
    var v2 = host.querySelector('#qzV2');
    var v3 = host.querySelector('#qzV3');

    function majVoyants() {
      if (v1) v1.classList.toggle('active', erreurs >= 1);
      if (v2) v2.classList.toggle('active', erreurs >= 2);
      if (v3) v3.classList.toggle('active', erreurs >= 3);
    }

    function majJokersUI() {
      var desactive = reponseVerrouillee || enCoursDeFrappe;
      if (joker50Btn) {
        joker50Btn.disabled = !jokers.cinquante || desactive;
        joker50Btn.classList.toggle('is-used', !jokers.cinquante);
        if (joker50Sub) joker50Sub.textContent = jokers.cinquante ? '1 disponible' : '✓ Utilisé';
      }
      if (jokerTimeBtn) {
        jokerTimeBtn.disabled = !jokers.temps || desactive;
        jokerTimeBtn.classList.toggle('is-used', !jokers.temps);
        if (jokerTimeSub) jokerTimeSub.textContent = jokers.temps ? '1 disponible' : '✓ Utilisé';
      }
      if (jokerPassBtn) {
        jokerPassBtn.disabled = !jokers.passe || desactive || questionsReserve.length === 0;
        jokerPassBtn.classList.toggle('is-used', !jokers.passe);
        if (jokerPassSub) jokerPassSub.textContent = jokers.passe ? '1 disponible' : '✓ Utilisé';
      }
    }

    function stopTimer() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    }

    function stopFrappe() {
      if (frappeTimer) { clearInterval(frappeTimer); frappeTimer = null; }
    }

    function lancerTimer() {
      stopTimer();
      tempsRestant = DUREE_QUESTION_SEC;
      majChronoUI();

      timerId = setInterval(function () {
        tempsRestant--;
        majChronoUI();
        if (tempsRestant <= 2 && tempsRestant > 0) {
          jouerSon('tick');
        }
        if (tempsRestant <= 0) {
          stopTimer();
          tempsEcoule();
        }
      }, 1000);
    }

    function majChronoUI() {
      var pct = Math.max(0, Math.min(100, (tempsRestant / DUREE_QUESTION_SEC) * 100));
      if (timerValEl) timerValEl.textContent = tempsRestant + 's';
      if (timerBarEl) timerBarEl.style.width = pct + '%';
      var estCritique = tempsRestant <= 2;
      if (timerBadgeEl) timerBadgeEl.classList.toggle('is-alert', estCritique);
      if (timerBarEl) timerBarEl.classList.toggle('is-alert', estCritique);
    }

    /* Animation machine à écrire (writescribe) : durée ≤ 5 secondes */
    function ecrireQuestion(texteComplet, callback) {
      stopFrappe();
      enCoursDeFrappe = true;
      reponseVerrouillee = true;
      majJokersUI();

      if (reponsesGrid) {
        reponsesGrid.style.display = 'none';
        reponsesGrid.classList.remove('is-visible');
      }

      if (timerValEl) timerValEl.textContent = DUREE_QUESTION_SEC + 's';
      if (timerBarEl) {
        timerBarEl.style.width = '100%';
        timerBarEl.classList.remove('is-alert');
      }
      if (timerBadgeEl) timerBadgeEl.classList.remove('is-alert');

      var charIndex = 0;
      var totalChars = texteComplet.length;
      // Vitesse ajustée pour toujours terminer entre 2.2s et 4.6s (strictement ≤ 5.5s)
      var intervalMs = Math.max(16, Math.min(36, Math.floor(4500 / Math.max(1, totalChars))));

      questionEl.innerHTML = '<span class="qz-typewriter-text"></span><span class="qz-cursor" aria-hidden="true"></span>';
      var textSpan = questionEl.querySelector('.qz-typewriter-text');
      var cursorSpan = questionEl.querySelector('.qz-cursor');

      frappeTimer = setInterval(function () {
        charIndex++;
        if (textSpan) {
          textSpan.textContent = texteComplet.slice(0, charIndex);
        }
        if (charIndex % 3 === 0) {
          jouerSon('clic');
        }

        if (charIndex >= totalChars) {
          stopFrappe();
          if (cursorSpan) cursorSpan.remove();
          if (callback) callback();
        }
      }, intervalMs);
    }

    /* Révélation des 4 réponses et lancement du compte à rebours 6s */
    function revelerReponsesEtChrono() {
      enCoursDeFrappe = false;
      stopFrappe();
      if (questionEl) {
        var cursor = questionEl.querySelector('.qz-cursor');
        if (cursor) cursor.remove();
      }

      if (reponsesGrid) {
        reponsesGrid.style.display = 'grid';
        reponsesGrid.classList.add('is-visible');
      }

      reponseVerrouillee = false;
      majJokersUI();
      lancerTimer();
    }

    /* Clic sur la carte pour accélérer l'écriture */
    if (qzCardEl) {
      qzCardEl.addEventListener('click', function () {
        if (enCoursDeFrappe && questionPrete) {
          stopFrappe();
          if (questionEl) questionEl.textContent = questionPrete.q;
          revelerReponsesEtChrono();
        }
      });
    }

    /* Affichage de la question courante */
    function afficherQuestion() {
      if (indexCourant >= NB_QUESTIONS_PARTIE) {
        terminerQuiz();
        return;
      }

      stopTimer();
      stopFrappe();

      var qObj = listeQuestions[indexCourant];
      questionPrete = preparerQuestionPourAffichage(qObj, indexCourant, equipeCode);

      if (curNumEl) curNumEl.textContent = String(indexCourant + 1);
      if (scoreValEl) scoreValEl.textContent = String(score);
      if (progressFillEl) progressFillEl.style.width = Math.round((indexCourant / NB_QUESTIONS_PARTIE) * 100) + '%';
      if (domaineEl) domaineEl.textContent = questionPrete.domaine;

      // Construction des 4 boutons de réponse
      var lettres = ['A', 'B', 'C', 'D'];
      reponsesGrid.innerHTML = '';
      questionPrete.reponses.forEach(function (repTexte, idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qz-rep-btn';
        btn.setAttribute('data-idx', String(idx));
        btn.innerHTML =
          '<span class="qz-rep-letter">' + lettres[idx] + '</span>'
          + '<span class="qz-rep-label">' + repTexte + '</span>';
        reponsesGrid.appendChild(btn);
      });

      majVoyants();

      // Démarrage de l'animation machine à écrire
      ecrireQuestion(questionPrete.q, function () {
        revelerReponsesEtChrono();
      });
    }

    /* Validation de la réponse */
    function validerReponse(idxChoisi, estTimeout) {
      if (reponseVerrouillee || fini) return;
      reponseVerrouillee = true;
      stopTimer();
      majJokersUI();

      var buttons = reponsesGrid.querySelectorAll('.qz-rep-btn');
      var bonneIdx = questionPrete.bonneRepIndex;
      var estBon = !estTimeout && (idxChoisi === bonneIdx);

      // En cas d'erreur ou timeout, AUCUNE révélation de la bonne réponse
      buttons.forEach(function (btn, i) {
        btn.disabled = true;
        if (estBon && i === bonneIdx) {
          btn.classList.add('is-correct');
        } else if (!estBon && i === idxChoisi) {
          btn.classList.add('is-wrong');
        }
      });

      if (estBon) {
        score++;
        jouerSon('ok');
        if (scoreValEl) scoreValEl.textContent = String(score);
      } else {
        erreurs++;
        jouerSon('faux');
        majVoyants();

        if (erreurs >= MAX_ERREURS) {
          // Éjection immédiate (3 erreurs)
          fini = true;
          declencherSecousse('forte');
          setTimeout(function () {
            onEchec('erreurs');
          }, 1100);
          return;
        }
      }

      // Si c'était la dernière question
      if (indexCourant >= NB_QUESTIONS_PARTIE - 1) {
        fini = true;
        var dureeTotale = Math.round((Date.now() - t0) / 1000);
        var pct = Math.round((score / NB_QUESTIONS_PARTIE) * 100);
        setTimeout(function () {
          if (score >= SEUIL_REUSSITE && erreurs < MAX_ERREURS) {
            jouerSon('ok');
            onVictoire({ score: score, pourcentage: pct, erreurs: erreurs, duree: dureeTotale });
          } else {
            jouerSon('faux');
            onEchec('score_insuffisant');
          }
        }, 900);
        return;
      }

      // Enchaînement ultra-fluide direct vers la question suivante (pas de bloc d'explication)
      setTimeout(function () {
        if (!fini) {
          indexCourant++;
          afficherQuestion();
        }
      }, 850);
    }

    function tempsEcoule() {
      validerReponse(-1, true);
    }

    /* Terminaison du quiz */
    function terminerQuiz() {
      fini = true;
      stopTimer();
      stopFrappe();

      if (progressFillEl) progressFillEl.style.width = '100%';

      var dureeTotale = Math.round((Date.now() - t0) / 1000);
      var pct = Math.round((score / NB_QUESTIONS_PARTIE) * 100);

      if (score >= SEUIL_REUSSITE && erreurs < MAX_ERREURS) {
        jouerSon('ok');
        setTimeout(function () {
          onVictoire({ score: score, pourcentage: pct, erreurs: erreurs, duree: dureeTotale });
        }, 900);
      } else {
        jouerSon('faux');
        setTimeout(function () {
          onEchec('score_insuffisant');
        }, 900);
      }
    }

    /* Événements sur la grille de réponses */
    reponsesGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('.qz-rep-btn');
      if (!btn || btn.disabled || reponseVerrouillee) return;
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      validerReponse(idx, false);
    });

    /* Joker 1 : 50 / 50 */
    if (joker50Btn) {
      joker50Btn.addEventListener('click', function () {
        if (!jokers.cinquante || reponseVerrouillee || fini || enCoursDeFrappe) return;
        jokers.cinquante = false;
        jouerSon('joker');
        majJokersUI();

        var buttons = Array.from(reponsesGrid.querySelectorAll('.qz-rep-btn'));
        var bonneIdx = questionPrete.bonneRepIndex;
        var fausses = buttons.filter(function (btn, i) { return i !== bonneIdx; });

        // Retirer 2 fausses au hasard
        fausses.sort(function () { return Math.random() - 0.5; });
        if (fausses[0]) {
          fausses[0].disabled = true;
          fausses[0].classList.add('is-eliminated');
        }
        if (fausses[1]) {
          fausses[1].disabled = true;
          fausses[1].classList.add('is-eliminated');
        }
      });
    }

    /* Joker 2 : +10s TEMPS */
    if (jokerTimeBtn) {
      jokerTimeBtn.addEventListener('click', function () {
        if (!jokers.temps || reponseVerrouillee || fini || enCoursDeFrappe) return;
        jokers.temps = false;
        jouerSon('joker');
        majJokersUI();

        tempsRestant = Math.min(16, tempsRestant + 10);
        majChronoUI();
      });
    }

    /* Joker 3 : PASSE */
    if (jokerPassBtn) {
      jokerPassBtn.addEventListener('click', function () {
        if (!jokers.passe || reponseVerrouillee || fini || enCoursDeFrappe || questionsReserve.length === 0) return;
        jokers.passe = false;
        jouerSon('joker');
        majJokersUI();
        stopTimer();
        stopFrappe();

        // Remplacement par une question de réserve
        var nouvelleQ = questionsReserve.shift();
        listeQuestions[indexCourant] = nouvelleQ;
        afficherQuestion();
      });
    }

    // Démarrage initial
    afficherQuestion();

    return {
      abandonner: function () {
        fini = true;
        stopTimer();
        stopFrappe();
      }
    };
  }

  // Export pour les tirages et le panneau admin
  window.NautilusQuiz = {
    init: init,
    tirerQuestionsPourEquipe: tirerQuestionsPourEquipe,
    BANQUE: BANQUE_30_QUESTIONS
  };
})();
