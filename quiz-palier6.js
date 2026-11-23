/* =============================================================
   PALIER 6 — « LE GRAND QUIZ DES ABYSSES »
   Moteur interactif du Quiz scientifique & vernien (quiz-palier6.js)

   RÈGLES OFFICIELLES :
   - 10 questions pointues tirées d'une banque de 30 questions par équipe.
   - 4 choix par question (1 seule bonne réponse, 3 distracteurs crédibles).
   - Chronomètre de 10 secondes par question.
   - Pause de transition de 6 secondes avec révélation avant la suite (ou clic Suivant immédiat).
   - 3 indices uniques par partie (1 de chaque) :
       ✂️ 50/50 : retire 2 mauvaises réponses.
       ⏳ +10s : ajoute 10 secondes de réflexion.
       ⏭️ Passe : saute la question sans erreur et en pioche une nouvelle.
   - Règle des 3 erreurs max : chaque mauvaise réponse allume un voyant d'alerte.
     À la 3e erreur : éjection immédiate (remontée en surface, blocage matelot).
   - Seuil de réussite ≥ 80% (au moins 8/10 requis) pour franchir le palier.
   ============================================================= */
(function () {
  'use strict';
  if (window.NautilusQuiz) return;

  var DUREE_QUESTION_SEC = 10;
  var DUREE_PAUSE_SEC = 6;
  var NB_QUESTIONS_PARTIE = 10;
  var SEUIL_REUSSITE = 8; // 8 / 10 = 80%
  var MAX_ERREURS = 3;

  /* ================= BANQUE DES 30 QUESTIONS SCIENTIFIQUES & VERNIENNES ================= */
  var BANQUE_30_QUESTIONS = [
    {
      id: 'geo_vengeur',
      domaine: '🌍 GÉOGRAPHIE & HISTOIRE',
      q: "À quelles coordonnées précises Nemo immerge-t-il le Nautilus pour rendre un hommage solennel au navire « Le Vengeur du Peuple » coulé en 1794 ?",
      reps: [
        "47° 24' N et 17° 28' O",
        "42° 15' N et 12° 40' O",
        "49° 10' N et 21° 05' O",
        "45° 50' N et 15° 12' O"
      ],
      ok: 0,
      expl: "Dans le chapitre « Le Vengeur », Nemo calcule et atteint exactement 47° 24' de latitude Nord et 17° 28' de longitude Ouest."
    },
    {
      id: 'geo_tunnel',
      domaine: '🌍 GÉOGRAPHIE & DÉTROITS',
      q: "Quel est le nom du passage sous-marin secret découvert par Nemo reliant la mer Rouge à la Méditerranée sous l'isthme de Suez ?",
      reps: [
        "L'Arabian Tunnel",
        "Le détroit de Bab-el-Mandeb",
        "La passe souterraine de Péroïse",
        "Le siphon d'Ormuz"
      ],
      ok: 0,
      expl: "Nemo a reconnu la communication entre les deux mers en baguant des poissons, nommant ce chenal naturel l’Arabian Tunnel."
    },
    {
      id: 'geo_vigo',
      domaine: '🌍 GÉOGRAPHIE & TRÉSORS',
      q: "En 1702, quelle célèbre flotte chargée d'or et d'argent a sombré dans la baie de Vigo, fournissant au Capitaine Nemo son inépuisable trésor ?",
      reps: [
        "La flotte des galions espagnols de la Plata",
        "L'Invincible Armada des Caraïbes",
        "L'escadre marchande des Philippines",
        "La flotte royale de l'Amirauté de Cadix"
      ],
      ok: 0,
      expl: "Le Nautilus puise son or dans les carcasses des galions coulés par les escadres anglo-hollandaises le 22 octobre 1702."
    },
    {
      id: 'geo_pole_sud',
      domaine: '🌍 GÉOGRAPHIE POLAIRE',
      q: "À quelle date historique le Capitaine Nemo prend-il possession du pôle Sud géographique au nom de lui-même ?",
      reps: [
        "21 mars 1868 (jour de l'équinoxe)",
        "14 juillet 1867 (solstice boréal)",
        "21 décembre 1868 (solstice austral)",
        "1er janvier 1869 (nouvel an polaire)"
      ],
      ok: 0,
      expl: "C'est au midi solaire du 21 mars 1868, jour de l'équinoxe, que Nemo déploie son étandard noir marqué d'un 'N' doré."
    },
    {
      id: 'geo_atlantide',
      domaine: '🌋 GÉOLOGIE & ABYSSES',
      q: "Vers quelle formation sous-marine Nemo guide-t-il Aronnax en scaphandre pour contempler les ruines calcinées de l'Atlantide engloutie ?",
      reps: [
        "La montagne sous-marine au large des Açores",
        "La fosse océanique des Caïmans",
        "La grande faille de Porto Rico",
        "La dorsale centrale de Sainte-Hélène"
      ],
      ok: 0,
      expl: "Les ruines atlantes s'étendent au pied d'un volcan sous-marin en éruption près de l'archipel des Açores."
    },
    {
      id: 'geo_crespo',
      domaine: '🌿 BOTANIQUE & EXPLORATION',
      q: "Dans quelle forêt sous-marine le Capitaine Nemo convie-t-il Pierre Aronnax à sa première partie de chasse avec fusils pneumatiques ?",
      reps: [
        "L'île Crespo (forêt de laminaires géantes)",
        "L'archipel des îles Mariannes",
        "La barrière de corail de Vanikoro",
        "La côte volcanique des îles Marquises"
      ],
      ok: 0,
      expl: "L’îlot Crespo, par 32° de latitude Nord, abrite une grandiose forêt sous-marine d’algues arborescentes de plusieurs dizaines de mètres."
    },
    {
      id: 'math_dimensions',
      domaine: '📐 GÉOMÉTRIE DU NAUTILUS',
      q: "Quelles sont les dimensions géométriques exactes de la coque cylindrique d'acier du Nautilus conçue par Nemo ?",
      reps: [
        "70 mètres de longueur sur 8 mètres de diamètre",
        "85 mètres de longueur sur 10 mètres de diamètre",
        "60 mètres de longueur sur 6 mètres de diamètre",
        "95 mètres de longueur sur 12 mètres de diamètre"
      ],
      ok: 0,
      expl: "Nemo décrit son navire comme un cylindre très allongé à bouts coniques : 70 mètres d’un bout à l’autre, et 8 mètres à son maître-bau."
    },
    {
      id: 'math_deplacement',
      domaine: '📐 PHYSIQUE & HYDRODYNAMIQUE',
      q: "Quel est le volume intérieur et le déplacement d'eau en surface de la double coque du Nautilus ?",
      reps: [
        "1 500 mètres cubes et 1 507 tonnes d'eau déplacée",
        "2 200 mètres cubes et 2 350 tonnes d'eau déplacée",
        "1 100 mètres cubes et 1 050 tonnes d'eau déplacée",
        "3 000 mètres cubes et 3 120 tonnes d'eau déplacée"
      ],
      ok: 0,
      expl: "Nemo calcule que son submersible déplace 1 507,2 tonnes métriques, ne laissant émerger qu'un dixième de sa coque en surface."
    },
    {
      id: 'math_lieues',
      domaine: '📐 UNITÉS & MESURES',
      q: "À quelle distance métrique correspondent les « 20 000 lieues » sous les mers selon la lieue marine française employée par Jules Verne ?",
      reps: [
        "80 000 kilomètres (lieue de 4 km, deux tours de la Terre)",
        "111 120 kilomètres (lieue nautique de trois milles)",
        "50 000 kilomètres (périmètre équatorial augmenté)",
        "20 000 kilomètres (distance exacte d'un pôle à l'autre)"
      ],
      ok: 0,
      expl: "Verne emploie la lieue de 4 000 mètres : 20 000 lieues font 80 000 kilomètres, soit exactement deux fois la circonférence du globe."
    },
    {
      id: 'math_vitesse',
      domaine: '📐 CALCUL CINÉMATIQUE',
      q: "Quelle vitesse de pointe maximale le loch électrique du Nautilus enregistre-t-il lors de ses pointes en plongée profonde ?",
      reps: [
        "50 milles à l'heure (environ 92,6 km/h)",
        "32 milles à l'heure (environ 59,2 km/h)",
        "65 milles à l'heure (environ 120,4 km/h)",
        "22 milles à l'heure (environ 40,7 km/h)"
      ],
      ok: 0,
      expl: "Sous la pleine poussée de ses batteries sodium, l'hélice du Nautilus le propulse à la vitesse foudroyante de 50 milles marins par heure."
    },
    {
      id: 'phys_energie',
      domaine: '⚡ PHYSIQUE & ÉLECTRICITÉ',
      q: "Quelle source chimique fournit l'électricité intégrale du Nautilus sans nécessiter de ravitaillement en charbon ?",
      reps: [
        "Le sodium extrait de l'eau de mer alimentant des piles Bunsen",
        "Des accumulateurs au plomb rechargés par courants thermiques",
        "Des dynamos à fluide phosphorescent sous haute pression",
        "Une pile galvanique fonctionnant au zinc minéral marin"
      ],
      ok: 0,
      expl: "Nemo extrait le sel marin (chlorure de sodium) et en isole le sodium métallique pour alimenter ses puissantes piles Bunsen."
    },
    {
      id: 'phys_pression',
      domaine: '🌊 HYDROSTATIQUE DES ABYSSES',
      q: "À quelle profondeur record Aronnax observe-t-il le manomètre descendre dans l'Atlantique Sud sans écrasement de la coque ?",
      reps: [
        "16 000 mètres (quatre lieues sous la surface)",
        "11 000 mètres (fond de la fosse des Mariannes)",
        "8 500 mètres (plancher abyssal tropical)",
        "22 000 mètres (abîme austral théorique)"
      ],
      ok: 0,
      expl: "Le Nautilus sonde jusqu'à 16 000 mètres de profondeur le 13 mars, supportant une pression phénoménale de 1 600 kg par cm²."
    },
    {
      id: 'phys_air',
      domaine: '🫁 PNEUMATIQUE DU BORD',
      q: "À quelle pression les réservoirs d'acier du Nautilus emmagasinent-ils l'air pour assurer 24 heures d'immersion totale à l'équipage ?",
      reps: [
        "15 atmosphères (environ 15 bars)",
        "50 atmosphères (environ 50 bars)",
        "5 atmosphères (environ 5 bars)",
        "100 atmosphères (environ 100 bars)"
      ],
      ok: 0,
      expl: "Des pompes refoulent l'air frais comprimé à 15 atmosphères dans des réservoirs de réserve, libéré selon les besoins vitaux du bord."
    },
    {
      id: 'phys_chaleur',
      domaine: '🌡️ THERMODYNAMIQUE',
      q: "Comment Nemo maintient-il la température intérieure des salons et cabines dans les eaux glaciales des calottes polaires ?",
      reps: [
        "Par des calorifères électriques alimentés par les piles du bord",
        "Par un échangeur thermique puisant aux cheminées hydrothermales",
        "Par la combustion continue d'huile de cétacés purifiée",
        "Par des réservoirs calorifugés de soufre volcanique"
      ],
      ok: 0,
      expl: "L'électricité assure tout le confort : lumière, force motrice et chauffage intégral au moyen de résistances calorifères."
    },
    {
      id: 'phys_fanal',
      domaine: '💡 OPTIQUE SOUS-MARINE',
      q: "Quel dispositif optique permet au fanal électrique de projeter sa clarté jusqu'à un demi-mille marin dans la nuit abyssale ?",
      reps: [
        "Une lampe à arc électrique concentrée par une lentille biconvexe",
        "Un miroir parabolique argenté en quartz taillé",
        "Un tube à induction phosphorescente de Ruhmkorff",
        "Une lanterne à prisme rotatif de Fresnel"
      ],
      ok: 0,
      expl: "Nemo utilise un puissant arc voltaïque logé dans une cage vitrée au sommet du sous-marin, orienté par une grande lentille biconvexe."
    },
    {
      id: 'bio_calmar',
      domaine: '🦑 BIOLOGIE ABYSSALE',
      q: "Quelle est l'anatomie exacte du monstre céphalopode qui attaque la plateforme du Nautilus au large des îles Lucayes ?",
      reps: [
        "Un calmar géant de 8 mètres muni de 8 bras et 2 tentacules",
        "Une pieuvre colossale de 15 mètres pourvue de 6 bras dentelés",
        "Un poulpe cuirassé de 12 mètres doté de 12 tentacules rétractiles",
        "Une seiche abyssale de 5 mètres armée de 4 appendices cornés"
      ],
      ok: 0,
      expl: "Aronnax décrit avec précision un calmar décapode mesurant huit mètres de longueur, muni de huit bras et de deux longs tentacules préhensiles."
    },
    {
      id: 'bio_perle',
      domaine: '🦪 BIOLOGIE & MALACOLOGIE',
      q: "Quelle est la dimension prodigieuse de la perle que Nemo élève en secret dans une tridacne géante au banc de Manaar ?",
      reps: [
        "La grosseur d'un œuf de coco (estimée à plus de 10 millions)",
        "La circonférence d'une pomme de pin boréale",
        "Le volume arrondi d'une tête d'enfant",
        "Le gabarit d'une orange sanguine de Malte"
      ],
      ok: 0,
      expl: "Dans une bénitier géant (Tridacna gigas) de deux mètres, Nemo laisse grandir une perle globuleuse de la taille d'une noix de coco."
    },
    {
      id: 'bio_dugong',
      domaine: '🐋 FAUNE MARINE',
      q: "Quel mammifère marin herbivore de grande taille Ned Land poursuit-il et harponne-t-il dans les eaux de la mer Rouge ?",
      reps: [
        "Un dugong (sirénien mesurant plus de sept mètres)",
        "Un narval géant à corne spiralée double",
        "Un lamantin des lagunes équatoriales",
        "Un léopard de mer égaré aux tropiques"
      ],
      ok: 0,
      expl: "Le fougueux harponneur canadien traque un gigantesque dugong dont la chair savoureuse garnira la table du salon pendant des semaines."
    },
    {
      id: 'bio_biolumi',
      domaine: '✨ BIOLUMINESCENCE',
      q: "À quel phénomène biologique Nemo attribue-t-il les féeriques « mers de lait » phosphorescentes que le Nautilus traverse sur des lieues ?",
      reps: [
        "À d'innombrables animalcules luminescents (noctiluques et vers gélatineux)",
        "À des bancs ultra-denses de méduses pélagiques fluorescentes",
        "À des émanations sous-marines de phosphure d'hydrogène naturel",
        "À des colonies d'algues siliceuses réagissant à la salinité"
      ],
      ok: 0,
      expl: "L'illumination nocturne provient de myriades de zoophytes microscopiques et de noctiluques dont le mucus étincelle sous l'eau."
    },
    {
      id: 'bio_cachalots',
      domaine: '🌊 ÉCOLOGIE MARINE',
      q: "Pour quel motif éthique Nemo lance-t-il l'éperon du Nautilus dans un massacre impitoyable de cachalots dans le Pacifique ?",
      reps: [
        "Pour défendre les baleines franches et leurs baleineaux attaqués en meute",
        "Pour extraire l'ambre gris obstruant les prises d'eau des ballasts",
        "Parce que les cachalots tentaient de broyer la cage de l'hélice",
        "Pour libérer un banc de corail rare menacé de destruction"
      ],
      ok: 0,
      expl: "Nemo distingue les baleines douces des cachalots 'bêtes cruelles et malfaisantes' qu'il extermine sans pitié pour protéger le troupeau."
    },
    {
      id: 'hum_devise',
      domaine: '📜 PHILOSOPHIE & SYMBOLES',
      q: "Quelle est la célèbre devise latine gravée sur le sceau, la vaisselle et l'étendard du Capitaine Nemo ?",
      reps: [
        "Mobilis in mobili (« Mobile dans l'élément mobile »)",
        "Fluctuat nec mergitur (« Il flotte sans sombrer »)",
        "Per mare ad astra (« Par la mer jusqu'aux étoiles »)",
        "Mare liberum, anima libera (« Mer libre, âme libre »)"
      ],
      ok: 0,
      expl: "La lettre 'N' majuscule d'or est accompagnée de la maxime Mobilis in mobili, emblème de la liberté absolue de Nemo dans l'océan."
    },
    {
      id: 'hum_aronnax',
      domaine: '📜 PERSONNAGES DU ROMAN',
      q: "Quelle fonction savante officielle Pierre Aronnax occupe-t-il avant d'être capturé par l'équipage du Nautilus ?",
      reps: [
        "Professeur suppléant au Muséum d'histoire naturelle de Paris",
        "Conservateur des collections océanographiques de Brest",
        "Directeur de l'Institut royal d'hydrographie navale",
        "Docteur titulaire de la chaire de zoologie comparée de Leyde"
      ],
      ok: 0,
      expl: "Auteur des « Mystères des grands fonds sous-marins », Aronnax est professeur suppléant au Muséum national d'histoire naturelle."
    },
    {
      id: 'hum_conseil',
      domaine: '📜 PERSONNAGES DU ROMAN',
      q: "Quelle est la ville natale et la passion méthodique de Conseil, le flegmatique serviteur d'Aronnax ?",
      reps: [
        "Gantois (originaire de Flandre) et classificateur taxonomique maniaque",
        "Parisien de naissance et dessinateur anatomiste de précision",
        "Anversois d'origine et herboriste spécialisé en algues",
        "Bruxellois de souche et mécanicien horloger d'instruments"
      ],
      ok: 0,
      expl: "Conseil est un Flamand de trente ans, flegmatique et dévoué, capable de classifier instantanément n'importe quel poisson en embranchements."
    },
    {
      id: 'hum_nedland',
      domaine: '📜 PERSONNAGES DU ROMAN',
      q: "D'où est originaire Ned Land, le redoutable roi des harponneurs embarqué à bord de la frégate pour chasser le cétacé ?",
      reps: [
        "De Québec (Canada francophone)",
        "De Boston (Massachusetts, États-Unis)",
        "D'Édimbourg (Écosse)",
        "D'Halifax (Nouvelle-Écosse)"
      ],
      ok: 0,
      expl: "Canadien français vigoureux et colossal, Ned Land manie le harpon avec une précision inégalée sur toutes les mers du globe."
    },
    {
      id: 'hum_dakkar',
      domaine: '👑 HISTOIRE & BIOGRAPHIE',
      q: "Quelle est la véritable identité royale de Nemo révélée par Jules Verne dans son roman « L'Île mystérieuse » ?",
      reps: [
        "Le Prince Dakkar, fils d'un râja souverain du Bundelkhand (Inde)",
        "Un aristocrate polonais vengeant l'écrasement de sa patrie",
        "L'amiral d'Acre exilé de l'Empire ottoman en révolte",
        "Un noble vénitien descendant des doges de la République maritime"
      ],
      ok: 0,
      expl: "Nemo est le Prince Dakkar, patriote indien instruit en Europe ayant pris la mer pour fuir la tyrannie après la révolte des Cipayes."
    },
    {
      id: 'hum_fregate',
      domaine: '🚢 NAVIRES HISTORIQUES',
      q: "Quel est le nom de la frégate de guerre américaine qui traque le Nautilus au début de l'aventure avant d'être éperonnée ?",
      reps: [
        "L'Abraham Lincoln",
        "Le Franklin Pierce",
        "Le George Washington",
        "L'Alexander Hamilton"
      ],
      ok: 0,
      expl: "Sous les ordres du commandant Farragut, la frégate à vapeur rapide Abraham Lincoln est lancée à la poursuite du prétendu narval géant."
    },
    {
      id: 'hum_peintres',
      domaine: '🎨 ARTS & HUMANITÉS',
      q: "Quels illustres maîtres de la Renaissance ornent les cimaises du musée privé du Capitaine Nemo dans le salon ?",
      reps: [
        "Raphaël, Léonard de Vinci, Titien, Vélasquez, Rubens et Holbein",
        "Michel-Ange, Caravage, Véronèse, Tintoret et Le Bernin",
        "Rembrandt, Vermeer, Van Dyck, Frans Hals et Brueghel",
        "Poussin, Delacroix, Géricault, Ingres et Turner"
      ],
      ok: 0,
      expl: "Aronnax admire une collection inestimable de chefs-d'œuvre de la peinture flamande, italienne et espagnole rachetés au fil de ses voyages."
    },
    {
      id: 'hum_orgue',
      domaine: '🎵 MUSIQUE DU BORD',
      q: "Quel instrument de musique monumental occupe le grand salon du Nautilus, sur lequel Nemo improvise des harmonies tragiques la nuit ?",
      reps: [
        "Un grand orgue-harmonium à pédalier de concert",
        "Un clavecin flamand en palissandre et ivoire marin",
        "Un piano à queue de facteur viennois en bronze forgé",
        "Un violoncelle d'ébène accordé aux fréquences sous-marines"
      ],
      ok: 0,
      expl: "Nemo passe de longues nuits d'extase devant son grand orgue, y jouant les chefs-d'œuvre de Beethoven, Mozart et Weber."
    },
    {
      id: 'terre_maelstrom',
      domaine: '🌀 OCÉANOGRAPHIE PHYSIQUE',
      q: "Près de quel archipel boréal norvégien le Nautilus est-il pris au piège dans le redoutable gouffre du Maelström ?",
      reps: [
        "L'archipel des îles Lofoten (entre Moskenesøya et Værøy)",
        "L'archipel du Svalbard au cap Nord",
        "Les îles Féroé au nord de l'Écosse",
        "Les récifs isolés des îles Vesterålen"
      ],
      ok: 0,
      expl: "C'est dans le gouffre du Moskenstraumen, le légendaire Maelström des Lofoten, que le Nautilus tourbillonne au dénouement de l'ouvrage."
    },
    {
      id: 'terre_corail',
      domaine: '🪸 CORAIL & SÉPULTURE',
      q: "Quel sanctuaire sous-marin inviolable Nemo choisit-il pour ensevelir un membre d'équipage blessé à mort lors d'un abordage ?",
      reps: [
        "Une clairière de corail blanc et de madrépores par 300 mètres de fond",
        "Une caverne basaltique sans courant ni sédiment",
        "Une faille sous-marine scellée par des blocs volcaniques",
        "Le pont immergé d'une épave de trois-mâts espagnol"
      ],
      ok: 0,
      expl: "Sous la croix de corail, les matelots reposent à l'abri des requins et des hommes : le corail recouvre lentement leurs tombes pour l'éternité."
    }
  ];

  /* Générateur pseudo-aléatoire reproductible par équipage */
  function aleaSeed(graine) {
    var h = 2166136261;
    var s = String(graine);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return function () {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 100000) / 100000;
    };
  }

  /* Sons Web Audio immersifs via NautilusSon */
  function jouerSon(type) {
    if (!window.NautilusSon || !window.NautilusSon.sonActif()) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      window.NautilusSon.registerContexte(ctx);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      if (type === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.09);
      } else if (type === 'ok') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.20, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.36);
      } else if (type === 'faux') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.33);
      } else if (type === 'joker') {
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
    // Les 20 restantes servent de réserve pour le joker "Passe"
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
      bonneRepTexte: qObj.reps[qObj.ok],
      explication: qObj.expl
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
    var pauseTimerId = null;
    var pauseRestante = DUREE_PAUSE_SEC;
    var questionPrete = null;
    var reponseVerrouillee = false;

    /* Injection du gabarit HTML minimaliste et immersif */
    host.innerHTML =
      '<div class="qz-container">'
      + '  <!-- 1. En-tête de bord -->'
      + '  <div class="qz-hud">'
      + '    <div class="qz-hud-top">'
      + '      <div class="qz-step-badge">QUESTION <b id="qzCurNum">1</b> / 10</div>'
      + '      <div class="qz-voyants" id="qzVoyants" title="Voyants d\'alerte (3 erreurs max)">'
      + '        <span class="qz-voyant" id="qzV1"></span>'
      + '        <span class="qz-voyant" id="qzV2"></span>'
      + '        <span class="qz-voyant" id="qzV3"></span>'
      + '        <span class="qz-voyants-lbl">ERREURS</span>'
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
      + '      <span class="qz-timer-val" id="qzTimerVal">10s</span>'
      + '    </div>'
      + '    <div class="qz-timer-track">'
      + '      <div class="qz-timer-bar" id="qzTimerBar" style="width:100%"></div>'
      + '    </div>'
      + '  </div>'

      + '  <!-- 3. Carte de la question -->'
      + '  <div class="qz-card" id="qzCard">'
      + '    <div class="qz-domaine" id="qzDomaine">—</div>'
      + '    <h3 class="qz-question-text" id="qzQuestion">—</h3>'
      + '  </div>'

      + '  <!-- 4. Grille des 4 réponses -->'
      + '  <div class="qz-grid" id="qzReponses" role="group" aria-label="Réponses au choix"></div>'

      + '  <!-- 5. Rack des 3 Indices (1 de chaque) -->'
      + '  <div class="qz-indices-box">'
      + '    <div class="qz-indices-title">AIDES DE BORD (1 de chaque par tentative) :</div>'
      + '    <div class="qz-indices-row">'
      + '      <button type="button" class="qz-btn-joker" id="qzJoker50" title="Retire deux réponses fausses">'
      + '        <span class="qz-joker-ico">✂️</span>'
      + '        <span class="qz-joker-lbl"><b>50 / 50</b> <span class="qz-joker-sub" id="qzJoker50Sub">1 disponible</span></span>'
      + '      </button>'
      + '      <button type="button" class="qz-btn-joker" id="qzJokerTime" title="Ajoute 10 secondes au chronomètre">'
      + '        <span class="qz-joker-ico">⏳</span>'
      + '        <span class="qz-joker-lbl"><b>+10s TEMPS</b> <span class="qz-joker-sub" id="qzJokerTimeSub">1 disponible</span></span>'
      + '      </button>'
      + '      <button type="button" class="qz-btn-joker" id="qzJokerPass" title="Passe à une autre question sans compter d\'erreur">'
      + '        <span class="qz-joker-ico">⏭️</span>'
      + '        <span class="qz-joker-lbl"><b>PASSE</b> <span class="qz-joker-sub" id="qzJokerPassSub">1 disponible</span></span>'
      + '      </button>'
      + '    </div>'
      + '  </div>'

      + '  <!-- 6. Panneau de pause & explication -->'
      + '  <div class="qz-pause-box" id="qzPauseBox" hidden>'
      + '    <div class="qz-pause-status" id="qzPauseStatus"></div>'
      + '    <div class="qz-pause-expl" id="qzPauseExpl"></div>'
      + '    <div class="qz-pause-action">'
      + '      <button type="button" class="qz-btn-next" id="qzBtnNext">Suivant ➔ (<span id="qzNextCountdown">6s</span>)</button>'
      + '    </div>'
      + '  </div>'
      + '</div>';

    var curNumEl = host.querySelector('#qzCurNum');
    var scoreValEl = host.querySelector('#qzScoreVal');
    var progressFillEl = host.querySelector('#qzProgressFill');
    var timerValEl = host.querySelector('#qzTimerVal');
    var timerBarEl = host.querySelector('#qzTimerBar');
    var timerBadgeEl = host.querySelector('#qzTimerBadge');
    var domaineEl = host.querySelector('#qzDomaine');
    var questionEl = host.querySelector('#qzQuestion');
    var reponsesGrid = host.querySelector('#qzReponses');
    var joker50Btn = host.querySelector('#qzJoker50');
    var jokerTimeBtn = host.querySelector('#qzJokerTime');
    var jokerPassBtn = host.querySelector('#qzJokerPass');
    var joker50Sub = host.querySelector('#qzJoker50Sub');
    var jokerTimeSub = host.querySelector('#qzJokerTimeSub');
    var jokerPassSub = host.querySelector('#qzJokerPassSub');
    var pauseBox = host.querySelector('#qzPauseBox');
    var pauseStatus = host.querySelector('#qzPauseStatus');
    var pauseExpl = host.querySelector('#qzPauseExpl');
    var btnNext = host.querySelector('#qzBtnNext');
    var nextCountdown = host.querySelector('#qzNextCountdown');
    var v1 = host.querySelector('#qzV1');
    var v2 = host.querySelector('#qzV2');
    var v3 = host.querySelector('#qzV3');

    function majVoyants() {
      if (v1) v1.classList.toggle('active', erreurs >= 1);
      if (v2) v2.classList.toggle('active', erreurs >= 2);
      if (v3) v3.classList.toggle('active', erreurs >= 3);
    }

    function majJokersUI() {
      if (joker50Btn) {
        joker50Btn.disabled = !jokers.cinquante || reponseVerrouillee;
        joker50Btn.classList.toggle('is-used', !jokers.cinquante);
        if (joker50Sub) joker50Sub.textContent = jokers.cinquante ? '1 disponible' : '✓ Utilisé';
      }
      if (jokerTimeBtn) {
        jokerTimeBtn.disabled = !jokers.temps || reponseVerrouillee;
        jokerTimeBtn.classList.toggle('is-used', !jokers.temps);
        if (jokerTimeSub) jokerTimeSub.textContent = jokers.temps ? '1 disponible' : '✓ Utilisé';
      }
      if (jokerPassBtn) {
        jokerPassBtn.disabled = !jokers.passe || reponseVerrouillee || questionsReserve.length === 0;
        jokerPassBtn.classList.toggle('is-used', !jokers.passe);
        if (jokerPassSub) jokerPassSub.textContent = jokers.passe ? '1 disponible' : '✓ Utilisé';
      }
    }

    function stopTimer() {
      if (timerId) { clearInterval(timerId); timerId = null; }
    }

    function stopPauseTimer() {
      if (pauseTimerId) { clearInterval(pauseTimerId); pauseTimerId = null; }
    }

    function lancerTimer() {
      stopTimer();
      tempsRestant = DUREE_QUESTION_SEC;
      majChronoUI();

      timerId = setInterval(function () {
        tempsRestant--;
        majChronoUI();
        if (tempsRestant <= 3 && tempsRestant > 0) {
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
      var estCritique = tempsRestant <= 3;
      if (timerBadgeEl) timerBadgeEl.classList.toggle('is-alert', estCritique);
      if (timerBarEl) timerBarEl.classList.toggle('is-alert', estCritique);
    }

    /* Affichage de la question courante */
    function afficherQuestion() {
      if (indexCourant >= NB_QUESTIONS_PARTIE) {
        terminerQuiz();
        return;
      }

      reponseVerrouillee = false;
      stopPauseTimer();
      if (pauseBox) pauseBox.hidden = true;

      var qObj = listeQuestions[indexCourant];
      questionPrete = preparerQuestionPourAffichage(qObj, indexCourant, equipeCode);

      if (curNumEl) curNumEl.textContent = String(indexCourant + 1);
      if (scoreValEl) scoreValEl.textContent = String(score);
      if (progressFillEl) progressFillEl.style.width = Math.round((indexCourant / NB_QUESTIONS_PARTIE) * 100) + '%';
      if (domaineEl) domaineEl.textContent = questionPrete.domaine;
      if (questionEl) questionEl.textContent = questionPrete.q;

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
      majJokersUI();
      lancerTimer();
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

      buttons.forEach(function (btn, i) {
        btn.disabled = true;
        if (i === bonneIdx) {
          btn.classList.add('is-correct');
        } else if (i === idxChoisi && !estBon) {
          btn.classList.add('is-wrong');
        }
      });

      if (estBon) {
        score++;
        jouerSon('ok');
        if (scoreValEl) scoreValEl.textContent = String(score);
        if (pauseStatus) {
          pauseStatus.className = 'qz-pause-status is-ok';
          pauseStatus.innerHTML = '✅ <b>EXCELLENTE RÉPONSE !</b>';
        }
      } else {
        erreurs++;
        jouerSon('faux');
        majVoyants();
        if (pauseStatus) {
          pauseStatus.className = 'qz-pause-status is-wrong';
          pauseStatus.innerHTML = estTimeout
            ? '⏱️ <b>TEMPS ÉCOULÉ !</b> La bonne réponse était : <b>' + questionPrete.bonneRepTexte + '</b>'
            : '❌ <b>MAUVAISE RÉPONSE !</b> La bonne réponse était : <b>' + questionPrete.bonneRepTexte + '</b>';
        }

        if (erreurs >= MAX_ERREURS) {
          // Éjection immédiate (3 erreurs)
          fini = true;
          if (pauseExpl) pauseExpl.innerHTML = '🚨 <b>3 ERREURS ATTEINTES !</b> Les systèmes du Nautilus se verrouillent : remontée forcée en surface.';
          if (pauseBox) pauseBox.hidden = false;
          setTimeout(function () {
            onEchec('erreurs');
          }, 1800);
          return;
        }
      }

      if (pauseExpl) {
        pauseExpl.innerHTML = '💡 <i>' + questionPrete.explication + '</i>';
      }
      if (pauseBox) pauseBox.hidden = false;

      // Battement de 6 secondes ou clic Suivant
      lancerPauseSuivant();
    }

    function tempsEcoule() {
      validerReponse(-1, true);
    }

    function lancerPauseSuivant() {
      stopPauseTimer();
      pauseRestante = DUREE_PAUSE_SEC;
      if (nextCountdown) nextCountdown.textContent = pauseRestante + 's';

      pauseTimerId = setInterval(function () {
        pauseRestante--;
        if (nextCountdown) nextCountdown.textContent = pauseRestante + 's';
        if (pauseRestante <= 0) {
          stopPauseTimer();
          passerQuestionSuivante();
        }
      }, 1000);
    }

    function passerQuestionSuivante() {
      stopPauseTimer();
      indexCourant++;
      afficherQuestion();
    }

    /* Terminaison du quiz */
    function terminerQuiz() {
      fini = true;
      stopTimer();
      stopPauseTimer();

      if (progressFillEl) progressFillEl.style.width = '100%';

      var dureeTotale = Math.round((Date.now() - t0) / 1000);
      var pct = Math.round((score / NB_QUESTIONS_PARTIE) * 100);

      if (score >= SEUIL_REUSSITE && erreurs < MAX_ERREURS) {
        jouerSon('ok');
        if (pauseStatus) {
          pauseStatus.className = 'qz-pause-status is-ok';
          pauseStatus.innerHTML = '🏆 <b>VICTOIRE ! ' + score + '/10 (' + pct + '%) RÉUSSI !</b>';
        }
        if (pauseExpl) {
          pauseExpl.innerHTML = 'Félicitations, matelot ! Votre maîtrise des sciences du Nautilus déverrouille l’accès au Palier 7.';
        }
        if (btnNext) btnNext.style.display = 'none';
        if (pauseBox) pauseBox.hidden = false;

        setTimeout(function () {
          onVictoire({ score: score, erreurs: erreurs, duree: dureeTotale });
        }, 1200);
      } else {
        jouerSon('faux');
        if (pauseStatus) {
          pauseStatus.className = 'qz-pause-status is-wrong';
          pauseStatus.innerHTML = '🚨 <b>ÉCHEC : ' + score + '/10 (' + pct + '%). SEUIL ≥ 80% NON ATTEINT.</b>';
        }
        if (pauseExpl) {
          pauseExpl.innerHTML = 'Moins de 8 réponses justes trouvées. Remontée immédiate en surface.';
        }
        if (btnNext) btnNext.style.display = 'none';
        if (pauseBox) pauseBox.hidden = false;

        setTimeout(function () {
          onEchec('score_insuffisant');
        }, 1800);
      }
    }

    /* Activer le Joker 50/50 */
    function utiliserJoker50() {
      if (!jokers.cinquante || reponseVerrouillee || fini || !questionPrete) return;
      jokers.cinquante = false;
      jouerSon('joker');
      majJokersUI();

      var buttons = reponsesGrid.querySelectorAll('.qz-rep-btn');
      var bonneIdx = questionPrete.bonneRepIndex;
      var fausses = [];
      buttons.forEach(function (btn, i) {
        if (i !== bonneIdx) fausses.push(btn);
      });

      // Écarte 2 fausses au hasard
      fausses.sort(function () { return 0.5 - Math.random(); });
      if (fausses[0]) { fausses[0].disabled = true; fausses[0].classList.add('is-eliminated'); }
      if (fausses[1]) { fausses[1].disabled = true; fausses[1].classList.add('is-eliminated'); }
    }

    /* Activer le Joker +10s */
    function utiliserJokerTemps() {
      if (!jokers.temps || reponseVerrouillee || fini) return;
      jokers.temps = false;
      jouerSon('joker');
      tempsRestant = Math.min(25, tempsRestant + 10);
      majChronoUI();
      majJokersUI();
    }

    /* Activer le Joker Passe */
    function utiliserJokerPasse() {
      if (!jokers.passe || reponseVerrouillee || fini || questionsReserve.length === 0) return;
      jokers.passe = false;
      jouerSon('joker');
      stopTimer();

      // Remplace la question courante par une de la réserve
      var nouvelleQuestion = questionsReserve.shift();
      listeQuestions[indexCourant] = nouvelleQuestion;
      majJokersUI();
      afficherQuestion();
    }

    /* Écouteurs d'événements */
    reponsesGrid.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.qz-rep-btn') : null;
      if (!btn || reponseVerrouillee || fini || btn.disabled) return;
      var idx = Number(btn.getAttribute('data-idx'));
      validerReponse(idx, false);
    });

    if (btnNext) {
      btnNext.addEventListener('click', function () {
        passerQuestionSuivante();
      });
    }

    if (joker50Btn) joker50Btn.addEventListener('click', utiliserJoker50);
    if (jokerTimeBtn) jokerTimeBtn.addEventListener('click', utiliserJokerTemps);
    if (jokerPassBtn) jokerPassBtn.addEventListener('click', utiliserJokerPasse);

    // Lancement du quiz
    afficherQuestion();

    return {
      abandonner: function () {
        fini = true;
        stopTimer();
        stopPauseTimer();
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
