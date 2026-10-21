#!/usr/bin/env node
/* =====================================================================
   PUBLICATION AUTOMATIQUE DES MAGASINS VERS FIRESTORE
   (tools/publish-magasins-firestore.mjs)

       node tools/publish-magasins-firestore.mjs                  # publie
       node tools/publish-magasins-firestore.mjs --dry-run         # vérifie
       FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' node tools/publish-magasins-firestore.mjs

   ---------------------------------------------------------------------
   UTILISATION EN CI (Option A)
   ---------------------------------------------------------------------
   Déclenché automatiquement à chaque merge sur main de
   data/magasins-fnac.json (via .github/workflows/publish-magasins-firestore.yml) :
     1. lit data/magasins-fnac.json (produit par sync-magasins-fnac.mjs)
     2. contrôle via artefact-moteur.js :: controlerMagasins
     3. écrit ATOMIQUEMENT artefacts/magasins + artefacts/config.magasinsVersion

   AUCUN appel réseau vers fnac.com. Aucune donnée sensible.
   Le fichier JSON est versionné ; la publication Firestore n'est qu'un
   miroir pour le jeu en ligne (lecture publique, écriture admin seule).

   Auth : variable d'environnement FIREBASE_SERVICE_ACCOUNT contenant le
   JSON du compte de service (secret GitHub). En local, --dry-run n'exige
   aucune auth et ne touche pas Firestore.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');
const CHEMIN_SOURCE = path.join(racine, 'data', 'magasins-fnac.json');

const args = process.argv.slice(2);
const drapeau = (n) => args.includes('--' + n);
const DRY = drapeau('dry-run') || drapeau('dryRun');

function log(...a) { console.log(...a); }

function lireSource() {
  const brut = fs.readFileSync(CHEMIN_SOURCE, 'utf8');
  const doc = JSON.parse(brut);
  // Le sync produit { version, syncedAt, count, magasins } — on accepte aussi tableau brut
  const magasins = Array.isArray(doc.magasins) ? doc.magasins : (Array.isArray(doc) ? doc : null);
  if (!magasins) throw new Error('format invalide : ' + CHEMIN_SOURCE + ' ne contient pas de tableau magasins');
  return { doc, magasins };
}

async function controler(magasins) {
  // Charge le moteur pur (sans dépendance Firestore)
  const mod = await import(path.join(racine, 'artefact-moteur.js'));
  // artefact-moteur.js expose en global NautilusArtefactMoteur, mais en Node il exporte via module.exports ?
  // On tente les deux chemins.
  let M = mod.default || mod.NautilusArtefactMoteur || globalThis.NautilusArtefactMoteur;
  if (!M) {
    // fallback : évaluation du fichier en contexte (artefact-moteur.js utilise var + global)
    const src = fs.readFileSync(path.join(racine, 'artefact-moteur.js'), 'utf8');
    // Le fichier s'auto-enregistre sur window/globalThis
    const vm = await import('node:vm');
    const ctx = { window: {}, console, Date, Math, Number, String, Array, Object, JSON };
    ctx.globalThis = ctx;
    ctx.window = ctx;
    vm.runInNewContext(src, ctx);
    M = ctx.NautilusArtefactMoteur || ctx.window.NautilusArtefactMoteur;
  }
  if (!M || typeof M.controlerMagasins !== 'function') {
    throw new Error('controlerMagasins introuvable dans artefact-moteur.js');
  }
  const problemes = M.controlerMagasins(magasins, []);
  return { M, problemes };
}

function ecrireCredentialsDepuisEnv() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) return null;
  let obj;
  try { obj = JSON.parse(json); } catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT n’est pas un JSON valide : ' + e.message); }
  const tmp = path.join(racine, '.gcp-key.json');
  fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmp;
  return tmp;
}

async function principal() {
  log('📦 publish-magasins-firestore — ' + new Date().toISOString());
  if (!fs.existsSync(CHEMIN_SOURCE)) {
    log('❌ source manquante : ' + CHEMIN_SOURCE);
    process.exit(2);
  }
  const { doc, magasins } = lireSource();
  log(`   source : ${CHEMIN_SOURCE} — ${magasins.length} magasins (version ${doc.version || '—'})`);

  const { problemes } = await controler(magasins);
  if (problemes.length) {
    log('⛔ contrôle refusé :');
    problemes.forEach((p) => log('   · ' + p));
    process.exit(2);
  }
  log('✅ contrôle OK : ' + magasins.length + ' magasins');

  const version = doc.version || ('v' + new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const syncedAt = new Date().toISOString();
  const payload = {
    version,
    syncedAt,
    source: 'automate-hebdo',
    count: magasins.length,
    magasins,
  };

  if (DRY) {
    log('🧪 dry-run : aucune écriture Firestore');
    log(JSON.stringify({ version, syncedAt, count: magasins.length, source: payload.source }, null, 2));
    process.exit(0);
  }

  const credPath = ecrireCredentialsDepuisEnv();
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !credPath) {
    log('❌ FIREBASE_SERVICE_ACCOUNT manquant (secret GitHub). Ajoute le JSON du compte de service dans Settings → Secrets → Actions.');
    log('   Pour tester sans Firestore : node tools/publish-magasins-firestore.mjs --dry-run');
    process.exit(2);
  }

  // firebase-admin v12 (déjà dans functions/package.json)
  let admin;
  try { admin = await import('firebase-admin'); }
  catch (e) {
    // fallback require
    try { admin = await import('firebase-admin/app'); } catch (_) { throw new Error('firebase-admin non installé : npm i firebase-admin — ' + e.message); }
  }
  // Compat CJS / ESM
  const adm = admin.default || admin;
  if (!adm.apps || adm.apps.length === 0) {
    adm.initializeApp({
      credential: adm.credential ? adm.credential.applicationDefault() : adm.credential.applicationDefault(),
    });
  }
  const db = adm.getFirestore ? adm.getFirestore() : adm.firestore();

  log(`   Firestore → artefacts/magasins (version ${version}) …`);
  // Écriture atomique : deux docs (batch)
  const batch = db.batch();
  batch.set(db.collection('artefacts').doc('magasins'), payload, { merge: false });
  batch.set(db.collection('artefacts').doc('config'), { magasinsVersion: version, magasinsUpdatedAt: syncedAt }, { merge: true });
  await batch.commit();
  log(`✅ publié : artefacts/magasins (${payload.count} magasins, ${version}) + artefacts/config.magasinsVersion`);

  // Nettoyage clé temporaire
  if (credPath) { try { fs.unlinkSync(credPath); } catch (e) {} }
}

principal().catch((e) => {
  console.error('❌ ' + (e && e.stack || e));
  process.exit(1);
});
