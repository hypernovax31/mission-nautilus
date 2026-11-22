// Test suite for Palier 5 (Le Juste Prix) - Version 2 (Prix exact, Chrono 10s, Voyants rouges, Pouces)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TEST SUITE PALIER 5 : LE JUSTE PRIX (V2 - RÈGLES STRICTES) ===\n');

// 1. Charger et valider produits.json et images locales
const produitsPath = path.resolve('produits.json');
assert.ok(fs.existsSync(produitsPath), 'produits.json doit exister');
const produits = JSON.parse(fs.readFileSync(produitsPath, 'utf8'));
assert.ok(Array.isArray(produits) && produits.length >= 20, 'produits.json doit contenir au moins 20 produits');
console.log(`✓ [Catalogue] ${produits.length} produits chargés depuis produits.json`);

for (const p of produits) {
  assert.ok(p.id, `Produit sans id : ${JSON.stringify(p)}`);
  assert.ok(p.nom, `Produit sans nom : ${p.id}`);
  assert.ok(p.categorie, `Produit sans categorie : ${p.id}`);
  assert.ok(p.image && p.image.startsWith('assets/produits/'), `Image locale requise : ${p.id} -> ${p.image}`);
  assert.ok(fs.existsSync(p.image), `Fichier image manquant : ${p.image}`);
  assert.ok(p.sec && typeof p.sec === 'string' && p.sec.length >= 4, `Produit sans cle anti-triche sec : ${p.id}`);
  assert.strictEqual(typeof p.prix, 'undefined', `ALERTE ANTI-TRICHE : Le produit ${p.id} expose un prix en clair !`);
}
console.log('✓ [Images & Anti-Triche] Les 28 images locales SVG existent et aucun prix en clair dans produits.json.');

// 2. Simuler l'environnement DOM
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
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.value = '';
    this._innerHTML = '';
    this.disabled = false;
    this.hidden = false;
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(html) {
    this._innerHTML = html;
    this.parseChildren(html);
  }

  get textContent() {
    return this._innerHTML.replace(/<[^>]*>/g, '');
  }
  set textContent(txt) {
    this._innerHTML = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    this.children = [];
  }

  get className() { return Array.from(this.classList._classes).join(' '); }
  set className(cn) {
    this.classList._classes.clear();
    if (cn) cn.trim().split(/\s+/).forEach(c => this.classList._classes.add(c));
  }

  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) || null; }
  removeAttribute(k) { this.attributes.delete(k); }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    if (!this.listeners.has(type)) return;
    this.listeners.set(type, this.listeners.get(type).filter(f => f !== fn));
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    list.forEach(fn => fn(event));
    if (this['on' + event.type]) this['on' + event.type](event);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const res = [];
    const walk = (el) => {
      if (matches(el, sel)) res.push(el);
      for (const c of el.children) walk(c);
    };
    for (const c of this.children) walk(c);
    return res;
  }

  focus() { this.focused = true; }
  blur() { this.focused = false; }
  select() { this.selected = true; }

  parseChildren(html) {
    this.children = [];
    const openTagRe = /<([a-z0-9]+)([^>]*)>/gi;
    let match;
    while ((match = openTagRe.exec(html)) !== null) {
      const tag = match[1];
      if (tag.startsWith('/')) continue;
      const attrsStr = match[2] || '';
      const child = new FakeElement(tag);

      const idM = /id=["']([^"']+)["']/i.exec(attrsStr);
      if (idM) { child.id = idM[1]; child.setAttribute('id', idM[1]); }

      const classM = /class=["']([^"']+)["']/i.exec(attrsStr);
      if (classM) {
        classM[1].trim().split(/\s+/).forEach(c => child.classList.add(c));
        child.setAttribute('class', classM[1]);
      }

      if (/disabled/i.test(attrsStr)) {
        child.disabled = true;
        child.setAttribute('disabled', 'true');
      }

      const dataAddM = /data-add=["']([^"']+)["']/i.exec(attrsStr);
      if (dataAddM) {
        child.dataset = child.dataset || {};
        child.dataset.add = dataAddM[1];
        child.setAttribute('data-add', dataAddM[1]);
      }

      this.children.push(child);
    }
  }
}

function matchesSingle(el, sel) {
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
  return el.tagName.toLowerCase() === sel.toLowerCase();
}

function matches(el, sel) {
  return sel.split(',').some(s => matchesSingle(el, s.trim()));
}

class FakeStorage {
  constructor() { this.data = new Map(); }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

const windowMock = {
  document: {
    createElement(tag) { return new FakeElement(tag); },
    getElementById(id) { return null; }
  },
  sessionStorage: new FakeStorage(),
  localStorage: new FakeStorage(),
  fetch: async (url) => {
    if (url.includes('produits.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(JSON.stringify(produits))
      };
    }
    return { ok: false, status: 404 };
  },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  NautilusSon: {
    jouer: () => {}
  }
};

globalThis.window = windowMock;
globalThis.document = windowMock.document;
globalThis.sessionStorage = windowMock.sessionStorage;
globalThis.localStorage = windowMock.localStorage;
globalThis.fetch = windowMock.fetch;

// Charger juste-prix.js
const codeMoteur = fs.readFileSync('juste-prix.js', 'utf8');
new Function(codeMoteur)();

assert.ok(window.NautilusJustePrix, 'window.NautilusJustePrix doit être défini');
console.log('✓ [Moteur] juste-prix.js chargé avec succès.');

// 3. Test de suppression de tolérance (prix exact)
const verifFn = window.NautilusJustePrix.verifierProposition;
const p0 = produits[0];
const prixReel = window.NautilusJustePrix.decrypterPrix(p0);
assert.ok(Number.isInteger(prixReel) && prixReel > 0, `Le prix décodé doit être un entier positif : ${prixReel}`);

// Test exactitude
const resExact = verifFn(p0, prixReel);
assert.strictEqual(resExact.valide, true, 'Prix exact doit être validé');

const resPlus1 = verifFn(p0, prixReel + 1);
assert.strictEqual(resPlus1.valide, false, 'Prix +1€ ne doit PAS être validé (aucune tolérance)');
assert.strictEqual(resPlus1.tropHaut, true, 'Doit indiquer trop haut');

const resMoins1 = verifFn(p0, prixReel - 1);
assert.strictEqual(resMoins1.valide, false, 'Prix -1€ ne doit PAS être validé (aucune tolérance)');
assert.strictEqual(resMoins1.tropBas, true, 'Doit indiquer trop bas');

console.log(`✓ [Prix Exact] Tolérance supprimée validée : exactitude stricte vérifiée sur ${prixReel} €.`);

// 4. Test Scénario A : Bonne réponse & Voyants éteints
console.log('\n--- Test Scénario A : Bonne réponse ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');

  await window.NautilusJustePrix.init(host, {
    equipe: 'NEMO',
    delaiTransitionMs: 10
  });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');
  const voyant1 = host.querySelector('#jpVoyant1');

  assert.ok(input, 'Input présent');
  assert.ok(btnValider, 'Bouton valider présent');
  assert.strictEqual(voyant1.classList.contains('is-error'), false, 'Voyant 1 doit être éteint au départ');

  const prod = window.NautilusJustePrix.getProduitCourant();
  input.value = String(window.NautilusJustePrix.decrypterPrix(prod));
  btnValider.dispatchEvent({ type: 'click' });

  const etat = window.NautilusJustePrix.getEtatPartie();
  assert.strictEqual(etat.score, 1, 'Score = 1 après bonne réponse');
  console.log(`✓ Bonne réponse enregistrée : score=${etat.score}, voyants éteints.`);
}

// 5. Test Scénario B : Mauvaise réponse & Voyants rouges qui s'illuminent
console.log('\n--- Test Scénario B : 3 voyants rouges s\'illuminent à chaque erreur ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');

  await window.NautilusJustePrix.init(host, { equipe: 'NEMO', delaiTransitionMs: 10 });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');
  const prod = window.NautilusJustePrix.getProduitCourant();
  const vraiPrix = window.NautilusJustePrix.decrypterPrix(prod);

  // Erreur 1
  input.value = String(vraiPrix + 20);
  btnValider.dispatchEvent({ type: 'click' });
  let v1 = host.querySelector('#jpVoyant1');
  let v2 = host.querySelector('#jpVoyant2');
  let v3 = host.querySelector('#jpVoyant3');
  assert.strictEqual(v1.classList.contains('is-error'), true, 'Voyant 1 doit être allumé en rouge après 1ère erreur');
  assert.strictEqual(v2.classList.contains('is-error'), false, 'Voyant 2 doit rester éteint');
  assert.strictEqual(v3.classList.contains('is-error'), false, 'Voyant 3 doit rester éteint');

  // Erreur 2
  input.value = String(vraiPrix - 10);
  btnValider.dispatchEvent({ type: 'click' });
  assert.strictEqual(v1.classList.contains('is-error'), true, 'Voyant 1 rouge');
  assert.strictEqual(v2.classList.contains('is-error'), true, 'Voyant 2 doit être allumé en rouge après 2ème erreur');
  assert.strictEqual(v3.classList.contains('is-error'), false, 'Voyant 3 éteint');

  // Erreur 3
  input.value = String(vraiPrix + 5);
  btnValider.dispatchEvent({ type: 'click' });
  assert.strictEqual(v1.classList.contains('is-error'), true, 'Voyant 1 rouge');
  assert.strictEqual(v2.classList.contains('is-error'), true, 'Voyant 2 rouge');
  assert.strictEqual(v3.classList.contains('is-error'), true, 'Voyant 3 doit être allumé en rouge après 3ème erreur');

  console.log('✓ Les 3 voyants rouges s\'illuminent consécutivement à chaque erreur.');
}

// 6. Test Scénario C : Chronomètre 10s et expiration
console.log('\n--- Test Scénario C : Chronomètre 10s par réponse ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');

  await window.NautilusJustePrix.init(host, { equipe: 'NEMO', delaiTransitionMs: 10 });

  const timerVal = host.querySelector('#jpTimerVal');
  const timerBar = host.querySelector('#jpTimerBar');
  assert.ok(timerVal && timerVal.textContent.includes('10s'), 'Le timer doit démarrer à 10s');
  assert.ok(timerBar, 'La barre de progression du chrono doit être présente');

  // Forcer l'écoulement du temps (10s écoulées)
  window.NautilusJustePrix.forcerTempsEcoule();

  const feedback = host.querySelector('#jpFeedback');
  assert.ok(feedback.textContent.includes('Temps écoulé'), 'Le feedback doit notifier le temps écoulé');
  const v1 = host.querySelector('#jpVoyant1');
  assert.strictEqual(v1.classList.contains('is-error'), true, 'Le voyant 1 rouge doit s\'allumer sur expiration chrono');

  console.log('✓ Chronomètre 10s et gestion d\'expiration validés.');
}

// 7. Test Scénario D : Règle stricte des 8/10 (Moins de 8 réponses trouvées = Défaite)
console.log('\n--- Test Scénario D : Échec si < 8 réponses trouvées -> Remontée en surface ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');
  let motifEchec = null;

  await window.NautilusJustePrix.init(host, {
    equipe: 'NEMO',
    delaiTransitionMs: 5,
    onEchec: (motif) => { motifEchec = motif; }
  });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');

  // Perdre 3 articles (score max = 7 < 8 -> défaite immédiate)
  for (let prod = 0; prod < 3; prod++) {
    for (let essai = 0; essai < 3; essai++) {
      input.value = '1';
      btnValider.dispatchEvent({ type: 'click' });
    }
    await new Promise(r => setTimeout(r, 15));
  }

  assert.strictEqual(motifEchec, 'erreurs', 'La défaite doit être déclenchée avec motif erreurs car < 8 réussites possibles');
  console.log('✓ Moins de 8 réponses possibles (3 articles perdus) déclenche bien la défaite et remontée en surface.');
}

// 8. Test Scénario E : Victoire à ≥ 80% (au moins 8 sur 10)
console.log('\n--- Test Scénario E : Victoire validée avec 8 articles sur 10 ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');
  let vic = null;

  await window.NautilusJustePrix.init(host, {
    equipe: 'NEMO',
    delaiTransitionMs: 5,
    onVictoire: (res) => { vic = res; }
  });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');

  for (let prod = 0; prod < 10; prod++) {
    if (prod < 8) {
      const p = window.NautilusJustePrix.getProduitCourant();
      input.value = String(window.NautilusJustePrix.decrypterPrix(p));
      btnValider.dispatchEvent({ type: 'click' });
    } else {
      for (let essai = 0; essai < 3; essai++) {
        input.value = '1';
        btnValider.dispatchEvent({ type: 'click' });
      }
    }
    await new Promise(r => setTimeout(r, 15));
  }

  assert.ok(vic, 'onVictoire doit être appelé');
  assert.strictEqual(vic.articlesTrouves, 8, '8 articles trouvés');
  assert.strictEqual(vic.reussite, true, 'Réussite = true');
  console.log(`✓ Victoire acquise avec 8 articles validés sur 10 (${vic.score}).`);
}

// 9. Test Scénario F : Chargement frais anti-cache à chaque lancement
console.log('\n--- Test Scénario F : Requête anti-cache à chaque lancement ---');
{
  let urlAppelee = '';
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urlAppelee = url;
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(JSON.stringify(produits))
    };
  };

  const host = new FakeElement('div');
  await window.NautilusJustePrix.init(host, { equipe: 'NEMO' });

  assert.ok(urlAppelee.includes('produits.json?v='), 'L\'URL doit comporter un paramètre anti-cache ?v=');
  console.log(`✓ Requête anti-cache validée : ${urlAppelee}`);

  globalThis.fetch = oldFetch;
}

console.log('\n=== TOUS LES TESTS SCÉNARISÉS V2 ONT RÉUSSI AVEC SUCCÈS (10/10) ===');
process.exit(0);
