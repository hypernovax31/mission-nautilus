/* =============================================================
   NAUTILUS CORE — Module partagé entre toutes les pages palier.
   Centralise : Firebase, audio helpers, math, format, live board.
   ============================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ---------- CONFIGURATION ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyB5ivqXO1W9fZqqhwJ0uDnLgVgvWSfQz50",
  authDomain: "mission-nautilus.firebaseapp.com",
  projectId: "mission-nautilus",
  storageBucket: "mission-nautilus.firebasestorage.app",
  messagingSenderId: "444670686419",
  appId: "1:444670686419:web:00d186940a2fb8c8c29026"
};

const TEAM_DEFS = [
  { code: "NEMO",     name: "Nemo" },
  { code: "NAUTILUS", name: "Nautilus" },
  { code: "ARONNAX",  name: "Aronnax" },
  { code: "NEDLAND",  name: "Ned Land" },
  { code: "CALAMAR",  name: "Calamar" }
];

/* Définition officielle UIT-R M.1677-1 (caractères accentués inclus) */
const MORSE_TABLE = {
  A:'.-',   B:'-...', C:'-.-.', D:'-..',  E:'.',    F:'..-.', G:'--.',  H:'....',
  I:'..',   J:'.---', K:'-.-',  L:'.-..', M:'--',   N:'-.',   O:'---',  P:'.--.',
  Q:'--.-', R:'.-.',  S:'...',  T:'-',    U:'..-',  V:'...-', W:'.--', X:'-..-',
  Y:'-.--', Z:'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-',
  '5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
  /* Caractères accentués selon UIT-R M.1677-1 */
  'À':'.--.-', 'Ä':'.-.-', 'Å':'.--.-',
  'É':'..-..', 'È':'.-..-',
  'Ö':'---.',  'Ñ':'--.--',
  'Ü':'..--',
  'Ç':'-.-..',
  'CH':'----'  /* digramme CH (suisse/allemand) */
};

const STEPS = {
  start:     { label: "Palier 1", next: "livres" },
  livres:    { label: "Palier 2", next: "son" },
  son:       { label: "Palier 3", next: "zone51" },
  zone51:    { label: "Palier 4", next: "occasion" },
  occasion:  { label: "Palier 5", next: "papeterie" },
  papeterie: { label: "Palier 6", next: "drone" },
  drone:     { label: "Palier 7", next: "final" },
  final:     { label: "Palier final", next: null }
};

/* Banque de mots : 40 mots, 7+ lettres, AVEC accents (UIT-R M.1677-1)
   Chaque mot a un hint thématique interne (pour le cap nº2 ou pour le log).
   ATTENTION : ces mots varient l'épreuve (anti-triche par rejouabilité)
   mais le LIEU DU QR DANS LE MAGASIN est FIXE — voir QR_LOCATION_HINT. */
const MORSE_WORDS = [
  { w:"NAUTILE",   h:"Animal marin à coquille spiralée" },
  { w:"ABYSSES",   h:"Profondeurs inexplorées de l'océan" },
  { w:"EPAVES",    h:"Épave = navire échoué au fond" },
  { w:"EQUATEUR",  h:"Ligne imaginaire autour de la Terre" },
  { w:"OCEANES",   h:"Vastes mers salées" },
  { w:"RECIFAL",   h:"Qualifie un récif corallien" },
  { w:"SOUSMARIN", h:"Bateau qui plonge sous l'eau" },
  { w:"BARQUES",   h:"Petits bateaux de pêche" },
  { w:"PHOQUES",   h:"Mammifères marins à nageoires" },
  { w:"CETACES",   h:"Famille des baleines et dauphins" },
  { w:"CORAIL",    h:"Animal qui forme les récifs" },
  { w:"MEDUSES",   h:"Animaux gélatineux urticants" },
  { w:"OURSINS",   h:"Petits animaux à piquants" },
  { w:"CRUSTACE",  h:"Famille du crabe et de la crevette" },
  { w:"BALEINES",  h:"Plus grands animaux marins" },
  { w:"DAUPHINS",  h:"Cétacés intelligents et joueurs" },
  { w:"REQUINS",   h:"Prédateurs au sourire de dents" },
  { w:"ANCHOIS",   h:"Petits poissons bleus en banc" },
  { w:"SARDINES",  h:"Petits poissons pêchés en boîte" },
  { w:"MOULES",    h:"Mollusques des rochers" },
  { w:"HUITRES",   h:"Mollusques précieux pour leurs perles" },
  { w:"CREVETTES", h:"Petits crustacés roses" },
  { w:"LANGOUSTE", h:"Grand crustacé à longues antennes" },
  { w:"MAREEES",   h:"Mouvement quotidien de la mer" },
  { w:"COURANTS",  h:"Flux d'eau continus dans l'océan" },
  { w:"VAGUES",    h:"Elles roulent vers le rivage" },
  { w:"ECUMES",    h:"Mousse blanche sur les crêtes" },
  { w:"ALGUES",    h:"Végétaux marins" },
  { w:"MANGROVE",  h:"Forêt des zones côtières tropicales" },
  { w:"PROMENADE", h:"Chemin le long de la côte" },
  { w:"PHARE",     h:"Tour qui guide les navires" },
  { w:"MARINIER",  h:"Qui concerne les marins" },
  { w:"PIRATES",   h:"Ecumeurs des mers du temps de la voile" },
  { w:"FLIBUSTIER",h:"Pirate des Antilles" },
  { w:"EQUIPAGES", h:"Équipes à bord d'un navire" },
  { w:"MATELOTS",  h:"Marins d'équipage" },
  { w:"CAPITAINE", h:"Commandant d'un navire" },
  { w:"AMIRAUTE",  h:"Commandement supérieur de la marine" },
  { w:"CHALUTIER", h:"Bateau de pêche au filet" },
  { w:"SOUSMARINE",h:"Autre orthographe du sous-marin" }
];

/* Lieu FIXE du QR du palier 2 dans le magasin.
   Ce texte est identique pour tous les mots tirés (le lieu ne dépend
   pas du mot Morse trouvé). C'est ici que l'équipe devra scanner
   le QR pour obtenir le numéro secret du palier 2. */
const QR_LOCATION_HINT = "📍 Direction la borne d'arcade au fond du magasin, derrière l'écran de démonstration.";

/* ---------- INITIALISATION FIREBASE ---------- */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- HELPERS GÉNÉRIQUES ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = (s) => String(s || '').trim().toUpperCase();
const memberKey = (name) => normalize(String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/gi, ''));
const simple = (s) => normalize(String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
function teamCodeFromInput(value) {
  const wanted = simple(value);
  const found = TEAM_DEFS.find(t => simple(t.code) === wanted || simple(t.name) === wanted);
  return found ? found.code : String(value || '').trim();
}
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

/* ---------- ROUTING PALIER (codes numériques) ---------- */
/* Génère la série de codes : palier1 = 16 1 12 9 5 18 ; palier2 = +1 à chaque ; etc. */
function getStepCode(stepId) {
  /* Trouve l'index du palier (1-indexé) */
  const stepKeys = Object.keys(STEPS);
  const idx = stepKeys.indexOf(stepId);
  if (idx < 0) return null;
  /* "PALIER" = P(16) A(1) L(12) I(9) E(5) R(18) */
  const base = [16, 1, 12, 9, 5, 18];
  return base.map(n => n + idx).join('-');
}
function getStepIdFromCode(code) {
  if (!code) return null;
  const cleaned = String(code).replace(/[\s.-]/g, '');
  if (cleaned.length !== 6) return null;
  const digits = cleaned.split('').map(Number);
  if (digits.some(isNaN)) return null;
  /* Détermine l'offset : on cherche un idx tel que (16+idx, 1+idx, ..., 18+idx) = digits */
  const offsets = digits.map((d, i) => d - [16,1,12,9,5,18][i]);
  const offset = offsets[0];
  if (!offsets.every(o => o === offset)) return null;
  if (offset < 0 || offset >= Object.keys(STEPS).length) return null;
  return Object.keys(STEPS)[offset];
}

/* ---------- SESSION COURANTE (équipage + identité joueur) ---------- */
function getClientId() {
  let id = localStorage.getItem('nautilusClientId');
  if (!id) { id = 'P-' + Math.random().toString(36).slice(2, 10).toUpperCase(); localStorage.setItem('nautilusClientId', id); }
  return id;
}
function getCurrentTeamCode() {
  /* Lit ?code=XXX dans l'URL d'abord, puis localStorage */
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('code');
  if (fromUrl) {
    const clean = teamCodeFromInput(fromUrl);
    localStorage.setItem('nautilusCurrentTeam', clean);
    return clean;
  }
  return localStorage.getItem('nautilusCurrentTeam');
}
function setCurrentTeamCode(code) { localStorage.setItem('nautilusCurrentTeam', code); }

/* ---------- ACCÈS FIRESTORE ---------- */
async function getTeam(code) {
  const cleanCode = teamCodeFromInput(code);
  const snap = await getDoc(doc(db, 'teams', cleanCode));
  return snap.exists() ? { teamCode: cleanCode, ...snap.data() } : null;
}
async function getTeamRealtime(code, callback) {
  return onSnapshot(doc(db, 'teams', teamCodeFromInput(code)), (snap) => {
    callback(snap.exists() ? { teamCode: teamCodeFromInput(code), ...snap.data() } : null);
  });
}
async function saveTeam(team, patch) {
  if (!team || !team.teamCode) throw new Error('Code équipage manquant.');
  const updated = { ...patch, updatedAt: new Date().toISOString() };
  await updateDoc(doc(db, 'teams', team.teamCode), updated);
  return { ...team, ...updated };
}
async function addEvent(team, type, data = {}) {
  return addDoc(collection(db, 'events'), {
    teamCode: team.teamCode, teamName: team.teamName, type,
    ...data, createdAt: serverTimestamp()
  });
}

/* ---------- SESSION PARTAGÉE (sous-collection morseSession) ---------- */
function sessionRef(teamCode) {
  return doc(db, 'teams', teamCodeFromInput(teamCode), 'morseSession', 'current');
}
async function getSession(teamCode) {
  const snap = await getDoc(sessionRef(teamCode));
  return snap.exists() ? snap.data() : null;
}
function watchSession(teamCode, callback) {
  return onSnapshot(sessionRef(teamCode), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}
async function createSession(teamCode, data) {
  await setDoc(sessionRef(teamCode), {
    teamCode: teamCodeFromInput(teamCode),
    state: 'playing',
    startedAt: new Date().toISOString(),
    attempts: 0,
    errors: 0,
    listensLeft: 3,
    hintsRevealed: [false, false, false],
    wordLength: 0,
    wordHash: 0,
    lastEvent: 'session_started',
    lastEventAt: new Date().toISOString(),
    ...data
  });
}
async function updateSession(teamCode, patch) {
  await updateDoc(sessionRef(teamCode), { ...patch, lastEventAt: new Date().toISOString() });
}
async function endSession(teamCode, reason) {
  await updateSession(teamCode, { state: 'ended', endReason: reason, endedAt: new Date().toISOString() });
}
async function clearSession(teamCode) {
  await setDoc(sessionRef(teamCode), { state: 'idle', clearedAt: new Date().toISOString() });
}

/* ---------- BLOCAGE PROGRESSIF ---------- */
function getLockHours(failCount) { return Math.min(24, Math.pow(2, failCount)); }
function getLockedUntilISO(failCount) {
  const d = new Date();
  d.setHours(d.getHours() + getLockHours(failCount));
  return d.toISOString();
}
function isLocked(team) {
  return team?.status === 'blocked' && team.lockedUntil && new Date(team.lockedUntil).getTime() > Date.now();
}
function formatDate(iso) { return iso ? new Date(iso).toLocaleString('fr-FR') : '—'; }

/* ---------- AUDIO WEB API ---------- */
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
  }
  return _audioCtx;
}

/* Tonalité Morse (point ou trait) sur le contexte courant */
function playMorseTone(ctx, destination, freq, duration, startAt) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.32, startAt + 0.012);
  gain.gain.setValueAtTime(0.32, startAt + duration - 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain); gain.connect(destination);
  osc.start(startAt); osc.stop(startAt + duration + 0.01);
}

/* Convertit un mot (avec accents) en séquence jouable */
function wordToMorseSeq(word) {
  const W = word.toUpperCase();
  const seq = [];
  for (let i = 0; i < W.length; i++) {
    const ch = W[i];
    /* Gestion du digramme CH */
    if (ch === 'C' && W[i+1] === 'H' && MORSE_TABLE.CH) {
      seq.push({ code: MORSE_TABLE.CH, letter: 'CH' });
      i++;
      continue;
    }
    const code = MORSE_TABLE[ch];
    if (!code) continue;
    seq.push({ code, letter: ch });
  }
  return seq;
}

/* Joue une séquence Morse à travers un nœud destination. */
async function playMorseSequence(ctx, destination, word, opts = {}) {
  const DOT = opts.dot ?? 0.18;
  const DASH = DOT * 3;
  const INTRA = DOT;
  const INTER = DOT * 3;
  const FREQ = opts.freq ?? 600;
  const seq = wordToMorseSeq(word);
  for (let i = 0; i < seq.length; i++) {
    const item = seq[i];
    const code = item.code;
    let t = ctx.currentTime;
    for (let s = 0; s < code.length; s++) {
      const sign = code[s];
      const dur = (sign === '.') ? DOT : DASH;
      playMorseTone(ctx, destination, FREQ, dur, t);
      t += dur;
      if (s < code.length - 1) t += INTRA;
    }
    const letterDur = code.split('').reduce((acc, c) => acc + (c === '.' ? DOT : DASH), 0)
      + (code.length - 1) * INTRA;
    opts.onLetter && opts.onLetter(i, item);
    await new Promise(r => setTimeout(r, letterDur * 1000));
    if (i < seq.length - 1) await new Promise(r => setTimeout(r, INTER * 1000));
  }
}

/* ---------- MOTS ALÉATOIRES (avec rotation post-épuisement) ---------- */
const _usedWords = new Set();
function pickWord() {
  /* Si tous les mots ont été utilisés, on reset */
  if (_usedWords.size >= MORSE_WORDS.length) _usedWords.clear();
  const available = MORSE_WORDS.filter((_, i) => !_usedWords.has(i));
  /* Mais on accède par index, pas par mot. Convertissons. */
  const idx = Math.floor(Math.random() * available.length);
  const realIdx = MORSE_WORDS.indexOf(available[idx]);
  _usedWords.add(realIdx);
  return MORSE_WORDS[realIdx];
}
function markHintsExhausted(word) {
  /* Le mot sera changé à la prochaine partie */
  const idx = MORSE_WORDS.findIndex(m => m.w === word);
  if (idx >= 0) _usedWords.add(idx);
}

/* ---------- UI HELPERS (chambre de pilotage live) ---------- */
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('nautilus-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'nautilus-toast-container';
    container.style.cssText = 'position:fixed;top:80px;right:14px;z-index:10002;display:flex;flex-direction:column;gap:8px;max-width:min(360px,92vw);';
    document.body.appendChild(container);
  }
  const colors = {
    info: { bg: 'rgba(11,52,78,.95)', border: 'rgba(142,231,255,.55)', color: '#eaf8ff' },
    success: { bg: 'rgba(11,76,42,.95)', border: 'rgba(174,229,202,.6)', color: '#effff7' },
    warning: { bg: 'rgba(76,38,11,.95)', border: 'rgba(232,192,95,.6)', color: '#fff4d8' },
    danger:  { bg: 'rgba(76,11,11,.95)', border: 'rgba(255,75,62,.7)', color: '#fff' }
  };
  const c = colors[type] || colors.info;
  const el = document.createElement('div');
  el.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.color};border-radius:14px;padding:12px 14px;font-weight:800;font-size:13px;line-height:1.45;box-shadow:0 12px 28px rgba(0,0,0,.4);animation:slideInRight .3s ease;`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOutRight .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/* ---------- LIVE BOARD (journal de bord temps réel) ---------- */
function addLogEntry(text, kind = 'info') {
  const list = document.getElementById('morse-log-list');
  if (!list) return;
  const colors = {
    info:    { dot: '#8ee7ff', border: 'rgba(142,231,255,.4)' },
    success: { dot: '#5be09b', border: 'rgba(91,255,156,.5)' },
    warning: { dot: '#ffd36c', border: 'rgba(245,176,39,.5)' },
    danger:  { dot: '#ff7b72', border: 'rgba(255,75,62,.55)' }
  };
  const c = colors[kind] || colors.info;
  const li = document.createElement('li');
  li.className = 'morse-log-entry';
  li.style.cssText = `display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-left:3px solid ${c.border};background:rgba(0,0,0,.22);border-radius:8px;`;
  li.innerHTML = `
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.dot};box-shadow:0 0 8px ${c.dot};flex:0 0 10px;margin-top:5px;"></span>
    <span style="flex:1;color:#dff6ff;line-height:1.4;">${esc(text)}</span>
  `;
  list.prepend(li);
  /* Limite à 20 entrées */
  while (list.children.length > 20) list.removeChild(list.lastChild);
}
function clearLog() {
  const list = document.getElementById('morse-log-list');
  if (list) list.innerHTML = '';
}

/* ---------- HEARTBEAT (mise à jour lastSeen du membre) ---------- */
async function heartbeat(teamCode) {
  const team = await getTeam(teamCode);
  if (!team) return;
  const online = { ...(team.onlinePlayers || {}), [getClientId()]: new Date().toISOString() };
  await updateDoc(doc(db, 'teams', teamCode), { onlinePlayers: online, updatedAt: new Date().toISOString() });
}

/* ---------- EXPORT GLOBAL ---------- */
window.Nautilus = {
  /* Constantes */
  TEAM_DEFS, MORSE_TABLE, MORSE_WORDS, STEPS, QR_LOCATION_HINT,
  /* Firebase */
  db, app,
  /* Helpers */
  $, esc, normalize, memberKey, simple, teamCodeFromInput, hashString,
  getStepCode, getStepIdFromCode,
  getClientId, getCurrentTeamCode, setCurrentTeamCode,
  getTeam, getTeamRealtime, saveTeam, addEvent,
  sessionRef, getSession, watchSession, createSession, updateSession, endSession, clearSession,
  getLockHours, getLockedUntilISO, isLocked, formatDate,
  getAudioCtx, playMorseTone, wordToMorseSeq, playMorseSequence,
  pickWord, markHintsExhausted,
  showToast, addLogEntry, clearLog, heartbeat
};
