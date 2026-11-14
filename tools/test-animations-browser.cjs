#!/usr/bin/env node
/* Regression tests in a real browser, with Firebase mocked: no production
   data is read or written. Install playwright-core and Chromium locally, then
   run this file with node. Set CHROMIUM_BIN if Chromium is not on Playwright's
   default path. The tests start their own loopback-only HTTP server.

   To test the targeted patch against an extracted copy of the published site:
     NAUTILUS_PUBLISHED_ROOT=/path/to/extracted/site node tools/test-animations-browser.cjs
   Apply tools/correctif-sonar-site-publie.patch to that copy beforehand. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const publishedSite = Boolean(process.env.NAUTILUS_PUBLISHED_ROOT);
const root = path.resolve(process.env.NAUTILUS_PUBLISHED_ROOT || path.join(__dirname, '..'));
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};
let probeCss = 'body { --probe-version: initial; }';
const cacheName = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/CACHE_NAME\s*=\s*'([^']+)'/)[1];
const landing = base => base + (publishedSite ? '?ecoutille=0' : '');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/blank.html') {
    res.writeHead(200, { 'Content-Type': mime['.html'] });
    res.end('<!doctype html><html><title>Service worker test</title></html>');
    return;
  }
  if (url.pathname === '/probe.css') {
    res.writeHead(200, { 'Content-Type': mime['.css'], 'Cache-Control': 'no-store' });
    res.end(probeCss);
    return;
  }
  const name = url.pathname === '/' ? '/index.html' : url.pathname;
  const filename = path.resolve(root, '.' + decodeURIComponent(name));
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(filename, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// Minimal Firestore response; only a fake Nemo crew is ever returned.
const firebase = {
  'firebase-app.js': `
    export const initializeApp = () => ({});
    export const getApps = () => [{}];
    export const getApp = () => ({});
  `,
  'firebase-auth.js': `
    export const getAuth = () => ({});
    export const signInAnonymously = async () => ({});
    export const onAuthStateChanged = (auth, cb) => { cb({uid: 'test'}); return () => {}; };
  `,
  'firebase-firestore.js': `
    const crew = [{id:'NEMO', data:()=>({teamName:'Nemo', members:[{name:'Alice',service:'PE',codeMatelot:'FAKE-2345'}], currentStep:'start', completedSteps:[]})}];
    const snap = ref => ({docs: ref && ref.path.endsWith('/teams') ? crew : [], exists:()=>true, data:()=>({}), empty:false, forEach:()=>{}});
    export const getFirestore = () => ({});
    export const doc = (...p) => ({path:p.join('/')});
    export const collection = (...p) => ({path:p.join('/')});
    export const getDoc = async ref => snap(ref);
    export const getDocs = async ref => snap(ref);
    export const setDoc = async () => {};
    export const updateDoc = async () => {};
    export const deleteDoc = async () => {};
    export const deleteField = () => null;
    export const serverTimestamp = () => new Date();
    export const onSnapshot = (ref, cb) => { queueMicrotask(() => cb(snap(ref))); return () => {}; };
    export const arrayUnion = (...values) => values;
    export const runTransaction = async (db, fn) => fn({get:getDoc,set:setDoc,update:updateDoc});
  `
};

async function prepareContext(browser, base, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1440, height: 900 },
    reducedMotion: options.reducedMotion || 'no-preference',
    serviceWorkers: options.serviceWorkers || 'block'
  });
  await context.addInitScript(() => {
    try { localStorage.setItem('nautilusInstallPromoSnooze', String(Date.now())); } catch (_) {}
    window.__typewriterEvents = 0;
    window.addEventListener('nautilus:fin-typewriter', () => window.__typewriterEvents++);
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    const name = url.pathname.split('/').pop();
    if (!options.blockFirebase && url.hostname === 'www.gstatic.com' && firebase[name]) {
      if (options.firebaseDelay) await new Promise(resolve => setTimeout(resolve, options.firebaseDelay));
      let body = firebase[name];
      if (options.failFirestore && name === 'firebase-firestore.js') {
        body = body.replace('export const getDocs = async ref => snap(ref);',
          "export const getDocs = async () => { throw new Error('test-network-failure'); };");
      }
      return route.fulfill({ status: 200, contentType: 'application/javascript',
        headers: { 'access-control-allow-origin': '*' }, body });
    }
    return route.abort();
  });
  return context;
}

async function radarInfo(page) {
  return page.evaluate(() => {
    const screen = document.querySelector('.radar-screen-big');
    const target = document.querySelector('.radar-sweep-big');
    const rect = screen.getBoundingClientRect();
    const style = getComputedStyle(target);
    return {
      top: rect.top, bottom: rect.bottom, viewport: innerHeight,
      name: style.animationName, duration: style.animationDuration,
      state: style.animationPlayState, transform: style.transform,
      idle: document.getElementById('radarStage').classList.contains('anim-idle')
    };
  });
}

async function assertMoving(page, name) {
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.radar-sweep-big')).animationPlayState === 'running');
  const before = await radarInfo(page);
  await page.waitForTimeout(250);
  const after = await radarInfo(page);
  assert.equal(after.name, 'radarRotateFast', name + ': keyframes absentes');
  assert.equal(after.state, 'running', name + ': animation en pause');
  assert.notEqual(before.transform, after.transform, name + ': le faisceau ne tourne pas');
  return after;
}

async function bottomAlignRadar(page) {
  await page.evaluate(() => {
    // A tall team list reproduces a card larger than the viewport.
    document.getElementById('teamsBox').style.height = '2000px';
    const screen = document.querySelector('.radar-screen-big');
    const rect = screen.getBoundingClientRect();
    window.scrollTo(0, scrollY + rect.top - (innerHeight - rect.height - 5));
  });
  await page.waitForTimeout(350);
}

async function testRadar(browser, base, viewport, label) {
  const context = await prepareContext(browser, base, { viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await bottomAlignRadar(page);
  const info = await assertMoving(page, label + ' en bas de la fenêtre');
  assert.ok(info.top >= 0 && info.bottom <= info.viewport, label + ': le radar doit être entièrement visible');

  // In the old code the whole card was under 45% visible at this position,
  // so the radar was paused despite being completely visible.
  const reveal = await page.waitForSelector('#teamsBox [data-team="NEMO"]', { timeout: 8000 });
  assert.ok(reveal, label + ': la carte du faux équipage doit apparaître');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('#radarStage').classList.contains('anim-idle'));
  assert.equal((await radarInfo(page)).state, 'paused', label + ': pause hors écran');
  await bottomAlignRadar(page);
  await assertMoving(page, label + ' au retour');

  if (label === 'desktop') {
    // Simulate tab visibility changes without relying on the CI window manager.
    await page.evaluate(() => {
      window.__visibilityForTest = 'hidden';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visibilityForTest });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.radar-sweep-big')).animationPlayState === 'paused');
    await page.evaluate(() => {
      window.__visibilityForTest = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await assertMoving(page, 'retour de l’onglet');

    if (!publishedSite) {
      // If a previous script removed the stage, it is recreated and observed.
      await page.evaluate(() => document.getElementById('radarStage').remove());
      await page.waitForSelector('#radarStage .radar-screen-big', { timeout: 8000 });
      await assertMoving(page, 'radar reconstruit');
    }

    // A different animated component must also run while it is on screen.
    await page.locator('#oxygenBar').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const oxygen = await page.$eval('#oxygenBar', el => {
      const style = getComputedStyle(el, '::before');
      return { name: style.animationName, state: style.animationPlayState, transform: style.transform };
    });
    await page.waitForTimeout(250);
    const oxygenAfter = await page.$eval('#oxygenBar', el => getComputedStyle(el, '::before').transform);
    assert.equal(oxygen.name, 'bubblesMove');
    assert.equal(oxygen.state, 'running');
    assert.notEqual(oxygen.transform, oxygenAfter, 'la jauge doit être animée');
  }

  assert.deepEqual(errors, [], label + ': erreur JavaScript');
  await context.close();
  console.log('✓ Radar ' + label + ' : visible, hors écran et reprise');
}

async function testFirestoreFailure(browser, base) {
  const context = await prepareContext(browser, base, { failFirestore: true });
  const page = await context.newPage();
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#teamsBox .notice.warning', { timeout: 8000 });
  assert.equal(await page.locator('#radarStage').count(), 1, 'une erreur réseau ne doit pas supprimer le sonar');
  await bottomAlignRadar(page);
  await assertMoving(page, 'après échec Firestore');
  await context.close();
  console.log('✓ Sonar conservé en cas d’échec Firestore');
}

async function testTypewriter(browser, base, reducedMotion) {
  const context = await prepareContext(browser, base, { blockFirebase: true, reducedMotion });
  const page = await context.newPage();
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('missionOrderText').dataset.typed === 'true', null, { timeout: 6000 });
  if (reducedMotion === 'no-preference') {
    const info = await page.evaluate(() => ({
      text: document.getElementById('missionOrderTyping').textContent,
      ghost: document.querySelectorAll('.typewriter-ghost').length
    }));
    assert.equal(info.ghost, 1, 'le secours doit reserver la hauteur pendant la frappe');
  }
  await page.waitForFunction(() => {
    const el = document.getElementById('missionOrderText');
    return document.getElementById('missionOrderTyping').textContent === el.dataset.text;
  }, null, { timeout: 11000 });
  assert.equal(await page.evaluate(() => window.__typewriterEvents), 1, 'signal de fin unique');
  assert.equal(await page.locator('.typewriter-ghost').count(), 0, 'fantôme retiré après la frappe');
  await context.close();
  console.log('✓ Ordre de mission sans Firebase (' + reducedMotion + ')');
}

async function testTypewriterWithFirebase(browser, base, delay) {
  const context = await prepareContext(browser, base, { firebaseDelay: delay });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(landing(base), { waitUntil: 'commit' });
  // Even a pending remote module must not prevent the local fallback starting.
  await page.waitForFunction(() => document.getElementById('missionOrderText')?.dataset.typed === 'true', null, { timeout: 6000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('missionOrderText');
    return document.getElementById('missionOrderTyping').textContent === el.dataset.text;
  }, null, { timeout: 12000 });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__typewriterEvents), 1, 'un seul signal même si Firebase arrive en retard');
  assert.equal(await page.locator('.typewriter-ghost').count(), 0, 'pas de double animation');
  assert.deepEqual(errors, [], 'typewriter : erreur JavaScript');
  await context.close();
  console.log('✓ Ordre de mission avec Firebase ' + (delay ? 'retardé' : 'disponible'));
}

async function testHatchFallback(browser, base) {
  const context = await prepareContext(browser, base, { blockFirebase: true });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3200);
  assert.notEqual(await page.$eval('#missionOrderText', el => el.dataset.typed), 'true',
    'le texte ne doit pas démarrer derrière une écoutille fermée');
  await page.evaluate(() => {
    document.documentElement.classList.add('ec-arrivee');
    window.dispatchEvent(new Event('nautilus:ecoutille-ouverte'));
  });
  await page.waitForFunction(() => document.getElementById('missionOrderText').dataset.typed === 'true', null, { timeout: 6000 });
  await page.waitForFunction(() => {
    const el = document.getElementById('missionOrderText');
    return document.getElementById('missionOrderTyping').textContent === el.dataset.text;
  }, null, { timeout: 11000 });
  assert.equal(await page.evaluate(() => window.__typewriterEvents), 1, 'un seul signal après ouverture');
  await context.close();
  console.log('✓ Secours du texte après ouverture de l’écoutille');
}

async function testReducedMotion(browser, base) {
  const context = await prepareContext(browser, base, { reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await bottomAlignRadar(page);
  if (publishedSite) {
    const info = await radarInfo(page);
    assert.equal(info.name, 'none', 'le site publié désactive le radar en mouvement réduit');
  } else {
    const info = await assertMoving(page, 'radar en mouvement réduit');
    assert.equal(info.duration, '14s', 'la vitesse réduite existante doit être conservée');
  }
  assert.equal(await page.$eval('.radar-center', el => getComputedStyle(el).animationName), 'none', 'ne pas réactiver les pulsations désactivées');
  await context.close();
  console.log('✓ Préférence de mouvement réduit conservée');
}

async function testSas(browser, base) {
  const context = await prepareContext(browser, base);
  const page = await context.newPage();
  await page.goto(base + '1721310619.html?sas=ferme', { waitUntil: 'domcontentloaded' });
  await page.locator('.sas-lock').scrollIntoViewIfNeeded();
  const before = await page.$eval('.sas-lock', el => ({
    name: getComputedStyle(el).animationName, shadow: getComputedStyle(el).boxShadow
  }));
  await page.waitForTimeout(350);
  const after = await page.$eval('.sas-lock', el => getComputedStyle(el).boxShadow);
  assert.equal(before.name, 'sasLockPulse');
  assert.notEqual(before.shadow, after, 'animation du sas');
  await context.close();
  console.log('✓ Animation du sas');
}

async function testServiceWorker(browser, base) {
  const context = await prepareContext(browser, base, { serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(base + 'blank.html');
  await page.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15000 });

  const first = await page.evaluate(() => fetch('/probe.css').then(r => r.text()));
  assert.ok(first.includes('initial'));
  probeCss = 'body { --probe-version: updated; }';
  await page.evaluate(() => fetch('/probe.css').then(r => r.text()));
  await page.waitForFunction(async cache => {
    const response = await (await caches.open(cache)).match('/probe.css');
    return response && (await response.text()).includes('updated');
  }, cacheName, { timeout: 10000 });
  await context.setOffline(true);
  const offline = await page.evaluate(() => fetch('/probe.css').then(r => r.text()));
  assert.ok(offline.includes('updated'), 'version rafraîchie disponible hors connexion');
  const missing = await page.evaluate(() => fetch('/missing.css').then(() => 'response', () => 'network error'));
  assert.equal(missing, 'network error', 'ne pas renvoyer du HTML à la place d’un CSS');
  await context.close();
  console.log('✓ Service worker : revalidation et cache hors connexion');
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const options = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.CHROMIUM_BIN) options.executablePath = process.env.CHROMIUM_BIN;
  const browser = await chromium.launch(options);
  try {
    await testRadar(browser, base, { width: 1440, height: 900 }, 'desktop');
    await testRadar(browser, base, { width: 390, height: 844 }, 'mobile');
    await testFirestoreFailure(browser, base);
    await testTypewriter(browser, base, 'no-preference');
    await testTypewriter(browser, base, 'reduce');
    await testTypewriterWithFirebase(browser, base, 0);
    await testTypewriterWithFirebase(browser, base, 4500);
    if (publishedSite) await testHatchFallback(browser, base);
    await testReducedMotion(browser, base);
    await testSas(browser, base);
    await testServiceWorker(browser, base);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
