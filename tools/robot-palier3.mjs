#!/usr/bin/env node
/* =====================================================================
   ROBOT PALIER 3 — SURVEILLANCE FNAC PAR ÉQUIPE
   tools/robot-palier3.mjs

   Déclenché uniquement quand une équipe arrive au Palier 3,
   s'arrête quand elle passe au Palier 4. Vrai pour chaque équipe.

   Fonctionnement :
     1. GitHub Action (schedule + repository_dispatch) lance ce script
     2. Il lit Firestore collection `watches` où active==true (une ligne par équipe)
     3. Pour chaque équipe en Palier 3, il fait une recherche EN DIRECT sur fnac.com
        pour son magasin : rayon -> fiches -> bloc "En stock + Retrait 1h"
     4. Si Fnac bloque (403/429/captcha), il S'ARRÊTE sans contourner et garde
        le dernier état
     5. Si l'équipe a déverrouillé Palier 4 (sasUnlocks.4), il désactive la surveillance

   Politesse : robots.txt vérifié, 3s entre requêtes, plafond 20, User-Agent identifié
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');

globalThis.window = globalThis;
await import(path.join(racine, 'fnac-lecteur.js'));
await import(path.join(racine, 'artefact-moteur.js'));
const L = globalThis.NautilusFnacLecteur;
const M = globalThis.NautilusArtefactMoteur;

const CHEMIN_MAGASINS = path.join(racine, 'data', 'magasins-fnac.json');
const USER_AGENT = 'MissionNautilus-RobotPalier3/1.0 (surveillance par equipe, lecture polie fnac.com; contact: hypernovax31@users.noreply.github.com)';
const MAX_FICHES = 12;
const DELAI_MS = 3000;
const PLAFOND = 20;

// --- helpers ---
const log = (...a) => console.log(...a);
const dormir = (ms) => new Promise(r => setTimeout(r, ms));

function estMurAntiBot(statut, corps) {
  if (statut === 403 || statut === 429 || statut === 503) return true;
  const t = String(corps||'').slice(0,4000).toLowerCase();
  return /(captcha|datadome|mumbo|mumb0|access denied|veuillez v[ée]rifier|pas un robot|are you a human|just a moment)/.test(t);
}

async function telechargerPoli(url, etat) {
  const permis = L.robotsAutorise(url);
  if (!permis.ok) return { ok:false, motif:'robots.txt: '+permis.motif, url };
  if (etat.requetes >= PLAFOND) return { ok:false, motif:'plafond atteint', url };
  if (etat.requetes > 0) await dormir(DELAI_MS);
  etat.requetes++;
  const headers = { 'User-Agent': USER_AGENT, 'Accept':'text/html,application/xhtml+xml', 'Accept-Language':'fr-FR,fr;q=0.9' };
  try {
    const reponse = await fetch(url, { headers, redirect:'follow' });
    const corps = await reponse.text();
    if (!reponse.ok) {
      if (estMurAntiBot(reponse.status, corps)) { etat.bloque=true; return { ok:false, mur:true, motif:'mur anti-bot HTTP '+reponse.status, url }; }
      return { ok:false, motif:'HTTP '+reponse.status, url };
    }
    if (estMurAntiBot(200, corps)) { etat.bloque=true; return { ok:false, mur:true, motif:'page anti-bot', url }; }
    return { ok:true, corps, urlFinale: reponse.url || url };
  } catch(e) { return { ok:false, motif:'réseau: '+(e.message||e), url }; }
}

function chargerMagasins() {
  if (!fs.existsSync(CHEMIN_MAGASINS)) throw new Error('magasins manquants');
  return JSON.parse(fs.readFileSync(CHEMIN_MAGASINS,'utf8'));
}
function trouverMagasin(liste, id) { return (liste||[]).find(m=>m.id===id) || null; }
function construireRayonUrl(magasin) {
  if (!magasin || !magasin.slug || !magasin.id) return '';
  const slug = String(magasin.slug).replace(/^\/+|\/+$/g,'');
  return `https://www.fnac.com/${slug}/${magasin.id}/livre`;
}

// --- Firebase Admin ---
async function initAdmin() {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    log('ℹ️ Pas de FIREBASE_SERVICE_ACCOUNT: mode dry-run (pas d\'écriture Firestore)');
    return null;
  }
  let cred;
  try { cred = JSON.parse(sa); } catch(e) { throw new Error('FIREBASE_SERVICE_ACCOUNT invalide'); }
  const admin = await import('firebase-admin');
  if (!admin.default.apps.length) {
    admin.default.initializeApp({ credential: admin.default.credential.cert(cred) });
  }
  return admin.default;
}

async function lireWatches(admin) {
  if (!admin) return [];
  const db = admin.firestore();
  const snap = await db.collection('watches').where('active','==',true).get();
  const out = [];
  snap.forEach(d => out.push({ id:d.id, ...d.data() }));
  return out;
}

async function equipeAPassePalier4(admin, teamCode) {
  if (!admin) return false;
  const db = admin.firestore();
  try {
    const snap = await db.doc(`teams/${teamCode}`).get();
    if (!snap.exists) return false;
    const data = snap.data()||{};
    if (data.sasUnlocks && data.sasUnlocks['4']) return true;
    if (data.sasUnlocks && data.sasUnlocks[4]) return true;
    if (Array.isArray(data.completedSteps) && data.completedSteps.includes('son')) {
      // Palier 3 terminé = peut aller au 4, mais pas encore déverrouillé : on garde surveillance
      // On ne coupe que si sasUnlocks.4 existe
      return false;
    }
    // aussi vérifier sessions/{team} currentStep zone51 ?
    const s2 = await db.doc(`sessions/${teamCode}`).get().catch(()=>null);
    if (s2 && s2.exists) {
      const sess = s2.data();
      if (sess && sess.magasinId && false) {}
    }
  } catch(e) {}
  return false;
}

async function desactiverWatch(admin, teamCode, raison) {
  if (!admin) { log(`[dry] désactiver ${teamCode}: ${raison}`); return; }
  const db = admin.firestore();
  await db.doc(`watches/${teamCode}`).update({
    active: false,
    desactiveLe: new Date().toISOString(),
    desactiveRaison: raison
  });
  log(`⏹️ Surveillance arrêtée pour ${teamCode}: ${raison}`);
}

async function mettreAJourWatch(admin, teamCode, patch) {
  if (!admin) { log(`[dry] update ${teamCode}`, patch); return; }
  const db = admin.firestore();
  await db.doc(`watches/${teamCode}`).set(patch, { merge:true });
}

// --- collecte live pour un magasin ---
async function collecteLivePourMagasin(magasinId, magasinsListe) {
  const magasin = trouverMagasin(magasinsListe, magasinId);
  if (!magasin) return { ok:false, motif:'magasin inconnu '+magasinId, requetes:0, livres:[] };
  const etat = { requetes:0, bloque:false };
  const rayonUrl = construireRayonUrl(magasin);
  if (!rayonUrl) return { ok:false, motif:'pas de rayon pour '+magasinId, requetes:0, livres:[] };

  const rRayon = await telechargerPoli(rayonUrl, etat);
  if (!rRayon.ok) return { ok:false, motif:'rayon: '+rRayon.motif, mur:!!rRayon.mur, bloque:etat.bloque, requetes:etat.requetes, livres:[] };

  const liens = L.extraireLiensFiches(rRayon.corps).slice(0, MAX_FICHES);
  if (!liens.length) return { ok:false, motif:'aucune fiche dans rayon', requetes:etat.requetes, livres:[] };

  const livres = [];
  const maintenant = Date.now();
  for (const lien of liens) {
    if (etat.bloque) break;
    const t = await telechargerPoli(lien.url, etat);
    if (!t.ok) { if (t.mur) break; continue; }
    const lecture = L.lireFiche(t.corps, { url:t.urlFinale, magasinId, magasins: magasinsListe, maintenant, strictMagasin:false });
    if (!lecture.livre.ean) continue;
    if (!lecture.exploitable) continue;
    livres.push(lecture.livre);
    if (livres.length >= 6) break;
  }
  if (!livres.length) return { ok:false, motif:`aucun retrait 1h en direct (${etat.requetes} requêtes)`, requetes:etat.requetes, bloque:etat.bloque, livres:[] };
  return { ok:true, requetes:etat.requetes, bloque:etat.bloque, livres };
}

async function principal() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const magasinForce = (args.find(a=>a.startsWith('--magasin='))||'').split('=')[1] || null;
  const teamForce = (args.find(a=>a.startsWith('--team='))||'').split('=')[1] || null;

  log('🤖 Robot Palier 3 — surveillance par équipe');
  const magasinsDoc = chargerMagasins();
  const magasinsListe = magasinsDoc.magasins || [];

  const admin = await initAdmin();
  let watches = await lireWatches(admin);
  if (teamForce) watches = watches.filter(w=>w.teamCode===teamForce || w.id===teamForce);
  if (magasinForce) watches = watches.filter(w=>w.magasinId===magasinForce);

  if (!watches.length) {
    log('ℹ️ Aucune équipe en surveillance Palier 3 (watches active==true vide). Rien à faire.');
    // aussi vérifier déclenchement manuel direct (sans watch) : si --magasin passé, on fait une collecte ponctuelle
    if (magasinForce) {
      log(`→ collecte ponctuelle pour ${magasinForce}`);
      const live = await collecteLivePourMagasin(magasinForce, magasinsListe);
      log(live.ok ? `✅ ${live.livres.length} livres retrait 1h (${live.requetes} requêtes)` : `⛔ ${live.motif}`);
      if (admin && live.ok) {
        // publier cartouches pour ce magasin
        const db = admin.firestore();
        for (const livre of live.livres) {
          const gen = M.genererCartouche(livre, { magasinId: magasinForce, sel: `robot|${magasinForce}|${Date.now()}`, maintenant: Date.now() });
          if (!gen.erreur && gen.cartouche) {
            if (!dryRun) await db.collection('cartouches').doc(gen.cartouche.id).set(gen.cartouche);
            log(`  + cartouche ${gen.cartouche.id} (${livre.titre.slice(0,30)})`);
          }
        }
      }
    }
    return;
  }

  log(`👀 ${watches.length} équipe(s) en Palier 3 à surveiller: ${watches.map(w=>w.teamCode||w.id).join(', ')}`);

  for (const watch of watches) {
    const team = watch.teamCode || watch.id;
    const magasinId = watch.magasinId || watch.magasin;
    if (!magasinId) { log(`⚠️ ${team}: pas de magasinId, ignoré`); continue; }

    // Vérifier si passée au Palier 4 → arrêter
    if (await equipeAPassePalier4(admin, team)) {
      await desactiverWatch(admin, team, 'passage Palier 4 détecté (sasUnlocks.4)');
      continue;
    }

    // Respect cadence par équipe : pas plus d'1 check toutes les 10 min
    if (watch.lastCheckAt) {
      const age = Date.now() - Date.parse(watch.lastCheckAt);
      if (age < 10*60*1000) { log(`⏳ ${team}: déjà vérifié il y a ${Math.round(age/60000)}min, on saute`); continue; }
    }

    log(`🔍 ${team} @ ${magasinId} — recherche en direct...`);
    const live = await collecteLivePourMagasin(magasinId, magasinsListe);
    if (!live.ok) {
      log(`  ⛔ ${team}: ${live.motif}${live.bloque?' (bloqué)':''}`);
      if (live.bloque || live.mur) {
        // ne jamais contourner : on garde l'état et on retry plus tard
        await mettreAJourWatch(admin, team, { lastCheckAt: new Date().toISOString(), lastCheckStatus:'bloque', lastCheckMotif: live.motif });
      } else {
        await mettreAJourWatch(admin, team, { lastCheckAt: new Date().toISOString(), lastCheckStatus:'vide', lastCheckMotif: live.motif });
      }
      continue;
    }

    log(`  ✅ ${team}: ${live.livres.length} livres retrait 1h (${live.requetes} requêtes)`);

    // Générer / mettre à jour les cartouches pour ce magasin
    if (admin) {
      const db = admin.firestore();
      let publiees = 0;
      for (const livre of live.livres) {
        const c = M.candidats([livre], magasinId, { maintenant: Date.now() });
        if (!c.retenus.length) continue;
        const gen = M.genererCartouche(c.retenus[0], { magasinId, sel: `robot|${team}|${Date.now()}|${livre.id}`, maintenant: Date.now() });
        if (gen.erreur || !gen.cartouche) continue;
        if (!dryRun) await db.collection('cartouches').doc(gen.cartouche.id).set(gen.cartouche);
        publiees++;
      }
      await mettreAJourWatch(admin, team, {
        lastCheckAt: new Date().toISOString(),
        lastCheckStatus: 'ok',
        lastCheckCount: live.livres.length,
        lastCheckRequetes: live.requetes,
        cartouchesPubliees: publiees
      });
      log(`  📤 ${publiees} cartouches mises à jour pour ${magasinId}`);
    } else {
      log(`  [dry] ${live.livres.length} cartouches à publier`);
    }
  }

  log('🤖 Tour terminé.');
}

principal().catch(e=>{ console.error('❌', e.stack||e); process.exit(1); });
