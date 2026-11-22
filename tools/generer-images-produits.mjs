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

const PRODUITS_INIT = [
  {
    id: "fnac-audio-01",
    nom: "Casque Bluetooth Marshall Major IV Noir",
    categorie: "Son & Casques",
    prix: 150,
    theme: "audio",
    icon: "🎧",
    marque: "MARSHALL",
    detail: "Bluetooth 80h · Arceau pliable",
    couleur: "#e6a122"
  },
  {
    id: "fnac-audio-02",
    nom: "Enceinte portable Bluetooth JBL Flip 6 Noir",
    categorie: "Son & Casques",
    prix: 140,
    theme: "audio",
    icon: "🔊",
    marque: "JBL",
    detail: "Étanche IP67 · Son Pro 20W",
    couleur: "#e84a27"
  },
  {
    id: "fnac-audio-03",
    nom: "Platine vinyle Audio-Technica AT-LP60XUSB Noir",
    categorie: "Son & Vinyles",
    prix: 180,
    theme: "audio",
    icon: "📻",
    marque: "AUDIO-TECHNICA",
    detail: "Entraînement courroie · Sortie USB",
    couleur: "#38bdf8"
  },
  {
    id: "fnac-audio-04",
    nom: "Écouteurs sans fil Sony WF-C500 True Wireless Noir",
    categorie: "Son & Casques",
    prix: 80,
    theme: "audio",
    icon: "🎵",
    marque: "SONY",
    detail: "DSEE · Boîtier compact 20h",
    couleur: "#a855f7"
  },
  {
    id: "fnac-audio-05",
    nom: "Casque à réduction de bruit Bose QuietComfort SC Noir",
    categorie: "Son & Casques",
    prix: 300,
    theme: "audio",
    icon: "🎧",
    marque: "BOSE",
    detail: "Réduction active · Mode Conscient",
    couleur: "#eab308"
  },
  {
    id: "fnac-livre-01",
    nom: "Jules Verne - Vingt mille lieues sous les mers (Édition Hetzel)",
    categorie: "Livres & Romans",
    prix: 30,
    theme: "livre",
    icon: "📖",
    marque: "JULES VERNE",
    detail: "Édition reliée cartonnée Hetzel",
    couleur: "#10b981"
  },
  {
    id: "fnac-livre-02",
    nom: "Coffret Manga One Piece Tomes 1 à 12 - Édition Glénat",
    categorie: "BD & Mangas",
    prix: 83,
    theme: "livre",
    icon: "📚",
    marque: "GLÉNAT",
    detail: "Arc East Blue · Tomes 1 à 12",
    couleur: "#f97316"
  },
  {
    id: "fnac-livre-03",
    nom: "Astérix Tome 40 - L'Iris Blanc (Édition Classique Albert René)",
    categorie: "BD & Mangas",
    prix: 11,
    theme: "livre",
    icon: "⚔️",
    marque: "ALBERT RENÉ",
    detail: "Par Fabcaro & Didier Conrad",
    couleur: "#eab308"
  },
  {
    id: "fnac-livre-04",
    nom: "J.R.R. Tolkien - Le Seigneur des Anneaux (Illustré Alan Lee)",
    categorie: "Livres & Fantasy",
    prix: 89,
    theme: "livre",
    icon: "💍",
    marque: "CHRISTIAN BOURGOIS",
    detail: "Intégrale grand format 50 peintures",
    couleur: "#22d3ee"
  },
  {
    id: "fnac-livre-05",
    nom: "Dictionnaire Le Petit Robert de la langue française 2026",
    categorie: "Livres & Référence",
    prix: 69,
    theme: "livre",
    icon: "📕",
    marque: "LE ROBERT",
    detail: "60 000 mots · Étymologie & citations",
    couleur: "#ec4899"
  },
  {
    id: "fnac-gaming-01",
    nom: "Manette sans fil Microsoft Xbox Series Robot White",
    categorie: "Gaming & Consoles",
    prix: 60,
    theme: "gaming",
    icon: "🎮",
    marque: "XBOX",
    detail: "Gâchettes texturées · Prise jack 3.5",
    couleur: "#10b981"
  },
  {
    id: "fnac-gaming-02",
    nom: "Souris gamer filaire Logitech G502 HERO Noir haute précision",
    categorie: "Informatique & Gaming",
    prix: 90,
    theme: "gaming",
    icon: "🖱️",
    marque: "LOGITECH G",
    detail: "Capteur 25 600 DPI · 11 boutons",
    couleur: "#06b6d4"
  },
  {
    id: "fnac-gaming-03",
    nom: "Clavier mécanique sans fil Logitech G915 LIGHTSPEED TKL Tactile",
    categorie: "Informatique & Gaming",
    prix: 230,
    theme: "gaming",
    icon: "⌨️",
    marque: "LOGITECH G",
    detail: "Switches GL low-profile · RGB Lightsync",
    couleur: "#8b5cf6"
  },
  {
    id: "fnac-gaming-04",
    nom: "Casque-micro gaming HyperX Cloud II Rouge filaire",
    categorie: "Gaming & Accessoires",
    prix: 100,
    theme: "gaming",
    icon: "🎙️",
    marque: "HYPERX",
    detail: "Son surround virtuel 7.1 · Coussinets confort",
    couleur: "#ef4444"
  },
  {
    id: "fnac-gaming-05",
    nom: "Manette sans fil Sony DualSense PlayStation 5 Midnight Black",
    categorie: "Gaming & Consoles",
    prix: 75,
    theme: "gaming",
    icon: "🕹️",
    marque: "PLAYSTATION",
    detail: "Retour haptique · Gâchettes adaptatives",
    couleur: "#3b82f6"
  },
  {
    id: "fnac-photo-01",
    nom: "Appareil photo instantané Fujifilm Instax Mini 12 Bleu Pastel",
    categorie: "Photo & Caméscopes",
    prix: 90,
    theme: "photo",
    icon: "📷",
    marque: "FUJIFILM",
    detail: "Mode selfie intégré · Exposition auto",
    couleur: "#38bdf8"
  },
  {
    id: "fnac-photo-02",
    nom: "Pack de 20 films instantanés Fujifilm Instax Mini format carte",
    categorie: "Photo & Consommables",
    prix: 20,
    theme: "photo",
    icon: "🎞️",
    marque: "INSTAX",
    detail: "2 packs de 10 vues · Format 54x86 mm",
    couleur: "#f59e0b"
  },
  {
    id: "fnac-photo-03",
    nom: "Trépied compact Manfrotto Befree Advanced Aluminium à rotule",
    categorie: "Photo & Accessoires",
    prix: 190,
    theme: "photo",
    icon: "📐",
    marque: "MANFROTTO",
    detail: "Charge admissible 9 kg · Rotule 494",
    couleur: "#ef4444"
  },
  {
    id: "fnac-photo-04",
    nom: "Sac à dos photo Lowepro Fastpack BP 250 AW III Noir",
    categorie: "Photo & Bagagerie",
    prix: 150,
    theme: "photo",
    icon: "🎒",
    marque: "LOWEPRO",
    detail: "Accès latéral rapide · Housse pluie All Weather",
    couleur: "#64748b"
  },
  {
    id: "fnac-tech-01",
    nom: "Liseuse numérique Kobo Clara Colour 16 Go écran couleur 6 pouces",
    categorie: "Objets connectés & Liseuses",
    prix: 160,
    theme: "tech",
    icon: "📱",
    marque: "KOBO",
    detail: "Écran couleur E Ink Kaleido 3 · Étanche IPX8",
    couleur: "#10b981"
  },
  {
    id: "fnac-tech-02",
    nom: "Montre de sport GPS Garmin Forerunner 55 Noire",
    categorie: "Objets connectés & Sport",
    prix: 200,
    theme: "tech",
    icon: "⌚",
    marque: "GARMIN",
    detail: "GPS intégré · Cardio poignet · Autonomie 14j",
    couleur: "#0284c7"
  },
  {
    id: "fnac-tech-03",
    nom: "Disque dur externe portable Seagate One Touch 2 To USB 3.0 Noir",
    categorie: "Informatique & Stockage",
    prix: 85,
    theme: "tech",
    icon: "💾",
    marque: "SEAGATE",
    detail: "Aluminium brossé · Logiciel de sauvegarde",
    couleur: "#6366f1"
  },
  {
    id: "fnac-tech-04",
    nom: "Clé USB 3.2 SanDisk Ultra Flair 128 Go finition métal",
    categorie: "Informatique & Stockage",
    prix: 20,
    theme: "tech",
    icon: "🖴",
    marque: "SANDISK",
    detail: "Vitesse 150 Mo/s · Boîtier aluminium résistant",
    couleur: "#e11d48"
  },
  {
    id: "fnac-pape-01",
    nom: "Carnet de notes Moleskine Classic relié Large Ligné Noir",
    categorie: "Papeterie & Écriture",
    prix: 25,
    theme: "papeterie",
    icon: "📓",
    marque: "MOLESKINE",
    detail: "240 pages ivoire · Pochette à soufflet",
    couleur: "#f5b027"
  },
  {
    id: "fnac-pape-02",
    nom: "Stylo plume Caran d'Ache 849 Fluo Jaune corps aluminium",
    categorie: "Papeterie & Écriture",
    prix: 42,
    theme: "papeterie",
    icon: "✒️",
    marque: "CARAN D'ACHE",
    detail: "Corps hexagonal aluminium · Plume acier M",
    couleur: "#eab308"
  },
  {
    id: "fnac-pape-03",
    nom: "Coffret de 24 feutres pinceaux Faber-Castell Pitt Artist Pen",
    categorie: "Papeterie & Beaux-Arts",
    prix: 65,
    theme: "papeterie",
    icon: "🎨",
    marque: "FABER-CASTELL",
    detail: "Encre de Chine pigmentée · Résistance lumière",
    couleur: "#14b8a6"
  },
  {
    id: "fnac-musique-01",
    nom: "Vinyle Double Album Daft Punk - Random Access Memories (180g)",
    categorie: "Son & Vinyles",
    prix: 35,
    theme: "musique",
    icon: "💿",
    marque: "DAFT PUNK",
    detail: "Double vinyle gatefold audiophile",
    couleur: "#cbd5e1"
  },
  {
    id: "fnac-musique-02",
    nom: "Vinyle Album Pink Floyd - The Dark Side of the Moon (180g)",
    categorie: "Son & Vinyles",
    prix: 30,
    theme: "musique",
    icon: "🌈",
    marque: "PINK FLOYD",
    detail: "Édition remasterisée 50e anniversaire",
    couleur: "#a855f7"
  }
];

function genererSvg(p) {
  const shortNom = p.nom.length > 34 ? p.nom.slice(0, 32) + '…' : p.nom;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${p.couleur}" stop-opacity="0.25"/>
      <stop offset="60%" stop-color="#071b2c" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#020813" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="cardBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.couleur}" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="#8ee7ff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#0a2a44" stop-opacity="0.9"/>
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Fond marin nautilus -->
  <rect width="320" height="320" rx="20" fill="url(#bgGlow)"/>
  <rect x="4" y="4" width="312" height="312" rx="16" fill="none" stroke="url(#cardBorder)" stroke-width="2"/>

  <!-- Halo central -->
  <circle cx="160" cy="140" r="82" fill="${p.couleur}" opacity="0.12" filter="url(#softGlow)"/>
  <circle cx="160" cy="140" r="70" fill="#041220" stroke="${p.couleur}" stroke-width="2" stroke-dasharray="6 4" opacity="0.85"/>

  <!-- Badge Fnac haut droit -->
  <rect x="238" y="16" width="66" height="22" rx="6" fill="#f5b027"/>
  <text x="271" y="32" font-family="'Helvetica Neue', Arial, sans-serif" font-size="12" font-weight="900" fill="#111" text-anchor="middle" letter-spacing="1">FNAC</text>

  <!-- Marque en haut gauche -->
  <text x="20" y="32" font-family="'Helvetica Neue', Arial, sans-serif" font-size="11" font-weight="800" fill="${p.couleur}" letter-spacing="1.5">${p.marque}</text>

  <!-- Grande icône produit -->
  <text x="160" y="165" font-size="72" text-anchor="middle" filter="url(#softGlow)">${p.icon}</text>

  <!-- Ligne séparatrice lumineuse -->
  <line x1="30" y1="235" x2="290" y2="235" stroke="${p.couleur}" stroke-width="1.5" opacity="0.5"/>

  <!-- Nom du produit -->
  <text x="160" y="260" font-family="'Helvetica Neue', Arial, sans-serif" font-size="13" font-weight="700" fill="#eaf8ff" text-anchor="middle">${shortNom.replace(/&/g, '&amp;')}</text>

  <!-- Détail / caractéristique -->
  <text x="160" y="284" font-family="'Helvetica Neue', Arial, sans-serif" font-size="11" font-weight="500" fill="#8ee7ff" opacity="0.85" text-anchor="middle">${p.detail.replace(/&/g, '&amp;')}</text>

  <!-- Pastille officielle Fnac -->
  <rect x="110" y="296" width="100" height="16" rx="8" fill="rgba(142,231,255,0.12)" stroke="rgba(142,231,255,0.3)" stroke-width="1"/>
  <text x="160" y="308" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9" font-weight="800" fill="#bbf2ff" text-anchor="middle" letter-spacing="0.8">PRODUIT OFFICIEL</text>
</svg>`;
}

const dir = path.resolve('assets/produits');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const catalogueFinal = [];

for (const p of PRODUITS_INIT) {
  const svgContent = genererSvg(p);
  const svgPath = path.join(dir, `${p.id}.svg`);
  fs.writeFileSync(svgPath, svgContent, 'utf8');

  catalogueFinal.push({
    id: p.id,
    nom: p.nom,
    categorie: p.categorie,
    image: `assets/produits/${p.id}.svg`,
    sec: encoderPrix(p.prix, p.id)
  });
}

fs.writeFileSync('produits.json', JSON.stringify(catalogueFinal, null, 2), 'utf8');
console.log(`✓ 28 images SVG créées dans assets/produits/ et produits.json mis à jour.`);
