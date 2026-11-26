// Test automatisé vérifiant l'exclusion totale de l'équipe test de tout élément visible
// (classement, podium, sonar/radar, annonces, records, suggestions),
// tout en préservant son affichage dans le panneau d'administration.

import fs from 'fs';
import assert from 'assert';

console.log('=== TEST DE CONFORMITÉ : EXCLUSION DE L\'ÉQUIPE TEST DU SITE VISIBLE ===\n');

let allOk = true;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    allOk = false;
  }
}

// 1. CLASSEMENT & PODIUM (classement.html)
test('classement.html : isTestTeam() et filtrage dans sortTeams()', () => {
  const content = fs.readFileSync('classement.html', 'utf8');
  assert(content.includes('function isTestTeam('), 'isTestTeam() doit être défini dans classement.html');
  assert(content.includes('!isTestTeam(t)'), 'sortTeams() doit filtrer les équipes via !isTestTeam(t)');

  // Extraire la fonction isTestTeam et la tester unitairement
  const isTestMemberCode = content.match(/function isTestMember\(m\)[\s\S]*?^\s*\}/m)[0];
  const isTestTeamCode = content.match(/function isTestTeam\(team\)[\s\S]*?^\s*\}/m)[0];
  const fn = new Function(`${isTestMemberCode}\n${isTestTeamCode}\nreturn isTestTeam;`)();

  assert.strictEqual(fn({ teamCode: 'TEST' }), true, 'teamCode TEST doit être exclu');
  assert.strictEqual(fn({ teamCode: 'TEST_TEAM' }), true, 'teamCode TEST_TEAM doit être exclu');
  assert.strictEqual(fn({ teamCode: 'EQUIPE_ESSAI' }), true, 'teamCode ESSAI doit être exclu');
  assert.strictEqual(fn({ teamName: 'Équipe Test' }), true, 'teamName Test doit être exclu');
  assert.strictEqual(fn({ isTest: true }), true, 'isTest true doit être exclu');
  assert.strictEqual(fn({ teamCode: 'NEMO', teamName: 'Nemo', members: [{ codeMatelot: 'ZZZZ-0000' }] }), true, 'Équipe avec uniquement membres test doit être exclue');
  assert.strictEqual(fn({ teamCode: 'NEMO', teamName: 'Nemo', members: [{ codeMatelot: 'ABCD-1234', name: 'Alice' }] }), false, 'Équipe valide ne doit pas être exclue');
});

// 2. RECORDS PAR PALIER (records-palier.js)
test('records-palier.js : blocage enregistrement et filtrage affichage pour équipe/matelot test', () => {
  const content = fs.readFileSync('records-palier.js', 'utf8');
  assert(content.includes('/test|essai/i.test(equipage)'), 'enregistrer() doit bloquer equipage test/essai');
  assert(content.includes('/test|concepteur|zzzz-0000/i.test(matelot)'), 'enregistrer() doit bloquer matelot test/concepteur');
  assert(content.includes('chargerEtRendre'), 'chargerEtRendre doit exister');
  assert(content.includes('indexOf(\'test\')') || content.includes('.includes(\'test\')'), 'chargerEtRendre doit filtrer les records test existants');
});

// 3. ÉQUIPAGE ACTIF (equipage-actif.js)
test('equipage-actif.js : estEquipeTest() et filtrage dans renderCrew()', () => {
  const content = fs.readFileSync('equipage-actif.js', 'utf8');
  assert(content.includes('function estEquipeTest('), 'estEquipeTest() doit être défini dans equipage-actif.js');
  assert(content.includes('estEquipeTest(team)'), 'renderCrew() doit ignorer les équipes test');
});

// 4. ANNONCES DE PALIER (palier-annonces.js)
test('palier-annonces.js : isTestTeam() et exclusion dans collectUnseenEvents()', () => {
  const content = fs.readFileSync('palier-annonces.js', 'utf8');
  assert(content.includes('function isTestTeam('), 'isTestTeam() doit être défini dans palier-annonces.js');
  assert(content.includes('isTestTeam(t)'), 'collectUnseenEvents() doit ignorer les équipes test');

  const fnMatch = content.match(/function isTestTeam\(t\)[\s\S]*?^\s*\}/m);
  assert(fnMatch, 'isTestTeam function found');
  const fn = new Function(`${fnMatch[0]}\nreturn isTestTeam;`)();
  assert.strictEqual(fn({ teamCode: 'TEST' }), true);
  assert.strictEqual(fn({ isTest: true }), true);
  assert.strictEqual(fn({ teamCode: 'NAUTILUS', teamName: 'Nautilus' }), false);
});

// 5. ACCUEIL, SONAR, RADAR, INSCRIPTION (index.html)
test('index.html : filtrage public strict et conservation admin', () => {
  const content = fs.readFileSync('index.html', 'utf8');
  assert(content.includes('function isTestTeam('), 'isTestTeam() doit être défini dans index.html');
  assert(content.includes('const publicTeams = teams.filter(t => !isTestTeam(t));'), 'loadTeams() doit filtrer publicTeams');
  assert(content.includes('syncTeamsUI(publicTeams);'), 'syncTeamsUI() doit être appelée avec publicTeams');
  assert(content.includes('!isTestTeam(t)'), 'syncTeamsUI() active filter doit exclure isTestTeam');
  assert(content.includes('if(isTestTeam(t)) return \'\';'), 'teamCardHtml() ne doit pas générer de carte pour l\'équipe test');
  assert(content.includes('pickBalancedTeam(candidateTeams, service)'), 'registerMember() doit équilibrer uniquement sur candidateTeams sans test');
  assert(content.includes('refreshAdminTeams(teams);'), 'refreshAdminTeams() doit recevoir toutes les équipes pour le panneau admin');

  // getMeilleurPalierAtteint
  assert(content.includes('window.isTestTeam = isTestTeam;'), 'window.isTestTeam doit être exposé globalement');
  assert(content.includes('window.isTestMatelotMember = isTestMatelotMember;'), 'window.isTestMatelotMember doit être exposé globalement');
  const gmpaStart = content.indexOf('function getMeilleurPalierAtteint()');
  const gmpaEnd = content.indexOf('return maxRank;', gmpaStart);
  assert(gmpaStart !== -1 && gmpaEnd !== -1, 'getMeilleurPalierAtteint trouvé');
  const gmpaCode = content.slice(gmpaStart, gmpaEnd);
  assert(gmpaCode.includes('isTestTeam(t)'), 'getMeilleurPalierAtteint doit ignorer les équipes test');
});

// 6. CACHE & SERVICE WORKER (sw.js)
test('sw.js : version du cache incrémentée et cohérence des versions precache', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert(sw.includes('equipage-actif.js?v=11'), 'sw.js doit inclure equipage-actif.js?v=11');
  assert(sw.includes('palier-annonces.js?v=6'), 'sw.js doit inclure palier-annonces.js?v=6');
  assert(sw.includes('records-palier.js?v=3'), 'sw.js doit inclure records-palier.js?v=3');
});

console.log('\n------------------------------------------------------------');
if (allOk) {
  console.log('TOUS LES TESTS DE NON-VISIBILITÉ DE L\'ÉQUIPE TEST SONT VALIDÉS (100%) !');
} else {
  console.error('DES ERREURS ONT ÉTÉ DÉTECTÉES !');
  process.exit(1);
}
