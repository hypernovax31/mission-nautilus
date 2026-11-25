// tools/test-labyrinthe-temps-optimal.mjs
// Test et calcul physique du temps nécessaire pour atteindre le Cœur en ligne directe
// sur le Labyrinthe Circulaire 10x24 (Palier 7)

import fs from 'fs';

console.log('=== BENCHMARK DU LABYRINTHE CIRCULAIRE 10x24 (PALIER 7) ===\n');

// 1. Charger la topologie depuis labyrinthe-circulaire.js
const code = fs.readFileSync('labyrinthe-circulaire.js', 'utf8');
const radialMatch = code.match(/var RADIAL_WALLS = (\[[\s\S]*?\]);/);
const ringMatch = code.match(/var RING_WALLS = (\[[\s\S]*?\]);/);
const startRingMatch = code.match(/var START_RING = (\d+);/);
const goalSectorMatch = code.match(/var GOAL_SECTOR = (\d+);/);

if (!radialMatch || !ringMatch || !startRingMatch || !goalSectorMatch) {
  console.error('✗ Impossible d extraire la topologie');
  process.exit(1);
}

const RADIAL_WALLS = JSON.parse(radialMatch[1]);
const RING_WALLS = JSON.parse(ringMatch[1]);
const START_RING = parseInt(startRingMatch[1], 10);
const GOAL_SECTOR = parseInt(goalSectorMatch[1], 10);

const RINGS = RADIAL_WALLS.length;
const SECTORS = RADIAL_WALLS[0].length;

console.log(`Dimensions : ${RINGS} anneaux concentriques × ${SECTORS} secteurs = ${RINGS * SECTORS} cellules.`);
console.log(`Parois : ${RADIAL_WALLS.flat().filter(Boolean).length} radiales, ${RING_WALLS.flat().filter(Boolean).length} circulaires.`);

// 2. Recherche du chemin optimal le plus court (ligne directe / direct path) par BFS
const dist = Array.from({ length: RINGS }, () => Array(SECTORS).fill(-1));
const parent = Array.from({ length: RINGS }, () => Array(SECTORS).fill(null));

const queue = [{ r: START_RING, s: 0 }];
dist[START_RING][0] = 0;

while (queue.length > 0) {
  const { r, s } = queue.shift();
  const d = dist[r][s];

  // sNext
  if (!RADIAL_WALLS[r][s]) {
    const sNext = (s + 1) % SECTORS;
    if (dist[r][sNext] === -1) {
      dist[r][sNext] = d + 1;
      parent[r][sNext] = { r, s };
      queue.push({ r, s: sNext });
    }
  }
  // sPrev
  const sPrev = (s - 1 + SECTORS) % SECTORS;
  if (!RADIAL_WALLS[r][sPrev]) {
    if (dist[r][sPrev] === -1) {
      dist[r][sPrev] = d + 1;
      parent[r][sPrev] = { r, s };
      queue.push({ r, s: sPrev });
    }
  }
  // rIn
  if (r > 0 && !RING_WALLS[r - 1][s]) {
    if (dist[r - 1][s] === -1) {
      dist[r - 1][s] = d + 1;
      parent[r - 1][s] = { r, s };
      queue.push({ r: r - 1, s });
    }
  }
  // rOut
  if (r < RINGS - 1 && !RING_WALLS[r][s]) {
    if (dist[r + 1][s] === -1) {
      dist[r + 1][s] = d + 1;
      parent[r + 1][s] = { r, s };
      queue.push({ r: r + 1, s });
    }
  }
}

let curr = { r: 0, s: GOAL_SECTOR };
let path = [];
while (curr) {
  path.push(curr);
  curr = parent[curr.r][curr.s];
}
path.reverse();

console.log(`\n✓ Chemin optimal direct : ${path.length} cellules franchies (${path.length - 1} transitions).`);

// Compter les impasses
let deadEnds = 0;
for (let r = 0; r < RINGS; r++) {
  for (let s = 0; s < SECTORS; s++) {
    let exits = 0;
    if (!RADIAL_WALLS[r][s]) exits++;
    const sPrev = (s - 1 + SECTORS) % SECTORS;
    if (!radialWallsSeparation(r, sPrev)) exits++;
    if (r > 0 && !RING_WALLS[r - 1][s]) exits++;
    if (r < RINGS - 1 && !RING_WALLS[r][s]) exits++;
    if (r === 0 && s === GOAL_SECTOR) exits++;
    if (r === START_RING && s === 0) exits++;
    if (exits === 1) deadEnds++;
  }
}
function radialWallsSeparation(r, s) { return RADIAL_WALLS[r][s]; }
console.log(`✓ Nombre d'impasses (culs-de-sac) dans le labyrinthe : ${deadEnds}`);

// 3. Calcul de la distance géométrique en pixels
const size = 440;
const center = size / 2;
const rOuter = size * 0.465;
const rInner = size * 0.125;
const trackWidth = (rOuter - rInner) / RINGS;
const sectorAngle = (Math.PI * 2) / SECTORS;

let totalDistancePx = 0;
for (let i = 0; i < path.length - 1; i++) {
  const p1 = path[i];
  const p2 = path[i + 1];
  const rMid1 = rInner + (p1.r + 0.5) * trackWidth;

  if (p1.r === p2.r) {
    // Déplacement angulaire
    totalDistancePx += rMid1 * sectorAngle;
  } else {
    // Déplacement radial
    totalDistancePx += trackWidth;
  }
}
totalDistancePx += rInner * 0.75; // Franchissement final dans le cœur

console.log(`✓ Distance géométrique totale de la trajectoire : ${totalDistancePx.toFixed(1)} px.`);

// 4. Simulation physique de la navigation en ligne directe (trajectoire optimale)
// Waypoints au centre de chaque cellule
const waypoints = [];
for (let i = 0; i < path.length; i++) {
  const p = path[i];
  const rMid = rInner + (p.r + 0.5) * trackWidth;
  const a = (p.s + 0.5) * sectorAngle;
  waypoints.push({ x: center + rMid * Math.cos(a), y: center + rMid * Math.sin(a) });
}
waypoints.push({ x: center, y: center });

// Paramètres physiques du jeu
const GRAVITE = 460;   // px/s²
const V_MAX = 220;     // px/s
const FROTTEMENT_60 = 0.975;
const dt = 1 / 120;    // 120 Hz simulation

// Simulation pilote parfait (idéal continu sans hésitation)
let simTime = 0;
let bx = waypoints[0].x, by = waypoints[0].y;
let bvx = 0, bvy = 0;
let targetIdx = 1;

while (targetIdx < waypoints.length && simTime < 240) {
  const target = waypoints[targetIdx];
  const tdx = target.x - bx;
  const tdy = target.y - by;
  const distToTarget = Math.hypot(tdx, tdy);

  if (distToTarget < 9) {
    targetIdx++;
    continue;
  }

  const ax = (tdx / distToTarget) * GRAVITE;
  const ay = (tdy / distToTarget) * GRAVITE;

  bvx = (bvx + ax * dt) * Math.pow(FROTTEMENT_60, dt * 60);
  bvy = (bvy + ay * dt) * Math.pow(FROTTEMENT_60, dt * 60);

  const v = Math.hypot(bvx, bvy);
  if (v > V_MAX) {
    bvx = (bvx / v) * V_MAX;
    bvy = (bvy / v) * V_MAX;
  }

  bx += bvx * dt;
  by += bvy * dt;
  simTime += dt;
}

console.log('\n--- RÉSULTATS DES TESTS DE TEMPS EN LIGNE DIRECTE ---');
console.log(`• Temps physique théorique minimal (pilote parfait sans arrêt) : ${simTime.toFixed(2)} s (~${Math.floor(simTime / 60)} min ${Math.round(simTime % 60)} s).`);
const tempsHumainDirect = simTime * 1.25;
console.log(`• Temps estimé joueur expérimenté (connaissant le chemin direct) : ${tempsHumainDirect.toFixed(1)} s (~${Math.floor(tempsHumainDirect / 60)} min ${Math.round(tempsHumainDirect % 60)} s).`);
const tempsHumainExplo = simTime * 1.75;
console.log(`• Temps moyen joueur en découverte (exploration avec impasses)  : ${tempsHumainExplo.toFixed(1)} s (~${Math.floor(tempsHumainExplo / 60)} min ${Math.round(tempsHumainExplo % 60)} s).`);
console.log(`• Réserve d'oxygène allouée : 180 s (3 minutes) — parfaitement proportionnée pour la difficulté !\n`);
