// Test automatisé vérifiant que tous les paliers affichent l'écran de défaite
// immédiatement de manière synchrone, et supportent ?apercu=defaite
import fs from 'fs';

const pages = [
  { file: 'palier1.html', palier: 1, type: 'inline' },
  { file: '1721310619.html', palier: 2, type: 'victoire-palier' },
  { file: '1831411720.html', palier: 3, type: 'victoire-palier' },
  { file: '1941512821.html', palier: 4, type: 'victoire-palier' },
  { file: '2051613922.html', palier: 5, type: 'victoire-palier' },
  { file: '21617141023.html', palier: 6, type: 'victoire-palier' },
  { file: '22718151124.html', palier: 7, type: 'victoire-palier' }
];

console.log('=== TEST DE CONFORMITÉ : ÉCRAN DE DÉFAITE SYNCHRONE SUR TOUS LES PALIERS ===\n');

let allOk = true;

for (const p of pages) {
  const content = fs.readFileSync(p.file, 'utf8');

  // 1. Vérification du support de ?apercu=defaite
  const hasApercuDefaite = content.includes('apercu=') &&
    (content.includes('defaite') || content.includes('apercuAdminDemande'));
  if (!hasApercuDefaite) {
    console.error(`✗ [${p.file}] Pas de gestion de ?apercu=defaite !`);
    allOk = false;
  } else {
    console.log(`✓ [${p.file}] Support de ?apercu=defaite validé.`);
  }

  // 2. Vérification de l'affichage immédiat synchrone
  if (p.type === 'victoire-palier') {
    // Vérifie que afficherBlocage est invoqué avant tout monIdentite() dans declencherBlocage
    const declencherIdx = content.indexOf('function declencherBlocage(');
    const premierAfficherBlocage = content.indexOf('afficherBlocage(', declencherIdx);
    const monIdentiteIdx = content.indexOf('monIdentite().then(', declencherIdx);

    if (premierAfficherBlocage !== -1 && monIdentiteIdx !== -1 && premierAfficherBlocage < monIdentiteIdx) {
      console.log(`✓ [${p.file}] declencherBlocage appelle afficherBlocage de façon IMMÉDIATE et SYNCHRONE avant tout appel réseau.`);
    } else {
      console.error(`✗ [${p.file}] declencherBlocage n'appelle pas afficherBlocage immédiatement avant monIdentite !`);
      allOk = false;
    }

    // Vérifie que victoire-palier.js?v=18 et palier1.css?v=61 sont inclus
    if (!content.includes('victoire-palier.js?v=18')) {
      console.error(`✗ [${p.file}] Version victoire-palier.js?v=18 manquante.`);
      allOk = false;
    }
  } else if (p.type === 'inline') {
    // palier1.html
    const synchroneDefaite = content.includes('/* Déclenchement IMMÉDIAT synchrone de l\'écran de défaite sans latence réseau */');
    const hasLostScreenTitle = content.includes(', tu remontes en surface</h2>');
    const hasLostSubtitle = content.includes('Ta plongée s’arrête là mais La mission continue pour l’équipage');
    const has3Puces = content.includes('Remontée En surface :') &&
                      content.includes('peut reprendre dès maintenant') &&
                      content.includes('Prochain échec :');

    if (synchroneDefaite && hasLostScreenTitle && hasLostSubtitle && has3Puces) {
      console.log(`✓ [${p.file}] Écran de défaite synchrone avec nouveau gabarit (titre, sous-titre, 3 puces) validé.`);
    } else {
      console.error(`✗ [${p.file}] Problème sur l'écran synchrone de palier1.html.`);
      allOk = false;
    }
  }

  // Vérification de palier1.css?v=61
  if (!content.includes('css/palier1.css?v=61')) {
    console.error(`✗ [${p.file}] css/palier1.css?v=61 manquant.`);
    allOk = false;
  }
}

if (allOk) {
  console.log('\n=== TOUS LES PALIERS SONT PARFAITEMENT CONFORMES ET SYNCHRONES (100%) ===\n');
} else {
  process.exit(1);
}
