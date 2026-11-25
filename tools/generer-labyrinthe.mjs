// tools/generer-labyrinthe.mjs
// Générateur et vérificateur du labyrinthe circulaire du Palier 7
// 7 anneaux concentriques x 16 secteurs angulaires = 112 cellules

const RINGS = 7; // ring index 0 (inner, track 1) to 6 (outer, track 7)
const SECTORS = 16;

function generateMaze(seed = 42) {
  let s = seed;
  function rnd() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  // Cells: (r, theta) where r in 0..6, theta in 0..15
  // Walls:
  // radialWalls[r][s]: wall between (r, s) and (r, (s+1)%16)
  // ringWalls[r][s]: wall between (r, s) and (r+1, s) (for r in 0..5)
  // innerOpening: sector on ring 0 that opens into the central core (radius 0)
  // outerBoundary: outer wall on ring 6 has start opening at sector 0

  const radialWalls = Array.from({ length: RINGS }, () => Array(SECTORS).fill(true));
  const ringWalls = Array.from({ length: RINGS - 1 }, () => Array(SECTORS).fill(true));

  // Use randomized Kruskal or DFS to generate a maze with high branching and long winding path
  // DFS with biased direction (prefer angular movements to create long circular corridors before ring jumps)
  const visited = Array.from({ length: RINGS }, () => Array(SECTORS).fill(false));
  const stack = [];

  // Start at outer ring 6, sector 0
  const startR = 6, startS = 0;
  visited[startR][startS] = true;
  stack.push({ r: startR, s: startS });

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const { r, s } = current;

    // Collect unvisited neighbors
    const neighbors = [];

    // Angular neighbors
    const sNext = (s + 1) % SECTORS;
    if (!visited[r][sNext]) neighbors.push({ r, s: sNext, dir: 'sNext', weight: 1.2 });

    const sPrev = (s - 1 + SECTORS) % SECTORS;
    if (!visited[r][sPrev]) neighbors.push({ r, s: sPrev, dir: 'sPrev', weight: 1.2 });

    // Radial inward
    if (r > 0 && !visited[r - 1][s]) {
      neighbors.push({ r: r - 1, s, dir: 'rIn', weight: 1.0 });
    }

    // Radial outward
    if (r < RINGS - 1 && !visited[r + 1][s]) {
      neighbors.push({ r: r + 1, s, dir: 'rOut', weight: 0.8 });
    }

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      // Pick neighbor using weighted random
      const totalW = neighbors.reduce((acc, n) => acc + n.weight, 0);
      let p = rnd() * totalW;
      let chosen = neighbors[0];
      for (const n of neighbors) {
        p -= n.weight;
        if (p <= 0) { chosen = n; break; }
      }

      // Remove wall
      if (chosen.dir === 'sNext') {
        radialWalls[r][s] = false;
      } else if (chosen.dir === 'sPrev') {
        radialWalls[r][chosen.s] = false;
      } else if (chosen.dir === 'rIn') {
        ringWalls[r - 1][s] = false;
      } else if (chosen.dir === 'rOut') {
        ringWalls[r][s] = false;
      }

      visited[chosen.r][chosen.s] = true;
      stack.push({ r: chosen.r, s: chosen.s });
    }
  }

  // The inner core goal opening: pick a sector on ring 0 that has the longest distance from start
  // Let us compute distance from start to all cells using BFS
  const dist = Array.from({ length: RINGS }, () => Array(SECTORS).fill(-1));
  const queue = [{ r: startR, s: startS, d: 0 }];
  dist[startR][startS] = 0;

  while (queue.length > 0) {
    const { r, s, d } = queue.shift();

    // Check angular connections
    if (!radialWalls[r][s] && dist[r][(s + 1) % SECTORS] === -1) {
      dist[r][(s + 1) % SECTORS] = d + 1;
      queue.push({ r, s: (s + 1) % SECTORS, d: d + 1 });
    }
    const sPrev = (s - 1 + SECTORS) % SECTORS;
    if (!radialWalls[r][sPrev] && dist[r][sPrev] === -1) {
      dist[r][sPrev] = d + 1;
      queue.push({ r, s: sPrev, d: d + 1 });
    }

    // Check radial connections
    if (r > 0 && !ringWalls[r - 1][s] && dist[r - 1][s] === -1) {
      dist[r - 1][s] = d + 1;
      queue.push({ r: r - 1, s, d: d + 1 });
    }
    if (r < RINGS - 1 && !ringWalls[r][s] && dist[r + 1][s] === -1) {
      dist[r + 1][s] = d + 1;
      queue.push({ r: r + 1, s, d: d + 1 });
    }
  }

  // Find cell on ring 0 with max distance
  let maxD = -1, bestGoalS = 0;
  for (let s = 0; s < SECTORS; s++) {
    if (dist[0][s] > maxD) {
      maxD = dist[0][s];
      bestGoalS = s;
    }
  }

  // Count dead ends (cells with only 1 exit)
  let deadEnds = 0;
  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < SECTORS; s++) {
      let exits = 0;
      if (!radialWalls[r][s]) exits++;
      const sPrev = (s - 1 + SECTORS) % SECTORS;
      if (!radialWalls[r][sPrev]) exits++;
      if (r > 0 && !ringWalls[r - 1][s]) exits++;
      if (r < RINGS - 1 && !ringWalls[r][s]) exits++;
      if (r === 0 && s === bestGoalS) exits++; // exit to goal
      if (r === startR && s === startS) exits++; // start
      if (exits === 1) deadEnds++;
    }
  }

  return {
    seed,
    radialWalls,
    ringWalls,
    start: { r: startR, s: startS },
    goal: { r: 0, s: bestGoalS },
    pathLength: maxD,
    deadEnds
  };
}

// Find seed with highest pathLength and many dead ends
let bestSeed = 0, bestScore = -1, bestData = null;
for (let seed = 1; seed <= 500; seed++) {
  const data = generateMaze(seed);
  // Score based on long path and many dead ends
  const score = data.pathLength * 2 + data.deadEnds * 3;
  if (score > bestScore) {
    bestScore = score;
    bestSeed = seed;
    bestData = data;
  }
}

console.log(`Meilleur seed trouvé : ${bestSeed}`);
console.log(`Longueur du chemin vers le cœur : ${bestData.pathLength} pas`);
console.log(`Nombre d'impasses (culs-de-sac) : ${bestData.deadEnds}`);
console.log(`Secteur d'entrée du cœur (anneau 0) : ${bestData.goal.s}`);
