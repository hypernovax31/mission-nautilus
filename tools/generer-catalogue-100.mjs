import fs from 'node:fs';
import path from 'node:path';

const SALT = 'Nautilus_Fnac_JustePrix_2026';

function encoderPrix(prix, id) {
  const str = String(prix);
  const key = SALT + id;
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 100 Produits officiels Fnac Labège (Rayons, Retrait 1h, Prix réels sans promo)
const PRODUITS_100 = [
  // --- RAYON 1 : SON, CASQUES & ENCEINTES (12) ---
  {
    id: "fnac-audio-01",
    nom: "Casque Bluetooth Marshall Major IV Noir",
    court: "Marshall Major IV",
    categorie: "Son & Casques",
    rayon: "SON & CASQUES",
    prix: 150,
    marque: "MARSHALL",
    detail: "Bluetooth 80h · Arceau pliable · Bouton multidirectionnel",
    couleur: "#f5a623",
    type: "headphones",
    accent: "marshall"
  },
  {
    id: "fnac-audio-02",
    nom: "Enceinte portable Bluetooth JBL Flip 6 Noir",
    court: "JBL Flip 6",
    categorie: "Son & Casques",
    rayon: "ENCEINTES SANS FIL",
    prix: 140,
    marque: "JBL",
    detail: "Étanche IP67 · Son Pro 20W · Radiateurs passifs",
    couleur: "#e84a27",
    type: "speaker",
    accent: "jbl-cyl"
  },
  {
    id: "fnac-audio-03",
    nom: "Platine vinyle Audio-Technica AT-LP60XUSB Noir",
    court: "Platine Audio-Technica",
    categorie: "Son & Vinyles",
    rayon: "HI-FI & VINYLES",
    prix: 180,
    marque: "AUDIO-TECHNICA",
    detail: "Courroie automatique · Sortie USB PC/Mac · Cellule VM95E",
    couleur: "#38bdf8",
    type: "turntable",
    accent: "lp60"
  },
  {
    id: "fnac-audio-04",
    nom: "Écouteurs sans fil Sony WF-C500 True Wireless Noir",
    court: "Sony WF-C500",
    categorie: "Son & Casques",
    rayon: "ÉCOUTEURS SANS FIL",
    prix: 80,
    marque: "SONY",
    detail: "Autonomie 20h · Boîtier compact · Résistance IPX4",
    couleur: "#22d3ee",
    type: "earbuds",
    accent: "sony"
  },
  {
    id: "fnac-audio-05",
    nom: "Casque à réduction de bruit Bose QuietComfort SC Noir",
    court: "Bose QC SC",
    categorie: "Son & Casques",
    rayon: "CASQUES RÉDUCTION BRUIT",
    prix: 300,
    marque: "BOSE",
    detail: "Réduction active Quiet & Aware · 24h d'écoute · USB-C",
    couleur: "#a855f7",
    type: "headphones",
    accent: "bose"
  },
  {
    id: "fnac-audio-06",
    nom: "Écouteurs sans fil Apple AirPods 3 avec boîtier MagSafe",
    court: "AirPods 3 MagSafe",
    categorie: "Son & Casques",
    rayon: "UNIVERS APPLE",
    prix: 199,
    marque: "APPLE",
    detail: "Audio spatial personnalisé · Boîtier MagSafe · IPX4",
    couleur: "#e2e8f0",
    type: "earbuds",
    accent: "airpods"
  },
  {
    id: "fnac-audio-07",
    nom: "Casque sans fil réducteur de bruit Sony WH-1000XM5 Noir",
    court: "Sony WH-1000XM5",
    categorie: "Son & Casques",
    rayon: "CASQUES HAUTE FIDÉLITÉ",
    prix: 420,
    marque: "SONY",
    detail: "Processeur V1 + QN1 · 8 micros · Autonomie 30h",
    couleur: "#fcd34d",
    type: "headphones",
    accent: "sony-xm5"
  },
  {
    id: "fnac-audio-08",
    nom: "Enceinte sans fil connectée Marshall Acton III Bluetooth Noir",
    court: "Marshall Acton III",
    categorie: "Son & Casques",
    rayon: "HI-FI & MAISON",
    prix: 280,
    marque: "MARSHALL",
    detail: "Son stéréo spatial · Façade vinyle laiton · Bluetooth 5.2",
    couleur: "#d97706",
    type: "speaker",
    accent: "acton"
  },
  {
    id: "fnac-audio-09",
    nom: "Enceinte nomade ultra-portable JBL Go 3 Étanche Bleu",
    court: "JBL Go 3 Bleu",
    categorie: "Son & Casques",
    rayon: "ENCEINTES SANS FIL",
    prix: 45,
    marque: "JBL",
    detail: "Format poche · Tissu résistant IP67 · Autonomie 5h",
    couleur: "#0284c7",
    type: "speaker",
    accent: "jbl-go"
  },
  {
    id: "fnac-audio-10",
    nom: "Écouteurs sans fil Bose QuietComfort Earbuds II Noir",
    court: "Bose QC Earbuds II",
    categorie: "Son & Casques",
    rayon: "ÉCOUTEURS RÉDUCTION BRUIT",
    prix: 250,
    marque: "BOSE",
    detail: "Technologie CustomTune · Réduction active personnalisée",
    couleur: "#c084fc",
    type: "earbuds",
    accent: "bose-buds"
  },
  {
    id: "fnac-audio-11",
    nom: "Barre de son compacte TV JBL Bar 2.0 All-In-One MK2",
    court: "Barre de son JBL 2.0",
    categorie: "Son & Casques",
    rayon: "HOME CINÉMA & TV",
    prix: 180,
    marque: "JBL",
    detail: "Dolby Digital · Puissance 80W · HDMI ARC & Optique",
    couleur: "#fb923c",
    type: "speaker",
    accent: "soundbar"
  },
  {
    id: "fnac-audio-12",
    nom: "Casque arceau filaire haute fidélité Sennheiser HD 560S",
    court: "Sennheiser HD 560S",
    categorie: "Son & Casques",
    rayon: "AUDIO HAUTE FIDÉLITÉ",
    prix: 170,
    marque: "SENNHEISER",
    detail: "Conception ouverte circum-auriculaire · Transducteurs 120 Ω",
    couleur: "#38bdf8",
    type: "headphones",
    accent: "sennheiser"
  },

  // --- RAYON 2 : INFORMATIQUE, TABLETTES & BUREAUTIQUE (12) ---
  {
    id: "fnac-info-01",
    nom: "Souris gamer filaire Logitech G502 HERO Noir haute précision",
    court: "Souris Logitech G502",
    categorie: "Informatique & Gaming",
    rayon: "GAMING PC",
    prix: 90,
    marque: "LOGITECH G",
    detail: "Capteur HERO 25K DPI · 11 boutons · Poids ajustables",
    couleur: "#06b6d4",
    type: "periph",
    accent: "mouse-g502"
  },
  {
    id: "fnac-info-02",
    nom: "Clavier mécanique sans fil Logitech G915 LIGHTSPEED TKL Tactile",
    court: "Clavier Logitech G915",
    categorie: "Informatique & Gaming",
    rayon: "GAMING PC",
    prix: 230,
    marque: "LOGITECH G",
    detail: "Switches GL tactiles · Rétroéclairage RVB · Châssis alu",
    couleur: "#10b981",
    type: "periph",
    accent: "keyboard-g915"
  },
  {
    id: "fnac-info-03",
    nom: "Tablette Apple iPad 10.9 pouces Wi-Fi 64 Go Argent",
    court: "Apple iPad 10.9\"",
    categorie: "Informatique & Tablettes",
    rayon: "UNIVERS APPLE",
    prix: 439,
    marque: "APPLE",
    detail: "Écran Liquid Retina 10.9\" · Puce A14 Bionic · USB-C",
    couleur: "#94a3b8",
    type: "tablet",
    accent: "ipad"
  },
  {
    id: "fnac-info-04",
    nom: "Souris bureautique sans fil Logitech MX Master 3S Graphite",
    court: "Logitech MX Master 3S",
    categorie: "Informatique & Bureautique",
    rayon: "BUREAUTIQUE PREMIUM",
    prix: 130,
    marque: "LOGITECH",
    detail: "Capteur 8000 DPI sur verre · Molette MagSpeed · Clics silencieux",
    couleur: "#64748b",
    type: "periph",
    accent: "mouse-mx"
  },
  {
    id: "fnac-info-05",
    nom: "Stylet tactile Apple Pencil 2e génération Blanc",
    court: "Apple Pencil 2",
    categorie: "Informatique & Tablettes",
    rayon: "ACCESSOIRES APPLE",
    prix: 149,
    marque: "APPLE",
    detail: "Fixation et charge magnétique · Détection de l'inclinaison",
    couleur: "#f8fafc",
    type: "periph",
    accent: "pencil"
  },
  {
    id: "fnac-info-06",
    nom: "Clavier sans fil compact multi-dispositifs Logitech MX Keys Mini",
    court: "Logitech MX Keys Mini",
    categorie: "Informatique & Bureautique",
    rayon: "BUREAUTIQUE PREMIUM",
    prix: 110,
    marque: "LOGITECH",
    detail: "Touches concaves Perfect Stroke · Rétroéclairage intelligent",
    couleur: "#cbd5e1",
    type: "periph",
    accent: "keyboard-mini"
  },
  {
    id: "fnac-info-07",
    nom: "Disque dur externe portable Seagate One Touch 2 To USB 3.0 Noir",
    court: "Disque Seagate 2 To",
    categorie: "Informatique & Stockage",
    rayon: "STOCKAGE & SAUVEGARDE",
    prix: 85,
    marque: "SEAGATE",
    detail: "Boîtier aluminium brossé · Rétrocompatible USB 2.0/3.0",
    couleur: "#ef4444",
    type: "periph",
    accent: "hdd"
  },
  {
    id: "fnac-info-08",
    nom: "Clé USB 3.2 SanDisk Ultra Flair 128 Go finition métal",
    court: "Clé USB SanDisk 128 Go",
    categorie: "Informatique & Stockage",
    rayon: "STOCKAGE & CLÉS USB",
    prix: 20,
    marque: "SANDISK",
    detail: "Vitesse lecture jusqu'à 150 Mo/s · Coque métal résistante",
    couleur: "#f59e0b",
    type: "periph",
    accent: "usb-key"
  },
  {
    id: "fnac-info-09",
    nom: "Disque SSD externe ultra-rapide Samsung Portable T7 1 To Bleu",
    court: "SSD Samsung T7 1 To",
    categorie: "Informatique & Stockage",
    rayon: "DISQUES SSD EXTERNES",
    prix: 120,
    marque: "SAMSUNG",
    detail: "Transferts jusqu'à 1050 Mo/s · USB 3.2 Gen 2 · Châssis alu",
    couleur: "#3b82f6",
    type: "periph",
    accent: "ssd"
  },
  {
    id: "fnac-info-10",
    nom: "Casque télétravail filaire Jabra Evolve 20 Stereo USB",
    court: "Casque Jabra Evolve 20",
    categorie: "Informatique & Bureautique",
    rayon: "BUREAUTIQUE & TÉLÉTRAVAIL",
    prix: 50,
    marque: "JABRA",
    detail: "Micro antibruit · Télécommande sur cordon · Prêt pour Teams/Zoom",
    couleur: "#f97316",
    type: "headphones",
    accent: "jabra"
  },
  {
    id: "fnac-info-11",
    nom: "Écran PC bureautique 24 pouces Dell SE2422HX Full HD",
    court: "Écran Dell 24\" FHD",
    categorie: "Informatique & Écrans",
    rayon: "MONITEURS PC",
    prix: 130,
    marque: "DELL",
    detail: "Dalle VA 75 Hz · Finitions ultra-fines · HDMI & VGA",
    couleur: "#0284c7",
    type: "tablet",
    accent: "screen"
  },
  {
    id: "fnac-info-12",
    nom: "Imprimante multifonction jet d'encre Canon PIXMA TS5350a Noire",
    court: "Imprimante Canon TS5350a",
    categorie: "Informatique & Bureautique",
    rayon: "IMPRESSION & SCANNERS",
    prix: 80,
    marque: "CANON",
    detail: "Impression recto-verso auto · Wi-Fi smartphone · Écran OLED",
    couleur: "#dc2626",
    type: "periph",
    accent: "printer"
  },

  // --- RAYON 3 : TÉLÉPHONIE & MONTRES CONNECTÉES (10) ---
  {
    id: "fnac-tel-01",
    nom: "Montre de sport GPS Garmin Forerunner 55 Noire",
    court: "Garmin Forerunner 55",
    categorie: "Objets connectés & Sport",
    rayon: "MONTRES GPS & SPORT",
    prix: 200,
    marque: "GARMIN",
    detail: "Autonomie 2 semaines · Conseils d'entraînement Garmin Coach",
    couleur: "#10b981",
    type: "watch",
    accent: "garmin"
  },
  {
    id: "fnac-tel-02",
    nom: "Montre connectée Apple Watch SE GPS 40 mm Boîtier Aluminium",
    court: "Apple Watch SE 40mm",
    categorie: "Objets connectés & Montres",
    rayon: "UNIVERS APPLE",
    prix: 279,
    marque: "APPLE",
    detail: "Écran Retina OLED · Détection des accidents · Étanche 50m",
    couleur: "#f1f5f9",
    type: "watch",
    accent: "applewatch"
  },
  {
    id: "fnac-tel-03",
    nom: "Batterie externe nomade Anker PowerCore 10000 mAh USB-C",
    court: "Batterie Anker 10000 mAh",
    categorie: "Téléphonie & Accessoires",
    rayon: "CHARGE & ÉNERGIE",
    prix: 30,
    marque: "ANKER",
    detail: "Recharge rapide PowerIQ · Format ultra-compact de poche",
    couleur: "#0284c7",
    type: "watch",
    accent: "powerbank"
  },
  {
    id: "fnac-tel-04",
    nom: "Chargeur induction rapide sans fil Belkin BoostCharge 15W",
    court: "Chargeur Belkin Qi 15W",
    categorie: "Téléphonie & Accessoires",
    rayon: "CHARGE SANS FIL",
    prix: 35,
    marque: "BELKIN",
    detail: "Certification Qi · Compatible coques jusqu'à 3 mm · Témoin LED",
    couleur: "#8b5cf6",
    type: "watch",
    accent: "charger-pad"
  },
  {
    id: "fnac-tel-05",
    nom: "Coque de protection Apple iPhone 15 Silicone Noir avec MagSafe",
    court: "Coque iPhone 15 MagSafe",
    categorie: "Téléphonie & Accessoires",
    rayon: "ACCESSOIRES APPLE",
    prix: 59,
    marque: "APPLE",
    detail: "Aimants intégrés MagSafe · Doublure microfibre douce",
    couleur: "#334155",
    type: "watch",
    accent: "case"
  },
  {
    id: "fnac-tel-06",
    nom: "Localisateur d'objets Apple AirTag (Pack de 1 unité)",
    court: "Apple AirTag",
    categorie: "Objets connectés & Sécurité",
    rayon: "UNIVERS APPLE",
    prix: 39,
    marque: "APPLE",
    detail: "Localisation précise ultra-wideband · Réseau Apple Localiser",
    couleur: "#e2e8f0",
    type: "watch",
    accent: "airtag"
  },
  {
    id: "fnac-tel-07",
    nom: "Montre connectée Samsung Galaxy Watch 6 40 mm Bluetooth",
    court: "Galaxy Watch 6 40mm",
    categorie: "Objets connectés & Montres",
    rayon: "MONTRES CONNECTÉES",
    prix: 320,
    marque: "SAMSUNG",
    detail: "Écran Sapphire Crystal · Analyse du sommeil · Capteur BioActive",
    couleur: "#38bdf8",
    type: "watch",
    accent: "galaxywatch"
  },
  {
    id: "fnac-tel-08",
    nom: "Câble USB-C vers Lightning officiel Apple 1 mètre Blanc",
    court: "Câble Apple USB-C/Lightning",
    categorie: "Téléphonie & Accessoires",
    rayon: "ACCESSOIRES APPLE",
    prix: 25,
    marque: "APPLE",
    detail: "Charge rapide pour iPhone et iPad · Câble certifié Apple",
    couleur: "#f8fafc",
    type: "watch",
    accent: "cable"
  },
  {
    id: "fnac-tel-09",
    nom: "Bracelet connecté de suivi d'activité Xiaomi Smart Band 8",
    court: "Xiaomi Smart Band 8",
    categorie: "Objets connectés & Sport",
    rayon: "BRACELETS CONNECTÉS",
    prix: 40,
    marque: "XIAOMI",
    detail: "Écran AMOLED 60 Hz · Plus de 150 modes sport · Autonomie 16j",
    couleur: "#f97316",
    type: "watch",
    accent: "band"
  },
  {
    id: "fnac-tel-10",
    nom: "Trépied perche à selfie Bluetooth avec télécommande Joby",
    court: "Perche Joby GripTight",
    categorie: "Téléphonie & Photo mobile",
    rayon: "PHOTO MOBILE & VIDÉO",
    prix: 35,
    marque: "JOBY",
    detail: "Pieds pliables en trépied · Déclencheur sans fil détachable",
    couleur: "#f43f5e",
    type: "camera",
    accent: "selfie"
  },

  // --- RAYON 4 : GAMING & CONSOLES (14) ---
  {
    id: "fnac-game-01",
    nom: "Manette sans fil Microsoft Xbox Series Robot White",
    court: "Manette Xbox Series",
    categorie: "Gaming & Consoles",
    rayon: "UNIVERS XBOX",
    prix: 60,
    marque: "MICROSOFT XBOX",
    detail: "Surface texturée antidérapante · Prise casque 3.5 mm · Bluetooth",
    couleur: "#22c55e",
    type: "controller",
    accent: "xbox"
  },
  {
    id: "fnac-game-02",
    nom: "Casque-micro gaming HyperX Cloud II Rouge filaire",
    court: "Casque HyperX Cloud II",
    categorie: "Gaming & Accessoires",
    rayon: "CASQUES GAMING",
    prix: 100,
    marque: "HYPERX",
    detail: "Son Surround 7.1 virtuel · Transducteurs 53 mm · Coussinets mémoire",
    couleur: "#dc2626",
    type: "headphones",
    accent: "hyperx"
  },
  {
    id: "fnac-game-03",
    nom: "Manette sans fil Sony DualSense PlayStation 5 Midnight Black",
    court: "Manette PS5 DualSense",
    categorie: "Gaming & Consoles",
    rayon: "UNIVERS PLAYSTATION",
    prix: 75,
    marque: "SONY PLAYSTATION",
    detail: "Retour haptique immersif · Gâchettes adaptatives · Micro intégré",
    couleur: "#3b82f6",
    type: "controller",
    accent: "ps5"
  },
  {
    id: "fnac-game-04",
    nom: "Console de jeux Nintendo Switch Modèle OLED Blanc",
    court: "Nintendo Switch OLED",
    categorie: "Gaming & Consoles",
    rayon: "UNIVERS NINTENDO",
    prix: 320,
    marque: "NINTENDO",
    detail: "Écran OLED 7 pouces · Support ajustable · 64 Go de stockage",
    couleur: "#ef4444",
    type: "controller",
    accent: "switch-oled"
  },
  {
    id: "fnac-game-05",
    nom: "Jeu Nintendo Switch The Legend of Zelda: Tears of the Kingdom",
    court: "Zelda: Tears of the Kingdom",
    categorie: "Gaming & Jeux vidéo",
    rayon: "JEUX NINTENDO SWITCH",
    prix: 70,
    marque: "NINTENDO",
    detail: "Aventure épique en monde ouvert · Nouvelles capacités de Link",
    couleur: "#10b981",
    type: "controller",
    accent: "zelda"
  },
  {
    id: "fnac-game-06",
    nom: "Jeu Nintendo Switch Super Mario Bros. Wonder",
    court: "Super Mario Bros. Wonder",
    categorie: "Gaming & Jeux vidéo",
    rayon: "JEUX NINTENDO SWITCH",
    prix: 60,
    marque: "NINTENDO",
    detail: "Plateforme 2D novatrice · Fleurs Prodige transformantes",
    couleur: "#eab308",
    type: "controller",
    accent: "mario"
  },
  {
    id: "fnac-game-07",
    nom: "Jeu PS5 Marvel's Spider-Man 2",
    court: "Spider-Man 2 PS5",
    categorie: "Gaming & Jeux vidéo",
    rayon: "JEUX PLAYSTATION 5",
    prix: 80,
    marque: "PLAYSTATION STUDIOS",
    detail: "Incarnez Peter Parker et Miles Morales · New York agrandi",
    couleur: "#dc2626",
    type: "controller",
    accent: "spiderman"
  },
  {
    id: "fnac-game-08",
    nom: "Jeu PS5 EA SPORTS FC 24",
    court: "EA SPORTS FC 24 PS5",
    categorie: "Gaming & Jeux vidéo",
    rayon: "JEUX PLAYSTATION 5",
    prix: 80,
    marque: "ELECTRONIC ARTS",
    detail: "Technologie HyperMotionV · 19 000 joueurs sous licence",
    couleur: "#22c55e",
    type: "controller",
    accent: "fc24"
  },
  {
    id: "fnac-game-09",
    nom: "Manette Nintendo Switch Pro Controller Noir",
    court: "Switch Pro Controller",
    categorie: "Gaming & Consoles",
    rayon: "ACCESSOIRES SWITCH",
    prix: 70,
    marque: "NINTENDO",
    detail: "Vibrations HD · Capteurs de mouvements · Lecteur NFC amiibo",
    couleur: "#64748b",
    type: "controller",
    accent: "switch-pro"
  },
  {
    id: "fnac-game-10",
    nom: "Volant de course à retour de force Logitech G29 Driving Force",
    court: "Volant Logitech G29",
    categorie: "Gaming & Accessoires",
    rayon: "VOLANTS & SIMULATION",
    prix: 300,
    marque: "LOGITECH G",
    detail: "Double moteur à retour de force · Pédalier inox · Cuir cousu",
    couleur: "#0284c7",
    type: "controller",
    accent: "wheel"
  },
  {
    id: "fnac-game-11",
    nom: "Casque audio gaming sans fil Sony Pulse 3D PS5 Blanc",
    court: "Casque Sony Pulse 3D",
    categorie: "Gaming & Accessoires",
    rayon: "ACCESSOIRES PS5",
    prix: 100,
    marque: "SONY PLAYSTATION",
    detail: "Optimisé pour l'Audio 3D PS5 · Deux micros antibruit",
    couleur: "#f8fafc",
    type: "headphones",
    accent: "pulse3d"
  },
  {
    id: "fnac-game-12",
    nom: "Station de rechargement pour 2 manettes DualSense PS5",
    court: "Station Charge DualSense",
    categorie: "Gaming & Accessoires",
    rayon: "ACCESSOIRES PS5",
    prix: 30,
    marque: "SONY PLAYSTATION",
    detail: "Charge simultanée de 2 manettes · Conception encliquetable",
    couleur: "#3b82f6",
    type: "controller",
    accent: "dock"
  },
  {
    id: "fnac-game-13",
    nom: "Carte d'extension mémoire officielle Seagate 1 To pour Xbox Series",
    court: "Carte Seagate 1 To Xbox",
    categorie: "Gaming & Accessoires",
    rayon: "ACCESSOIRES XBOX",
    prix: 160,
    marque: "SEAGATE",
    detail: "Architecture Xbox Velocity · Performances SSD identiques",
    couleur: "#16a34a",
    type: "periph",
    accent: "xbox-ssd"
  },
  {
    id: "fnac-game-14",
    nom: "Jeu PS5 Gran Turismo 7 Édition Standard",
    court: "Gran Turismo 7 PS5",
    categorie: "Gaming & Jeux vidéo",
    rayon: "JEUX PLAYSTATION 5",
    prix: 80,
    marque: "POLYPHONY DIGITAL",
    detail: "Simulation automobile de référence · Plus de 420 bolides",
    couleur: "#38bdf8",
    type: "controller",
    accent: "gt7"
  },

  // --- RAYON 5 : PHOTO, VIDÉO & DRONES (10) ---
  {
    id: "fnac-photo-01",
    nom: "Appareil photo instantané Fujifilm Instax Mini 12 Bleu Pastel",
    court: "Fujifilm Instax Mini 12",
    categorie: "Photo & Caméscopes",
    rayon: "PHOTO INSTANTANÉE",
    prix: 90,
    marque: "FUJIFILM",
    detail: "Exposition automatique · Miroir à selfie · Gros plan intégré",
    couleur: "#38bdf8",
    type: "camera",
    accent: "instax"
  },
  {
    id: "fnac-photo-02",
    nom: "Pack de 20 films instantanés Fujifilm Instax Mini format carte",
    court: "Films Instax Mini (20)",
    categorie: "Photo & Consommables",
    rayon: "CONSOMMABLES PHOTO",
    prix: 20,
    marque: "FUJIFILM",
    detail: "Photos au format carte de crédit 54 x 86 mm · Bords blancs",
    couleur: "#f59e0b",
    type: "camera",
    accent: "films"
  },
  {
    id: "fnac-photo-03",
    nom: "Trépied compact Manfrotto Befree Advanced Aluminium à rotule",
    court: "Trépied Manfrotto Befree",
    categorie: "Photo & Accessoires",
    rayon: "TRÉPIEDS & ACCESSOIRES",
    prix: 190,
    marque: "MANFROTTO",
    detail: "Rotule 494 en aluminium · Charge utile 8 kg · Sac de transport",
    couleur: "#ef4444",
    type: "camera",
    accent: "tripod"
  },
  {
    id: "fnac-photo-04",
    nom: "Sac à dos photo Lowepro Fastpack BP 250 AW III Noir",
    court: "Sac photo Lowepro BP 250",
    categorie: "Photo & Bagagerie",
    rayon: "SACS & SACS À DOS PHOTO",
    prix: 150,
    marque: "LOWEPRO",
    detail: "Compartiment hybride reflex/hybride · Housse de pluie AW",
    couleur: "#475569",
    type: "camera",
    accent: "bag"
  },
  {
    id: "fnac-photo-05",
    nom: "Carte mémoire SanDisk Extreme PRO SDXC 128 Go 200 Mo/s",
    court: "Carte SD SanDisk 128 Go",
    categorie: "Photo & Cartes mémoire",
    rayon: "CARTES MÉMOIRE SD",
    prix: 45,
    marque: "SANDISK",
    detail: "Vitesse de transfert jusqu'à 200 Mo/s · Classe V30 / U3 4K UHD",
    couleur: "#f59e0b",
    type: "periph",
    accent: "sdcard"
  },
  {
    id: "fnac-photo-06",
    nom: "Caméra d'action étanche GoPro HERO12 Black 5.3K",
    court: "GoPro HERO12 Black",
    categorie: "Photo & Caméras de sport",
    rayon: "CAMÉRAS D'ACTION",
    prix: 400,
    marque: "GOPRO",
    detail: "Vidéo HDR 5.3K60 · Stabilisation HyperSmooth 6.0 · Étanche 10m",
    couleur: "#0284c7",
    type: "camera",
    accent: "gopro"
  },
  {
    id: "fnac-photo-07",
    nom: "Appareil photo instantané Polaroid Now Génération 2 Noir & Blanc",
    court: "Polaroid Now Gen 2",
    categorie: "Photo & Caméscopes",
    rayon: "PHOTO INSTANTANÉE",
    prix: 130,
    marque: "POLAROID",
    detail: "Système autofocus 2 lentilles · Retardateur · Double exposition",
    couleur: "#e2e8f0",
    type: "camera",
    accent: "polaroid"
  },
  {
    id: "fnac-photo-08",
    nom: "Bague lumineuse LED Ring Light 10 pouces avec trépied de table",
    court: "Ring Light LED 10\"",
    categorie: "Photo & Éclairage",
    rayon: "VLOGGING & VIDÉO",
    prix: 30,
    marque: "HAMA",
    detail: "3 températures de couleur · 10 niveaux de luminosité · Support mobile",
    couleur: "#fbbf24",
    type: "camera",
    accent: "ringlight"
  },
  {
    id: "fnac-photo-09",
    nom: "Stabilisateur motorisé 3 axes pour smartphone DJI Osmo Mobile 6",
    court: "DJI Osmo Mobile 6",
    categorie: "Photo & Stabilisateurs",
    rayon: "STABILISATEURS SMARTPHONE",
    prix: 160,
    marque: "DJI",
    detail: "ActiveTrack 6.0 · Perche télescopique intégrée · Pliable",
    couleur: "#94a3b8",
    type: "camera",
    accent: "gimbal"
  },
  {
    id: "fnac-photo-10",
    nom: "Kit de nettoyage complet optique et capteur photo Hama",
    court: "Kit nettoyage optique",
    categorie: "Photo & Entretien",
    rayon: "ENTRETIEN PHOTO",
    prix: 15,
    marque: "HAMA",
    detail: "Stylo Lenspen · Poire soufflante · Chiffon microfibre de précision",
    couleur: "#06b6d4",
    type: "camera",
    accent: "cleankit"
  },

  // --- RAYON 6 : LIVRES, ROMANS & ESSAIS (12) ---
  {
    id: "fnac-livre-01",
    nom: "Jules Verne - Vingt mille lieues sous les mers (Édition Hetzel)",
    court: "20 000 Lieues (Hetzel)",
    categorie: "Livres & Romans",
    rayon: "LITTÉRATURE CLASSIQUE",
    prix: 30,
    marque: "ÉDITIONS HETZEL",
    detail: "Reliure cartonnée aux initiales dorées · Gravures d'époque",
    couleur: "#10b981",
    type: "book",
    accent: "verne"
  },
  {
    id: "fnac-livre-02",
    nom: "J.R.R. Tolkien - Le Seigneur des Anneaux (Illustré Alan Lee)",
    court: "Tolkien SDA (Alan Lee)",
    categorie: "Livres & Fantasy",
    rayon: "SCIENCE-FICTION & FANTASY",
    prix: 89,
    marque: "CHRISTIAN BOURGOIS",
    detail: "Édition intégrale de luxe · 50 illustrations pleine page en couleurs",
    couleur: "#d97706",
    type: "book",
    accent: "tolkien"
  },
  {
    id: "fnac-livre-03",
    nom: "Dictionnaire Le Petit Robert de la langue française 2026",
    court: "Le Petit Robert 2026",
    categorie: "Livres & Référence",
    rayon: "DICTIONNAIRES & LANGUE",
    prix: 69,
    marque: "LE ROBERT",
    detail: "60 000 mots · 300 000 sens · Mots nouveaux et étymologies",
    couleur: "#dc2626",
    type: "book",
    accent: "robert"
  },
  {
    id: "fnac-livre-04",
    nom: "Jean-Baptiste Andrea - Veiller sur elle (Prix Goncourt)",
    court: "Veiller sur elle (Goncourt)",
    categorie: "Livres & Romans",
    rayon: "PRIX LITTÉRAIRES",
    prix: 23,
    marque: "L'ICONOCLASTE",
    detail: "Prix Goncourt · Grand roman d'amour et d'art dans l'Italie du XXe",
    couleur: "#f59e0b",
    type: "book",
    accent: "goncourt"
  },
  {
    id: "fnac-livre-05",
    nom: "Pierre Lemaitre - Le Silence et la Colère (Grand Format)",
    court: "Le Silence et la Colère",
    categorie: "Livres & Romans",
    rayon: "ROMANS FRANÇAIS",
    prix: 24,
    marque: "CALMANN-LÉVY",
    detail: "Fresque des Trente Glorieuses · Famille Pelletier",
    couleur: "#3b82f6",
    type: "book",
    accent: "lemaitre"
  },
  {
    id: "fnac-livre-06",
    nom: "Sylvain Tesson - Blanc (Récit illustré Gallimard)",
    court: "Sylvain Tesson - Blanc",
    categorie: "Livres & Récits",
    rayon: "VOYAGES & RÉCITS",
    prix: 21,
    marque: "GALLIMARD",
    detail: "Traversée des Alpes à ski de Menton à Trieste",
    couleur: "#0284c7",
    type: "book",
    accent: "tesson"
  },
  {
    id: "fnac-livre-07",
    nom: "Cédric Sapin-Defour - Son odeur après la pluie (Stock)",
    court: "Son odeur après la pluie",
    categorie: "Livres & Romans",
    rayon: "LITTÉRATURE CONTEMPORAINE",
    prix: 19,
    marque: "STOCK",
    detail: "Grand Prix 30 Millions d'Amis · Histoire de complicité montagnarde",
    couleur: "#84cc16",
    type: "book",
    accent: "sapin"
  },
  {
    id: "fnac-livre-08",
    nom: "Yuval Noah Harari - Sapiens : Une brève histoire de l'humanité",
    court: "Harari - Sapiens",
    categorie: "Livres & Essais",
    rayon: "HISTOIRE & SOCIÉTÉ",
    prix: 24,
    marque: "ALBIN MICHEL",
    detail: "Bestseller mondial · 70 000 ans d'histoire humaine décryptés",
    couleur: "#eab308",
    type: "book",
    accent: "harari"
  },
  {
    id: "fnac-livre-09",
    nom: "Albert Camus - L'Étranger (Édition Folio Classique)",
    court: "Camus - L'Étranger",
    categorie: "Livres & Poches",
    rayon: "LIVRES DE POCHE",
    prix: 8,
    marque: "FOLIO",
    detail: "Chef-d'œuvre du Prix Nobel Albert Camus · Texte intégral",
    couleur: "#f8fafc",
    type: "book",
    accent: "camus"
  },
  {
    id: "fnac-livre-10",
    nom: "Antoine de Saint-Exupéry - Le Petit Prince (Grand Format Couleur)",
    court: "Le Petit Prince (Couleur)",
    categorie: "Livres & Jeunesse",
    rayon: "JEUNESSE & CLASSIQUES",
    prix: 14,
    marque: "GALLIMARD JEUNESSE",
    detail: "Aquarelles originales de l'auteur · Reliure cartonnée",
    couleur: "#38bdf8",
    type: "book",
    accent: "prince"
  },
  {
    id: "fnac-livre-11",
    nom: "Franck Thilliez - La Faille (Thriller Fleuve Noir)",
    court: "Franck Thilliez - La Faille",
    categorie: "Livres & Polars",
    rayon: "POLARS & THRILLERS",
    prix: 23,
    marque: "FLEUVE NOIR",
    detail: "Enquête haletante de Sharko · Thriller scientifique sombre",
    couleur: "#dc2626",
    type: "book",
    accent: "thilliez"
  },
  {
    id: "fnac-livre-12",
    nom: "Guide du Routard Toulouse et ses environs 2026",
    court: "Guide Routard Toulouse",
    categorie: "Livres & Tourisme",
    rayon: "GUIDES DE VOYAGE",
    prix: 11,
    marque: "HACHETTE TOURISME",
    detail: "Bons plans restaurants, musées, balades Canal du Midi et Labège",
    couleur: "#f97316",
    type: "book",
    accent: "routard"
  },

  // --- RAYON 7 : BD, MANGAS & COMICS (10) ---
  {
    id: "fnac-manga-01",
    nom: "Coffret Manga One Piece Tomes 1 à 12 - Édition Glénat",
    court: "Coffret One Piece (1-12)",
    categorie: "BD & Mangas",
    rayon: "MANGAS SHONEN",
    prix: 83,
    marque: "GLÉNAT MANGA",
    detail: "Arc East Blue complet · Boîte collector cartonnée officielle",
    couleur: "#f59e0b",
    type: "manga",
    accent: "onepiece"
  },
  {
    id: "fnac-manga-02",
    nom: "Astérix Tome 40 - L'Iris Blanc (Édition Classique Albert René)",
    court: "Astérix T40 L'Iris Blanc",
    categorie: "BD & Mangas",
    rayon: "BANDE DESSINÉE FRANCO-BELGE",
    prix: 11,
    marque: "ÉDITIONS ALBERT RENÉ",
    detail: "Nouvelle aventure d'Astérix et Obélix par Fabcaro et Didier Conrad",
    couleur: "#eab308",
    type: "manga",
    accent: "asterix"
  },
  {
    id: "fnac-manga-03",
    nom: "Manga Naruto Tome 1 - Édition Kana",
    court: "Naruto Tome 1",
    categorie: "BD & Mangas",
    rayon: "MANGAS SHONEN",
    prix: 7,
    marque: "KANA",
    detail: "Premier tome mythique de Masashi Kishimoto · Format poche",
    couleur: "#f97316",
    type: "manga",
    accent: "naruto"
  },
  {
    id: "fnac-manga-04",
    nom: "Manga Demon Slayer Tome 1 - Panini Manga",
    court: "Demon Slayer Tome 1",
    categorie: "BD & Mangas",
    rayon: "MANGAS SHONEN",
    prix: 7,
    marque: "PANINI MANGA",
    detail: "Aventure de Tanjiro et Nezuko par Koyoharu Gotouge",
    couleur: "#06b6d4",
    type: "manga",
    accent: "demonslayer"
  },
  {
    id: "fnac-manga-05",
    nom: "Manga Jujutsu Kaisen Tome 1 - Ki-oon",
    court: "Jujutsu Kaisen Tome 1",
    categorie: "BD & Mangas",
    rayon: "MANGAS DARK FANTASY",
    prix: 7,
    marque: "KI-OON",
    detail: "Shonen surnaturel explosif de Gege Akutami",
    couleur: "#8b5cf6",
    type: "manga",
    accent: "jujutsu"
  },
  {
    id: "fnac-manga-06",
    nom: "BD Hergé - Les Aventures de Tintin : Le Trésor de Rackham le Rouge",
    court: "Tintin : Rackham le Rouge",
    categorie: "BD & Jeunesse",
    rayon: "BANDE DESSINÉE CLASSIQUE",
    prix: 13,
    marque: "CASTERMAN",
    detail: "L'exploration sous-marine en sous-marin requin du Pr Tournesol",
    couleur: "#ef4444",
    type: "manga",
    accent: "tintin"
  },
  {
    id: "fnac-manga-07",
    nom: "BD Blacksad Tome 7 - Alors, tout tombe (Première Partie)",
    court: "Blacksad Tome 7",
    categorie: "BD & Polar",
    rayon: "BANDE DESSINÉE POLAR",
    prix: 16,
    marque: "DARGAUD",
    detail: "Dessins magistraux de Juanjo Guarnido · Polar anthropomorphe",
    couleur: "#334155",
    type: "manga",
    accent: "blacksad"
  },
  {
    id: "fnac-manga-08",
    nom: "Comics Batman - The Dark Knight Returns (Édition Urban Comics)",
    court: "Batman : Dark Knight Returns",
    categorie: "Comics & Super-héros",
    rayon: "COMICS DC",
    prix: 25,
    marque: "URBAN COMICS",
    detail: "Chef-d'œuvre de Frank Miller · Référence absolue du Chevalier Noir",
    couleur: "#1e293b",
    type: "manga",
    accent: "batman"
  },
  {
    id: "fnac-manga-09",
    nom: "Manga Dragon Ball Super Tome 1 - Glénat Manga",
    court: "Dragon Ball Super Tome 1",
    categorie: "BD & Mangas",
    rayon: "MANGAS SHONEN",
    prix: 7,
    marque: "GLÉNAT MANGA",
    detail: "Suite officielle de l'œuvre d'Akira Toriyama par Toyotaro",
    couleur: "#f59e0b",
    type: "manga",
    accent: "dragonball"
  },
  {
    id: "fnac-manga-10",
    nom: "BD L'Arabe du futur Tome 6 - Riad Sattouf (Allary Éditions)",
    court: "L'Arabe du futur T6",
    categorie: "BD & Romans graphiques",
    rayon: "ROMANS GRAPHIQUES",
    prix: 25,
    marque: "ALLARY ÉDITIONS",
    detail: "Dernier volume magistral de la série autobiographique culte",
    couleur: "#10b981",
    type: "manga",
    accent: "sattouf"
  },

  // --- RAYON 8 : MUSIQUE, VINYLES & CD (8) ---
  {
    id: "fnac-vinyle-01",
    nom: "Vinyle Double Album Daft Punk - Random Access Memories (180g)",
    court: "Vinyle Daft Punk - RAM",
    categorie: "Son & Vinyles",
    rayon: "VINYLES ÉLECTRO",
    prix: 35,
    marque: "COLUMBIA",
    detail: "Édition vinyle audiophile 180 grammes · Get Lucky, Instant Crush",
    couleur: "#f59e0b",
    type: "vinyl",
    accent: "daftpunk"
  },
  {
    id: "fnac-vinyle-02",
    nom: "Vinyle Album Pink Floyd - The Dark Side of the Moon (180g)",
    court: "Vinyle Pink Floyd - Dark Side",
    categorie: "Son & Vinyles",
    rayon: "VINYLES ROCK",
    prix: 30,
    marque: "PARLOPHONE",
    detail: "Édition remasterisée 50e anniversaire · Pochette prisme iconique",
    couleur: "#a855f7",
    type: "vinyl",
    accent: "pinkfloyd"
  },
  {
    id: "fnac-vinyle-03",
    nom: "Vinyle Double Album Michael Jackson - Thriller 40th Anniversary",
    court: "Vinyle Michael Jackson - Thriller",
    categorie: "Son & Vinyles",
    rayon: "VINYLES POP",
    prix: 32,
    marque: "EPIC RECORDS",
    detail: "Album le plus vendu de tous les temps · Pochette dépliante gatefold",
    couleur: "#dc2626",
    type: "vinyl",
    accent: "thriller"
  },
  {
    id: "fnac-vinyle-04",
    nom: "Vinyle Album Queen - Greatest Hits I (Double Vinyle Rouge/Blanc)",
    court: "Vinyle Queen - Greatest Hits",
    categorie: "Son & Vinyles",
    rayon: "VINYLES ROCK",
    prix: 38,
    marque: "VIRGIN EMI",
    detail: "Double album vinyle collector · Bohemian Rhapsody, Don't Stop Me Now",
    couleur: "#ef4444",
    type: "vinyl",
    accent: "queen"
  },
  {
    id: "fnac-vinyle-05",
    nom: "Vinyle Album Nirvana - Nevermind (Édition Vinyle Remaster)",
    court: "Vinyle Nirvana - Nevermind",
    categorie: "Son & Vinyles",
    rayon: "VINYLES ROCK GRUNGE",
    prix: 28,
    marque: "GEFFEN RECORDS",
    detail: "Album grunge culte avec Smells Like Teen Spirit · Vinyle 180g",
    couleur: "#0284c7",
    type: "vinyl",
    accent: "nirvana"
  },
  {
    id: "fnac-vinyle-06",
    nom: "Vinyle Album Orelsan - Civilisation Édition Vinyle Original",
    court: "Vinyle Orelsan - Civilisation",
    categorie: "Son & Vinyles",
    rayon: "VINYLES RAP FRANÇAIS",
    prix: 30,
    marque: "WAGRAM MUSIC",
    detail: "Double vinyle avec L'odeur de l'essence, Jour meilleur",
    couleur: "#10b981",
    type: "vinyl",
    accent: "orelsan"
  },
  {
    id: "fnac-vinyle-07",
    nom: "Vinyle Album Miles Davis - Kind of Blue (Vinyle Bleu 180g)",
    court: "Vinyle Miles Davis - Kind of Blue",
    categorie: "Son & Vinyles",
    rayon: "VINYLES JAZZ",
    prix: 26,
    marque: "COLUMBIA JAZZ",
    detail: "Le monument du jazz modal · Enregistrement analogique de référence",
    couleur: "#3b82f6",
    type: "vinyl",
    accent: "milesdavis"
  },
  {
    id: "fnac-vinyle-08",
    nom: "Brosse de nettoyage carbone antistatique pour disques vinyles",
    court: "Brosse carbone vinyle",
    categorie: "Son & Accessoires vinyles",
    rayon: "ACCESSOIRES HI-FI",
    prix: 18,
    marque: "AUDIOQUEST",
    detail: "Fibres conductrices de carbone · Élimine la poussière et l'électricité",
    couleur: "#94a3b8",
    type: "vinyl",
    accent: "brush"
  },

  // --- RAYON 9 : PAPETERIE, ÉCRITURE & BEAUX-ARTS (6) ---
  {
    id: "fnac-pape-01",
    nom: "Carnet de notes Moleskine Classic relié Large Ligné Noir",
    court: "Carnet Moleskine Large",
    categorie: "Papeterie & Écriture",
    rayon: "CARNETS & ÉCRITURE",
    prix: 25,
    marque: "MOLESKINE",
    detail: "Couverture rigide noire · Fermeture élastique · Pochette à soufflet",
    couleur: "#475569",
    type: "stationery",
    accent: "moleskine"
  },
  {
    id: "fnac-pape-02",
    nom: "Stylo plume Caran d'Ache 849 Fluo Jaune corps aluminium",
    court: "Stylo Caran d'Ache 849",
    categorie: "Papeterie & Écriture",
    rayon: "STYLO DE PRÉCISION",
    prix: 42,
    marque: "CARAN D'ACHE",
    detail: "Corps hexagonal en aluminium suisse · Plume acier inoxydable M",
    couleur: "#facc15",
    type: "stationery",
    accent: "carandache"
  },
  {
    id: "fnac-pape-03",
    nom: "Coffret de 24 feutres pinceaux Faber-Castell Pitt Artist Pen",
    court: "Feutres Faber-Castell (24)",
    categorie: "Papeterie & Beaux-Arts",
    rayon: "BEAUX-ARTS & DESSIN",
    prix: 65,
    marque: "FABER-CASTELL",
    detail: "Encre de Chine pigmentée · Résistance maximale à la lumière · Pointe B",
    couleur: "#0284c7",
    type: "stationery",
    accent: "faber"
  },
  {
    id: "fnac-pape-04",
    nom: "Bloc de cours Rhodia N°18 A4 petits carreaux agrafé Orange",
    court: "Bloc Rhodia N°18 A4",
    categorie: "Papeterie & Bureautique",
    rayon: "CARNETS & PAPIER",
    prix: 6,
    marque: "RHODIA",
    detail: "Papier vélin velouté Clairefontaine 80g · Couverture rainée orange",
    couleur: "#ea580c",
    type: "stationery",
    accent: "rhodia"
  },
  {
    id: "fnac-pape-05",
    nom: "Pochette de 8 marqueurs peinture Posca PC-5M pointe moyenne",
    court: "Marqueurs Posca (8)",
    categorie: "Papeterie & Beaux-Arts",
    rayon: "BEAUX-ARTS & MARQUEURS",
    prix: 32,
    marque: "POSCA",
    detail: "Peinture à base d'eau tous supports · Couleurs vives et opaques",
    couleur: "#ec4899",
    type: "stationery",
    accent: "posca"
  },
  {
    id: "fnac-pape-06",
    nom: "Coffret de 12 crayons de couleur aquarellables Caran d'Ache Supracolor",
    court: "Crayons Supracolor (12)",
    categorie: "Papeterie & Beaux-Arts",
    rayon: "BEAUX-ARTS & DESSIN",
    prix: 35,
    marque: "CARAN D'ACHE",
    detail: "Mine tendre 3.8 mm · Bois de cèdre certifié FSC · Boîte métal",
    couleur: "#ef4444",
    type: "stationery",
    accent: "supracolor"
  },

  // --- RAYON 10 : JEUX DE SOCIÉTÉ, JOUETS & LEGO (6) ---
  {
    id: "fnac-jeu-01",
    nom: "Boîte de briques LEGO Star Wars - Le Casque de Dark Vador 75304",
    court: "LEGO Casque Dark Vador",
    categorie: "Jeux & Jouets",
    rayon: "LEGO COLLECTOR & POP CULTURE",
    prix: 80,
    marque: "LEGO STAR WARS",
    detail: "834 pièces · Modèle d'exposition pour adultes avec plaque nominative",
    couleur: "#e2e8f0",
    type: "toy",
    accent: "lego-vader"
  },
  {
    id: "fnac-jeu-02",
    nom: "Boîte de briques LEGO Icons - Les Fleurs Sauvages Botanical 10313",
    court: "LEGO Fleurs Sauvages",
    categorie: "Jeux & Jouets",
    rayon: "LEGO BOTANICAL COLLECTION",
    prix: 60,
    marque: "LEGO ICONS",
    detail: "939 pièces · 8 espèces de fleurs sauvages avec tiges ajustables",
    couleur: "#10b981",
    type: "toy",
    accent: "lego-flowers"
  },
  {
    id: "fnac-jeu-03",
    nom: "Jeu de société Les Colons de Catan - Édition Asmodee",
    court: "Jeu Catan (Asmodee)",
    categorie: "Jeux de société",
    rayon: "JEUX DE STRATÉGIE",
    prix: 45,
    marque: "ASMODEE",
    detail: "Le grand classique de la négociation et du développement colonial",
    couleur: "#d97706",
    type: "toy",
    accent: "catan"
  },
  {
    id: "fnac-jeu-04",
    nom: "Jeu de société familial Dixit - Nouvelle Édition Libellud",
    court: "Jeu Dixit (Libellud)",
    categorie: "Jeux de société",
    rayon: "JEUX D'AMBIANCE & FAMILLE",
    prix: 35,
    marque: "LIBELLUD",
    detail: "Jeu d'énigmes poétique primé · 84 grandes cartes illustrées",
    couleur: "#a855f7",
    type: "toy",
    accent: "dixit"
  },
  {
    id: "fnac-jeu-05",
    nom: "Jeu de cartes d'ambiance et de réflexes Dobble Classique",
    court: "Jeu Dobble Classique",
    categorie: "Jeux de société",
    rayon: "JEUX DE POCHE & CARTES",
    prix: 16,
    marque: "ASMODEE",
    detail: "55 cartes rondes · Boîte métal jaune · 5 variantes de jeu",
    couleur: "#facc15",
    type: "toy",
    accent: "dobble"
  },
  {
    id: "fnac-jeu-06",
    nom: "Coffret Dresseur d'Élite JCC Pokémon (ETB Boîte de cartes)",
    court: "Pokémon Coffret ETB",
    categorie: "Jeux & Cartes à collectionner",
    rayon: "CARTES POKÉMON COLLECTOR",
    prix: 60,
    marque: "POKÉMON COMPANY",
    detail: "9 boosters officiels · Carte promo brillante · 65 protège-cartes",
    couleur: "#3b82f6",
    type: "toy",
    accent: "pokemon"
  }
];

// --- GÉNÉRATEUR VECTORIEL RÉALISTE PAR ARCHÉTYPE ---

function genererArtworkRealiste(p) {
  const col = p.couleur || '#8ee7ff';

  switch (p.type) {
    case 'headphones':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="208" rx="64" ry="12" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Arceau supérieur rembourré en cuir -->
        <path d="M 104 150 C 104 90, 216 90, 216 150" fill="none" stroke="#222" stroke-width="18" stroke-linecap="round"/>
        <path d="M 108 148 C 108 96, 212 96, 212 148" fill="none" stroke="#333" stroke-width="12" stroke-linecap="round"/>
        <path d="M 120 120 C 140 106, 180 106, 200 120" fill="none" stroke="#111" stroke-width="14" stroke-linecap="round"/>
        <!-- Glissières métalliques télescopiques -->
        <line x1="102" y1="140" x2="102" y2="164" stroke="#888" stroke-width="4" stroke-linecap="round"/>
        <line x1="218" y1="140" x2="218" y2="164" stroke="#888" stroke-width="4" stroke-linecap="round"/>
        <!-- Écouteur Gauche -->
        <g transform="translate(86, 142)">
          <rect x="0" y="0" width="32" height="54" rx="14" fill="#181818" stroke="#333" stroke-width="2"/>
          <rect x="4" y="6" width="24" height="42" rx="10" fill="#252525"/>
          <ellipse cx="16" cy="27" rx="8" ry="14" fill="${col}" opacity="0.25"/>
          <circle cx="16" cy="27" r="5" fill="#111" stroke="${col}" stroke-width="1.5"/>
        </g>
        <!-- Écouteur Droit -->
        <g transform="translate(202, 142)">
          <rect x="0" y="0" width="32" height="54" rx="14" fill="#181818" stroke="#333" stroke-width="2"/>
          <rect x="4" y="6" width="24" height="42" rx="10" fill="#252525"/>
          <ellipse cx="16" cy="27" rx="8" ry="14" fill="${col}" opacity="0.25"/>
          <circle cx="16" cy="27" r="5" fill="#111" stroke="${col}" stroke-width="1.5"/>
          <!-- Bouton de commande doré Marshall / alu -->
          <circle cx="28" cy="40" r="3.5" fill="#f5b027" stroke="#111" stroke-width="1"/>
        </g>
      `;

    case 'speaker':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="204" rx="68" ry="12" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Boîtier principal cylindrique / enceinte -->
        <rect x="100" y="118" width="120" height="72" rx="26" fill="url(#metalGrad)" stroke="#1e293b" stroke-width="2"/>
        <!-- Grille acoustique tressée -->
        <rect x="110" y="126" width="100" height="56" rx="18" fill="#111827" stroke="${col}" stroke-width="1.5"/>
        <!-- Motif perforé de la grille -->
        <line x1="118" y1="138" x2="202" y2="138" stroke="${col}" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>
        <line x1="118" y1="146" x2="202" y2="146" stroke="${col}" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/>
        <line x1="118" y1="154" x2="202" y2="154" stroke="${col}" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/>
        <line x1="118" y1="162" x2="202" y2="162" stroke="${col}" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>
        <line x1="118" y1="170" x2="202" y2="170" stroke="${col}" stroke-width="1" stroke-dasharray="3 3" opacity="0.4"/>
        <!-- Badge central de marque / logo -->
        <rect x="142" y="144" width="36" height="20" rx="4" fill="#030712" stroke="${col}" stroke-width="1.5"/>
        <text x="160" y="158" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10" font-weight="900" fill="${col}" text-anchor="middle">JBL</text>
        <!-- Radiateurs passifs latéraux en silicone -->
        <ellipse cx="98" cy="154" rx="5" ry="24" fill="#1f2937" stroke="${col}" stroke-width="1.5"/>
        <ellipse cx="222" cy="154" rx="5" ry="24" fill="#1f2937" stroke="${col}" stroke-width="1.5"/>
      `;

    case 'earbuds':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="206" rx="52" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Boîtier de charge blanc / noir glossy -->
        <rect x="122" y="128" width="76" height="66" rx="22" fill="url(#metalGrad)" stroke="#cbd5e1" stroke-width="2"/>
        <path d="M 122 148 L 198 148" stroke="#64748b" stroke-width="1.5" opacity="0.6"/>
        <!-- Encoche d'ouverture -->
        <rect x="152" y="146" width="16" height="4" rx="2" fill="#475569"/>
        <!-- Témoin lumineux de charge LED -->
        <circle cx="160" cy="162" r="2.5" fill="#22c55e" filter="url(#softGlow)"/>
        <!-- Écouteur sans fil gauche flottant -->
        <g transform="translate(98, 114)">
          <ellipse cx="14" cy="16" rx="12" ry="14" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
          <rect x="10" y="24" width="8" height="22" rx="4" fill="#e2e8f0"/>
          <circle cx="14" cy="14" r="5" fill="#0284c7" opacity="0.4"/>
        </g>
        <!-- Écouteur sans fil droit flottant -->
        <g transform="translate(194, 114)">
          <ellipse cx="14" cy="16" rx="12" ry="14" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
          <rect x="10" y="24" width="8" height="22" rx="4" fill="#e2e8f0"/>
          <circle cx="14" cy="14" r="5" fill="#0284c7" opacity="0.4"/>
        </g>
      `;

    case 'turntable':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="210" rx="72" ry="12" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Châssis platine -->
        <rect x="94" y="120" width="132" height="84" rx="10" fill="#0f172a" stroke="#334155" stroke-width="2"/>
        <!-- Plateau tournant circulaire -->
        <circle cx="150" cy="162" r="34" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
        <circle cx="150" cy="162" r="28" fill="#020617" stroke="#475569" stroke-width="1"/>
        <circle cx="150" cy="162" r="12" fill="#3b82f6" opacity="0.8"/>
        <circle cx="150" cy="162" r="3" fill="#f8fafc"/>
        <!-- Bras de lecture avec cellule et diamant -->
        <path d="M 204 134 Q 210 155, 196 178" fill="none" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
        <rect x="190" y="174" width="8" height="12" rx="2" fill="#ef4444"/>
        <circle cx="204" cy="134" r="5" fill="#cbd5e1"/>
        <!-- Boutons 33 / 45 tours -->
        <circle cx="106" cy="188" r="4" fill="#38bdf8"/>
        <circle cx="118" cy="188" r="4" fill="#64748b"/>
      `;

    case 'tablet':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="210" rx="64" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Châssis métallique tablette / écran -->
        <rect x="108" y="108" width="104" height="96" rx="12" fill="#0f172a" stroke="#475569" stroke-width="2.5"/>
        <!-- Écran vitré / dalle Retina -->
        <rect x="114" y="114" width="92" height="84" rx="8" fill="#020817"/>
        <rect x="118" y="118" width="84" height="76" rx="6" fill="url(#screenGrad)"/>
        <!-- Reflet spéculaire sur la vitre -->
        <path d="M 120 120 L 190 120 L 140 190 Z" fill="#fff" opacity="0.08"/>
        <!-- Caméra frontale / capteur -->
        <circle cx="160" cy="111" r="2" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
      `;

    case 'periph':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="208" rx="60" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Corps de périphérique profilé / souris / disque / clavier -->
        <rect x="112" y="116" width="96" height="84" rx="18" fill="#0f172a" stroke="#334155" stroke-width="2"/>
        <path d="M 112 152 Q 160 142, 208 152" fill="none" stroke="${col}" stroke-width="2" opacity="0.8"/>
        <!-- Molette moletée en métal / bouton central -->
        <rect x="154" y="122" width="12" height="24" rx="5" fill="#1e293b" stroke="#94a3b8" stroke-width="1.5"/>
        <line x1="154" y1="128" x2="166" y2="128" stroke="#f8fafc" stroke-width="1"/>
        <line x1="154" y1="134" x2="166" y2="134" stroke="#f8fafc" stroke-width="1"/>
        <line x1="154" y1="140" x2="166" y2="140" stroke="#f8fafc" stroke-width="1"/>
        <!-- Logo lumineux G / indicateur DPI -->
        <circle cx="160" cy="176" r="10" fill="#020617" stroke="${col}" stroke-width="1.5"/>
        <path d="M 164 172 A 6 6 0 1 0 164 180 L 160 180" fill="none" stroke="${col}" stroke-width="1.5"/>
      `;

    case 'watch':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="208" rx="50" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Bracelet en silicone sport haut et bas -->
        <rect x="144" y="96" width="32" height="30" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <rect x="144" y="186" width="32" height="26" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <!-- Boîtier montre connectée -->
        <rect x="130" y="118" width="60" height="72" rx="18" fill="#0f172a" stroke="#64748b" stroke-width="2.5"/>
        <!-- Écran OLED tactile avec jauges d'activité -->
        <rect x="136" y="124" width="48" height="60" rx="12" fill="#020617"/>
        <circle cx="160" cy="154" r="18" fill="none" stroke="#22c55e" stroke-width="3" stroke-dasharray="80 30"/>
        <circle cx="160" cy="154" r="13" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="60 20"/>
        <circle cx="160" cy="154" r="8" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="40 10"/>
        <!-- Couronne rotative Digital Crown -->
        <rect x="190" y="132" width="4" height="12" rx="2" fill="#94a3b8"/>
      `;

    case 'controller':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="208" rx="66" ry="12" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Coque manette ergonomique / console -->
        <path d="M 106 188 C 96 160, 102 122, 134 122 L 186 122 C 218 122, 224 160, 214 188 C 210 200, 196 198, 188 178 C 182 166, 172 164, 160 164 C 148 164, 138 166, 132 178 C 124 198, 110 200, 106 188 Z"
              fill="#0f172a" stroke="#475569" stroke-width="2.5"/>
        <!-- Pavé tactile central / logo -->
        <rect x="144" y="126" width="32" height="20" rx="4" fill="#1e293b" stroke="${col}" stroke-width="1"/>
        <!-- Croix directionnelle D-pad -->
        <path d="M 120 142 L 126 142 L 126 136 L 132 136 L 132 142 L 138 142 L 138 148 L 132 148 L 132 154 L 126 154 L 126 148 L 120 148 Z" fill="#334155"/>
        <!-- 4 boutons d'action (A B X Y ou Triangle Rond Croix Carre) -->
        <circle cx="188" cy="138" r="3" fill="#ef4444"/>
        <circle cx="196" cy="144" r="3" fill="#22c55e"/>
        <circle cx="180" cy="144" r="3" fill="#38bdf8"/>
        <circle cx="188" cy="150" r="3" fill="#facc15"/>
        <!-- Sticks analogiques concaves -->
        <circle cx="138" cy="166" r="10" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
        <circle cx="138" cy="166" r="6" fill="#020617"/>
        <circle cx="182" cy="166" r="10" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
        <circle cx="182" cy="166" r="6" fill="#020617"/>
      `;

    case 'camera':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="208" rx="66" ry="12" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Boîtier appareil photo / Instax / caméra -->
        <rect x="110" y="118" width="100" height="82" rx="20" fill="url(#metalGrad)" stroke="#334155" stroke-width="2"/>
        <!-- Fût de l'objectif central -->
        <circle cx="160" cy="160" r="30" fill="#020617" stroke="#64748b" stroke-width="3"/>
        <circle cx="160" cy="160" r="22" fill="#0f172a" stroke="${col}" stroke-width="2"/>
        <!-- Lentille optique en verre multicouche avec reflets cyan/magenta -->
        <circle cx="160" cy="160" r="14" fill="#030712"/>
        <path d="M 152 152 Q 160 148, 168 152" stroke="#38bdf8" stroke-width="2" fill="none" opacity="0.8"/>
        <path d="M 156 166 Q 162 170, 166 166" stroke="#ec4899" stroke-width="1.5" fill="none" opacity="0.6"/>
        <!-- Viseur optique & flash -->
        <rect x="184" y="128" width="16" height="12" rx="3" fill="#1e293b" stroke="#cbd5e1" stroke-width="1"/>
        <circle cx="128" cy="134" r="5" fill="#fef08a" stroke="#eab308" stroke-width="1"/>
        <!-- Déclencheur sur le dessus -->
        <rect x="124" y="112" width="12" height="6" rx="2" fill="#f43f5e"/>
      `;

    case 'book':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="210" rx="58" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Tranche des pages papier -->
        <path d="M 124 116 L 198 122 L 198 196 L 124 190 Z" fill="#fefce8" stroke="#cbd5e1" stroke-width="1.5"/>
        <line x1="198" y1="122" x2="204" y2="124" stroke="#d4d4d8" stroke-width="1.5"/>
        <line x1="198" y1="196" x2="204" y2="198" stroke="#d4d4d8" stroke-width="1.5"/>
        <!-- Couverture rigide reliée -->
        <path d="M 116 112 L 192 118 L 192 194 L 116 188 Z" fill="#0f172a" stroke="${col}" stroke-width="2"/>
        <!-- Dos / mors du livre doré -->
        <path d="M 112 112 C 112 112, 116 114, 116 188" stroke="#f5b027" stroke-width="5" stroke-linecap="round"/>
        <!-- Lettres / dorure Hetzel ou Goncourt sur la couverture -->
        <rect x="130" y="132" width="48" height="14" rx="2" fill="${col}" opacity="0.8"/>
        <line x1="130" y1="154" x2="178" y2="154" stroke="#f5b027" stroke-width="1"/>
        <line x1="130" y1="160" x2="178" y2="160" stroke="#f5b027" stroke-width="1"/>
        <line x1="130" y1="166" x2="164" y2="166" stroke="#f5b027" stroke-width="1"/>
      `;

    case 'manga':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="210" rx="56" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Volume manga / BD avec tranche papier -->
        <rect x="124" y="112" width="72" height="92" rx="4" fill="#0f172a" stroke="${col}" stroke-width="2"/>
        <!-- Tranche blanche de tankobon -->
        <rect x="192" y="114" width="8" height="88" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.5"/>
        <!-- Illustration dynamique sur la couverture -->
        <rect x="128" y="116" width="60" height="52" rx="2" fill="url(#screenGrad)"/>
        <polygon points="144,142 158,124 172,142" fill="${col}" opacity="0.8"/>
        <circle cx="158" cy="136" r="4" fill="#fef08a"/>
        <!-- Bandeau titre japonais / logo Glénat / Kana -->
        <rect x="128" y="174" width="60" height="14" rx="2" fill="#ef4444"/>
        <text x="158" y="185" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9" font-weight="900" fill="#fff" text-anchor="middle">MANGA</text>
        <circle cx="182" cy="194" r="3" fill="#f59e0b"/>
      `;

    case 'vinyl':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="210" rx="68" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Pochette d'album carrée -->
        <rect x="102" y="114" width="88" height="88" rx="4" fill="#0f172a" stroke="${col}" stroke-width="2"/>
        <!-- Graphisme d'album iconique (ex: prisme Pink Floyd / casques Daft Punk) -->
        <polygon points="146,138 126,174 166,174" fill="none" stroke="#fff" stroke-width="1.5"/>
        <line x1="146" y1="156" x2="186" y2="162" stroke="#ef4444" stroke-width="1"/>
        <line x1="146" y1="156" x2="186" y2="166" stroke="#f59e0b" stroke-width="1"/>
        <line x1="146" y1="156" x2="186" y2="170" stroke="#38bdf8" stroke-width="1"/>
        <!-- Disque vinyle noir sortant de la pochette -->
        <circle cx="188" cy="158" r="38" fill="#020617" stroke="#111" stroke-width="2"/>
        <!-- Micro-sillons concentriques -->
        <circle cx="188" cy="158" r="34" fill="none" stroke="#1e293b" stroke-width="0.8" stroke-dasharray="12 4"/>
        <circle cx="188" cy="158" r="28" fill="none" stroke="#1e293b" stroke-width="0.8" stroke-dasharray="16 6"/>
        <circle cx="188" cy="158" r="22" fill="none" stroke="#1e293b" stroke-width="0.8" stroke-dasharray="14 4"/>
        <!-- Macaron central en papier imprimé -->
        <circle cx="188" cy="158" r="14" fill="${col}"/>
        <circle cx="188" cy="158" r="3.5" fill="#000"/>
      `;

    case 'stationery':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="210" rx="58" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Carnet Moleskine / Rhodia fermé -->
        <rect x="114" y="112" width="74" height="92" rx="6" fill="#0f172a" stroke="#334155" stroke-width="2"/>
        <!-- Élastique de fermeture vertical -->
        <rect x="174" y="112" width="6" height="92" fill="${col}" opacity="0.9"/>
        <!-- Stylo Caran d'Ache / Posca posé en biais -->
        <g transform="translate(142, 94) rotate(22)">
          <rect x="0" y="0" width="10" height="90" rx="4" fill="${col}" stroke="#111" stroke-width="1"/>
          <!-- Clip métallique chromé -->
          <rect x="2" y="8" width="6" height="24" rx="2" fill="#e2e8f0"/>
          <!-- Plume / mine conique -->
          <polygon points="1,90 9,90 5,102" fill="#cbd5e1" stroke="#475569" stroke-width="0.5"/>
        </g>
      `;

    case 'toy':
      return `
        <!-- Ombre de contact au sol -->
        <ellipse cx="160" cy="210" rx="64" ry="12" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <!-- Boîte de jeu collector Lego / Catan / Pokémon -->
        <rect x="110" y="112" width="100" height="90" rx="6" fill="#0f172a" stroke="${col}" stroke-width="2"/>
        <!-- Logo Lego ou boîte de jeu -->
        <rect x="118" y="120" width="22" height="22" rx="3" fill="#ef4444"/>
        <text x="129" y="135" font-family="'Helvetica Neue', Arial, sans-serif" font-size="8" font-weight="900" fill="#facc15" text-anchor="middle">LEGO</text>
        <!-- Briques ou hexagone de jeu au centre -->
        <polygon points="160,138 180,148 180,172 160,182 140,172 140,148" fill="#1e293b" stroke="${col}" stroke-width="1.5"/>
        <circle cx="160" cy="160" r="8" fill="${col}" opacity="0.7"/>
        <!-- Pastille âge 18+ ou nombre de pièces -->
        <rect x="174" y="184" width="28" height="12" rx="3" fill="#111" stroke="#475569" stroke-width="0.8"/>
        <text x="188" y="193" font-family="'Helvetica Neue', Arial, sans-serif" font-size="7" font-weight="800" fill="#e2e8f0" text-anchor="middle">18+</text>
      `;

    default:
      return `
        <ellipse cx="160" cy="208" rx="60" ry="10" fill="#000" opacity="0.6" filter="url(#dropBlur)"/>
        <rect x="114" y="116" width="92" height="84" rx="14" fill="#0f172a" stroke="${col}" stroke-width="2"/>
        <circle cx="160" cy="158" r="24" fill="${col}" opacity="0.3"/>
      `;
  }
}

function genererSvgProduit(p) {
  const shortNom = p.nom.length > 34 ? p.nom.slice(0, 32) + '…' : p.nom;
  const col = p.couleur || '#8ee7ff';
  const artwork = genererArtworkRealiste(p);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <defs>
    <radialGradient id="studioGlow" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="#081e31" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#020813" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="cardFrame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="#8ee7ff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0a2a44" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="dropBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>

  <!-- Fond marin studio Nautilus -->
  <rect width="320" height="320" rx="20" fill="url(#studioGlow)"/>
  <rect x="4" y="4" width="312" height="312" rx="16" fill="none" stroke="url(#cardFrame)" stroke-width="2"/>

  <!-- Halo lumineux d'exposition du produit -->
  <circle cx="160" cy="160" r="78" fill="${col}" opacity="0.10" filter="url(#softGlow)"/>

  <!-- En-tête : Badge Fnac Labège Retrait 1h en haut à droite -->
  <rect x="178" y="14" width="128" height="22" rx="6" fill="#f5b027"/>
  <text x="242" y="29" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9.5" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="0.5">FNAC LABÈGE · 1H</text>

  <!-- Marque en haut à gauche -->
  <text x="18" y="30" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10.5" font-weight="800" fill="${col}" letter-spacing="1.2">${p.marque}</text>

  <!-- Rayon de magasin -->
  <text x="18" y="43" font-family="'Helvetica Neue', Arial, sans-serif" font-size="8" font-weight="600" fill="#94a3b8" letter-spacing="0.8">${p.rayon}</text>

  <!-- Illustration vectorielle réaliste de l'article -->
  <g id="productArtwork">
    ${artwork}
  </g>

  <!-- Ligne séparatrice néon -->
  <line x1="26" y1="234" x2="294" y2="234" stroke="${col}" stroke-width="1.5" opacity="0.45"/>

  <!-- Intitulé officiel Fnac de l'article -->
  <text x="160" y="258" font-family="'Helvetica Neue', Arial, sans-serif" font-size="12.5" font-weight="700" fill="#eaf8ff" text-anchor="middle">${shortNom.replace(/&/g, '&amp;')}</text>

  <!-- Détail / Caractéristiques en rayon -->
  <text x="160" y="280" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10" font-weight="500" fill="#8ee7ff" opacity="0.85" text-anchor="middle">${p.detail.replace(/&/g, '&amp;')}</text>

  <!-- Pastille officielle Fnac Labege -->
  <rect x="95" y="294" width="130" height="16" rx="8" fill="rgba(142,231,255,0.12)" stroke="rgba(142,231,255,0.3)" stroke-width="1"/>
  <text x="160" y="306" font-family="'Helvetica Neue', Arial, sans-serif" font-size="8.5" font-weight="800" fill="#bbf2ff" text-anchor="middle" letter-spacing="0.8">EN STOCK RETRAIT 1H</text>
</svg>`;
}

// Génération
const dir = path.resolve('assets/produits');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

console.log(`Génération des ${PRODUITS_100.length} articles du catalogue Fnac Labège...`);

const catalogueFinal = [];
const refP5 = [];

for (const p of PRODUITS_100) {
  const svgContent = genererSvgProduit(p);
  const svgPath = path.join(dir, `${p.id}.svg`);
  fs.writeFileSync(svgPath, svgContent, 'utf8');

  catalogueFinal.push({
    id: p.id,
    nom: p.nom,
    categorie: p.categorie,
    image: `assets/produits/${p.id}.svg`,
    sec: encoderPrix(p.prix, p.id)
  });

  refP5.push({
    nom: p.court || p.nom,
    p: `${p.prix} €`
  });
}

fs.writeFileSync('produits.json', JSON.stringify(catalogueFinal, null, 2), 'utf8');
console.log(`✓ 100 images réalistes SVG créées dans assets/produits/`);
console.log(`✓ produits.json mis à jour (${catalogueFinal.length} articles)`);

// Export de la liste REF_P5 pour admin-artefact.js
const refP5JsonPath = path.resolve('tools/ref_p5_100.json');
fs.writeFileSync(refP5JsonPath, JSON.stringify(refP5, null, 2), 'utf8');
console.log(`✓ Références REF_P5 générées dans tools/ref_p5_100.json`);
