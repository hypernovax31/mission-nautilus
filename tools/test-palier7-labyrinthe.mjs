// tools/test-palier7-labyrinthe.mjs
// Suite de tests unitaires et de conformité du Palier 7 : Le Labyrinthe Circulaire 10x24

import fs from 'fs';

console.log('=== TEST SUITE PALIER 7 : LE LABYRINTHE CIRCULAIRE DU NAUTILUS (10x24) ===\n');

// 1. Vérification de l existence des fichiers clés
const files = [
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

// 6. Vérification du minuteur de 1 minute maximum et suppression du compteur
if (code.includes('DUREE_PARCOURS_SEC = 60') && code.includes('labyTimer') && !code.includes('labyChrono') && !code.includes('t0Chrono')) {
  console.log(`✓ [Minuteur] Minuteur de 1 minute maximum (60s) actif, compteur incrémental supprimé avec succès.`);
} else {
  console.error(`✗ [Minuteur] Configuration du minuteur ou suppression du compteur non conforme.`);
  process.exit(1);
}

// 7. Vérification de la priorité au gyroscope mobile
if (code.includes('laby-gyro-prompt') && code.includes('DeviceOrientationEvent.requestPermission')) {
  console.log(`✓ [Contrôles] Priorité absolue au gyroscope avec demande d'autorisation iOS interactive.`);
} else {
  console.error(`✗ [Contrôles] Priorité gyroscope incomplète.`);
  process.exit(1);
}

// 8. Vérification du Service Worker
const swContent = fs.readFileSync('sw.js', 'utf8');
if (swContent.includes('./palier7-jeu.html') && swContent.includes('./labyrinthe.html') && swContent.includes('./labyrinthe-circulaire.js?v=2') && swContent.includes('./css/palier7.css?v=2')) {
  console.log(`✓ [Cache PWA] Tous les assets v2 du Palier 7 sont précachés dans sw.js.`);
} else {
  console.error(`✗ [Cache PWA] Assets v2 manquants dans sw.js.`);
  process.exit(1);
}

console.log('\n=== TOUS LES TESTS DU PALIER 7 (HAUTE COMPLEXITÉ) SONT VALIDÉS (100%) ===\n');
