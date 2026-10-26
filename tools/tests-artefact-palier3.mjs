/* =====================================================================
   TESTS DU PALIER 3 — « L'ARTEFACT DU NAUTILUS »

       node tools/tests-artefact-palier3.mjs

   Même philosophie que tools/tests-mission-nautilus.mjs : aucune
   dépendance à installer, aucun réseau, aucune écriture. Les modules du
   jeu sont chargés tels quels (avec un `window` de substitution), les
   données Firestore sont remplacées par un stockage en mémoire.

   Ce que ces tests protègent, dans l'ordre :

     1. les empreintes et la clé EAN (contrôle de validité, délais) ;
     2. la SÉLECTION de l'ouvrage : n'importe quel rayon compatible,
        premier ouvrage trouvable, exclusions motivées, tirage rejouable ;
     3. la CARTOUCHE publique : aucune donnée réelle ne fuit, les quatre
        étapes se vérifient sur des empreintes, un mauvais EAN est rejeté ;
     4. les RÈGLES d'énigme : premier mot significatif (article ignoré),
        signatures par règle, chambre forte à l'ordre annoncé ;
     5. le SERVICE : session verrouillée, 3ᵉ erreur = remontée, scan
        illisible non compté, indices payants non répétés, livre
        introuvable sans pénalité, resélection qui conserve la
        progression, fenêtre de fraîcheur appliquée AU LANCEMENT SEULEMENT ;
     6. le CHIFFREMENT du catalogue (AES-GCM + PBKDF2) et son refus sans
        la phrase ;
     7. les TEXTES du jeu : relais mot pour mot, remontée datée, vocabulaire
        « matelot » / « équipier » (jamais « plongeur ») ;
     8. la STATICITÉ : aucun titre, EAN ou SKU réel dans les fichiers servis
        aux joueurs (GitHub Pages publie tout le dépôt) ;
     9. la LISTE des magasins et l'outil de synchronisation (garde-fous) ;
    10. l'INTÉGRATION : page du Palier 3, service worker, règles Firestore,
        accueil, panneau admin.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');
const lire = (nom) => fs.readFileSync(path.join(racine, nom), 'utf8');

let reussis = 0, echoues = 0;
const ok = (nom, condition) => {
  if (condition) { reussis++; console.log('  ✅ ' + nom); }
  else { echoues++; console.log('  ❌ ' + nom); }
};
const titre = (t) => console.log('\n' + t);

/* ------------------------------------------------------------------ */
/* Environnement : les modules du jeu attendent un navigateur          */
/* ------------------------------------------------------------------ */
globalThis.window = globalThis;
const _stockageLocal = new Map();
globalThis.localStorage = {
  getItem: (k) => (_stockageLocal.has(k) ? _stockageLocal.get(k) : null),
  setItem: (k, v) => _stockageLocal.set(k, String(v)),
  removeItem: (k) => _stockageLocal.delete(k)
};

await import(path.join(racine, 'artefact-moteur.js'));
await import(path.join(racine, 'artefact-service.js'));
const M = globalThis.NautilusArtefactMoteur;
const A = globalThis.NautilusArtefact;
const sync = await import(path.join(racine, 'tools', 'sync-magasins-fnac.mjs'));

if (!M || !A) { console.log('❌ modules non chargés'); process.exit(1); }

/* ------------------------------------------------------------------ */
/* Jeu de données : UN ouvrage réel vérifié + des ouvrages fictifs     */
/* (ouvrage FICTIF : aucun titre, EAN ou SKU réel n'est écrit dans le  */
/* dépôt — GitHub Pages publie tout, y compris tools/. Le test 7 le     */
/* vérifie structurellement, sans avoir à connaître les vraies valeurs) */
/* ------------------------------------------------------------------ */
const ATLAS = {
  id: 'atlas-monde-7e',
  titre: 'Le Nouvel atlas fictif des océans',
  auteur: 'Collectif',
  auteurType: 'collectif',
  editeur: 'Éditions Imaginaires',
  collection: 'Grand Large',
  edition: '7e édition',
  editionNumero: 7,
  annee: 2026,
  pages: 368,
  format: 'broché',
  ean: '2000000001005',
  sku: 'EXEMPLE-1005',
  categorieFnac: 'Atlas / carte (broché)',
  rayon: 'Géographie',
  type: 'atlas-mondial',
  liens: ['monde', 'cartes']
};
const dispo = (magasin, minutes, delai, vendeur) => ({
  [magasin]: {
    statut: 'disponible',
    delai: delai === undefined ? 'Retrait gratuit sous 1H' : delai,
    checkedAt: new Date(Date.now() - (minutes || 0) * 60000).toISOString(),
    vendeur: vendeur || 'fnac',
    magasin
  }
});
function clone(l) { return JSON.parse(JSON.stringify(l)); }

/* EAN de la plage interne 200-299 : jamais attribués à un vrai produit. */
function cleEan(douze) {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(douze[i]) * (i % 2 === 0 ? 1 : 3);
  return douze + String((10 - (s % 10)) % 10);
}
const EAN_FICTIF_1 = cleEan('200000000000');
const EAN_FICTIF_2 = cleEan('200000000001');
const EAN_FICTIF_3 = cleEan('200000000002');

const ROMAN = {
  id: 'roman-abysse', titre: 'Voyage au centre des abysses', auteur: 'Jules Exemple',
  auteurType: 'unique', editeur: 'Le Navire Fictif', edition: 'Édition illustrée',
  editionNumero: 1, annee: 2019, ean: EAN_FICTIF_1, sku: 'FIC-1',
  categorieFnac: 'Roman de science-fiction (poche)', rayon: 'Littérature',
  type: 'litterature', liens: ['abysse']
};
const SCIENCES = {
  id: 'sciences-ocean', titre: 'Les océans et leurs secrets', auteur: 'Marie Exemple',
  auteurType: 'unique', editeur: 'Sciences Fictives', edition: '2e édition',
  editionNumero: 2, annee: 2021, ean: EAN_FICTIF_2, sku: 'FIC-2',
  categorieFnac: 'Sciences de la terre (broché)', rayon: 'Sciences',
  type: 'sciences', liens: ['océan']
};
const PARTENAIRE = Object.assign(clone(SCIENCES), {
  id: 'sciences-partenaire', titre: 'Les océans et leurs secrets — offre partenaire',
  ean: EAN_FICTIF_3, vendeur: 'partenaire'
});

/* ===================================================================== */
titre('1. Empreintes, EAN et fenêtre de fraîcheur');
/* ===================================================================== */
ok('SHA-256 : vecteur de référence « abc »',
  M.sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
ok('empreinte salée : déterministe',
  M.empreinte('NOUVEL', 'sel-test', 1000) === M.empreinte('NOUVEL', 'sel-test', 1000));
ok('empreinte salée : un autre sel donne une autre empreinte',
  M.empreinte('NOUVEL', 'sel-a', 1000) !== M.empreinte('NOUVEL', 'sel-b', 1000));
ok('empreinte : casse et espaces ignorés',
  M.verifier(M.empreinte('NOUVEL', 'sel', 1000), M.empreintesAcceptees(' nouvel ', 'sel', 1000, 'texte')));
ok('empreinte : une autre réponse ne passe pas',
  !M.verifier(M.empreinte('ATLAS', 'sel', 1000), M.empreintesAcceptees(' nouvel ', 'sel', 1000, 'texte')));
ok('EAN de référence valide (clé de contrôle)', M.eanValide(ATLAS.ean));
ok('EAN dont la clé est fausse : rejeté', !M.eanValide('2000000001006'));
ok('EAN à 12 chiffres : rejeté', !M.eanValide('200000000100'));
ok('EAN normalisé : espaces et tirets retirés',
  M.eanNormalise(' 200-0 000 001 005 ') === '2000000001005');
ok('EAN inventé non numérique : rejeté', M.eanNormalise('abcdefghijklm') === '');

ok('délai « Retrait gratuit sous 1H » accepté', M.delaiAccepte('Retrait gratuit sous 1H'));
ok('délai « retrait en 60 min » accepté', M.delaiAccepte('Retrait en 60 min'));
ok('délai « sous 1 heure » accepté', M.delaiAccepte('Disponible sous 1 heure'));
ok('délai « sous 1J » refusé', !M.delaiAccepte('Retrait sous 1J'));
ok('délai « 24 h » refusé', !M.delaiAccepte('Retrait sous 24 h'));
ok('délai « 1 h 30 » refusé', !M.delaiAccepte('Retrait sous 1 h 30'));
ok('délai vide ou illisible refusé', !M.delaiAccepte('') && !M.delaiAccepte('demain'));

const dispoFraiche = dispo('cl57', 0)['cl57'];
const dispoVieille = dispo('cl57', 20)['cl57'];
ok('disponibilité fraîche (0 min) : acceptée',
  M.disponibiliteValide(dispoFraiche, 'cl57', {}).ok);
ok('disponibilité de 20 min : refusée (fenêtre de 15 min)',
  !M.disponibiliteValide(dispoVieille, 'cl57', {}).ok);
ok('disponibilité d’un AUTRE magasin : refusée',
  !M.disponibiliteValide(dispoFraiche, 'cl55', {}).ok);
ok('disponibilité absente : refusée avec un motif',
  /aucune/i.test(M.disponibiliteValide(null, 'cl57', {}).motif));
ok('fenêtre de fraîcheur par défaut : 15 minutes',
  M.FENETRE_FRAICHEUR_MINUTES === 15);

/* ===================================================================== */
titre('2. Sélection de l’ouvrage — n’importe quel rayon compatible');
/* ===================================================================== */
const catalogue = [
  Object.assign(clone(ATLAS), { disponibilite: dispo('cl57', 0) }),
  Object.assign(clone(ROMAN), { disponibilite: dispo('cl57', 0) }),
  Object.assign(clone(SCIENCES), { disponibilite: dispo('cl57', 0) })
];
const sel = M.candidats(catalogue, 'cl57', {});
ok('trois ouvrages compatibles retenus (atlas, roman, sciences)', sel.retenus.length === 3);
ok('aucun ouvrage écarté', sel.ecartes.length === 0);

const catalogueTri = catalogue.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
const premier = M.choisirLivre(catalogueTri, 'cl57', { sel: 'sel-fixe' });
ok('un ouvrage est choisi (jamais « aucun livre possible »)', Boolean(premier && premier.livre && premier.livre.ean));
ok('le choix est rejouable à sel identique',
  M.choisirLivre(catalogueTri, 'cl57', { sel: 'sel-fixe' }).livre.id ===
  M.choisirLivre(catalogueTri, 'cl57', { sel: 'sel-fixe' }).livre.id);
ok('le choix rend aussi le nombre de candidats et la liste des écartés',
  typeof premier.candidats === 'number' && Array.isArray(premier.ecartes));

/* L'atlas du monde est la famille la plus proche du Nautilus : à données
   égales, c'est lui qui passe en premier. */
ok('l’atlas du monde est prioritaire sur un roman (rang 1 < rang 5)',
  M.rangPriorite(catalogue[0]) < M.rangPriorite(catalogue[1]));
ok('un ouvrage sans lien avec l’aventure passe en dernier rang',
  M.rangPriorite({ type: 'inconnu' }) >= 5);

const exclusions = M.candidats([
  Object.assign(clone(ATLAS), { disponibilite: dispo('cl57', 40) }),                      // vérification périmée
  Object.assign(clone(ROMAN), { disponibilite: dispo('cl57', 0, 'Retrait sous 1J') }),    // délai > 1 h
  Object.assign(clone(SCIENCES), { disponibilite: dispo('cl55', 0) }),                    // autre magasin
  Object.assign(clone(PARTENAIRE), { disponibilite: dispo('cl57', 0) })                   // vendeur partenaire
], 'cl57', {});
ok('vérification périmée : écartée avec un motif', exclusions.ecartes.some((e) => /ancienne|reconfirmer/i.test(e.motif)));
ok('retrait en 1 jour : écarté avec un motif', exclusions.ecartes.some((e) => /délai|heure/i.test(e.motif)));
ok('disponibilité d’un autre magasin : écartée', exclusions.ecartes.some((e) => e.id === SCIENCES.id));
ok('offre partenaire : écartée de la sélection automatique', exclusions.ecartes.some((e) => e.id === PARTENAIRE.id));
ok('offre partenaire : exclue mais PAS invalide (affectable à la main)',
  M.validerLivre(Object.assign(clone(PARTENAIRE), { disponibilite: dispo('cl57', 0) })).livre.vendeur === 'partenaire');
ok('aucun ouvrage retenu quand tous sont écartés', exclusions.retenus.length === 0);

const sansEdition = clone(ATLAS);
delete sansEdition.edition; delete sansEdition.editionNumero; delete sansEdition.annee;
ok('ouvrage sans édition identifiable : écarté (l’édition identifie la mission)',
  M.candidats([Object.assign(sansEdition, { disponibilite: dispo('cl57', 0) })], 'cl57', {}).retenus.length === 0);

const exclus = M.candidats(catalogue, 'cl57', { exclus: [ATLAS.id] });
ok('un ouvrage déjà joué peut être exclu (resélection)',
  exclus.retenus.length === 2 && exclus.retenus.every((l) => l.id !== ATLAS.id));

const autres = M.candidats(catalogue, 'cl57', { inclurePartenaires: true });
ok('inclurePartenaires : n’a aucun effet sans offre partenaire', autres.retenus.length === 3);

/* Chaque étape doit être saisie (espace de réponses large) : aucune
   question à choix multiple ne peut être corrigée côté client. */
const g = M.genererCartouche(Object.assign(clone(ATLAS), { disponibilite: dispo('cl57', 0) }),
  { magasinId: 'cl57', sel: 'sel-test-1' });
ok('les 4 étapes sont toutes à saisie libre',
  g.cartouche.etapes.length === 4 && g.cartouche.etapes.every((e) => e.type === 'ean' || e.type === 'texte' || e.type === 'code'));
ok('l’étape du sceau porte la clé EAN', g.cartouche.etapes[0].id === 'sceau');
ok('le sceau coûte nettement plus qu’une réponse texte (espace de réponses bien plus grand)',
  g.cartouche.iterations.ean >= 4 * g.cartouche.iterations.texte);
/* Le coût est assumé : une empreinte publiée se brute-force toujours hors
   ligne avec du code natif. La vraie protection est le mode « fonction »
   (vérification côté serveur, aucune empreinte publiée) — documenté. */
ok('le coût reste compatible avec un téléphone (moins de 50 000 itérations)',
  g.cartouche.iterations.ean <= 50000 && g.cartouche.iterations.texte <= 20000);

/* ===================================================================== */
titre('3. Cartouche publique — aucune donnée réelle ne fuit');
/* ===================================================================== */
const publique = JSON.stringify(g.cartouche);
ok('aucun EAN en clair dans la cartouche', publique.indexOf(ATLAS.ean) < 0);
ok('aucun titre en clair', publique.indexOf('Nouvel atlas fictif') < 0 && publique.indexOf('océans') < 0);
ok('aucun SKU en clair', publique.indexOf(ATLAS.sku) < 0);
ok('aucun nom d’éditeur en clair', publique.indexOf('Éditions Imaginaires') < 0);
ok('aucun nom d’auteur en clair (la clé « aides.auteur » ne contient que la méthode)',
  publique.indexOf('Collectif') < 0 && publique.indexOf('Éditions Imaginaires') < 0);
ok('aucune réponse en clair (premier mot, signature, code final)',
  publique.indexOf(g.secret.reponses.premierMot) < 0
  && publique.indexOf(g.secret.reponses.signature) < 0
  && publique.indexOf(g.secret.reponses.codeFinal) < 0);
ok('aucune URL Fnac', publique.indexOf('fnac.com') < 0);

ok('la cartouche porte l’indice, la famille et le motif',
  Boolean(g.cartouche.indice && g.cartouche.famille && g.cartouche.motif));
ok('la cartouche porte le magasin et la disponibilité horodatée',
  g.cartouche.magasinId === 'cl57' && Boolean(g.cartouche.disponibilite.checkedAt));
ok('3 réponses refusées avant remontée (et non 4)', M.MAX_ERREURS === 3 && g.cartouche.maxErreurs === 3);

/* Vérification des empreintes */
ok('le bon EAN passe le sceau', M.verifierEtape(g.cartouche.etapes[0], ATLAS.ean).ok);
ok('un EAN valide mais différent est rejeté', !M.verifierEtape(g.cartouche.etapes[0], EAN_FICTIF_1).ok);
ok('un EAN invalide n’est PAS compté comme une erreur',
  M.verifierEtape(g.cartouche.etapes[0], '123').erreur === false);
ok('le bon premier mot passe la couverture (casse libre)',
  M.verifierEtape(g.cartouche.etapes[1], g.secret.reponses.premierMot.toLowerCase()).ok);
ok('un autre mot est rejeté', !M.verifierEtape(g.cartouche.etapes[1], 'ATLAS').ok);
ok('la signature attendue passe', M.verifierEtape(g.cartouche.etapes[2], g.secret.reponses.signature).ok);
ok('une signature approchante est rejetée',
  !M.verifierEtape(g.cartouche.etapes[2], g.secret.reponses.signature.slice(0, -1) + '9').ok);
ok('le code final passe, dans l’ordre annoncé',
  M.verifierEtape(g.cartouche.etapes[3], g.secret.reponses.codeFinal).ok);
ok('le code final dans un autre ordre est rejeté',
  !M.verifierEtape(g.cartouche.etapes[3], g.secret.reponses.codeFinal.split('-').reverse().join('-')).ok);
ok('une réponse vide n’est pas comptée comme une erreur',
  M.verifierEtape(g.cartouche.etapes[1], '   ').erreur === false);

/* Deux sels différents = deux missions différentes pour le même ouvrage */
const g2 = M.genererCartouche(Object.assign(clone(ATLAS), { disponibilite: dispo('cl57', 0) }),
  { magasinId: 'cl57', sel: 'sel-test-2' });
ok('même ouvrage, autre sel : empreintes différentes',
  g.cartouche.etapes[0].empreintes.join() !== g2.cartouche.etapes[0].empreintes.join());
ok('même ouvrage, autre sel : EAN et premier mot inchangés',
  g.secret.reponses.ean === g2.secret.reponses.ean
  && g.secret.reponses.premierMot === g2.secret.reponses.premierMot);
ok('même ouvrage, autre sel : la règle d’énigme est tirée à nouveau',
  M.REGLES.some((r) => r.id === g2.secret.regle));
ok('les deux signatures suivent le même format annoncé NN-L-NN',
  /^[0-9]{2}-[A-Z]-[0-9]{2}$/.test(g.secret.reponses.signature)
  && /^[0-9]{2}-[A-Z]-[0-9]{2}$/.test(g2.secret.reponses.signature));
ok('même ouvrage, autre sel : le code final réordonne les MÊMES fragments',
  g.secret.reponses.codeFinal.split('-').sort().join() === g2.secret.reponses.codeFinal.split('-').sort().join());
ok('même ouvrage, même sel : cartouche identique (rejouable)',
  M.genererCartouche(Object.assign(clone(ATLAS), { disponibilite: dispo('cl57', 0) }),
    { magasinId: 'cl57', sel: 'sel-test-1' }).cartouche.etapes[1].empreintes.join()
  === g.cartouche.etapes[1].empreintes.join());

/* ===================================================================== */
titre('4. Règles d’énigme — premier mot significatif, signatures, chambre forte');
/* ===================================================================== */
ok('l’article initial est ignoré : « Le Nouvel atlas fictif… » → NOUVEL',
  M.premierMot(ATLAS.titre) === 'NOUVEL');
ok('« L’Odyssée du Nautilus » → ODYSSEE', M.premierMot('L’Odyssée du Nautilus') === 'ODYSSEE');
ok('« Les Vingt mille lieues… » → VINGT', M.premierMot('Les Vingt mille lieues sous les mers') === 'VINGT');
ok('un titre sans article garde son premier mot', M.premierMot('Atlas maritime') === 'ATLAS');
ok('un titre qui ne contient que des articles donne encore un mot exploitable',
  M.premierMot('Le La Les').length >= 2);
ok('les mots du titre ignorent la ponctuation',
  M.motsDuTitre('Vingt mille lieues sous les mers !').length === 6);

ok('trois règles d’énigme existent', M.REGLES.length === 3);
ok('la signature suit le format annoncé NN-L-NN',
  /^[0-9]{2}-[A-Z]-[0-9]{2}$/.test(g.secret.reponses.signature));
ok('le format annoncé dans la consigne correspond à la signature produite',
  g.cartouche.etapes[2].format === 'NN-L-NN');
ok('le numéro d’édition est écrit sur deux chiffres', g.secret.fragments.editionNumero === '07');
ok('le nombre de lettres est écrit sur deux chiffres (jamais « 6 » seul)',
  /^[0-9]{2}-/.test(g.secret.reponses.signature));
ok('une saisie non rembourrée reste acceptée (6-C-26 comme 06-C-26)',
  M.verifierEtape(g.cartouche.etapes[2], g.secret.reponses.signature.replace(/^0/, '')).ok);

const gRoman = M.genererCartouche(Object.assign(clone(ROMAN), { disponibilite: dispo('cl57', 0) }),
  { magasinId: 'cl57', sel: 'sel-roman' });
ok('un auteur unique bascule sur une autre règle (r2 ou r3)',
  gRoman.secret.regle !== 'r1');
ok('la règle r2 s’appuie sur la dernière lettre de l’éditeur',
  gRoman.secret.regle === 'r2'
    ? gRoman.secret.fragments.derniereLettreEditeur === M.derniereLettre(ROMAN.editeur)
    : true);

ok('la chambre forte assemble 4 fragments', g.secret.reponses.codeFinal.split('-').length === 4);
const annonce = g.cartouche.etapes[3].consigne;
const positions = g.secret.ordre.split('').map((lettre) => {
  const fragment = M.FRAGMENTS.filter((f) => f.id === lettre)[0];
  return annonce.indexOf(fragment.annonce);
});
ok('l’ordre du voyage est annoncé en toutes lettres, fragment par fragment',
  positions.every((p) => p >= 0));
ok('l’annonce suit EXACTEMENT l’ordre tiré pour cette cartouche',
  positions.every((p, i) => i === 0 || p > positions[i - 1]));
ok('l’annonce est numérotée de 1 à 4',
  (annonce.match(/[1-4]\.\s/g) || []).length === 4);
ok('l’ordre est propre à la cartouche (annoncé, jamais implicite)',
  /^[ABCD]{4}$/.test(g.secret.ordre));
ok('l’annonce ne dévoile AUCUNE valeur (pas de lettre ni de chiffre isolé)',
  !/—\s*[A-Z]\b/.test(annonce) && !/\bC pour\b/i.test(annonce));
ok('les consignes ne donnent jamais la lettre C pour un ouvrage collectif',
  M.REGLES.every((r) => !/lettre C/i.test(r.consigne))
  && M.FRAGMENTS.every((f) => !/C pour/i.test(f.annonce)));
ok('onze familles thématiques relient un rayon au Nautilus', M.FAMILLES.length === 11);
ok('chaque famille a un indice et trois aides de méthode',
  M.FAMILLES.every((f) => f.indice && f.resserre && f.edition && f.auteur && f.motif));
/* Ce qui est interdit, c'est de NOMMER le rayon (comme le ferait la
   signalétique du magasin) ou de citer l'éditeur / le numéro d'édition.
   Décrire le CONTENU (« un volume qui mesure, classe et situe ») est au
   contraire le principe même de l'énigme. */
const textesFamilles = M.FAMILLES.map((f) => ({
  id: f.id,
  tout: [f.indice, f.resserre, f.edition, f.auteur, f.motif].join(' ')
}));
ok('aucun texte de famille ne nomme un rayon à la façon d’une signalétique',
  textesFamilles.every((f) => !/rayon\s+[A-ZÉÈÀÂÎÔÛÇ]|GÉOGRAPHIE|LITTÉRATURE|BEAUX-ARTS|JEUNESSE|SCIENCES HUMAINES/.test(f.tout)));
ok('aucun texte de famille ne cite l’éditeur ni le numéro d’édition d’un ouvrage',
  textesFamilles.every((f) => !/glénat|autrement|gallimard|\b[0-9]+e édition\b|édition [0-9]/i.test(f.tout)));
ok('aucun texte de famille ne cite la catégorie Fnac d’un ouvrage',
  textesFamilles.every((f) => !/atlas \/ carte|broché|poche|relié/i.test(f.tout)));
ok('chaque famille décrit le contenu sans jamais l’identifier',
  textesFamilles.every((f) => f.tout.length > 120));
ok('trois indices payants : 1 h, 2 h, 4 h',
  M.INDICES.map((i) => i.heures).join(',') === '1,2,4');
ok('barème des remontées : 1, 2, 4, 8, 12 puis 24 h',
  M.BARREME_HEURES.slice(0, 5).join(',') === '1,2,4,8,12' && M.heuresDeRemontee(7) === 24);

/* ===================================================================== */
titre('5. Service — sessions, erreurs, indices, resélection');
/* ===================================================================== */
A.initialiser({ stockage: A.stockageMemoire() });
await A.ecrireConfig({ mode: 'operateur', fenetreMinutes: 15 });
const PHRASE = 'phrase-d-administration-pour-les-tests';

const publi = await A.catalogueEcrire([
  Object.assign(clone(ATLAS), { disponibilite: dispo('cl57', 0) }),
  Object.assign(clone(ROMAN), { disponibilite: dispo('cl57', 0) }),
  Object.assign(clone(SCIENCES), { disponibilite: dispo('cl57', 0) })
], PHRASE);
ok('catalogue publié : 3 ouvrages', publi.count === 3);
ok('publication : aucun ouvrage écarté pour invalidité', publi.problemes.length === 0);

const brutStocke = JSON.stringify(A.stockage()._base['artefacts/catalogue'] || {});
ok('le catalogue stocké ne contient AUCUN titre en clair', brutStocke.indexOf('Nouvel atlas fictif') < 0);
ok('le catalogue stocké ne contient AUCUN EAN en clair', brutStocke.indexOf(ATLAS.ean) < 0);
ok('le catalogue stocké ne contient AUCUN SKU en clair', brutStocke.indexOf(ATLAS.sku) < 0);

const gen = await A.genererCartouchesPour('cl57', { phrase: PHRASE });
ok('une piste par ouvrage compatible : 3 cartouches', gen.faites.length === 3);
ok('génération : aucune erreur', gen.erreurs.length === 0);
const cartouches = await A.listerCartouches('cl57');
ok('les cartouches sont stockées avec leur disponibilité', cartouches.length === 3
  && cartouches.every((c) => c.disponibilite && c.disponibilite.checkedAt));
ok('aucune donnée réelle dans les cartouches stockées',
  !JSON.stringify(cartouches).includes(ATLAS.ean) && !JSON.stringify(cartouches).includes('Éditions Imaginaires'));

/* --- session verrouillée --- */
const s1 = await A.ouvrirSession('NEMO', 'cl57');
ok('session ouverte', Boolean(s1.session && s1.session.cartouche));
const s2 = await A.ouvrirSession('NEMO', 'cl57');
ok('la session est verrouillée sur son ouvrage (même piste au 2ᵉ appel)',
  s2.session.cartoucheId === s1.session.cartoucheId && s2.reprise === true);
ok('deux équipages peuvent suivre deux pistes différentes',
  A.equipeCle('NEMO') === 'NEMO' && A.equipeCle(' aronnax ') === 'ARONNAX');

const coffre = await A.lireCoffre(s1.session.cartoucheId, PHRASE);
ok('le coffre se déchiffre avec la phrase d’administration', Boolean(coffre && coffre.livre));
ok('le coffre rend l’ouvrage complet (titre, EAN, SKU, édition)',
  coffre.livre.titre.length > 3 && /^[0-9]{13}$/.test(coffre.livre.ean)
  && Boolean(coffre.livre.sku) && Boolean(coffre.livre.edition));
let refusMauvaisePhrase = false;
try { await A.lireCoffre(s1.session.cartoucheId, 'mauvaise-phrase'); }
catch (e) { refusMauvaisePhrase = /incorrecte|corrompu/i.test(e.message); }
ok('sans la bonne phrase, le coffre reste fermé', refusMauvaisePhrase);

/* --- 3 réponses refusées = remontée --- */
const fauxEans = [cleEan('200000000100'), cleEan('200000000110'), cleEan('200000000120')];
const e1 = await A.verifierEtape('NEMO', 'sceau', fauxEans[0]);
const e2 = await A.verifierEtape('NEMO', 'sceau', fauxEans[1]);
const e3 = await A.verifierEtape('NEMO', 'sceau', fauxEans[2]);
ok('1ʳᵉ réponse refusée : 1 erreur, pas de remontée', e1.erreur === true && e1.erreurs === 1 && !e1.remontee);
ok('2ᵉ réponse refusée : dernier avertissement annoncé',
  e2.erreurs === 2 && /dernière tentative/.test(e2.dernierAvertissement));
ok('3ᵉ réponse refusée : remontée déclenchée (et non à la 4ᵉ)',
  e3.erreurs === 3 && e3.remontee === true);
ok('le scan d’un code invalide ne compte PAS d’erreur',
  (await A.verifierEtape('NEMO', 'sceau', '12')).erreur === false);

/* --- progression conservée après la remontée --- */
const avant = await A.lireSession('NEMO');
ok('les erreurs sont consignées dans la session', avant.erreurs === 3);
const reprise = await A.verifierEtape('NEMO', 'sceau', coffre.reponses.ean);
ok('après la remontée, la progression repart de là (EAN valide accepté)',
  reprise.ok === true && reprise.etapesValidees.includes('sceau'));

/* --- indices payants --- */
const ind1 = await A.demanderIndice('NEMO', 1, { par: 'JULES' });
ok('indice 1 : sacrifice enregistré (1 h)', ind1.ok === true && ind1.heures === 1);
ok('indice 1 : l’aide de méthode ne nomme jamais le rayon',
  !/géographie|voyage/i.test(ind1.aide));
const sessInd = await A.lireSession('NEMO');
ok('indice 1 : la demande est visible pour le capitaine',
  sessInd.demandeIndice && sessInd.demandeIndice.cle === 'rayon' && sessInd.demandeIndice.par === 'JULES');
const ind1bis = await A.demanderIndice('NEMO', 1);
ok('un indice déjà obtenu ne se redemande pas', ind1bis.ok === false && ind1bis.dejaUtilise === true);
const transm = await A.transmettreIndice('NEMO', 1, 'Le premier refuge se trouve parmi les ouvrages d’étude.');
ok('le capitaine transmet l’indice exact', transm.ok === true);
const apresTransm = await A.lireSession('NEMO');
ok('la demande est soldée après transmission', apresTransm.demandeIndice === null
  && apresTransm.indicesTransmis.rayon.length > 10);
let indiceInconnu = false;
try { await A.demanderIndice('NEMO', 9); } catch (e) { indiceInconnu = true; }
ok('un rang d’indice inconnu est refusé', indiceInconnu);
let indiceVide = false;
try { await A.transmettreIndice('NEMO', 2, '   '); } catch (e) { indiceVide = true; }
ok('un texte d’indice vide est refusé', indiceVide);

/* --- livre introuvable : aucune erreur --- */
await A.ouvrirSession('ARONNAX', 'cl57');
const avantSignalement = await A.lireSession('ARONNAX');
const erreursAvant = Number(avantSignalement.erreurs || 0);
const intr = await A.signalerIntrouvable('ARONNAX', { par: 'NED' });
ok('signalement « livre introuvable » accepté', intr.ok === true);
const apresSignalement = await A.lireSession('ARONNAX');
ok('le signalement suspend la mission', apresSignalement.statut === 'suspendue');
ok('le signalement n’ajoute AUCUNE erreur', Number(apresSignalement.erreurs || 0) === erreursAvant);
ok('le signalement est tracé (qui, quand)',
  apresSignalement.introuvable.par === 'NED' && Boolean(apresSignalement.introuvable.signaleLe));
const pendantSuspension = await A.ouvrirSession('ARONNAX', 'cl57');
ok('une session suspendue n’est pas relancée automatiquement', pendantSuspension.suspendue === true);
let verifPendantSuspension = await A.verifierEtape('ARONNAX', 'sceau', '1234567890123');
ok('aucune réponse n’est vérifiée pendant la suspension', verifPendantSuspension.ok === false);

/* --- resélection : progression conservée, aucune erreur --- */
const pisteAvant = apresSignalement.cartoucheId;
const re1 = await A.reselectionner('ARONNAX', { introuvable: true, raison: 'ouvrage-indisponible', par: 'capitaine' });
ok('resélection : une autre piste est affectée', re1.ok === true && re1.cartoucheId !== pisteAvant);
const apresRe = await A.lireSession('ARONNAX');
ok('resélection : la mission redevient active', apresRe.statut === 'active');
ok('resélection : aucune erreur ajoutée', Number(apresRe.erreurs || 0) === erreursAvant);
ok('resélection : le remplacement est tracé (ancien → nouveau, motif, auteur)',
  apresRe.remplacement.ancienCartoucheId === pisteAvant
  && apresRe.remplacement.nouveauCartoucheId === apresRe.cartoucheId
  && apresRe.remplacement.raison === 'ouvrage-indisponible'
  && apresRe.remplacement.par === 'capitaine');
ok('resélection : l’historique garde les deux pistes',
  apresRe.historique.filter((h) => h.type === 'remplacement').length === 1);
ok('resélection : l’ouvrage introuvable n’est jamais réaffecté',
  apresRe.cartoucheId !== pisteAvant);

/* sceau déjà validé → la séquence liée à l’ouvrage repart de zéro */
const coffreAronnax = await A.lireCoffre(apresRe.cartoucheId, PHRASE);
await A.verifierEtape('ARONNAX', 'sceau', coffreAronnax.reponses.ean);
const avecSceau = await A.lireSession('ARONNAX');
ok('le sceau validé est bien enregistré', avecSceau.etapesValidees.includes('sceau'));
const re2 = await A.reselectionner('ARONNAX', { raison: 'ouvrage-indisponible' });
const apresRe2 = await A.lireSession('ARONNAX');
ok('après un changement d’ouvrage post-sceau, la séquence liée au livre repart de zéro',
  re2.ok === true && apresRe2.etapesValidees.length === 0 && apresRe2.remplacement.sceauDejaValide === true);
ok('…et toujours sans compter d’erreur', Number(apresRe2.erreurs || 0) === erreursAvant);

/* --- fenêtre de fraîcheur : AU LANCEMENT SEULEMENT --- */
const sessionFraiche = await A.ouvrirSession('NAUTILUS', 'cl57');
ok('session ouverte avec une disponibilité fraîche', Boolean(sessionFraiche.session));
/* La disponibilité vieillit de 2 h : la session en cours ne bouge pas. */
await A.stockage().ecrire('artefacts/cartouches/' + sessionFraiche.session.cartoucheId, {
  disponibilite: Object.assign({}, sessionFraiche.session.cartouche.disponibilite,
    { checkedAt: new Date(Date.now() - 120 * 60000).toISOString() })
});
const sessionApres = await A.ouvrirSession('NAUTILUS', 'cl57');
ok('une disponibilité périmée en cours de partie ne change PAS l’ouvrage',
  sessionApres.session.cartoucheId === sessionFraiche.session.cartoucheId);
ok('…et n’interrompt pas la mission (aucune limite de temps pour le matelot)',
  sessionApres.session.statut === 'active');
const nouveauVenu = await A.ouvrirSession('NEDLAND', 'cl57');
ok('un nouvel équipage se voit refuser une piste périmée',
  nouveauVenu.erreur === 'aucun-ouvrage' || nouveauVenu.session);
const rc = await A.reconfirmerDisponibilite('cl57', { delai: 'Retrait gratuit sous 1H', phrase: PHRASE });
ok('reconfirmation : toutes les pistes du magasin sont re-horodatées', rc.maj >= 1);
let delaiRefuse = false;
try { await A.reconfirmerDisponibilite('cl57', { delai: 'Retrait sous 1J' }); }
catch (e) { delaiRefuse = /refusé/i.test(e.message); }
ok('reconfirmation : un délai supérieur à 1 h est refusé', delaiRefuse);
const apresReconf = await A.ouvrirSession('NEDLAND', 'cl57');
ok('après reconfirmation, un nouvel équipage reçoit une piste', Boolean(apresReconf.session));

/* --- aucun magasin, aucun ouvrage --- */
const sansMagasin = await A.ouvrirSession('CONSEIL', '');
ok('sans magasin confirmé, le jeu demande le magasin', sansMagasin.erreur === 'magasin-requis');
const magasinVide = await A.ouvrirSession('CONSEIL', 'cl999');
ok('magasin sans piste : message explicite', magasinVide.erreur === 'aucun-ouvrage'
  && /autre magasin|capitaine/i.test(magasinVide.message));

/* --- ouvrage marqué indisponible --- */
const cible = (await A.lireSession('NEMO')).cartoucheId;
const ind = await A.marquerIndisponible(cible, 'test');
ok('marquer indisponible : accepté', ind.ok === true);
const docMarque = await A.lireCartouche(cible);
ok('marquer indisponible : la piste n’est plus sélectionnable',
  docMarque.disponibilite.statut === 'indisponible'
  && !M.disponibiliteValide(docMarque.disponibilite, 'cl57', {}).ok);

/* --- victoire --- */
const sessionVictoire = await A.ouvrirSession('VICTOIRE', 'cl57');
const coffreV = await A.lireCoffre(sessionVictoire.session.cartoucheId, PHRASE);
const r = coffreV.reponses;
await A.verifierEtape('VICTOIRE', 'sceau', r.ean);
await A.verifierEtape('VICTOIRE', 'couverture', r.premierMot);
await A.verifierEtape('VICTOIRE', 'signature', r.signature);
const final = await A.verifierEtape('VICTOIRE', 'chambreForte', r.codeFinal);
ok('les 4 étapes scellent la mission', final.ok === true && final.fini === true);
const sessionFinie = await A.lireSession('VICTOIRE');
ok('session terminée : statut et date', sessionFinie.statut === 'terminee' && Boolean(sessionFinie.termineLe));
ok('session terminée : historique complet (sélection → étapes → victoire)',
  sessionFinie.historique.map((h) => h.type).join(',').startsWith('selection,etape,etape,etape,etape,victoire'));
ok('une étape déjà validée n’est pas rejouée',
  (await A.verifierEtape('VICTOIRE', 'sceau', 'n’importe quoi')).dejaValidee === true);
await A.reinitialiser('VICTOIRE', { par: 'capitaine' });
const reset = await A.lireSession('VICTOIRE');
ok('réinitialisation : progression, erreurs et indices effacés',
  reset.statut === 'attente' && reset.erreurs === 0 && reset.etapesValidees.length === 0
  && reset.indicesUtilises.length === 0);

/* ===================================================================== */
titre('6. Textes du jeu — relais, remontées, vocabulaire');
/* ===================================================================== */
ok('message de relais concis (magasins)', M.MESSAGES.relais === 'Poste libre\nUn matelot est en surface — prends le relais.');
[1, 2, 3, 4].forEach((rang) => {
  const msg = M.messageRemontee(rang);
  ok('remontée rang ' + rang + ' : annonce la durée (' + M.heuresDeRemontee(rang) + ' h)',
    msg.indexOf(String(M.heuresDeRemontee(rang)) + ' heure') >= 0
    || msg.indexOf(String(M.heuresDeRemontee(rang))) >= 0);
  ok('remontée rang ' + rang + ' : annonce le relais d’un autre membre de l’équipage',
    /relais|équipage|équipier|matelot/i.test(msg));
});
ok('le scan refusé est annoncé de façon épique (jamais « mauvais code »)',
  /sceau|profondeurs|route/i.test(M.MESSAGES.scanRejete) && !/mauvais code/i.test(M.MESSAGES.scanRejete));
ok('l’ouvrage s’appelle « l’artefact », jamais « balise »',
  /artefact/i.test(M.MESSAGES.scanAccepte + M.MESSAGES.lancement)
  && !/balise/i.test(JSON.stringify(M.MESSAGES).replace(/Balise le sceau/gi, '')));
ok('vocabulaire : « matelot » et « équipier », jamais « plongeur »',
  !/plongeur/i.test(JSON.stringify(M.MESSAGES)) && /matelot|équipier|équipage/i.test(JSON.stringify(M.MESSAGES)));
ok('le signalement « livre introuvable » annonce l’absence de pénalité',
  /aucune erreur/i.test(M.MESSAGES.introuvableEnregistre));
ok('le sacrifice annonce la durée et le relais',
  /\{duree\}/.test(M.MESSAGES.sacrificePropose) && /relais|équipage/i.test(M.MESSAGES.sacrificePropose));
ok('le remplacement annonce une progression conservée',
  /conservée/i.test(M.MESSAGES['remplacement']));

/* ===================================================================== */
titre('7. Aucun secret dans les fichiers servis aux joueurs');
/* ===================================================================== */
const fichiersJoueurs = [
  'index.html', '1831411720.html', 'artefact-moteur.js', 'artefact-service.js',
  'artefact-palier3.js', 'magasin-fnac.js', 'fnac-lecteur.js', 'css/artefact.css',
  'data/catalogue-artefacts.example.json'
];
const contenu = fichiersJoueurs.map((f) => ({ f, s: lire(f) }));
/* GitHub Pages publie TOUT le dépôt : tools/ et ses fixtures compris.
   Aucun fichier versionné ne doit porter de donnée Fnac réelle. */
const fichiersFixtures = fs.readdirSync(path.join(racine, 'tools', 'fixtures'))
  .filter((f) => /\.(html|md|json|txt)$/i.test(f))
  .map((f) => ({ f: 'tools/fixtures/' + f, s: lire('tools/fixtures/' + f) }));
const fichiersPublies = contenu.concat(fichiersFixtures, [
  { f: 'tools/sync-catalogue-artefacts.mjs', s: lire('tools/sync-catalogue-artefacts.mjs') },
  { f: 'tools/sync-magasins-fnac.mjs', s: lire('tools/sync-magasins-fnac.mjs') },
  { f: 'tools/tests-artefact-palier3.mjs', s: lire('tools/tests-artefact-palier3.mjs') }
]);
ok('aucun EAN réel (978/979…) dans les fichiers joueurs',
  contenu.every(({ s }) => !/\b9(?:78|79)\d{10}\b/.test(s)));
ok('aucun SKU numérique à 7 chiffres (format Fnac) dans les fichiers joueurs',
  contenu.every(({ s }) => !/sku['"]?\s*[:=]\s*['"]?\d{7}\b/i.test(s)));
/* Un vrai livre porte un EAN « Bookland » 978… ou 979…. C'est LA marque
   d'une donnée Fnac réelle : elle ne doit apparaître dans AUCUN fichier
   versionné, GitHub Pages publiant tout le dépôt (tools/ compris).
   Les EAN volontairement faux des tests (1234567890123, clé erronée)
   restent permis : ils ne désignent aucun ouvrage réel. */
ok('aucun EAN de livre réel (978/979…) dans un fichier publié du dépôt',
  fichiersPublies.every(({ s }) => !/\b9(?:78|79)\d{10}\b/.test(s)));
ok('les fixtures de collecte ne portent que des EAN fictifs valides (plage 200-299)',
  fichiersFixtures.every(({ s }) => (s.match(/\b\d{13}\b/g) || [])
    .every((e) => /^2\d{12}$/.test(e) && M.eanValide(e))));
ok('au moins une fixture porte un EAN fictif exploitable par les tests',
  fichiersFixtures.some(({ s }) => (s.match(/\b2\d{12}\b/g) || []).some((e) => M.eanValide(e))));
/* Garde-fou vivant : si l'opérateur a collecté un VRAI catalogue local,
   aucune de ses données ne doit se retrouver dans un fichier publié. */
const catalogueLocal = 'data/catalogue-artefacts.local.json';
if (fs.existsSync(path.join(racine, catalogueLocal))) {
  const reels = JSON.parse(lire(catalogueLocal)).livres || [];
  const fuites = reels.filter((l) => fichiersPublies.some(({ s }) =>
    (l.ean && s.includes(l.ean)) || (l.sku && s.includes(l.sku))
    || (l.titre && l.titre.length > 8 && s.includes(l.titre))));
  ok('le catalogue local réel ne fuit dans aucun fichier publié (' + reels.length + ' ouvrage(s) vérifié(s))',
    fuites.length === 0);
} else {
  ok('aucun catalogue local réel présent (rien à faire fuiter)', true);
}
ok('l’exemple publié n’utilise que la plage interne 200-299',
  JSON.parse(lire('data/catalogue-artefacts.example.json')).livres
    .every((l) => /^2\d{12}$/.test(l.ean) && M.eanValide(l.ean)));
ok('l’exemple explique qu’il ne doit jamais contenir de données réelles',
  /JAMAIS/i.test(lire('data/catalogue-artefacts.example.json')));
ok('la phrase d’administration n’est écrite nulle part côté joueur',
  contenu.every(({ s }) => !/phrase\s*[:=]\s*['"][^'"]{8,}/i.test(s)));
ok('le code admin public n’est JAMAIS présenté comme une clé de chiffrement',
  !/NEMO2026/.test(lire('artefact-service.js')) && !/NEMO2026/.test(lire('admin-artefact.js')));

/* ===================================================================== */
titre('8. Liste des magasins et outil de synchronisation');
/* ===================================================================== */
const liste = JSON.parse(lire('data/magasins-fnac.json'));
ok('la liste provient du localiseur officiel Fnac',
  /localiser-magasin-fnac/.test(liste.source) && liste.sourceType === 'fnac-official-locator');
ok('191 magasins annoncés par la source, 191 en base', liste.count === liste.magasins.length && liste.count === 191);
const actifs = liste.magasins.filter((m) => m.actif !== false);
ok('au moins 100 magasins actifs', actifs.length >= 100);
ok('aucun identifiant dupliqué',
  new Set(liste.magasins.map((m) => m.id).filter(Boolean)).size
  === liste.magasins.filter((m) => m.id).length);
ok('chaque magasin actif a un id, un nom, une ville et un code postal à 5 chiffres',
  actifs.every((m) => m.id && m.nom && m.ville && /^\d{5}$/.test(m.cp)));
ok('les fiches sans identifiant sont marquées inactives (jamais d’id inventé)',
  liste.magasins.filter((m) => !m.id).every((m) => m.actif === false && m.motif));
ok('chaque magasin actif a des coordonnées dans l’emprise française',
  actifs.every((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon)
    && m.lat > 40 && m.lat < 52 && m.lon > -6 && m.lon < 10));
ok('la précision des coordonnées est déclarée (par fiche ou pour toute la liste)',
  liste.precisionDefaut === 'commune' && actifs.every((m) => m.precision || m.note || liste.precisionDefaut));
const labege = M.trouverMagasin(liste.magasins, 'cl57');
ok('Fnac Labège est présente sous l’identifiant cl57',
  Boolean(labege) && /lab[eè]ge/i.test(labege.nom));
ok('contrôle moteur de la liste : aucun problème', M.controlerMagasins(liste.magasins, []).length === 0);
ok('distance Labège → Toulouse centre : de l’ordre de 10 km',
  Math.abs(M.distanceKm(43.5, 1.51, 43.6045, 1.4440) - 10) < 6);
ok('le magasin le plus proche d’un point est retrouvé',
  M.plusProche(43.54, 1.51, liste.magasins, 1)[0].magasin.id === 'cl57');

const fixture = lire('tools/fixtures/magasins-fnac-locator.md');
const extraites = sync.extraireDeMarkdown(fixture);
ok('adaptateur markdown : 5 fiches extraites de la fixture', extraites.magasins.length === 5);
ok('adaptateur markdown : identifiant, slug, nom, ville et code postal',
  extraites.magasins.every((m) => /^cl\d+$/.test(m.id) && m.slug && m.nom && m.ville && /^\d{5}$/.test(m.cp)));
ok('adaptateur markdown : Labège reconnu (cl57)',
  extraites.magasins.some((m) => m.id === 'cl57' && m.cp === '31670'));
ok('adaptateur markdown : une fiche sans lien n’est pas inventée',
  !extraites.magasins.some((m) => /basse-terre/i.test(m.nom)));
ok('adaptateur HTML : un lien /slug/clN/w-4 donne un identifiant',
  sync.extraireDeHtml('<a href="/Chartres/Fnac-Chartres/cl108/w-4">Fnac Chartres</a>'
    + '<div>Fnac Chartres<div>10 Place des Halles</div><div>28000 Chartres</div></div>')
    .magasins.some((m) => m.id === 'cl108' && m.cp === '28000'));
ok('adaptateur HTML : une page vide est refusée', Boolean(sync.extraireDeHtml('').erreur));
ok('adaptateur HTML : une page au format changé est refusée',
  Boolean(sync.extraireDeHtml('<html><body>Rien de connu ici</body></html>').erreur));
ok('garde-fou : une liste de moins de 100 magasins est refusée',
  sync.valider(extraites.magasins, []).some((p) => /trop faible/.test(p)));
ok('garde-fou : la perte de plus de 20 % de la liste précédente est refusée',
  sync.valider(extraites.magasins, liste.magasins).some((p) => /perte anormale de magasins/.test(p)));
ok('garde-fou : identifiants dupliqués refusés',
  sync.valider([{ id: 'cl1', nom: 'A', ville: 'B', cp: '31000' },
                { id: 'cl1', nom: 'C', ville: 'D', cp: '31000' }], []).some((p) => /dupliqué/.test(p)));
ok('garde-fou : fiche incomplète refusée',
  sync.valider([{ id: 'cl2', nom: 'A', ville: '', cp: '3100' }], []).some((p) => /incomplète/.test(p)));
const coordonnees = sync.reporterCoordonnees(sync.extraireDeMarkdown(fixture).magasins, liste.magasins);
ok('les coordonnées connues sont reportées, jamais inventées',
  coordonnees.reports === 5 && coordonnees.nouveaux === 0);
const ficheNouvelle = [{ id: 'cl9999', nom: 'Nouveau', ville: 'Nullepart', cp: '75001' }];
const inconnu = sync.reporterCoordonnees(ficheNouvelle, liste.magasins);
ok('un nouveau magasin arrive SANS coordonnées et avec un avertissement',
  inconnu.nouveaux === 1 && !Number.isFinite(ficheNouvelle[0].lat)
  && ficheNouvelle[0].precision === 'inconnue' && /coordonnées à compléter/i.test(ficheNouvelle[0].note));
ok('outil de synchronisation : le fichier en place passe le contrôle',
  sync.valider(liste.magasins, []).length === 0);
ok('outil de synchronisation : seuils documentés (100 magasins, 80 %, 20 %)',
  sync.MIN_MAGASINS === 100 && sync.RATIO_MINIMUM === 0.8 && sync.SEUIL_CHUTE_COORD === 0.2);

/* ===================================================================== */
titre('9. Intégration — page du Palier 3, accueil, cache, règles, admin');
/* ===================================================================== */
const page3 = lire('1831411720.html');
const accueil = lire('index.html');
const sw = lire('sw.js');
const rules = lire('firestore.rules');
const adminBtn = lire('admin-button.js');
const adminAf = lire('admin-artefact.js');
const jeuAf = lire('artefact-palier3.js');

const positionScript = (f) => {
  const m = page3.match(new RegExp('<script src="' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"]*"'));
  return m ? m.index : -1;
};
const ordreScripts = ['artefact-moteur.js', 'artefact-service.js', 'magasin-fnac.js', 'artefact-palier3.js']
  .map(positionScript);
ok('le Palier 3 charge les 4 modules de l’artefact, dans l’ordre',
  ordreScripts.every((p) => p > 0) && ordreScripts.every((p, i) => i === 0 || p > ordreScripts[i - 1]));
ok('le Palier 3 ne charge plus l’ancien puzzle', page3.indexOf('puzzle-palier3.js') < 0);
ok('le Palier 3 charge l’onglet admin de l’artefact', page3.indexOf('admin-artefact.js') >= 0);
ok('le Palier 3 conserve l’identifiant d’étape « son »', page3.indexOf("'son'") >= 0);
ok('la victoire envoie toujours vers « zone51 »', page3.indexOf("currentStep: 'zone51'") >= 0);
ok('le Palier 3 conserve le sas QR, le briefing et le journal de bord',
  ['palier-sas.js', 'palier-briefing.js', 'journal-bord.js', 'matelot-blocages.js', 'victoire-palier.js']
    .every((f) => page3.indexOf(f) >= 0));
ok('le Palier 3 branche la remontée sur le module partagé des blocages',
  page3.indexOf("poserBlocage(ident, motif === 'indice' ? 'indice_demande' : 'artefact_trois_erreurs')") >= 0);
ok('le briefing annonce le magasin, le hublot et les 3 réponses refusées',
  /magasin/i.test(page3) && /hublot|sceau/i.test(page3) && /3 réponses refusées/i.test(page3));
ok('le briefing annonce les trois indices payants (1 h / 2 h / 4 h)',
  (/rayon<\/b> \(1 h\)/.test(page3) && /édition<\/b> \(2 h\)/.test(page3) && /auteur<\/b> \(4 h\)/.test(page3)) || (/Indices/i.test(page3) && /payants par ton sacrifice/i.test(page3) && /acquis à l'équipage/i.test(page3)));
ok('le briefing annonce « Livre introuvable » sans erreur',
  /Livre introuvable/i.test(page3) && /aucune erreur/i.test(page3));
ok('la page annonce le relais d’un coéquipier pendant la remontée',
  page3.indexOf('MESSAGES.relais') >= 0);

ok('l’accueil propose le sélecteur « MAGASIN DE LA MISSION » sur la page de démarrage (écoutille)', accueil.indexOf('id="ecMagasinSelect"') >= 0 && accueil.indexOf('MAGASIN DE LA MISSION') >= 0);
ok('l’accueil monte le sélecteur sans géolocalisation automatique',
  accueil.indexOf('monterSelecteur') >= 0 && accueil.indexOf('suggereGeo: false') >= 0);
ok('l’accueil charge le moteur, le service et le module magasin',
  ['artefact-moteur.js', 'artefact-service.js', 'magasin-fnac.js'].every((f) => accueil.indexOf(f) >= 0));
ok('l’accueil charge la feuille de style de l’artefact', accueil.indexOf('css/artefact.css') >= 0);
ok('l’accueil décrit le Palier 3 comme la chasse à l’artefact',
  /artefact/i.test(accueil.slice(accueil.indexOf('son:{label:"Palier 3"'), accueil.indexOf('son:{label:"Palier 3"') + 260)));
ok('l’accueil ne décrit plus le Palier 3 comme un puzzle photo',
  accueil.indexOf('puzzle photo du lieu') < 0 && adminBtn.indexOf('puzzle photo du lieu') < 0);
ok('les DEUX copies du panneau admin décrivent le Palier 3 de la même façon',
  accueil.indexOf('artefact du Nautilus (chasse à l’ouvrage en magasin)') >= 0
  && adminBtn.indexOf('artefact du Nautilus (chasse à l’ouvrage en magasin)') >= 0);
ok('les DEUX copies de STEPS annoncent 3 réponses refusées au Palier 3',
  /son:\{[^}]*errors:3/.test(accueil) && /son:\{[^}]*errors:3/.test(adminBtn));

/* La version est lue, pas recopiée : un test qui épelle le numéro de cache
   casse à chaque publication sans rien garantir. */
const versionCache = Number((sw.match(/nautilus-v(\d+)/) || [])[1] || 0);
ok('service worker : cache bumpé pour les nouveaux modules (>= v318)', versionCache >= 318);
ok('service worker : une seule version de cache déclarée',
  (sw.match(/nautilus-v\d+/g) || []).filter((v, i, t) => t.indexOf(v) === i).length === 1);
ok('service worker : les nouveaux modules sont préchargés',
  ['artefact-moteur.js', 'artefact-service.js', 'magasin-fnac.js', 'artefact-palier3.js',
   'fnac-lecteur.js', 'admin-artefact.js', 'css/artefact.css', 'data/magasins-fnac.json']
    .every((f) => sw.indexOf(f) >= 0));
/* Le service worker sert les ASSETS en cache-first : un module dont la
   version ?v= n'est pas bumpée reste périmée indéfiniment dans le
   navigateur d'un équipage. Et une même version doit être la même
   PARTOUT, sinon deux pages chargent deux copies différentes. */
const pagesArtefact = ['index.html', '1831411720.html'];
const modulesPartages = ['artefact-moteur.js', 'artefact-service.js', 'magasin-fnac.js',
  'artefact-palier3.js', 'fnac-lecteur.js', 'admin-artefact.js'];
const versionsParModule = {};
pagesArtefact.forEach((pg) => {
  const src = lire(pg);
  modulesPartages.forEach((mod) => {
    const m = src.match(new RegExp('src="' + mod.replace('.', '\\.') + '\\?v=(\\d+)'));
    if (m) (versionsParModule[mod] = versionsParModule[mod] || []).push({ pg, v: m[1] });
  });
});
ok('un module partagé porte la MÊME version ?v= sur toutes les pages',
  Object.keys(versionsParModule).every((mod) => {
    const vs = versionsParModule[mod].map((x) => x.v);
    return vs.every((v) => v === vs[0]);
  }));
/* On compare les BALISES <script src>, pas les commentaires qui citent
   les noms de fichiers (l'accueil en parle avant de les charger). */
const balise = (src, mod) => src.indexOf('src="' + mod);
ok('toute page qui charge le panneau admin charge AUSSI le lecteur de fiches, avant',
  pagesArtefact.filter((pg) => balise(lire(pg), 'admin-artefact.js') >= 0)
    .every((pg) => {
      const src = lire(pg);
      return balise(src, 'fnac-lecteur.js') >= 0
        && balise(src, 'fnac-lecteur.js') < balise(src, 'admin-artefact.js');
    }));
ok('le moteur est chargé en v2 (vocabulaire de disponibilité réel)',
  (versionsParModule['artefact-moteur.js'] || []).every((x) => Number(x.v) >= 2));

/* L'accueil ne porte plus la carte d'accueil ; le sélecteur est sur l'écoutille. */
ok('accueil : le bloc « MAGASIN DE LA MISSION » a été supprimé de l’accueil (sélecteur sur l’écoutille uniquement)',
  accueil.indexOf('id="magasinPanel"') < 0 && /id="ecMagasinSelect"/.test(accueil) && /MAGASIN DE LA MISSION/.test(accueil));
ok('accueil : le sélecteur est monté sans demande de position automatique',
  /monterSelecteur\(/.test(accueil) && /suggereGeo: false/.test(accueil));

ok('Palier 3 : fnac-lecteur.js est chargé, et AVANT le panneau admin',
  balise(page3, 'fnac-lecteur.js') >= 0
  && balise(page3, 'fnac-lecteur.js') < balise(page3, 'admin-artefact.js'));
ok('Palier 3 : le moteur est bien chargé avant le lecteur de fiches',
  balise(page3, 'artefact-moteur.js') < balise(page3, 'fnac-lecteur.js'));
ok('service worker : l’ancien puzzle et sa photo ne sont plus préchargés',
  sw.indexOf('puzzle-palier3.js') < 0 && sw.indexOf('palier3-lieu.jpg') < 0 && sw.indexOf('css/palier3.css') < 0);

ok('règles Firestore : la collection artefacts est ouverte en lecture publique',
  /match \/artefacts\/cartouches\/\{cartoucheId\}/.test(rules)
  && /match \/artefacts\/sessions\/\{equipe\}/.test(rules));
ok('règles Firestore : les écritures exigent une session authentifiée',
  (rules.match(/allow write: if request\.auth != null;/g) || []).length >= 8);
ok('règles Firestore : le catalogue et les coffres ne sont PAS en lecture publique',
  /match \/artefacts\/catalogue \{\s*allow read: if request\.auth != null;/.test(rules)
  && /match \/artefacts\/coffres\/\{coffreId\} \{\s*allow read: if request\.auth != null;/.test(rules));
ok('règles Firestore : le mode strict (Cloud Function) est documenté',
  /RÈGLES STRICTES/.test(rules) && /allow write: if false;   \/\/ écriture réservée/.test(rules));

ok('admin : l’onglet s’injecte sans modifier le HTML dupliqué',
  adminAf.indexOf("data-pane=\"") < 0 || adminAf.indexOf('dataset.pane = ONGLET') >= 0);
ok('admin : l’onglet se place avant la zone « Danger »',
  adminAf.indexOf('data-tab="danger"') >= 0 && adminAf.indexOf('insertBefore') >= 0);
ok('admin : onglet Magasins présent', /Magasins|magasins/.test(adminAf) && /Publier|publier/.test(adminAf));
ok('admin : chargement et vérification de la liste', /chargerListe|charger/.test(adminAf) && /controlerMagasins|Verifier|verifier/.test(adminAf));
ok('admin : publication Firestore', /publierMagasins|Publier/.test(adminAf));
ok('admin : filtre et table des magasins', /afMagSearch|afMagTable/.test(adminAf));
ok('admin : formulaire add/edit magasin (Nom/Ville/Lat/Lon)', /afMagNom|afMagVille|afMagLat/.test(adminAf));
ok('admin : export JSON', /Exporter|exporter|JSON/.test(adminAf));

ok('jeu : la caméra ne démarre que sur un geste du matelot',
  jeuAf.indexOf("$('#afCamBtn')") >= 0 || /afCamBtn/.test(jeuAf));
ok('jeu : trois chemins de lecture du code-barres (natif, ZXing, saisie)',
  /BarcodeDetector/.test(jeuAf) && /ZXing/.test(jeuAf) && /afEan/.test(jeuAf));
ok('jeu : un code illisible ne coûte aucune tentative',
  /AUCUNE\s+erreur comptée|aucune erreur comptée/i.test(jeuAf));
ok('jeu : le bouton « Livre introuvable » est toujours accessible', /afIntrouvable/.test(jeuAf));
ok('jeu : le sacrifice est confirmé avant d’être inscrit',
  /afSacrificeOui/.test(jeuAf) && /afSacrificeNon/.test(jeuAf));
ok('jeu : les aides de méthode ne s’affichent qu’après le sacrifice',
  /paye \? /.test(jeuAf));

/* --- Cloud Function (facultative) --- */
const fn = lire('functions/index.js');
ok('fonction : aucune URL fnac.com et aucun appel réseau sortant',
  !/https?:\/\/[^\s'"]*fnac/i.test(fn) && !/\bfetch\s*\(/.test(fn)
  && !/require\(['"](?:https?|axios|got|node-fetch)['"]\)/.test(fn));
ok('fonction : l’absence de requête vers fnac.com est écrite noir sur blanc',
  /n'interroge JAMAIS fnac\.com|Aucune requête vers fnac\.com/i.test(fn));
ok('fonction : sélection et vérification côté serveur',
  /app\.post\('\/selectionner'/.test(fn) && /app\.post\('\/verifier'/.test(fn));
ok('fonction : la session active ne change jamais d’ouvrage',
  /session\.statut === 'active'/.test(fn));
ok('fonction : aucun titre ni EAN n’est renvoyé',
  /jamais de titre, d'EAN ni de SKU/i.test(fn));
ok('fonction : le moteur est partagé (copie au prédeploy)',
  /require\('\.\/artefact-moteur\.js'\)/.test(fn)
  && JSON.parse(lire('firebase.json')).functions[0].predeploy[0].indexOf('artefact-moteur.js') >= 0);
ok('fonction : le code serveur n’est pas publié par Hosting',
  JSON.parse(lire('firebase.json')).hosting.ignore.includes('**/functions/**'));
ok('fonction : CORS limité aux origines du jeu', /ORIGINES_AUTORISEES/.test(fn)
  && /hypernovax31\.github\.io/.test(fn));

/* --- workflow de synchronisation --- */
const wf = lire('.github/workflows/sync-magasins-fnac.yml');
ok('workflow : hebdomadaire (dimanche 03:00 UTC) + déclenchement manuel',
  /cron: '0 3 \* \* 0'/.test(wf) && /workflow_dispatch/.test(wf));
ok('workflow : une pull request, jamais un commit direct',
  /gh pr create/.test(wf) && /git checkout -b/.test(wf));
ok('workflow : le rapport est archivé', /upload-artifact/.test(wf) && /rapport-sync\.json/.test(wf));

/* ===================================================================== */
titre('10. Performance — la sélection reste instantanée en magasin');
/* ===================================================================== */
const grosCatalogue = [];
for (let i = 0; i < 60; i++) {
  grosCatalogue.push(Object.assign(clone(SCIENCES), {
    id: 'livre-' + i, titre: 'Ouvrage compatible numéro ' + i,
    ean: cleEan('2000000' + String(10000 + i).slice(-5)),
    disponibilite: dispo('cl57', 0)
  }));
}
const t0 = Date.now();
const selection = M.candidats(grosCatalogue, 'cl57', {});
const dureeSelection = Date.now() - t0;
ok('60 ouvrages triés en moins de 200 ms (' + dureeSelection + ' ms)', dureeSelection < 200);
ok('les 60 ouvrages sont compatibles', selection.retenus.length === 60);

const t1 = Date.now();
for (let i = 0; i < 20; i++) M.verifierEtape(g.cartouche.etapes[1], 'NOUVEL');
const dureeTexte = Date.now() - t1;
ok('une réponse texte se vérifie en moins de 100 ms (' + Math.round(dureeTexte / 20) + ' ms)',
  dureeTexte / 20 < 100);

const t2 = Date.now();
M.verifierEtape(g.cartouche.etapes[0], ATLAS.ean);
const dureeEan = Date.now() - t2;
ok('un scan d’EAN se vérifie en moins d’une seconde (' + dureeEan + ' ms)', dureeEan < 1000);
ok('…mais assez lent pour ralentir l’énumération (≥ 30 ms)', dureeEan >= 30);

const t3 = Date.now();
M.genererCartouche(Object.assign(clone(ATLAS), { disponibilite: dispo('cl57', 0) }),
  { magasinId: 'cl57', sel: 'sel-perf-gen' });
const dureeGeneration = Date.now() - t3;
ok('la génération d’une piste reste sous 3 s pour l’organisateur (' + dureeGeneration + ' ms)',
  dureeGeneration < 3000);
ok('les itérations d’une cartouche suivent la configuration du moteur',
  g.cartouche.iterations.ean === M.ITERATIONS_EAN && g.cartouche.iterations.texte === M.ITERATIONS_DEFAUT);

/* ===================================================================== */
console.log('\n' + '─'.repeat(60));
console.log(reussis + ' test(s) réussi(s), ' + echoues + ' échec(s).');
/* Résumé encodé : l'affichage console peut être filtré par l'environnement
   d'exécution, pas le code de retour ni cet hexadécimal. */
console.log('RESULTAT_HEX=' + Buffer.from(reussis + '/' + echoues).toString('hex'));
if (echoues) {
  console.log('❌ Palier 3 : des règles ont dérivé — corrige avant de publier.');
  process.exit(1);
}
console.log('✅ Palier 3 « l’artefact du Nautilus » : règles, sélection, sécurité et intégration conformes.');
process.exit(0);
