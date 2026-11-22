// Test suite for Palier 5 (Le Juste Prix)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== TEST SUITE PALIER 5 : LE JUSTE PRIX ===\n');

// 1. Charger et valider produits.json
const produitsPath = path.resolve('produits.json');
assert.ok(fs.existsSync(produitsPath), 'produits.json doit exister');
const produits = JSON.parse(fs.readFileSync(produitsPath, 'utf8'));
assert.ok(Array.isArray(produits) && produits.length >= 20, 'produits.json doit contenir au moins 20 produits');
console.log(`✓ [Catalogue] ${produits.length} produits chargés depuis produits.json`);

// Vérifier que chaque produit a les propriétés requises et PAS de prix en clair
for (const p of produits) {
  assert.ok(p.id, `Produit sans id : ${JSON.stringify(p)}`);
  assert.ok(p.nom, `Produit sans nom : ${p.id}`);
  assert.ok(p.categorie, `Produit sans categorie : ${p.id}`);
  assert.ok(p.image, `Produit sans image : ${p.id}`);
  assert.ok(p.sec && typeof p.sec === 'string' && p.sec.length >= 8, `Produit sans cle anti-triche sec : ${p.id}`);
  assert.strictEqual(typeof p.prix, 'undefined', `ALERTE ANTI-TRICHE : Le produit ${p.id} expose un prix en clair !`);
}
console.log('✓ [Anti-Triche] Aucun prix en clair dans produits.json, signatures et codes présents.');

// 2. Simuler l'environnement DOM minimal pour charger juste-prix.js
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

// Storage simulation
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
  NautilusSon: {
    jouer: (nom) => { /* audio stub */ }
  }
};

globalThis.window = windowMock;
globalThis.document = windowMock.document;
globalThis.sessionStorage = windowMock.sessionStorage;
globalThis.localStorage = windowMock.localStorage;
globalThis.fetch = windowMock.fetch;

// Charger juste-prix.js dans ce contexte
const codeMoteur = fs.readFileSync('juste-prix.js', 'utf8');
new Function(codeMoteur)();

assert.ok(window.NautilusJustePrix, 'window.NautilusJustePrix doit être défini');
console.log('✓ [Moteur] juste-prix.js chargé et initialisé avec succès');

// 3. Tests unitaires du déchiffrement anti-triche
const verifFn = window.NautilusJustePrix.verifierProposition;
assert.ok(typeof verifFn === 'function', 'verifierProposition doit être exporté');

// Tester avec le premier produit du catalogue
const p0 = produits[0];
// Déchiffrer en interne pour connaître la valeur attendue
const secretRealPrice = window.NautilusJustePrix.decrypterPrix(p0);
assert.ok(typeof secretRealPrice === 'number' && secretRealPrice > 0, `Prix déchiffré invalide: ${secretRealPrice}`);
console.log(`✓ [Anti-Triche] Produit '${p0.nom}' (${p0.id}) : déchiffrement dynamique valide (valeur cachée testée)`);

// Test tolérance ±5%
const resExact = verifFn(p0, secretRealPrice);
assert.strictEqual(resExact.valide, true, 'Prix exact doit être validé');
assert.strictEqual(resExact.message, "C'est le juste prix !", 'Message exact');

const resPlus4 = verifFn(p0, secretRealPrice * 1.04);
assert.strictEqual(resPlus4.valide, true, 'Prix +4% doit être validé');

const resMoins4 = verifFn(p0, secretRealPrice * 0.96);
assert.strictEqual(resMoins4.valide, true, 'Prix -4% doit être validé');

const resPlus5 = verifFn(p0, secretRealPrice * 1.05);
assert.strictEqual(resPlus5.valide, true, 'Prix +5% doit être validé (borne haute)');

const resMoins5 = verifFn(p0, secretRealPrice * 0.95);
assert.strictEqual(resMoins5.valide, true, 'Prix -5% doit être validé (borne basse)');

const resTropHaut = verifFn(p0, secretRealPrice * 1.15);
assert.strictEqual(resTropHaut.valide, false, 'Prix +15% ne doit pas être validé');
assert.strictEqual(resTropHaut.tropHaut, true, 'Doit indiquer trop haut');
assert.ok(resTropHaut.message.includes('moins'), 'Message doit indiquer C\'est moins');

const resTropBas = verifFn(p0, secretRealPrice * 0.85);
assert.strictEqual(resTropBas.valide, false, 'Prix -15% ne doit pas être validé');
assert.strictEqual(resTropBas.tropBas, true, 'Doit indiquer trop bas');
assert.ok(resTropBas.message.includes('plus'), 'Message doit indiquer C\'est plus');

console.log('✓ [Validation Tolérance] Tolérance ±5% validée avec succès (bornes, trop haut, trop bas).');

// 4. Test Scénario A : Bonne réponse au 1er essai
console.log('\n--- Test Scénario A : Bonne réponse ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');
  let victoireAppelee = false;
  let echecAppele = false;

  await window.NautilusJustePrix.init(host, {
    equipe: 'NEMO',
    onVictoire: (res) => { victoireAppelee = true; },
    onEchec: (motif) => { echecAppele = true; }
  });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');
  assert.ok(input, 'Le champ input prix doit être rendu');
  assert.ok(btnValider, 'Le bouton valider doit être rendu');

  // Récupérer le produit en cours
  const prodCourant = window.NautilusJustePrix.getProduitCourant();
  const prixReel = window.NautilusJustePrix.decrypterPrix(prodCourant);

  // Proposer le juste prix
  input.value = String(prixReel);
  btnValider.dispatchEvent({ type: 'click' });

  const etat = window.NautilusJustePrix.getEtatPartie();
  assert.strictEqual(etat.score, 1, 'Le score doit être incrémenté à 1 après une bonne réponse');
  console.log(`✓ Bonne réponse enregistrée : score=${etat.score}/10, produit suivant chargé.`);
}

// 5. Test Scénario B : Mauvaise réponse & feedback "C'est plus" / "C'est moins"
console.log('\n--- Test Scénario B : Mauvaise réponse et feedback ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');

  await window.NautilusJustePrix.init(host, { equipe: 'NEMO' });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');
  const prodCourant = window.NautilusJustePrix.getProduitCourant();
  const prixReel = window.NautilusJustePrix.decrypterPrix(prodCourant);

  // Proposition trop basse
  input.value = String(Math.max(1, Math.round(prixReel * 0.5)));
  btnValider.dispatchEvent({ type: 'click' });

  let feedback = host.querySelector('#jpFeedback');
  assert.ok(feedback && feedback.textContent.includes('plus'), 'Le feedback doit être "C\'est plus !" quand la proposition est trop basse');
  assert.strictEqual(window.NautilusJustePrix.getEssaisRestants(), 2, 'Il doit rester 2 essais');

  // Proposition trop haute
  input.value = String(Math.round(prixReel * 2.0));
  btnValider.dispatchEvent({ type: 'click' });

  feedback = host.querySelector('#jpFeedback');
  assert.ok(feedback && feedback.textContent.includes('moins'), 'Le feedback doit être "C\'est moins !" quand la proposition est trop haute');
  assert.strictEqual(window.NautilusJustePrix.getEssaisRestants(), 1, 'Il doit rester 1 essai');

  console.log('✓ Feedback C\'est plus / C\'est moins vérifié et décompte des essais exact.');
}

// 6. Test Scénario C : 3 erreurs sur un produit -> produit perdu + révélation prix
console.log('\n--- Test Scénario C : 3 erreurs sur un produit ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');

  await window.NautilusJustePrix.init(host, { equipe: 'NEMO' });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');
  const prodCourant = window.NautilusJustePrix.getProduitCourant();
  const prixReel = window.NautilusJustePrix.decrypterPrix(prodCourant);

  // 3 mauvaises propositions
  for (let i = 0; i < 3; i++) {
    input.value = '1';
    btnValider.dispatchEvent({ type: 'click' });
  }

  const feedback = host.querySelector('#jpFeedback');
  assert.ok(feedback.textContent.includes('Produit perdu') || feedback.textContent.includes('juste prix'),
    'Le feedback doit révéler le prix réel après 3 erreurs');
  assert.ok(feedback.textContent.includes(prixReel.toFixed(2).replace('.', ',')),
    'Le prix réel formaté doit apparaître dans le message d\'échec');

  const etat = window.NautilusJustePrix.getEtatPartie();
  assert.strictEqual(etat.produitsPerdus, 1, 'Le compteur de produits perdus doit valoir 1');
  console.log(`✓ 3 erreurs gérées : prix réel révélé (${prixReel.toFixed(2)} €), produit perdu comptabilisé (1/3).`);
}

// 7. Test Scénario D : 3 produits perdus au total -> Défaite (lockout)
console.log('\n--- Test Scénario D : 3 produits perdus -> Défaite (lockout) ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');
  let motifEchec = null;

  await window.NautilusJustePrix.init(host, {
    equipe: 'NEMO',
    delaiTransitionMs: 10, // transition rapide pour le test
    onEchec: (motif) => { motifEchec = motif; }
  });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');

  // Perdre 3 produits consécutivement (3 x 3 essais)
  for (let prod = 0; prod < 3; prod++) {
    for (let essai = 0; essai < 3; essai++) {
      input.value = '1';
      btnValider.dispatchEvent({ type: 'click' });
    }
    // Avancer le temps pour la transition
    await new Promise(r => setTimeout(r, 20));
  }

  assert.strictEqual(motifEchec, 'erreurs', 'La défaite doit être déclenchée avec le motif erreurs après 3 produits perdus');
  console.log('✓ Défaite (3 produits perdus) déclenche bien onEchec("erreurs") pour la remontée en surface.');
}

// 8. Test Scénario E : Rechargement en cours de partie (Session recovery)
console.log('\n--- Test Scénario E : Rechargement en cours de partie ---');
{
  window.sessionStorage.clear();
  const host1 = new FakeElement('div');

  await window.NautilusJustePrix.init(host1, { equipe: 'NEMO', delaiTransitionMs: 10 });

  const input1 = host1.querySelector('#jpInputPrix');
  const btnValider1 = host1.querySelector('#jpBtnValider');

  // Gagner le produit 0
  const p0 = window.NautilusJustePrix.getProduitCourant();
  input1.value = String(window.NautilusJustePrix.decrypterPrix(p0));
  btnValider1.dispatchEvent({ type: 'click' });
  await new Promise(r => setTimeout(r, 20));

  // Vérifier que la session a été enregistrée dans sessionStorage
  const sessionData = window.sessionStorage.getItem('nautilusJustePrixSession');
  assert.ok(sessionData, 'La session doit être sauvegardée dans sessionStorage');
  const parsed = JSON.parse(sessionData);
  assert.strictEqual(parsed.score, 1, 'Score sauvegardé = 1');
  assert.strictEqual(parsed.indexCourant, 1, 'Index sauvegardé = 1');

  // "Rechargement" de la page : initialiser un nouveau conteneur
  const host2 = new FakeElement('div');
  await window.NautilusJustePrix.init(host2, { equipe: 'NEMO' });

  const etatRecup = window.NautilusJustePrix.getEtatPartie();
  assert.strictEqual(etatRecup.score, 1, 'Le score doit être restauré à 1');
  assert.strictEqual(etatRecup.indexCourant, 1, 'L\'index produit doit être restauré à 1');
  console.log(`✓ Reprise sur rechargement OK : score restauré (${etatRecup.score}), index restauré (${etatRecup.indexCourant}).`);
}

// 9. Test Scénario F : Victoire à ≥ 80% (8 produits réussis sur 10)
console.log('\n--- Test Scénario F : Victoire à ≥ 80% ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');
  let victoireRes = null;

  await window.NautilusJustePrix.init(host, {
    equipe: 'NEMO',
    delaiTransitionMs: 5,
    onVictoire: (res) => { victoireRes = res; }
  });

  const input = host.querySelector('#jpInputPrix');
  const btnValider = host.querySelector('#jpBtnValider');

  // Valider 8 produits, perdre 2 produits (total 10 produits, 80% réussite)
  for (let prod = 0; prod < 10; prod++) {
    if (prod < 8) {
      // Victoire sur ce produit
      const p = window.NautilusJustePrix.getProduitCourant();
      input.value = String(window.NautilusJustePrix.decrypterPrix(p));
      btnValider.dispatchEvent({ type: 'click' });
    } else {
      // Défaite sur ce produit
      for (let essai = 0; essai < 3; essai++) {
        input.value = '1';
        btnValider.dispatchEvent({ type: 'click' });
      }
    }
    await new Promise(r => setTimeout(r, 15));
  }

  assert.ok(victoireRes, 'onVictoire doit être appelé');
  assert.strictEqual(victoireRes.reussite, true, 'Victoire doit indiquer réussite = true');
  assert.strictEqual(victoireRes.articlesTrouves, 8, '8 articles trouvés');
  assert.ok(victoireRes.score.includes('8') && victoireRes.score.includes('10'), 'Score affiché 8 / 10');
  console.log(`✓ Victoire atteinte avec ${victoireRes.score} (${victoireRes.pourcentage}%) ≥ 80%.`);
}

// 10. Test Scénario G : Liste vide ou erreur de chargement
console.log('\n--- Test Scénario G : Liste de produits vide ---');
{
  window.sessionStorage.clear();
  const host = new FakeElement('div');

  // Remplacer fetch pour retourner un tableau vide
  const oldFetch = globalThis.fetch;
  const mockEmptyFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => []
  });
  window.fetch = mockEmptyFetch;
  globalThis.fetch = mockEmptyFetch;

  await window.NautilusJustePrix.init(host, { equipe: 'NEMO' });

  const msgErreur = host.querySelector('.jp-vide, .status-banner');
  assert.ok(msgErreur, 'Un message propre doit être affiché lorsque la liste de produits est vide');
  assert.ok(host.innerHTML.includes('Aucun article disponible') || host.innerHTML.includes('indisponible'),
    'Le texte doit expliciter l\'indisponibilité du catalogue');

  window.fetch = oldFetch;
  globalThis.fetch = oldFetch;
  console.log('✓ Gestion gracieuse de catalogue vide sans plantage.');
}

console.log('\n=== TOUS LES TESTS SCÉNARISÉS ONT RÉUSSI AVEC SUCCÈS (10/10) ===');
