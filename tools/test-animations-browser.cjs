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
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const root = path.resolve(process.env.NAUTILUS_PUBLISHED_ROOT || path.join(__dirname, '..'));
// Both the restored home page and a copy of the published site have a hatch.
const publishedSite = fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('id="ecoutille"');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.wav': 'audio/wav',
  '.json': 'application/json; charset=utf-8'
};
let probeCss = 'body { --probe-version: initial; }';
let failedAsset = '';
const cacheName = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/CACHE_NAME\s*=\s*'([^']+)'/)[1];
const landing = base => base + (publishedSite ? '?ecoutille=0' : '');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === failedAsset) {
    res.writeHead(503, { 'Cache-Control': 'no-store' });
    res.end('Simulated temporary network failure');
    return;
  }
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
  if (url.pathname === '/probe.mp4') {
    const bytes = Buffer.from('0123456789');
    const range = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '');
    if (range) {
      const start = Number(range[1]), end = Math.min(Number(range[2]), bytes.length - 1);
      res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': end - start + 1 });
      res.end(bytes.subarray(start, end + 1));
    } else {
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length, 'Accept-Ranges': 'bytes' });
      res.end(bytes);
    }
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
    hasTouch: Boolean(options.hasTouch),
    isMobile: Boolean(options.isMobile),
    userAgent: options.userAgent,
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
      driver: target.classList.contains('nautilus-radar-js'),
      driverRunning: Boolean(window.NautilusAnimations && window.NautilusAnimations.sonarAnime()),
      idle: document.getElementById('radarStage').classList.contains('anim-idle')
    };
  });
}

async function assertMoving(page, name) {
  await page.waitForFunction(() => {
    const beam = document.querySelector('.radar-sweep-big');
    const style = getComputedStyle(beam);
    return beam.classList.contains('nautilus-radar-js')
      ? Boolean(window.NautilusAnimations && window.NautilusAnimations.sonarAnime()) && style.transform !== 'none'
      : style.animationPlayState === 'running';
  });
  const before = await radarInfo(page);
  // Attendre une vraie image différente plutôt qu’un délai fixe : le premier
  // requestAnimationFrame peut être retardé par le rendu vidéo en CI.
  await page.waitForFunction(previous => {
    const beam = document.querySelector('.radar-sweep-big');
    return beam && getComputedStyle(beam).transform !== previous;
  }, before.transform, { timeout: 5000 });
  const after = await radarInfo(page);
  if (after.driver) {
    assert.equal(after.driverRunning, true, name + ': pilote de secours arrêté');
  } else {
    assert.equal(after.name, 'radarRotateFast', name + ': keyframes absentes');
    assert.equal(after.state, 'running', name + ': animation en pause');
  }
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

async function testWithoutIntersectionObserver(browser, base) {
  const context = await prepareContext(browser, base, { viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => { delete window.IntersectionObserver; });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await bottomAlignRadar(page);
  await assertMoving(page, 'navigateur sans IntersectionObserver');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('#radarStage').classList.contains('anim-idle'));
  await bottomAlignRadar(page);
  await assertMoving(page, 'reprise sans IntersectionObserver');
  assert.deepEqual(errors, [], 'aucune erreur sur le chemin de repli');
  await context.close();
  console.log('✓ Radar : repli sans IntersectionObserver');
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

async function testHatchAnimation(browser, base, viewport, label) {
  const context = await prepareContext(browser, base, { viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ecoutillePrete === true);
  await page.waitForFunction(() => [...document.querySelector('#ecMagasinSelect').options]
    .some(option => option.value && !option.disabled), null, { timeout: 10000 });
  // Laisser démarrer le rendu et la première image des effets très lents.
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => {
    const video = document.querySelector('#ecoutille .ec-film');
    return video && video.readyState >= 2 && !video.paused;
  }, null, { timeout: 7000 });
  const imageDuFilm = () => page.$eval('#ecoutille .ec-film', el => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.drawImage(el, 0, 0, 64, 64);
    return { time: el.currentTime, pixels: Array.from(ctx.getImageData(0, 0, 64, 64).data) };
  });
  const videoAvant = await imageDuFilm();
  await page.waitForTimeout(600);
  const videoApres = await imageDuFilm();
  assert.ok(videoApres.time > videoAvant.time, label + ': le film du hublot doit avancer');
  let difference = 0;
  for (let i = 0; i < videoAvant.pixels.length; i += 4) {
    difference += Math.abs(videoAvant.pixels[i] - videoApres.pixels[i]);
    difference += Math.abs(videoAvant.pixels[i + 1] - videoApres.pixels[i + 1]);
    difference += Math.abs(videoAvant.pixels[i + 2] - videoApres.pixels[i + 2]);
  }
  assert.ok(difference / (64 * 64 * 3) > 0.05, label + ': les images du film doivent réellement changer');
  assert.equal(await page.locator('#ecAnimationControl').isHidden(), true, 'aucun bouton supplémentaire si tout fonctionne');
  const effets = {
    '.m-rayons': 'ecMerRais', '.m-caustique': 'ecMerCaustique',
    '.m-neige': 'ecMerNeige', '.m-bulles': 'ecMerBulles'
  };
  const avant = {};
  for (const [selecteur, nom] of Object.entries(effets)) {
    avant[selecteur] = await page.$eval('#ecoutille ' + selecteur, el => ({
      name: getComputedStyle(el).animationName,
      transform: getComputedStyle(el).transform,
      instances: el.getAnimations().length
    }));
    assert.equal(avant[selecteur].name, nom, label + ': keyframes de ' + selecteur);
    assert.ok(avant[selecteur].instances > 0, label + ': animation réelle de ' + selecteur);
  }
  await page.waitForTimeout(400);
  for (const selecteur of Object.keys(effets)) {
    const apres = await page.$eval('#ecoutille ' + selecteur, el => getComputedStyle(el).transform);
    assert.notEqual(avant[selecteur].transform, apres, label + ': ' + selecteur + ' doit bouger');
  }

  const store = await page.$eval('#ecMagasinSelect', el =>
    [...el.options].find(option => option.value && !option.disabled).value);
  await page.selectOption('#ecMagasinSelect', store);
  await page.locator('#ecStart').click();
  await page.waitForSelector('#ecoutille.ec-plongee', { timeout: 2000 });
  await page.waitForSelector('#ecoutille.ec-impact', { timeout: 3000 });
  await page.waitForSelector('#ecoutille', { state: 'detached', timeout: 7000 });
  await page.waitForFunction(() => document.getElementById('missionOrderText').dataset.typed === 'true', null, { timeout: 5000 });
  assert.deepEqual(errors, [], label + ': erreur pendant la transition');
  await context.close();
  console.log('✓ Écoutille animée, ouverture et ordre de mission : ' + label);
}

async function testOpenAlert(browser, base, mode) {
  const mobile = mode !== 'desktop';
  const mouvementReduit = mode === 'iphone-réduit' || mode === 'iphone-calme' || mode === 'paysage-calme';
  const calme = mode === 'iphone-calme' || mode === 'paysage-calme';
  const context = await prepareContext(browser, base, {
    viewport: mode === 'paysage' || mode === 'paysage-calme' ? { width: 844, height: 390 } :
      (mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }),
    hasTouch: mobile, isMobile: mobile,
    reducedMotion: mouvementReduit ? 'reduce' : 'no-preference',
    userAgent: mouvementReduit ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1' : undefined
  });
  if (mode === 'iphone-réduit') await context.addInitScript(() => localStorage.setItem('nautilusAnimationsAutorisees', '1'));
  if (mode === 'silencieux') await context.addInitScript(() => localStorage.setItem('nautilusSoundOn', '0'));
  if (mode === 'secours') await context.route(/\/ecoutille\.js(?:\?|$)/, route => route.abort());
  await context.addInitScript(() => {
    window.__alertesTest = [];
    window.__clicOpenTest = null;
    window.__ouvertureOpenTest = null;
    window.__debutSonOpenTest = null;
    window.__finSonOpenTest = null;
    window.__oscillateursOuverture = 0;
    window.__zoomTransitions = [];
    for (const type of ['transitionrun', 'transitioncancel', 'transitionend']) {
      document.addEventListener(type, event => {
        if (window.__clicOpenTest != null && event.target.classList?.contains('ec-hublot') && event.propertyName === 'transform')
          window.__zoomTransitions.push({ type, temps: performance.now() });
      }, true);
    }
    window.addEventListener('nautilus:ecoutille-ouverte', () => { window.__ouvertureOpenTest = performance.now(); });
    document.addEventListener('playing', event => {
      if (event.target.id === 'openAlertAudio') window.__debutSonOpenTest = performance.now();
    }, true);
    document.addEventListener('ended', event => {
      if (event.target.id === 'openAlertAudio') window.__finSonOpenTest = performance.now();
    }, true);
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.id === 'openAlertAudio' || this.id === 'alarmAudio') {
        window.__alertesTest.push({ id: this.id, temps: performance.now(), muet: this.muted, volume: this.volume });
      }
      return play.apply(this, arguments);
    };
    const audio = window.AudioContext || window.webkitAudioContext;
    if (audio) {
      const create = audio.prototype.createOscillator;
      audio.prototype.createOscillator = function () {
        if (window.__clicOpenTest != null && window.__ouvertureOpenTest == null)
          window.__oscillateursOuverture++;
        return create.apply(this, arguments);
      };
    }
    document.addEventListener('click', event => {
      if (event.isTrusted && event.target.closest && event.target.closest('#ecStart') && window.__clicOpenTest == null)
        window.__clicOpenTest = performance.now();
    }, true);
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelector('#ecMagasinSelect').options]
    .some(option => option.value && !option.disabled), null, { timeout: 10000 });
  await page.waitForFunction(() => {
    const audio = document.getElementById('openAlertAudio');
    return audio && Number.isFinite(audio.duration) && audio.duration > 0;
  }, null, { timeout: 10000 });
  const duree = await page.$eval('#openAlertAudio', audio => audio.duration);
  assert.ok(duree >= 1.45 && duree <= 1.56, 'métadonnées du signal de 1,5 s : ' + duree + ' s');
  assert.equal(await page.evaluate(() => window.NautilusDureeOpen()), 1500, 'durée prévue de l’ouverture');
  if (mode === 'desktop') {
    // Vérifier le fichier exact demandé, son adaptation temporelle et le
    // rendu décodé, plutôt que seulement les métadonnées MP3.
    const sourcePath = path.join(root, 'tools/audio-source/signal-lilmati.wav');
    assert.equal(createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),
      'c4a9aac1e2ed58af32792ceb6e5af22eb64dee039242ec82d62bcded9f2142fe', 'source Freesound choisie');
    const son = await page.evaluate(async () => {
      const source = document.querySelector('#openAlertAudio source').src;
      const donnees = await (await fetch(source)).arrayBuffer();
      const original = await (await fetch('/tools/audio-source/signal-lilmati.wav')).arrayBuffer();
      const contexte = new (window.AudioContext || window.webkitAudioContext)();
      try {
        const buffer = await contexte.decodeAudioData(donnees);
        const prise = await contexte.decodeAudioData(original);
        const gauche = buffer.getChannelData(0), droite = buffer.getChannelData(1);
        const reference = prise.getChannelData(0);
        function niveau(canal, debut, fin, rate) {
          let somme = 0, n = 0;
          for (let i = Math.floor(debut * rate); i < Math.floor(fin * rate); i++) {
            somme += canal[i] * canal[i]; n++;
          }
          return Math.sqrt(somme / n);
        }
        function correlation(a, b) {
          let produit = 0, energieA = 0, energieB = 0;
          for (let i = 0; i < Math.min(a.length, b.length); i++) {
            produit += a[i] * b[i]; energieA += a[i] * a[i]; energieB += b[i] * b[i];
          }
          return produit / Math.sqrt(energieA * energieB);
        }
        const fenetres = [[.03,.15],[.15,.30],[.30,.45],[.45,.75],[.75,1.05],[1.05,1.35]];
        const rendu = fenetres.map(([a,b]) => niveau(gauche, a, b, buffer.sampleRate));
        const originalNiveaux = fenetres.map(([a,b]) => niveau(reference, a*4/3, b*4/3, prise.sampleRate));
        let mono = 0, pic = 0;
        for (let i = 0; i < gauche.length; i++) {
          mono += ((gauche[i] + droite[i]) / 2) ** 2;
          pic = Math.max(pic, Math.abs(gauche[i]), Math.abs(droite[i]));
        }
        return { duree: buffer.duration, dureeOriginale: prise.duration, canaux: buffer.numberOfChannels,
          fidelite: correlation(rendu, originalNiveaux), stereo: correlation(gauche, droite),
          gainCalme: 20 * Math.log10(rendu[3] / originalNiveaux[3]),
          mono: Math.sqrt(mono / gauche.length), debut: rendu[0], milieu: rendu[3], fin: rendu[5], pic };
      } finally { await contexte.close(); }
    });
    assert.ok(Math.abs(son.duree - 1.5) < .01, 'le son décodé dure 1,5 s : ' + son.duree);
    assert.ok(Math.abs(son.dureeOriginale - 2) < .01, 'durée du fichier choisi');
    assert.ok(son.fidelite > .94, 'le rythme accéléré suit l’enveloppe du son choisi : ' + son.fidelite);
    assert.ok(son.gainCalme > 9 && son.gainCalme < 11, 'gain de +10 dB hors limitation : ' + son.gainCalme);
    assert.ok(son.debut > .01 && son.milieu > .01 && son.fin > .001 && son.fin < son.milieu,
      'le signal conserve son attaque et sa décroissance');
    assert.equal(son.canaux, 2, 'le son reste stéréo');
    assert.ok(son.stereo > .98, 'la disposition stéréo d’origine est conservée');
    assert.ok(son.mono > .02, 'le son reste audible sur un appareil mono');
    assert.ok(son.pic < .98, 'le son ne doit pas saturer');
  }
  assert.deepEqual(await page.evaluate(() => window.__alertesTest), [], 'aucune alerte avant OPEN');

  if (mode === 'desktop') {
    // Un clic refusé faute de magasin ne doit pas déclencher l’alerte.
    await page.locator('#ecStart').click();
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.__alertesTest), [], 'pas d’alerte si l’ouverture est refusée');
    await page.evaluate(() => { window.__clicOpenTest = null; });
  }
  const store = await page.$eval('#ecMagasinSelect', el =>
    [...el.options].find(option => option.value && !option.disabled).value);
  await page.selectOption('#ecMagasinSelect', store);
  await page.$eval('#ecoutille', racine => {
    const phases = ['ec-plongee', 'ec-eclat', 'ec-impact', 'ec-sortie'];
    const hublot = racine.querySelector('.ec-hublot');
    const boite = hublot.getBoundingClientRect(), vue = racine.getBoundingClientRect();
    window.__zoomBase = { largeur: boite.width, x: boite.left + boite.width/2, y: boite.top + boite.height/2,
      cibleX: vue.left + vue.width/2, cibleY: vue.top + vue.height/2,
      vueX: vue.left, vueY: vue.top, vueLargeur: vue.width, vueHauteur: vue.height };
    window.__zoomFrames = [];
    window.__phasesOpenTest = {};
    const preparer = window.NautilusPreparerOuverture;
    window.NautilusPreparerOuverture = function(duree) {
      preparer(duree);
      const rect = hublot.getBoundingClientRect();
      window.__zoomPrepare = { rect: { x: rect.x, y: rect.y, largeur: rect.width, hauteur: rect.height },
        x: racine.style.getPropertyValue('--ec-zoom-x'), y: racine.style.getPropertyValue('--ec-zoom-y'),
        scale: racine.style.getPropertyValue('--ec-zoom-echelle'),
        scrollScene: racine.querySelector('.ec-scene').scrollTop, scrollRacine: racine.scrollTop };
    };
    let derniereImage = 0;
    function suivre(temps) {
      if (!racine.isConnected) return;
      if (racine.classList.contains('ec-plongee') && !racine.classList.contains('ec-passee') && temps - derniereImage >= 80) {
        const r = hublot.getBoundingClientRect();
        const voile = racine.querySelector('.ec-ombre-zoom'), rectVoile = voile.getBoundingClientRect();
        window.__zoomFrames.push({ temps, largeur: r.width, x: r.left + r.width/2, y: r.top + r.height/2,
          ombre: Number(getComputedStyle(voile).opacity),
          voile: { x: rectVoile.x, y: rectVoile.y, largeur: rectVoile.width, hauteur: rectVoile.height },
          scrollScene: racine.querySelector('.ec-scene').scrollTop, scrollRacine: racine.scrollTop });
        derniereImage = temps;
      }
      requestAnimationFrame(suivre);
    }
    requestAnimationFrame(suivre);
    const observer = new MutationObserver(() => {
      for (const phase of phases) {
        if (racine.classList.contains(phase) && !window.__phasesOpenTest[phase]) {
          const rayons = getComputedStyle(racine.querySelector('.m-rayons'));
          const ombre = getComputedStyle(racine.querySelector('.ec-ombre-zoom'));
          const flood = getComputedStyle(racine.querySelector('.ec-flood'));
          window.__phasesOpenTest[phase] = {
            temps: performance.now(), transitionRacine: getComputedStyle(racine).transitionDuration,
            transitionHublot: getComputedStyle(hublot).transitionDuration,
            hublotTransform: getComputedStyle(hublot).transform,
            sceneTransform: getComputedStyle(racine.querySelector('.ec-scene')).transform,
            titreOpacity: getComputedStyle(racine.querySelector('.ec-titre')).opacity,
            ombreOpacity: ombre.opacity, ombreTransition: ombre.transitionDuration,
            floodHeight: flood.height, floodWidth: flood.width,
            flashDisplay: getComputedStyle(racine.querySelector('.ec-flash')).display,
            rayonsNom: rayons.animationName, rayonsEtat: rayons.animationPlayState
          };
        }
      }
    });
    observer.observe(racine, { attributes: true, attributeFilter: ['class'] });
  });
  if (mobile) await page.locator('#ecStart').tap();
  else await page.locator('#ecStart').click();
  // Plusieurs événements ou deux gestionnaires ne peuvent pas rejouer le son.
  await page.evaluate(() => {
    window.NautilusAlerteOpen();
    document.getElementById('ecStart').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const attendu = mode === 'silencieux' ? 0 : 1;
  await page.waitForFunction(silencieux => window.__ouvertureOpenTest != null &&
    (silencieux || window.__finSonOpenTest != null), !attendu, { timeout: 4000 });
  await page.waitForTimeout(100);
  const resultat = await page.evaluate(() => ({
    sons: window.__alertesTest, clic: window.__clicOpenTest, phases: window.__phasesOpenTest,
    zoomBase: window.__zoomBase, zoomPrepare: window.__zoomPrepare, zoomFrames: window.__zoomFrames, zoomTransitions: window.__zoomTransitions,
    ouverture: window.__ouvertureOpenTest, debutSon: window.__debutSonOpenTest,
    finSon: window.__finSonOpenTest, oscillateurs: window.__oscillateursOuverture
  }));
  assert.equal(resultat.sons.length, attendu, 'une seule alerte, ou aucune si le son est coupé');
  assert.equal(resultat.oscillateurs, 0, 'aucun écho, choc ou souffle sonore supplémentaire');
  assert.ok(resultat.ouverture != null, 'la page doit être révélée');
  const phases = resultat.phases;
  for (const [phase, fraction] of [['ec-plongee', 0], ['ec-eclat', .15], ['ec-impact', .35], ['ec-sortie', .70]]) {
    assert.ok(phases[phase], 'phase visuelle manquante : ' + phase);
    assert.ok(Math.abs(phases[phase].temps - phases['ec-plongee'].temps - 1500 * fraction) < 130,
      phase + ' doit suivre le rythme de 1,5 s');
  }
  assert.ok(Math.abs((resultat.ouverture - phases['ec-plongee'].temps) - 1500) < 180,
    'l’animation doit durer 1,5 s');
  assert.ok(resultat.ouverture - resultat.clic >= 1400 && resultat.ouverture - resultat.clic < 1800,
    'l’ouverture doit se terminer environ 1,5 s après le clic');
  if (!calme) {
    for (const phase of ['ec-plongee', 'ec-eclat', 'ec-impact', 'ec-sortie']) {
      assert.ok(Math.abs(parseFloat(phases[phase].transitionHublot) - 1.5) < .01,
        'une même transition de zoom pour ' + phase);
      assert.equal(phases[phase].sceneTransform, 'none', 'pas de zoom imbriqué sur la scène');
      assert.equal(phases[phase].flashDisplay, 'none', 'pas de flash parasite pendant le zoom');
      assert.equal(phases[phase].rayonsNom, 'ecMerRais', 'les rais ne sont pas réinitialisés');
      assert.equal(phases[phase].rayonsEtat, 'paused', 'les rais sont figés pendant la plongée');
    }
    assert.ok(Math.abs(parseFloat(phases['ec-impact'].ombreTransition) - .42) < .01,
      'l’assombrissement progresse sur 420 ms');
    assert.ok(Number(phases['ec-sortie'].ombreOpacity) > .4, 'la fin du zoom est assombrie');
    assert.ok(Math.abs(parseFloat(phases['ec-sortie'].transitionRacine) - .45) < .01,
      'le fondu final occupe les 450 dernières ms');
    const runs = resultat.zoomTransitions.filter(event => event.type === 'transitionrun');
    const interruptions = resultat.zoomTransitions.filter(event => event.type === 'transitioncancel' &&
      event.temps < resultat.ouverture - 120);
    assert.equal(runs.length, 1, 'le zoom ne redémarre pas entre les phases');
    assert.equal(interruptions.length, 0, 'aucune interruption prématurée du zoom');
    assert.ok(resultat.zoomFrames.length >= 3, 'le zoom produit plusieurs images');
    assert.ok(Math.abs(parseFloat(phases['ec-impact'].floodHeight) - parseFloat(phases['ec-plongee'].floodHeight)) < 1,
      'le voile conserve sa hauteur et ne réinitialise pas le scroll à l’impact');
    assert.ok(Math.abs(parseFloat(phases['ec-impact'].floodWidth) - parseFloat(phases['ec-plongee'].floodWidth)) < 1,
      'le voile conserve sa largeur à l’impact');
    const base = resultat.zoomBase;
    for (let i = 0; i < resultat.zoomFrames.length; i++) {
      const image = resultat.zoomFrames[i];
      if (i > 0) assert.ok(image.largeur + 4 >= resultat.zoomFrames[i-1].largeur,
        'le hublot ne rétrécit pas pendant la plongée');
      assert.ok(Math.abs(image.scrollRacine - resultat.zoomPrepare.scrollRacine) < 2 &&
        Math.abs(image.scrollScene - resultat.zoomPrepare.scrollScene) < 2,
        'aucun saut de défilement pendant le zoom');
      assert.ok(Math.abs(image.voile.x - base.vueX) < 2 && Math.abs(image.voile.y - base.vueY) < 2 &&
        Math.abs(image.voile.largeur - base.vueLargeur) < 2 && Math.abs(image.voile.hauteur - base.vueHauteur) < 2,
        'le voile sombre couvre tout l’écran même après défilement : ' + JSON.stringify({voile: image.voile, base, scroll: image.scrollRacine}));
    }
    const depart = resultat.zoomPrepare.rect;
    const fin = resultat.zoomFrames[resultat.zoomFrames.length - 1];
    assert.ok(fin.largeur > depart.largeur * 1.8, 'le hublot grandit réellement');
    const distanceAvant = Math.hypot(depart.x + depart.largeur/2 - base.cibleX, depart.y + depart.hauteur/2 - base.cibleY);
    const distanceApres = Math.hypot(fin.x - base.cibleX, fin.y - base.cibleY);
    assert.ok(distanceApres <= distanceAvant * .5 + 8, 'le hublot se recentre sans dériver : ' + JSON.stringify({base, prepare: resultat.zoomPrepare, fin, distanceAvant, distanceApres}));
  } else {
    assert.equal(phases['ec-impact'].hublotTransform, 'none', 'pas de zoom sans accord pour les mouvements réduits');
    assert.equal(Number(phases['ec-sortie'].ombreOpacity), 0, 'pas d’assombrissement animé en mouvement réduit');
    assert.equal(Number(phases['ec-impact'].titreOpacity), 1, 'le titre reste visible en mouvement réduit');
    for (const image of resultat.zoomFrames) {
      assert.ok(Math.abs(image.scrollRacine - resultat.zoomPrepare.scrollRacine) < 2 &&
        Math.abs(image.scrollScene - resultat.zoomPrepare.scrollScene) < 2,
        'aucun saut de défilement en mouvement réduit');
    }
  }
  if (attendu) {
    assert.equal(resultat.sons[0].id, 'openAlertAudio');
    assert.equal(resultat.sons[0].muet, false);
    assert.equal(resultat.sons[0].volume, 1, 'le signal amplifié ne subit pas d’atténuation supplémentaire');
    assert.ok(resultat.sons[0].temps - resultat.clic >= 0 && resultat.sons[0].temps - resultat.clic < 100,
      'le signal doit partir directement au clic');
    assert.ok(resultat.debutSon != null && resultat.finSon != null, 'le signal doit être joué jusqu’à sa fin');
    assert.ok(Math.abs(resultat.finSon - resultat.debutSon - 1500) < 180,
      'la lecture audible doit durer environ 1,5 s');
    assert.ok(Math.abs(resultat.debutSon - phases['ec-plongee'].temps) < 120,
      'le son et l’animation doivent commencer ensemble');
    assert.ok(Math.abs(resultat.ouverture - resultat.finSon) < 180,
      'la fin du signal et la fin de l’ouverture doivent coïncider');
  }
  if (mode === 'desktop' || mode === 'mobile') {
    assert.equal(await page.locator('#creditImmersion').count(), 0, 'ancienne mention retirée de la page');
    assert.equal(await page.getByText('Son d’immersion :', { exact: false }).count(), 0,
      'la mention que le joueur ne souhaite plus voir est absente');
  }
  assert.deepEqual(errors, [], 'aucune erreur JavaScript pendant OPEN');
  await context.close();
  console.log('✓ Signal choisi et animation OPEN de 1,5 s : ' + mode);
}

async function testOpenLateEngine(browser, base) {
  const context = await prepareContext(browser, base, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  let liberer;
  const attente = new Promise(resolve => { liberer = resolve; });
  await context.route(/\/ecoutille\.js(?:\?|$)/, async route => { await attente; await route.continue(); });
  await context.addInitScript(() => {
    window.__sonsOpenTardifs = 0;
    window.__ouverturesTardives = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.id === 'openAlertAudio') window.__sonsOpenTardifs++;
      return play.apply(this, arguments);
    };
    window.addEventListener('nautilus:ecoutille-ouverte', () => window.__ouverturesTardives++);
  });
  const page = await context.newPage();
  try {
    await page.goto(base, { waitUntil: 'commit' });
    await page.waitForFunction(() => typeof window.__ecoutilleSecours === 'function', null, { timeout: 10000 });
    await page.waitForFunction(() => document.getElementById('openAlertAudio')?.duration > 0, null, { timeout: 10000 });
    await page.locator('#ecStart').tap(); // le repli démarre avant le moteur
    liberer();
    await page.waitForFunction(() => window.__ecoutilleSecours === null, null, { timeout: 5000 });
    await page.evaluate(() => {
      const bouton = document.getElementById('ecStart');
      if (bouton) bouton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForFunction(() => window.__ouverturesTardives === 1, null, { timeout: 4000 });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__sonsOpenTardifs), 1, 'une seule alerte avec moteur retardé');
    assert.equal(await page.evaluate(() => window.__ouverturesTardives), 1, 'une seule ouverture avec moteur retardé');
  } finally {
    liberer();
    await context.close();
  }
  console.log('✓ Un seul signal et une seule ouverture si le moteur arrive en retard');
}

async function testOpenSlowAudio(browser, base, tropTard) {
  const context = await prepareContext(browser, base, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  let liberer;
  const attente = new Promise(resolve => { liberer = resolve; });
  let requetesAudio = 0;
  await context.route(/\/assets\/alerte-open\.mp3(?:\?|$)/, async route => {
    requetesAudio++;
    await attente;
    try { await route.continue(); } catch (_) { /* requête déjà annulée */ }
  });
  await context.addInitScript(() => {
    window.__lecturesAudioLent = 0;
    window.__demarragesAudioLent = 0;
    window.__debutSonAudioLent = null;
    window.__finSonAudioLent = null;
    window.__clicAudioLent = null;
    window.__ouvertureAudioLent = null;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.id === 'openAlertAudio') window.__lecturesAudioLent++;
      return play.apply(this, arguments);
    };
    document.addEventListener('playing', event => {
      if (event.target.id === 'openAlertAudio') {
        window.__demarragesAudioLent++;
        window.__debutSonAudioLent = performance.now();
      }
    }, true);
    document.addEventListener('ended', event => {
      if (event.target.id === 'openAlertAudio') window.__finSonAudioLent = performance.now();
    }, true);
    document.addEventListener('click', event => {
      if (event.isTrusted && event.target.closest && event.target.closest('#ecStart'))
        window.__clicAudioLent = performance.now();
    }, true);
    window.addEventListener('nautilus:ecoutille-ouverte', () => {
      window.__ouvertureAudioLent = performance.now();
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => [...document.querySelector('#ecMagasinSelect').options]
      .some(option => option.value && !option.disabled), null, { timeout: 10000 });
    const store = await page.$eval('#ecMagasinSelect', el =>
      [...el.options].find(option => option.value && !option.disabled).value);
    await page.selectOption('#ecMagasinSelect', store);
    await page.locator('#ecStart').tap();
    if (tropTard) {
      await page.waitForSelector('#ecoutille.ec-plongee', { timeout: 2000 });
      assert.equal(await page.$eval('#openAlertAudio', audio => audio.paused), true,
        'annuler la lecture en attente avant de lancer le repli visuel');
    } else {
      // Une connexion mobile modérément lente doit encore jouer le son et
      // attendre son démarrage pour lancer l’animation.
      await page.waitForTimeout(350);
      assert.equal(await page.$eval('#ecoutille', el => el.classList.contains('ec-plongee')), false,
        'attendre brièvement le signal avant de lancer la plongée');
    }
    assert.ok(requetesAudio > 0, 'le chargement du signal est effectivement bloqué');
    liberer();
    await page.waitForFunction(() => window.__ouvertureAudioLent != null, null, { timeout: 4000 });
    if (!tropTard) await page.waitForFunction(() => window.__finSonAudioLent != null, null, { timeout: 2000 });
    await page.waitForTimeout(350);
    const resultat = await page.evaluate(() => ({
      lectures: window.__lecturesAudioLent, demarrages: window.__demarragesAudioLent,
      debutSon: window.__debutSonAudioLent, finSon: window.__finSonAudioLent,
      ouverture: window.__ouvertureAudioLent, pause: document.getElementById('openAlertAudio').paused,
      duree: window.__ouvertureAudioLent - window.__clicAudioLent
    }));
    assert.equal(resultat.lectures, 1, 'une seule tentative de lecture au clic');
    assert.equal(resultat.pause, true, 'le signal n’est pas encore en lecture après l’ouverture');
    if (tropTard) {
      assert.equal(resultat.demarrages, 0, 'aucun signal tardif après un chargement trop long');
      assert.ok(resultat.duree >= 1900 && resultat.duree < 2700,
        'l’animation de secours conserve sa durée : ' + resultat.duree + ' ms');
    } else {
      assert.equal(resultat.demarrages, 1, 'le signal a démarré malgré le léger retard réseau');
      assert.ok(Math.abs(resultat.ouverture - resultat.debutSon - 1500) < 180,
        'l’animation garde 1,5 s à partir du début du signal');
      assert.ok(Math.abs(resultat.ouverture - resultat.finSon) < 180,
        'le signal et la plongée finissent ensemble après un léger retard réseau');
    }
    assert.deepEqual(errors, [], 'aucune erreur si le son arrive tard');
  } finally {
    liberer();
    await context.close();
  }
  console.log('✓ Son ' + (tropTard ? 'annulé si le fichier arrive trop tard' : 'synchronisé après un court délai réseau'));
}

async function testOpenAudioUnavailable(browser, base, mode) {
  const context = await prepareContext(browser, base, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  if (mode === 'fichier indisponible') {
    await context.route(/\/assets\/alerte-open\.mp3(?:\?|$)/, route => route.abort());
  } else {
    await context.addInitScript(mode => {
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (this.id === 'openAlertAudio') {
          if (mode === 'lecture en attente') return new Promise(() => {});
          return Promise.reject(new DOMException('Lecture refusée', 'NotAllowedError'));
        }
        return play.apply(this, arguments);
      };
    }, mode);
  }
  await context.addInitScript(() => {
    window.__debutOuverture = null;
    window.__finOuverture = null;
    document.addEventListener('click', event => {
      if (event.isTrusted && event.target.closest && event.target.closest('#ecStart'))
        window.__debutOuverture = performance.now();
    }, true);
    window.addEventListener('nautilus:ecoutille-ouverte', () => { window.__finOuverture = performance.now(); });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelector('#ecMagasinSelect').options]
    .some(option => option.value && !option.disabled), null, { timeout: 10000 });
  const store = await page.$eval('#ecMagasinSelect', el =>
    [...el.options].find(option => option.value && !option.disabled).value);
  await page.selectOption('#ecMagasinSelect', store);
  await page.locator('#ecStart').tap();
  await page.waitForFunction(() => window.__finOuverture != null, null, { timeout: 4000 });
  const delai = await page.evaluate(() => window.__finOuverture - window.__debutOuverture);
  assert.equal(await page.evaluate(() => window.NautilusDureeOpen()), 1500, 'durée de secours sans métadonnées');
  assert.ok(delai >= 1350 && delai < 2500, mode + ' : ouverture de 1,5 s malgré le problème audio (' + delai + ' ms)');
  assert.deepEqual(errors, [], 'aucune erreur non gérée lorsque le son est indisponible');
  await context.close();
  console.log('✓ Ouverture rapide si ' + mode);
}

async function testHatchReducedMotion(browser, base) {
  const context = await prepareContext(browser, base, { reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  for (const selecteur of ['.m-rayons', '.m-caustique', '.m-neige', '.m-bulles']) {
    assert.equal(await page.$eval('#ecoutille ' + selecteur, el => getComputedStyle(el).animationName),
      'none', 'respecter les mouvements réduits pour ' + selecteur);
  }
  assert.equal(await page.$eval('#ecoutille .ec-film', el => el.paused), true, 'vidéo immobile par défaut');
  assert.equal(await page.$eval('#ecoutille .ec-film', el => getComputedStyle(el).opacity), '0',
    'le premier écran noir ne doit pas cacher l’affiche');
  await page.waitForFunction(() => [...document.querySelector('#ecMagasinSelect').options]
    .some(option => option.value && !option.disabled), null, { timeout: 10000 });
  const store = await page.$eval('#ecMagasinSelect', el =>
    [...el.options].find(option => option.value && !option.disabled).value);
  await page.selectOption('#ecMagasinSelect', store);
  await page.locator('#ecStart').click();
  await page.waitForTimeout(300);
  assert.equal(await page.$eval('#ecoutille .ec-film', el => el.paused), true, 'OPEN ne doit pas lancer le film sans accord');
  await context.close();
  console.log('✓ Écoutille : préférence de mouvement réduit respectée');
}

async function testMotionChoice(browser, base, mode) {
  const tactile = mode === 'tactile';
  const context = await prepareContext(browser, base, {
    viewport: tactile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    reducedMotion: 'reduce', hasTouch: tactile, isMobile: tactile,
    userAgent: tactile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1' : undefined
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const bouton = page.locator('#ecAnimationControl');
  await bouton.waitFor({ state: 'visible' });
  assert.match(await bouton.innerText(), /Activer les animations/);
  assert.equal(await page.$eval('.ec-film', el => el.paused), true);
  if (tactile) await bouton.tap();
  else { await bouton.focus(); await bouton.press('Enter'); }
  await page.waitForFunction(() => document.documentElement.classList.contains('nautilus-motion-enabled'));
  await page.waitForFunction(() => !document.querySelector('.ec-film').paused, null, { timeout: 5000 });
  assert.equal(await page.$eval('.m-rayons', el => getComputedStyle(el).animationName), 'ecMerRais');
  assert.equal(await page.evaluate(() => localStorage.getItem('nautilusAnimationsAutorisees')), '1');
  assert.equal(await bouton.isHidden(), true, 'le bouton du hublot disparaît après activation');
  assert.equal(await page.locator('#radarAnimationControl').isHidden(), true, 'le bouton du sonar disparaît aussi');
  assert.equal(await page.$eval('#ecoutille', el => el.classList.contains('ec-plongee')), false,
    'activer les animations ne doit pas ouvrir le sas');

  // Le choix volontaire reste valable au prochain chargement de cet appareil.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('nautilus-motion-enabled'));
  await page.waitForFunction(() => !document.querySelector('.ec-film').paused, null, { timeout: 5000 });
  assert.equal(await bouton.isHidden(), true, 'le bouton reste caché après rechargement');
  await page.waitForFunction(() => [...document.querySelector('#ecMagasinSelect').options]
    .some(option => option.value && !option.disabled), null, { timeout: 10000 });
  const store = await page.$eval('#ecMagasinSelect', el =>
    [...el.options].find(option => option.value && !option.disabled).value);
  await page.selectOption('#ecMagasinSelect', store);
  await page.locator('#ecStart').click();
  await page.waitForSelector('#ecoutille', { state: 'detached', timeout: 7000 });
  await bottomAlignRadar(page);
  const radar = await assertMoving(page, 'sonar activé volontairement');
  assert.equal(radar.driver, true, 'le pilote de secours évite le blocage CSS sur iPhone');
  assert.equal(await page.locator('#radarAnimationControl').isHidden(), true, 'pas de bouton sous le sonar');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => !window.NautilusAnimations.sonarAnime());
  const arrete = (await radarInfo(page)).transform;
  await page.waitForTimeout(250);
  assert.equal((await radarInfo(page)).transform, arrete, 'le balayage est arrêté hors écran');
  await bottomAlignRadar(page);
  await assertMoving(page, 'reprise du sonar activé');
  await page.evaluate(() => {
    window.__visibiliteTest = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visibiliteTest });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(() => !window.NautilusAnimations.sonarAnime());
  await page.evaluate(() => { window.__visibiliteTest = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  await assertMoving(page, 'retour de l’onglet avec animations activées');

  await page.evaluate(() => window.NautilusAnimations.reinitialiser());
  assert.equal(await page.evaluate(() => localStorage.getItem('nautilusAnimationsAutorisees')), null);
  assert.equal(await page.$eval('.radar-sweep-big', el => getComputedStyle(el).animationName), 'none',
    'retour au réglage système');
  assert.equal(await page.locator('#radarAnimationControl').isVisible(), true);
  assert.deepEqual(errors, [], 'aucune erreur JavaScript');
  await context.close();
  console.log('✓ Choix explicite et réversible des animations : ' + mode);
}

async function testRadarChoiceOnPage(browser, base, firebaseAbsent) {
  const context = await prepareContext(browser, base, {
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce',
    hasTouch: true, isMobile: true, blockFirebase: firebaseAbsent,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
  });
  if (firebaseAbsent) await context.addInitScript(() => localStorage.setItem('nautilusAnimationsAutorisees', '1'));
  const page = await context.newPage();
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await bottomAlignRadar(page);
  const bouton = page.locator('#radarAnimationControl');
  if (!firebaseAbsent) {
    await bouton.waitFor({ state: 'visible' });
    await bouton.tap();
  }
  assert.equal(await bouton.isHidden(), true, 'le bouton du sonar disparaît après le choix');
  const radar = await assertMoving(page, firebaseAbsent ? 'sonar sans Firebase' : 'activation depuis le sonar');
  assert.equal(radar.driver, true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await bottomAlignRadar(page);
  assert.equal(await bouton.isHidden(), true, 'le choix mémorisé ne réaffiche pas le bouton');
  await assertMoving(page, 'sonar après rechargement');
  await context.close();
  console.log('✓ Sonar iPhone ' + (firebaseAbsent ? 'sans Firebase' : 'activé sur sa page') + ' : bouton caché et rotation');
}

async function testRadarVisualViewport(browser, base) {
  const context = await prepareContext(browser, base, {
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true
  });
  await context.addInitScript(() => localStorage.setItem('nautilusAnimationsAutorisees', '1'));
  const page = await context.newPage();
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await bottomAlignRadar(page);
  await assertMoving(page, 'sonar avant changement du viewport visuel');
  await page.evaluate(() => {
    const vue = new EventTarget();
    Object.assign(vue, { width: innerWidth, height: 80, offsetLeft: 0, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vue });
    window.dispatchEvent(new Event('scroll'));
  });
  await page.waitForFunction(() => !window.NautilusAnimations.sonarAnime());
  await page.evaluate(() => { window.visualViewport.height = innerHeight; window.dispatchEvent(new Event('scroll')); });
  await assertMoving(page, 'sonar après changement du viewport visuel');
  await context.close();
  console.log('✓ Sonar : pause et reprise avec le viewport visuel mobile');
}

async function testRadarSansObservateur(browser, base) {
  const context = await prepareContext(browser, base, {
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true
  });
  await context.addInitScript(() => {
    localStorage.setItem('nautilusAnimationsAutorisees', '1');
    delete window.IntersectionObserver;
  });
  const page = await context.newPage();
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await bottomAlignRadar(page);
  await assertMoving(page, 'sonar réduit sans IntersectionObserver');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => !window.NautilusAnimations.sonarAnime());
  await bottomAlignRadar(page);
  await assertMoving(page, 'reprise du sonar réduit sans IntersectionObserver');
  await context.close();
  console.log('✓ Sonar activé : repli sans IntersectionObserver');
}

async function testRadarStorageFallback(browser, base) {
  const context = await prepareContext(browser, base, {
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true
  });
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    Storage.prototype.getItem = function (key) {
      if (this === window.localStorage) throw new Error('localStorage refusé');
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (this === window.localStorage) throw new Error('localStorage refusé');
      return set.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (this === window.localStorage) throw new Error('localStorage refusé');
      return remove.call(this, key);
    };
  });
  const page = await context.newPage();
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await bottomAlignRadar(page);
  await page.locator('#radarAnimationControl').tap();
  assert.equal(await page.locator('#radarAnimationControl').isHidden(), true);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('nautilusAnimationsAutorisees')), '1');
  await assertMoving(page, 'sonar en mode privé');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await bottomAlignRadar(page);
  assert.equal(await page.locator('#radarAnimationControl').isHidden(), true);
  await assertMoving(page, 'sonar après rechargement en mode privé');
  await context.close();
  console.log('✓ Sonar : choix maintenu dans la session si localStorage est refusé');
}

async function testSystemMotionChanges(browser, base) {
  const context = await prepareContext(browser, base, { viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('.ec-film').paused, null, { timeout: 6000 });
  assert.equal(await page.locator('#ecAnimationControl').isHidden(), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#ecAnimationControl').waitFor({ state: 'visible', timeout: 3000 });
  // Le style peut devenir visible juste avant l’événement matchMedia qui
  // met effectivement la vidéo en pause.
  await page.waitForFunction(() => document.querySelector('.ec-film').paused, null, { timeout: 3000 });
  assert.equal(await page.$eval('.m-neige', el => getComputedStyle(el).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !document.querySelector('.ec-film').paused, null, { timeout: 6000 });
  assert.equal(await page.locator('#ecAnimationControl').isHidden(), true);
  assert.equal(await page.$eval('.m-neige', el => getComputedStyle(el).animationName), 'ecMerNeige');
  await context.close();
  console.log('✓ Adaptation au changement de réglage système');
}

async function testAutoplayFallback(browser, base) {
  const context = await prepareContext(browser, base, { viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    const autoplay = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'autoplay');
    window.__autoriserFilmTest = false;
    Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', {
      configurable: true, get: autoplay.get,
      set(value) { autoplay.set.call(this, this.classList.contains('ec-film') && !window.__autoriserFilmTest ? false : value); }
    });
    HTMLMediaElement.prototype.play = function () {
      if (this.classList.contains('ec-film') && !window.__autoriserFilmTest)
        return Promise.reject(new DOMException('Lecture refusée', 'NotAllowedError'));
      return play.call(this);
    };
  });
  await context.route(base, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('class="ec-film" autoplay muted', 'class="ec-film" muted');
    await route.fulfill({ response, body });
  });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const bouton = page.locator('#ecAnimationControl');
  await bouton.waitFor({ state: 'visible', timeout: 6000 });
  assert.match(await bouton.innerText(), /Lancer la vidéo/);
  assert.equal(await page.$eval('.ec-film', el => el.paused), true);
  await page.evaluate(() => { window.__autoriserFilmTest = true; });
  await bouton.click();
  await page.waitForFunction(() => !document.querySelector('.ec-film').paused, null, { timeout: 5000 });
  assert.equal(await bouton.isHidden(), true);
  assert.equal(await page.$eval('#ecoutille', el => el.classList.contains('ec-plongee')), false);
  await context.close();
  console.log('✓ Vidéo : reprise manuelle si la lecture automatique est refusée');
}

async function testFilmUnavailable(browser, base) {
  const context = await prepareContext(browser, base, { viewport: { width: 390, height: 844 } });
  await context.route('**/assets/film-nautilus-*.mp4*', route => route.abort());
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.locator('#ecAnimationControl').waitFor({ state: 'visible', timeout: 10000 });
  assert.match(await page.locator('#ecAnimationControl').innerText(), /Réessayer la vidéo/);
  const etat = await page.evaluate(() => ({
    opacite: getComputedStyle(document.querySelector('.ec-film')).opacity,
    affiche: getComputedStyle(document.querySelector('.ec-fenetre')).backgroundImage,
    charge: document.querySelector('#ecoutille').classList.contains('ec-film-pret')
  }));
  assert.equal(etat.opacite, '0', 'le film indisponible ne doit pas masquer son affiche');
  assert.match(etat.affiche, /film-nautilus-P\.jpg/);
  assert.equal(etat.charge, false);
  await context.close();
  console.log('✓ Vidéo indisponible : affiche visible et bouton de reprise');
}

async function testVideoResume(browser, base) {
  const context = await prepareContext(browser, base, { viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('.ec-film').paused, null, { timeout: 6000 });
  await page.evaluate(() => {
    window.__visibiliteTest = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visibiliteTest });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.$eval('.ec-film', el => el.paused), true);
  await page.evaluate(() => { window.__visibiliteTest = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => !document.querySelector('.ec-film').paused, null, { timeout: 5000 });

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => /film-nautilus-L\.mp4/.test(document.querySelector('.ec-film').currentSrc)
    && !document.querySelector('.ec-film').paused, null, { timeout: 8000 });
  assert.equal(await page.locator('#ecAnimationControl').isHidden(), true);
  await context.close();
  console.log('✓ Vidéo : reprise après retour à l’onglet et changement d’orientation');
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

async function testCssomAnimations(browser, base) {
  const context = await prepareContext(browser, base);
  const page = await context.newPage();
  await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200); // inclut les feuilles injectées par les scripts
  const missing = await page.evaluate(() => {
    const definitions = new Set();
    const usages = new Map();
    function parcourir(rules, source) {
      for (const rule of rules) {
        if (rule.type === CSSRule.KEYFRAMES_RULE) definitions.add(rule.name);
        if (rule.type === CSSRule.STYLE_RULE) {
          const noms = rule.style.getPropertyValue('animation-name');
          for (const nom of noms.split(',').map(n => n.trim())) {
            if (!nom || ['none', 'initial', 'unset', 'inherit', 'revert'].includes(nom) || nom.includes('var(')) continue;
            if (!usages.has(nom)) usages.set(nom, []);
            usages.get(nom).push(source + ': ' + rule.selectorText);
          }
        }
        if (rule.cssRules) parcourir(rule.cssRules, source);
      }
    }
    for (const sheet of document.styleSheets) {
      try { parcourir(sheet.cssRules, sheet.href || 'style intégré'); } catch (_) { /* feuille externe inaccessible */ }
    }
    return [...usages].filter(([nom]) => !definitions.has(nom));
  });
  assert.deepEqual(missing, [], 'keyframes manquantes dans les feuilles effectivement chargées');
  await context.close();
  console.log('✓ Feuilles CSS chargées : aucune keyframe manquante');
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

async function testIntegratedPaliers(browser, base, viewport, label) {
  const context = await prepareContext(browser, base, { viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  if (label === 'desktop') {
    await page.goto(landing(base), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.locator('#adminFabBtn').scrollIntoViewIfNeeded();
    await page.locator('#adminFabBtn').click();
    // Le code est lu dans la page locale du test, jamais dans une base réelle.
    const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const admin = source.match(/const ADMIN_CODE\s*=\s*'([^']+)'/);
    assert.ok(admin, 'code concepteur disponible pour le test local');
    await page.locator('#adminCodeInput').pressSequentially(admin[1]);
    await page.locator('#adminCodeInput').press('Enter');
    await page.waitForSelector('#adminWorkspace:not([style*="display: none"])', { timeout: 5000 });
    await page.locator('#adminDesignerBtn').click();
    assert.ok(await page.locator('#adminDesignerBox a[href*="1941512821.html"]').count(),
      'le palier 4 doit rester accessible dans le mode concepteur');
    await page.locator('[data-tab="reponses"]').click();
    await page.waitForTimeout(500);
    const reponses = await page.locator('[data-pane="reponses"]').innerText();
    assert.match(reponses, /r[eé]ponses|p3|photo/i);
    assert.doesNotMatch(reponses, /retrait.{0,8}1\s*h|livres attribués|ancien livre fictif/i);
  }

  const paliers = [
    ['1721310619.html', '#mcHost .mc-grille', 'mots croisés'],
    ['1831411720.html', '#puzzleHost .photo-viewfinder, #puzzleHost .puzzle-piece', 'photo défi'],
    ['1941512821.html', '#epreuveHost .marq-case', 'relevé du sonar']
  ];
  for (const [fichier, selecteur, nom] of paliers) {
    await page.goto(base + fichier + '?apercu=jeu&k=k2h04qj', { waitUntil: 'domcontentloaded' });
    await page.locator('#briefCtaBtn').waitFor({ state: 'visible', timeout: 6000 });
    if (nom === 'photo défi' || nom === 'puzzle') {
      const briefing = await page.locator('#briefHost').innerText();
      assert.doesNotMatch(briefing, /retrait/i, 'pas de retrait dans le palier 3');
    }
    await page.locator('#briefCtaBtn').click();
    await page.locator(selecteur).first().waitFor({ state: 'visible', timeout: 9000 });
    if (nom === 'mots croisés') {
      assert.ok((await page.locator('#mcHost .mc-input').count()) > 30);
    } else if (nom === 'photo défi' || nom === 'puzzle') {
      const isPhotoDefi = (await page.locator('#puzzleHost .photo-viewfinder').count()) > 0;
      if (isPhotoDefi) {
        assert.ok(await page.locator('#puzzleHost #photoVideo').count() > 0);
        assert.ok(await page.locator('#btnTrigger').count() > 0);
        assert.ok(await page.locator('#btnUrgence').count() > 0);
        const timerText = await page.locator('#photoTimer').innerText();
        assert.match(timerText, /0[23]:\d{2}/, 'le chronomètre de 3 minutes doit être actif');
      } else {
        assert.equal(await page.locator('#puzzleHost .puzzle-piece').count(), 51);
        const resultat = await page.evaluate(() => {
          const stage = document.querySelector('#pzStage');
          const slots = [...document.querySelectorAll('#pzBoard .puzzle-slot')];
          const piece = [...stage.querySelectorAll('.puzzle-piece')].find(p => Number(p.dataset.idx) === 30);
          const slot = slots[30];
          const r = stage.getBoundingClientRect();
          const size = parseFloat(piece.style.width);
          const prise = size * 0.62 / 2;
          const pointer = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y
          }));
          const x = r.left + parseFloat(piece.style.left) + prise;
          const y = r.top + parseFloat(piece.style.top) + prise;
          const cibleX = r.left + parseFloat(slot.style.left) + size / 2;
          const cibleY = r.top + parseFloat(slot.style.top) + size / 2;
          pointer('pointerdown', piece, x, y);
          pointer('pointermove', stage, cibleX, cibleY);
          pointer('pointerup', stage, cibleX, cibleY);
          return { place: piece.classList.contains('puzzle-piece--lock'),
            etat: document.getElementById('pzStatus').textContent };
        });
        assert.equal(resultat.place, true, 'une pièce du puzzle doit se placer correctement');
        assert.match(resultat.etat, /1\s*\/\s*51/);
      }
    } else {
      assert.equal(await page.locator('#epreuveHost .marq-case').count(), 81);
      assert.equal(await page.locator('#epreuveHost .marq-jeton').count(), 8);
      await page.locator('#mrqPing').click();
      assert.match(await page.locator('#mrqSonar').innerText(), /case/i);
      await page.locator('#mrqReveal').click();
      assert.match(await page.locator('#mrqStatus').innerText(), /1\s*\/\s*8/);
    }
  }
  if (label === 'desktop') {
    await page.goto(base + 'palier1.html?apercu=victoire&k=k2h04qj', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    assert.match(await page.locator('body').innerText(), /victoire|validée|bravo/i);
    await page.goto(base + '2051613922.html?sas=ferme', { waitUntil: 'domcontentloaded' });
    assert.match(await page.locator('#gateHero').innerText(), /PALIER 5/);
  }
  assert.deepEqual(errors, [], label + ': erreur JavaScript lors de la navigation');
  await context.close();
  console.log('✓ Accueil et paliers conservés : ' + label);
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

  // Une vidéo présente en cache ne doit pas masquer une requête Range :
  // Safari et les navigateurs mobiles attendent une réponse HTTP 206.
  await page.evaluate(() => fetch('/probe.mp4').then(r => r.arrayBuffer()));
  await page.waitForFunction(async cache => Boolean(await (await caches.open(cache)).match('/probe.mp4')),
    cacheName, { timeout: 10000 });
  const extrait = await page.evaluate(async () => {
    const response = await fetch('/probe.mp4', { headers: { Range: 'bytes=2-4' } });
    return { status: response.status, text: await response.text(), range: response.headers.get('Content-Range') };
  });
  assert.deepEqual(extrait, { status: 206, text: '234', range: 'bytes 2-4/10' }, 'requête Range pour la vidéo');
  // Le vrai signal de 1,5 s doit être présent dans la nouvelle version du
  // précache, pas uniquement récupéré depuis le réseau lors des tests OPEN.
  await context.setOffline(true);
  const dureeSonHorsLigne = await page.evaluate(async () => {
    const donnees = await (await fetch('/assets/alerte-open.mp3?v=7')).arrayBuffer();
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    try { return (await audio.decodeAudioData(donnees)).duration; }
    finally { await audio.close(); }
  });
  assert.ok(Math.abs(dureeSonHorsLigne - 1.5) < .01, 'signal de 1,5 s disponible hors ligne');
  await context.setOffline(false);
  await page.evaluate(async cache => {
    await (await caches.open(cache)).put('/assets/alerte-open.mp3?v=7',
      new Response('0123456789', { headers: { 'Content-Type': 'audio/mpeg' } }));
  }, cacheName);
  await context.setOffline(true);
  const extraitSon = await page.evaluate(async () => {
    const url = '/assets/alerte-open.mp3?v=7';
    const lire = async range => {
      const res = await fetch(url, { headers: { Range: range } });
      return { status: res.status, text: await res.text(), range: res.headers.get('Content-Range') };
    };
    return [await lire('bytes=2-4'), await lire('bytes=-3'), await lire('bytes=8-'), await lire('bytes=30-40')];
  });
  assert.deepEqual(extraitSon, [
    { status: 206, text: '234', range: 'bytes 2-4/10' },
    { status: 206, text: '789', range: 'bytes 7-9/10' },
    { status: 206, text: '89', range: 'bytes 8-9/10' },
    { status: 416, text: '', range: 'bytes */10' }
  ], 'signal court précaché lisible par plages hors ligne');
  const offline = await page.evaluate(() => fetch('/probe.css').then(r => r.text()));
  assert.ok(offline.includes('updated'), 'version rafraîchie disponible hors connexion');
  const missing = await page.evaluate(() => fetch('/missing.css').then(() => 'response', () => 'network error'));
  assert.equal(missing, 'network error', 'ne pas renvoyer du HTML à la place d’un CSS');
  await context.close();
  console.log('✓ Service worker : revalidation et cache hors connexion');
}

async function testIsolatedPreview(browser) {
  const process = spawn('python3', [path.join(__dirname, 'serveur-apercu-animations.py'), '--source', root, '--port', '0']);
  let context;
  let second;
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('démarrage de l’aperçu trop long')), 8000);
      process.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/port (\d+)/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
      process.once('error', reject);
      process.once('exit', code => reject(new Error('aperçu arrêté : ' + code)));
    });
    const base = 'http://127.0.0.1:' + port + '/';
    context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + (publishedSite ? '?ecoutille=0' : ''), { waitUntil: 'domcontentloaded' });
    const resultat = await page.evaluate(async () => {
      const fs = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
      const ref = fs.doc(fs.getFirestore(), 'teams', 'TEST_ISOLE');
      await fs.setDoc(ref, { nom: 'fictif' });
      let bloquee = false;
      try {
        await fetch('https://firestore.googleapis.com/v1/projects/mission-nautilus/databases/(default)/documents',
          { method: 'POST', body: 'test' });
      } catch (_) { bloquee = true; }
      return { local: fs.getFirestore().demo === true, nom: (await fs.getDoc(ref)).data().nom, bloquee };
    });
    assert.deepEqual(resultat, { local: true, nom: 'fictif', bloquee: true }, 'aucune écriture dans Firebase réel');
    assert.equal(await page.locator('[aria-label="Aperçu avec données fictives"]').count(), 1);
    second = await browser.newContext();
    const autre = await second.newPage();
    await autre.goto(base + (publishedSite ? '?ecoutille=0' : ''), { waitUntil: 'domcontentloaded' });
    const isole = await autre.evaluate(async () => {
      const fs = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
      return !(await fs.getDoc(fs.doc(fs.getFirestore(), 'teams', 'TEST_ISOLE'))).exists();
    });
    assert.equal(isole, true, 'les données fictives restent propres à chaque onglet');
  } finally {
    if (context) await context.close();
    if (second) await second.close();
    process.kill();
  }
  console.log('✓ Aperçu isolé : équipes fictives, connexions réelles bloquées');
}

async function testPartialPrecache(browser, base, withFallback) {
  failedAsset = '/assets/Victoire.mp3';
  const context = await prepareContext(browser, base, { serviceWorkers: 'allow' });
  const page = await context.newPage();
  try {
    await page.goto(base + 'blank.html');
    await page.evaluate(async withFallback => {
      const previous = await caches.open('nautilus-v-test-ancien');
      await previous.put('/old-only.txt', new Response('ancienne version'));
      if (withFallback) {
        await previous.put('/assets/Victoire.mp3', new Response('son en cache', {
          headers: { 'Content-Type': 'audio/mpeg' }
        }));
      }
      await (await caches.open('une-autre-application')).put('/other.txt', new Response('autre application'));
      await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
    }, withFallback);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 20000 });
    const state = await page.evaluate(async cache => {
      const nouveau = await caches.open(cache);
      const sound = await nouveau.match('/assets/Victoire.mp3');
      return {
        pages: Boolean(await nouveau.match('/index.html')),
        fallback: Boolean(await nouveau.match('/typewriter-secours.js?v=1')),
        sound: sound ? await sound.text() : null,
        keys: await caches.keys()
      };
    }, cacheName);
    assert.equal(state.pages, true, 'une erreur ne doit pas annuler tout le précache');
    assert.equal(state.fallback, true, 'secours typewriter toujours en cache');
    assert.ok(state.keys.includes('une-autre-application'), 'caches des autres applications préservés');
    if (withFallback) {
      assert.equal(state.sound, 'son en cache', 'réutiliser la copie exacte de l’ancien cache');
      assert.ok(!state.keys.includes('nautilus-v-test-ancien'), 'ancien cache supprimé une fois le nouveau complet');
    } else {
      assert.equal(state.sound, null, 'le fichier manquant ne doit pas être inventé');
      assert.ok(state.keys.includes('nautilus-v-test-ancien'), 'ancien cache préservé si le nouveau est incomplet');
    }
    await context.setOffline(true);
    await page.goto(landing(base), { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('missionOrderText')?.dataset.typed === 'true', null, { timeout: 8000 });
    assert.equal(await page.$eval('.radar-sweep-big', el => getComputedStyle(el).animationName), 'radarRotateFast',
      'le CSS des animations reste disponible hors ligne');
  } finally {
    failedAsset = '';
    await context.close();
  }
  console.log('✓ Précache partiel et reprise hors ligne (' + (withFallback ? 'avec ancien fichier' : 'sans ancien fichier') + ')');
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const options = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  if (process.env.CHROMIUM_BIN) options.executablePath = process.env.CHROMIUM_BIN;
  const browser = await chromium.launch(options);
  try {
    if (process.env.NAUTILUS_TEST_ONLY === 'open') {
      await testOpenAlert(browser, base, 'desktop');
      await testOpenAlert(browser, base, 'mobile');
      await testOpenAlert(browser, base, 'paysage');
      await testOpenAlert(browser, base, 'iphone-réduit');
      await testOpenAlert(browser, base, 'iphone-calme');
      await testOpenAlert(browser, base, 'paysage-calme');
      await testOpenAlert(browser, base, 'silencieux');
      await testOpenAlert(browser, base, 'secours');
      await testOpenLateEngine(browser, base);
      await testOpenSlowAudio(browser, base, false);
      await testOpenSlowAudio(browser, base, true);
      await testOpenAudioUnavailable(browser, base, 'lecture refusée');
      await testOpenAudioUnavailable(browser, base, 'lecture en attente');
      await testOpenAudioUnavailable(browser, base, 'fichier indisponible');
      return;
    }
    await testRadar(browser, base, { width: 1440, height: 900 }, 'desktop');
    await testRadar(browser, base, { width: 390, height: 844 }, 'mobile');
    await testWithoutIntersectionObserver(browser, base);
    await testFirestoreFailure(browser, base);
    await testTypewriter(browser, base, 'no-preference');
    await testTypewriter(browser, base, 'reduce');
    await testTypewriterWithFirebase(browser, base, 0);
    await testTypewriterWithFirebase(browser, base, 4500);
    if (publishedSite) {
      await testHatchFallback(browser, base);
      await testHatchAnimation(browser, base, { width: 1440, height: 900 }, 'desktop');
      await testHatchAnimation(browser, base, { width: 390, height: 844 }, 'mobile');
      await testOpenAlert(browser, base, 'desktop');
      await testOpenAlert(browser, base, 'mobile');
      await testOpenAlert(browser, base, 'paysage');
      await testOpenAlert(browser, base, 'iphone-réduit');
      await testOpenAlert(browser, base, 'iphone-calme');
      await testOpenAlert(browser, base, 'paysage-calme');
      await testOpenAlert(browser, base, 'silencieux');
      await testOpenAlert(browser, base, 'secours');
      await testOpenLateEngine(browser, base);
      await testOpenSlowAudio(browser, base, false);
      await testOpenSlowAudio(browser, base, true);
      await testOpenAudioUnavailable(browser, base, 'lecture refusée');
      await testOpenAudioUnavailable(browser, base, 'lecture en attente');
      await testOpenAudioUnavailable(browser, base, 'fichier indisponible');
      await testHatchReducedMotion(browser, base);
      await testMotionChoice(browser, base, 'clavier');
      await testMotionChoice(browser, base, 'tactile');
      await testRadarChoiceOnPage(browser, base, false);
      await testRadarChoiceOnPage(browser, base, true);
      await testRadarVisualViewport(browser, base);
      await testRadarSansObservateur(browser, base);
      await testRadarStorageFallback(browser, base);
      await testSystemMotionChanges(browser, base);
      await testAutoplayFallback(browser, base);
      await testFilmUnavailable(browser, base);
      await testVideoResume(browser, base);
    }
    await testReducedMotion(browser, base);
    await testCssomAnimations(browser, base);
    await testSas(browser, base);
    if (publishedSite && fs.existsSync(path.join(root, '1941512821.html')) && fs.existsSync(path.join(root, 'admin-artefact.js'))) {
      await testIntegratedPaliers(browser, base, { width: 1280, height: 900 }, 'desktop');
      await testIntegratedPaliers(browser, base, { width: 390, height: 844 }, 'mobile');
    }
    await testServiceWorker(browser, base);
    await testPartialPrecache(browser, base, false);
    await testPartialPrecache(browser, base, true);
    await testIsolatedPreview(browser);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
