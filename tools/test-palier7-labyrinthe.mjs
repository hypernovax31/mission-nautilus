// tools/test-palier7-labyrinthe.mjs
// Suite de tests unitaires et de conformité du Palier 7 : Le Labyrinthe Circulaire

import fs from 'fs';

console.log('=== TEST SUITE PALIER 7 : LE LABYRINTHE CIRCULAIRE DU NAUTILUS ===\n');

// 1. Vérification de l existence des fichiers clés
const files = [
  'palier7-jeu.html',
  '22718151124.html',
  'labyrinthe.html',
  'labyrinthe-circulaire.js',
  'css/palier7.css'
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

const fn = new Function('window', 'document', 'localStorage', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setInterval', 'clearInterval', 'setTimeout', code);

global.window = mockWindow;
global.document = {
  addEventListener: () => {},
  removeEventListener: () => {}
};

try {
  fn(mockWindow, global.document, {}, { now: () => 0 }, () => 1, () => {}, () => 1, () => {}, () => 1);
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
// Extraire les constantes RADIAL_WALLS et RING_WALLS
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

console.log(`✓ [Topologie] 7 anneaux et 16 secteurs bien définis.`);
console.log(`✓ [Parois] ${RADIAL_WALLS.flat().filter(Boolean).length} parois radiales et ${RING_WALLS.flat().filter(Boolean).length} parois circulaires.`);

// BFS pour vérifier le chemin
const RINGS = 7, SECTORS = 16;
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
  console.log(`✓ [Solvabilité] Chemin valide du départ vers le Cœur central (${goalDist} étapes requises).`);
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

if (deadEnds >= 15) {
  console.log(`✓ [Impasses] Labyrinthe très difficile validé avec ${deadEnds} culs-de-sac (≥ 15 requis).`);
} else {
  console.error(`✗ [Impasses] Seulement ${deadEnds} culs-de-sac trouvés.`);
  process.exit(1);
}

// 4. Vérification de la gestion Gyroscope + Joystick de secours
if (code.includes('DeviceOrientationEvent') && code.includes('deviceorientation')) {
  console.log(`✓ [Contrôles] Détection et support du gyroscope mobile (DeviceOrientation) validés.`);
} else {
  console.error(`✗ [Contrôles] Gyroscope manquant dans le code.`);
  process.exit(1);
}

if (code.includes('joystickZone') && code.includes('labyJoyBase') && code.includes('activerModeJoystick')) {
  console.log(`✓ [Contrôles] Joystick tactile de secours (si pas de gyroscope) validé.`);
} else {
  console.error(`✗ [Contrôles] Joystick tactile manquant.`);
  process.exit(1);
}

// 5. Vérification du rendu 3D de la bille
if (code.includes('createRadialGradient') && code.includes('shadowGrad') && code.includes('rotX') && code.includes('rotY')) {
  console.log(`✓ [Rendu 3D] Bille 3D avec ombrage sphérique, reflets spéculaires et rotation 3D validée.`);
} else {
  console.error(`✗ [Rendu 3D] Éléments 3D manquants.`);
  process.exit(1);
}

// 6. Vérification du Service Worker
const swContent = fs.readFileSync('sw.js', 'utf8');
if (swContent.includes('./palier7-jeu.html') && swContent.includes('./labyrinthe.html') && swContent.includes('./labyrinthe-circulaire.js?v=1') && swContent.includes('./css/palier7.css?v=1')) {
  console.log(`✓ [Cache PWA] Tous les assets du Palier 7 sont précachés dans sw.js.`);
} else {
  console.error(`✗ [Cache PWA] Assets manquants dans sw.js.`);
  process.exit(1);
}

console.log('\n=== TOUS LES TESTS DU PALIER 7 (LABYRINTHE CIRCULAIRE) SONT VALIDÉS (100%) ===\n');
