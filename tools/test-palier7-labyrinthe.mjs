// tools/test-palier7-labyrinthe.mjs
// Suite de tests unitaires et de conformité du Palier 7 : Le Labyrinthe Circulaire 10x24

import fs from 'fs';

console.log('=== TEST SUITE PALIER 7 : LE LABYRINTHE CIRCULAIRE DU NAUTILUS (10x24) ===\n');

// 1. Vérification de l existence des fichiers clés
const files = [
  'palier7-briefing.html',
  'palier7-jeu.html',
  '22718151124.html',
  'labyrinthe.html',
  'labyrinthe-circulaire.js',
  'css/palier7.css',
  'tools/test-labyrinthe-temps-optimal.mjs'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    console.log(`✓ [Fichier requis] ${f} existe.`);
  } else {
    console.error(`✗ [Fichier manquant] ${f} n'existe pas !`);
    process.exit(1);
  }
});

// 2. Test du code source de labyrinthe-circulaire.js
const code = fs.readFileSync('labyrinthe-circulaire.js', 'utf8');

// Simuler l'environnement browser
const mockWindow = {
  NautilusSon: {
    sonActif: () => false,
    registerContexte: () => {}
  }
};

const fn = new Function('window', 'document', 'localStorage', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setInterval', 'clearInterval', 'setTimeout', 'screen', code);

global.window = mockWindow;
global.document = {
  addEventListener: () => {},
  removeEventListener: () => {}
};

try {
  fn(mockWindow, global.document, {}, { now: () => 0 }, () => 1, () => {}, () => 1, () => {}, () => 1, { orientation: { lock: () => Promise.resolve() } });
  if (mockWindow.NautilusLabyrinthe && typeof mockWindow.NautilusLabyrinthe.init === 'function') {
    console.log('✓ [Moteur] window.NautilusLabyrinthe.init exporté avec succès.');
  } else {
    throw new Error('window.NautilusLabyrinthe.init non trouvé');
  }
} catch (e) {
  console.error('✗ Erreur exécution labyrinthe-circulaire.js:', e);
  process.exit(1);
}

// 3. Test de la topologie du labyrinthe (solvabilité et impasses)
const radialMatch = code.match(/var RADIAL_WALLS = (\[[\s\S]*?\]);/);
const ringMatch = code.match(/var RING_WALLS = (\[[\s\S]*?\]);/);
const startRingMatch = code.match(/var START_RING = (\d+);/);
const goalSectorMatch = code.match(/var GOAL_SECTOR = (\d+);/);

if (!radialMatch || !ringMatch || !startRingMatch || !goalSectorMatch) {
  console.error('✗ Impossible d extraire la topologie du labyrinthe');
  process.exit(1);
}

const RADIAL_WALLS = JSON.parse(radialMatch[1]);
const RING_WALLS = JSON.parse(ringMatch[1]);
const START_RING = parseInt(startRingMatch[1], 10);
const GOAL_SECTOR = parseInt(goalSectorMatch[1], 10);

const RINGS = RADIAL_WALLS.length;
const SECTORS = RADIAL_WALLS[0].length;

console.log(`✓ [Topologie 10x24] ${RINGS} anneaux et ${SECTORS} secteurs = ${RINGS * SECTORS} cellules.`);
console.log(`✓ [Parois] ${RADIAL_WALLS.flat().filter(Boolean).length} parois radiales et ${RING_WALLS.flat().filter(Boolean).length} parois circulaires.`);

// BFS pour vérifier le chemin
const dist = Array.from({ length: RINGS }, () => Array(SECTORS).fill(-1));
const queue = [{ r: START_RING, s: 0 }];
dist[START_RING][0] = 0;

while (queue.length > 0) {
  const { r, s } = queue.shift();
  const d = dist[r][s];

  if (!RADIAL_WALLS[r][s]) {
    const sNext = (s + 1) % SECTORS;
    if (dist[r][sNext] === -1) { dist[r][sNext] = d + 1; queue.push({ r, s: sNext }); }
  }
  const sPrev = (s - 1 + SECTORS) % SECTORS;
  if (!RADIAL_WALLS[r][sPrev]) {
    if (dist[r][sPrev] === -1) { dist[r][sPrev] = d + 1; queue.push({ r, s: sPrev }); }
  }
  if (r > 0 && !RING_WALLS[r - 1][s]) {
    if (dist[r - 1][s] === -1) { dist[r - 1][s] = d + 1; queue.push({ r: r - 1, s }); }
  }
  if (r < RINGS - 1 && !RING_WALLS[r][s]) {
    if (dist[r + 1][s] === -1) { dist[r + 1][s] = d + 1; queue.push({ r: r + 1, s }); }
  }
}

const goalDist = dist[0][GOAL_SECTOR];
if (goalDist > 0) {
  console.log(`✓ [Solvabilité complexe] Chemin optimal direct vers le Cœur : ${goalDist + 1} étapes requises.`);
} else {
  console.error(`✗ [Solvabilité] Aucun chemin trouvé vers le Cœur !`);
  process.exit(1);
}

// Compter les culs-de-sac (impasses)
let deadEnds = 0;
for (let r = 0; r < RINGS; r++) {
  for (let s = 0; s < SECTORS; s++) {
    let exits = 0;
    if (!RADIAL_WALLS[r][s]) exits++;
    const sPrev = (s - 1 + SECTORS) % SECTORS;
    if (!RADIAL_WALLS[r][sPrev]) exits++;
    if (r > 0 && !RING_WALLS[r - 1][s]) exits++;
    if (r < RINGS - 1 && !RING_WALLS[r][s]) exits++;
    if (r === 0 && s === GOAL_SECTOR) exits++;
    if (r === START_RING && s === 0) exits++;
    if (exits === 1) deadEnds++;
  }
}

if (deadEnds >= 30) {
  console.log(`✓ [Haute complexité] ${deadEnds} culs-de-sac (impasses) validés (≥ 30 requis).`);
} else {
  console.error(`✗ [Impasses] Seulement ${deadEnds} culs-de-sac trouvés.`);
  process.exit(1);
}

// 4. Vérification du verrouillage d orientation portrait
if (code.includes('tenterVerrouillagePortrait') && code.includes('screen.orientation.lock')) {
  console.log(`✓ [Orientation] Verrouillage d'orientation portrait (screen.orientation.lock) actif.`);
} else {
  console.error(`✗ [Orientation] Verrouillage d'orientation manquant.`);
  process.exit(1);
}

// 5. Vérification de la compensation de rotation de l écran pour le gyroscope
if (code.includes('angleDeg') && code.includes('screen.orientation.angle')) {
  console.log(`✓ [Gyroscope] Compensation dynamique de rotation de l'appareil active.`);
} else {
  console.error(`✗ [Gyroscope] Compensation de rotation manquante.`);
  process.exit(1);
}

// 6. Vérification du minuteur de 1 minute maximum, visibilité et clignotement latéral
if (code.includes('DUREE_PARCOURS_SEC = 60') && code.includes('labyTimer') && code.includes('labyEdgeAlarm') && code.includes('is-critical') && !code.includes('labyChrono')) {
  console.log(`✓ [Minuteur] Minuteur 1 min hautement visible avec alerte latérale (5 dernières secondes) validé.`);
} else {
  console.error(`✗ [Minuteur] Configuration du minuteur ou de l'alerte latérale non conforme.`);
  process.exit(1);
}

// 7. Vérification du démarrage du jeu par bouton gyroscope ou joystick
if (code.includes('btnStartGyro') && code.includes('btnStartJoy') && code.includes('demarrerPartie') && code.includes('DeviceOrientationEvent.requestPermission')) {
  console.log(`✓ [Contrôles & Démarrage] Activation du minuteur et du jeu par bouton Gyroscope (ou Joystick si non dispo) validée.`);
} else {
  console.error(`✗ [Contrôles] Démarrage par bouton gyroscope/joystick incomplet.`);
  process.exit(1);
}

// 8. Vérification de l'épuration de la page de retenue du chrono et retrait du bouton retour briefing
const palier7Html = fs.readFileSync('palier7-jeu.html', 'utf8');
if (palier7Html.includes('id="epreuveStatut" class="status-banner info" hidden') &&
    code.includes('id="labyHudStats" hidden') &&
    code.includes('id="labyControlsBar" hidden') &&
    code.includes('id="labyStatus" hidden') &&
    !code.includes('PALIER 7 — <b>LABYRINTHE SCELLÉ') &&
    !code.includes('labyBriefLink') &&
    !code.includes('labyBriefHolder') &&
    code.includes('id="labyTimer"')) {
  console.log(`✓ [Page de retenue épurée] Éléments non nécessaires retirés et bouton de retour au briefing effacé.`);
} else {
  console.error(`✗ [Page de retenue] Épuration incomplète sur la page de retenue pour le chrono.`);
  process.exit(1);
}

// 9. Vérification du briefing épuré (sans indice direct ni effets visuels) et règle des 100 impacts
const briefingHtml = fs.readFileSync('palier7-briefing.html', 'utf8');
const sasHtml = fs.readFileSync('22718151124.html', 'utf8');
const sansIndicesEtEffets = !briefingHtml.includes('10 anneaux') &&
                            !briefingHtml.includes('clignot') &&
                            !sasHtml.includes('10 anneaux') &&
                            !sasHtml.includes('clignot');
const consignesConformes = briefingHtml.includes('100 fois') &&
                           briefingHtml.includes('culs-de-sac trompeurs') &&
                           briefingHtml.includes('coursive extérieure jusqu\'au Cœur central') &&
                           briefingHtml.includes('Minuteur strict de 1 minute chrono') &&
                           sasHtml.includes('100 fois');
const regle100ImpactsCode = code.includes('collisionsCount > 100');

if (sansIndicesEtEffets && consignesConformes && regle100ImpactsCode) {
  console.log(`✓ [Briefing immersif & Règle 100 impacts] Aucun indice direct, aucun effet visuel écrit, règle des 100 impacts active.`);
} else {
  console.error(`✗ [Briefing Palier 7] Configuration du briefing ou règle des 100 impacts non conforme.`);
  process.exit(1);
}

// 10. Vérification du Service Worker
const swContent = fs.readFileSync('sw.js', 'utf8');
if (swContent.includes('./palier7-briefing.html') && swContent.includes('./palier7-jeu.html') && swContent.includes('./labyrinthe.html') && swContent.includes('./labyrinthe-circulaire.js?v=13') && swContent.includes('./css/palier7.css?v=13')) {
  console.log(`✓ [Cache PWA] Tous les assets v13 et la page briefing du Palier 7 sont précachés dans sw.js.`);
} else {
  console.error(`✗ [Cache PWA] Assets v13 ou page briefing manquants dans sw.js.`);
  process.exit(1);
}

// 11. Vérification de la page de défaite / remontée en surface (NautilusDefaite)
const defaiteCode = fs.readFileSync('victoire-palier.js', 'utf8');
let htmlDefaite = '';
const mockHost = {
  set innerHTML(v) { htmlDefaite = v; },
  get innerHTML() { return htmlDefaite; },
  parentNode: { querySelectorAll: () => [] }
};
const winDef = {};
const fnDef = new Function('window', 'document', 'localStorage', defaiteCode);
fnDef(winDef, { getElementById: () => null }, { getItem: () => 'Nemo' });

winDef.NautilusDefaite.afficher(mockHost, {
  palier: 7,
  nom: 'Robin',
  equipe: 'Nemo',
  hours: 1,
  jusqua: new Date(2026, 10, 26, 0, 50, 51)
});

const defaiteTexte = htmlDefaite.replace(/<[^>]+>/g, '');
const defaiteOk = htmlDefaite.includes('Robin</span>, tu remontes en surface') &&
                  htmlDefaite.includes('Ta plongée s’arrête là mais La mission continue pour l’équipage') &&
                  htmlDefaite.includes('Remontée En surface : <b>1 h</b> — retour <b>26/11/2026 00:50:51.</b>') &&
                  htmlDefaite.includes('<b>Nemo</b> peut reprendre dès maintenant (risque 1 h).') &&
                  htmlDefaite.includes('Prochain échec : <b>2 h</b> en surface (compteur personnel).');

if (defaiteOk) {
  console.log(`✓ [Écran de défaite] Gabarit exact conforme : nom du matelot, sous-titre équipage, puces ⏱, ⚓ et 🔁 validés.`);
} else {
  console.error(`✗ [Écran de défaite] Gabarit de remontée en surface non conforme :\n`, htmlDefaite);
  process.exit(1);
}

console.log('\n=== TOUS LES TESTS DU PALIER 7 (HAUTE COMPLEXITÉ) SONT VALIDÉS (100%) ===\n');
