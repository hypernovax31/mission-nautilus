// Test suite pour le Palier 4 : Génération de flotte unique par équipe & Réinitialisation en mode test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

console.log('=== TEST SUITE PALIER 4 : BATAILLE NAVALE / TRAQUE SONAR ===\n');

// 1. Charger et exécuter palier4-bataille.js dans un environnement DOM simulé
const p4Code = fs.readFileSync('palier4-bataille.js', 'utf8');

const localStorageMock = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.classList = {
      _classes: new Set(),
      add(...c) { c.forEach(cls => this._classes.add(cls)); },
      remove(...c) { c.forEach(cls => this._classes.delete(cls)); },
      contains(cls) { return this._classes.has(cls); },
      toggle(cls, force) {
        if (force === undefined) {
          if (this._classes.has(cls)) this._classes.delete(cls);
          else this._classes.add(cls);
        } else if (force) this._classes.add(cls);
        else this._classes.delete(cls);
      }
    };
    this.attributes = new Map();
    this.listeners = new Map();
    this._innerHTML = '';
    this.disabled = false;
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) || null; }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all[0] || null;
  }
  querySelectorAll(sel) {
    const res = [];
    function walk(node) {
      if (!node) return;
      if (sel.startsWith('#')) {
        const id = sel.slice(1);
        if (node.attributes && node.attributes.get('id') === id) res.push(node);
      } else if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        if (node.classList && node.classList.contains(cls)) res.push(node);
      }
      if (node.children) {
        for (const child of node.children) walk(child);
      }
    }
    walk(this);
    return res;
  }
}

const fakeDocument = {
  createElement: (tag) => new FakeElement(tag),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

const sandbox = {
  window: {},
  document: fakeDocument,
  localStorage: localStorageMock,
  location: { search: '' },
  console: console,
  Set: Set,
  Array: Array,
  Math: Math,
  JSON: JSON
};

vm.createContext(sandbox);
vm.runInContext(p4Code, sandbox);

const NautilusBataille = sandbox.window.NautilusBataille;
assert.ok(NautilusBataille, 'window.NautilusBataille doit être exporté');
assert.strictEqual(typeof NautilusBataille.getFlottePourEquipe, 'function', 'getFlottePourEquipe doit être une fonction');
assert.strictEqual(typeof NautilusBataille.reinitialiser, 'function', 'reinitialiser doit être une fonction');
console.log('✓ [API] window.NautilusBataille exporte correctement init, reinitialiser et getFlottePourEquipe.');

// 2. Vérification des flottes pour chaque équipe en mode normal
const TEAMS = ['NEMO', 'NAUTILUS', 'ARONNAX', 'NEDLAND'];
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

const flottesParEquipe = {};

for (const team of TEAMS) {
  const flotte = NautilusBataille.getFlottePourEquipe(team);
  assert.ok(Array.isArray(flotte) && flotte.length === 4, `L'équipe ${team} doit avoir 4 monstres`);
  flottesParEquipe[team] = flotte;

  const casesOccupees = new Set();
  const taillesAttendues = { kraken: 4, calmar: 3, anguille: 2, manta: 1 };

  for (const nav of flotte) {
    assert.strictEqual(nav.coords.length, taillesAttendues[nav.id], `Monstre ${nav.id} de taille incorrecte (${nav.coords.length})`);

    // Vérifier les coordonnées valides
    for (const c of nav.coords) {
      assert.ok(c.length === 2, `Format coord invalide : ${c}`);
      const col = c[0];
      const row = Number(c[1]);
      assert.ok(COLS.includes(col), `Colonne hors limites : ${col}`);
      assert.ok(ROWS.includes(row), `Ligne hors limites : ${row}`);

      // Pas de collision interne
      assert.ok(!casesOccupees.has(c), `Collision interne dans l'équipe ${team} sur la case ${c}`);
      casesOccupees.add(c);
    }

    // Vérifier l'alignement continu (horizontal ou vertical)
    if (nav.coords.length > 1) {
      const memeCol = nav.coords.every(c => c[0] === nav.coords[0][0]);
      const memeLig = nav.coords.every(c => c[1] === nav.coords[0][1]);
      assert.ok(memeCol || memeLig, `Le navire ${nav.nom} de ${team} n'est ni horizontal ni vertical : ${nav.coords.join(',')}`);

      if (memeCol) {
        const rows = nav.coords.map(c => Number(c[1])).sort((a, b) => a - b);
        for (let i = 0; i < rows.length - 1; i++) {
          assert.strictEqual(rows[i + 1], rows[i] + 1, `Le navire vertical ${nav.nom} de ${team} a des cases non contiguës`);
        }
      } else {
        const colIndices = nav.coords.map(c => COLS.indexOf(c[0])).sort((a, b) => a - b);
        for (let i = 0; i < colIndices.length - 1; i++) {
          assert.strictEqual(colIndices[i + 1], colIndices[i] + 1, `Le navire horizontal ${nav.nom} de ${team} a des cases non contiguës`);
        }
      }
    }
  }

  console.log(`✓ [Flotte ${team}] 4 créatures générées sans collision interne :`);
  flotte.forEach(s => console.log(`   - ${s.ico} ${s.nom} (${s.taille}c) : ${s.coords.join(' · ')}`));
}

// 3. Vérifier qu'en mode normal, les différentes équipes ne partagent AUCUN emplacement de monstre
console.log('\n--- Vérification de la non-collision des emplacements entre équipes ---');
const monsterTypes = ['kraken', 'calmar', 'anguille', 'manta'];

for (const mId of monsterTypes) {
  const emplacementsParMonstre = new Map();

  for (const team of TEAMS) {
    const navire = flottesParEquipe[team].find(s => s.id === mId);
    assert.ok(navire, `Monstre ${mId} introuvable pour ${team}`);
    const keyCoords = navire.coords.slice().sort().join(',');

    if (emplacementsParMonstre.has(keyCoords)) {
      const autreEquipe = emplacementsParMonstre.get(keyCoords);
      assert.fail(`COLLISION DÉTECTÉE ! Le monstre ${navire.nom} partage le même emplacement (${keyCoords}) entre ${autreEquipe} et ${team}`);
    }
    emplacementsParMonstre.set(keyCoords, team);
  }
}
console.log('✓ [Validation inter-équipes] Aucune créature ne partage le même emplacement entre deux équipes !');

// 4. Vérifier l'isolation et la réinitialisation en mode test
console.log('\n--- Vérification de la réinitialisation en mode test ---');

// Préparer un mock de host pour init
const hostEl = new FakeElement('div');
localStorageMock.clear();

// Simulation d'une partie en mode test
const engineTest = NautilusBataille.init(hostEl, {
  equipe: 'TEST',
  isTest: true
});

assert.ok(engineTest, 'Instance du moteur créée');
assert.strictEqual(typeof engineTest.reinitialiser, 'function', 'Instance doit exposer reinitialiser()');

// Écrire des tirs dans la session test
localStorageMock.setItem('nautilusP4Partie:TEST', JSON.stringify({ tirs: ['A1', 'B2', 'C3'] }));
assert.ok(localStorageMock.getItem('nautilusP4Partie:TEST'), 'La clé test doit exister');

// Réinitialisation via l'instance
engineTest.reinitialiser();
assert.strictEqual(localStorageMock.getItem('nautilusP4Partie:TEST'), null, 'La clé de partie test doit avoir été effacée par reinitialiser()');
assert.strictEqual(localStorageMock.getItem('nautilusP4Partie:NEMO'), null, 'La clé NEMO ne doit jamais être touchée en mode test');

// Réinitialisation globale via NautilusBataille.reinitialiser
localStorageMock.setItem('nautilusP4Partie:TEST', JSON.stringify({ tirs: ['H7', 'H8'] }));
NautilusBataille.reinitialiser('TEST');
assert.strictEqual(localStorageMock.getItem('nautilusP4Partie:TEST'), null, 'NautilusBataille.reinitialiser("TEST") doit purger la session de test');

console.log('✓ [Mode Test & Reset] La réinitialisation locale et globale en mode test fonctionne parfaitement sans polluer les équipes réelles.');
console.log('\n=== TOUS LES TESTS DU PALIER 4 SONT VALIDÉS AVEC SUCCÈS (100%) ===\n');
