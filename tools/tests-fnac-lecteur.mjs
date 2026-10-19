/* =====================================================================
   TESTS DU LECTEUR DE FICHES FNAC ET DE LA COLLECTE DU CATALOGUE

       node tools/tests-fnac-lecteur.mjs

   Aucune dépendance à installer, AUCUN réseau, aucune écriture : tout se
   joue sur des fixtures (tools/fixtures/fiche-fnac-*.html) qui
   reproduisent les gabarits réellement observés sur fnac.com le
   19/10/2026, avec des ouvrages FICTIFS (EAN de la plage interne
   200-299). Aucune donnée Fnac réelle n'est versionnée.

   Ce que ces tests protègent, dans l'ordre :

     1.  la mise en texte (HTML, tableaux, markdown, entités, JSON-LD) ;
     2.  la lecture des caractéristiques (EAN, ISBN, SKU, éditeur,
         collection, parution, pages, format, libellé défilant) ;
     3.  le bloc DISPONIBILITÉ : « En stock en magasin / Retrait gratuit
         sous 1H » exploitable, « Livrable en magasin / sous 1J » refusé,
         « Indisponible en magasin » refusé, page sans magasin non
         attribuée ;
     4.  le rapprochement du magasin ANNONCÉ avec la liste officielle,
         et le refus de trancher en cas d'ambiguïté ou de magasin fermé ;
     5.  le pont avec le moteur : une disponibilité lue est acceptée par
         disponibiliteValide, une autre est refusée, et la sélection ne
         retient QUE l'ouvrage confirmé sous 1 h ;
     6.  la cartouche publique : aucun titre, EAN, SKU ni nom de magasin
         ne fuit vers le joueur ;
     7.  la découverte de fiches depuis une page de rayon ;
     8.  le respect de robots.txt et l'absence de contournement anti-bot ;
     9.  les garde-fous de l'outil de collecte (mur anti-bot, fusion du
         catalogue, chemin non gitignoré, vérification du catalogue) ;
    10.  la staticité : le lecteur ne fait AUCUNE requête, et aucun EAN
         réel (978/979…) n'apparaît dans un fichier publié du dépôt.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(ici, '..');
const lire = (nom) => fs.readFileSync(path.join(racine, nom), 'utf8');
const fixture = (nom) => lire(path.join('tools', 'fixtures', nom));

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
await import(path.join(racine, 'artefact-moteur.js'));
await import(path.join(racine, 'fnac-lecteur.js'));
const M = globalThis.NautilusArtefactMoteur;
const L = globalThis.NautilusFnacLecteur;
const OUTIL = await import(path.join(racine, 'tools', 'sync-catalogue-artefacts.mjs'));

const MAGASINS = JSON.parse(lire('data/magasins-fnac.json')).magasins;
const maintenant = Date.now();
const lireFixture = (nom, opts) => L.lireFiche(fixture(nom), Object.assign({
  magasins: MAGASINS, magasinId: 'cl57', maintenant, url: ''
}, opts || {}));

/* ===================================================================== */
titre('1. Mise en texte — HTML, tableaux, markdown, entités, JSON-LD');
/* ===================================================================== */
const conv = L.htmlVersLignes(fixture('fiche-fnac-en-stock-1h.html'));
ok('le HTML devient une suite de lignes lisibles', conv.lignes.length > 20);
ok('les balises ont disparu', !/<[a-z]/i.test(conv.texte));
ok('les libellés et valeurs sont sur des lignes séparées',
  conv.lignes.indexOf('EAN') >= 0 && conv.lignes[conv.lignes.indexOf('EAN') + 1] === '2000000001005');
ok('les tableaux deviennent des paires libellé/valeur',
  L.htmlVersLignes(fixture('fiche-fnac-livrable-1j.html')).lignes.indexOf('EAN') >= 0);
ok('le markdown collé est accepté tel quel (pas de HTML)',
  !L.estHtml(fixture('fiche-fnac-texte-colle.md')) && L.htmlVersLignes(fixture('fiche-fnac-texte-colle.md')).lignes.length > 10);
ok('les entités sont décodées', L.decoderEntites('&Eacute;ditions &amp; C&#39;est &nbsp;ok') === 'Éditions & C\'est  ok');
ok('le JSON-LD est extrait avant nettoyage', conv.jsonLd.length >= 1);
ok('JSON-LD : le nœud Book est retrouvé parmi les nœuds imbriqués',
  !!L.jsonLdParType(conv.jsonLd, ['book']) && L.jsonLdParType(conv.jsonLd, ['book'])['@type'] === 'Book');
ok('JSON-LD : gtin13 et sku sont présents',
  L.jsonLdParType(conv.jsonLd, ['book']).gtin13 === '2000000001005'
  && L.jsonLdParType(conv.jsonLd, ['book']).sku === 'EXEMPLE-1005');
ok('JSON-LD : un bloc invalide ne casse rien',
  L.extraireJsonLd('<script type="application/ld+json">{invalide</script><script type="application/ld+json">{"@type":"Book","name":"X"}</script>').length === 1);
ok('JSON-LD : @graph et tableaux sont aplatis',
  L.extraireJsonLd('<script type="application/ld+json">{"@graph":[{"@type":"Book","name":"A"},{"@type":"Offer"}]}</script>').length === 2);

/* ===================================================================== */
titre('2. Caractéristiques lues sur la fiche « en stock, retrait 1H »');
/* ===================================================================== */
const atlas = lireFixture('fiche-fnac-en-stock-1h.html', { url: 'https://www.fnac.com/a99000001/Collectif-Atlas' });
ok('titre lu (og:title nettoyé des mentions « Achat Livre | fnac »)',
  atlas.titre === 'Atlas fictif des oceans perdus');
ok('EAN à 13 chiffres, clé de contrôle valide',
  atlas.livre.ean === '2000000001005' && M.eanValide(atlas.livre.ean));
ok('ISBN et SKU recopiés tels quels', atlas.livre.isbn === '2000001000' && atlas.livre.sku === 'EXEMPLE-1005');
ok('éditeur et collection lus', atlas.livre.editeur === 'Éditions Imaginaires' && atlas.livre.collection === 'Grand Large');
ok('année et nombre de pages lus', atlas.livre.annee === 2025 && atlas.livre.pages === 240);
ok('mention d’édition retrouvée (elle identifie la mission)',
  atlas.livre.edition === '4e édition' && atlas.livre.editionNumero === 4);
ok('le LIBELLÉ DÉFILANT Fnac est recopié mot pour mot',
  atlas.livre.etiquetteFnac === 'Atlas / carte (broché)' && atlas.livre.categorieFnac === 'Atlas / carte');
ok('le format vient du libellé défilant', atlas.livre.format === 'broché');
ok('auteur collectif détecté depuis le JSON-LD',
  atlas.livre.auteurType === 'collectif' && /Collectif/.test(atlas.livre.auteur));
ok('identifiant produit tiré de l’URL demandée', atlas.produitId === '99000001' && atlas.livre.id === 'fnac-a99000001');
ok('le type thématique suit la catégorie Fnac', atlas.livre.type === 'atlas-mondial');

/* L'identifiant produit ne se devine JAMAIS dans le corps de page. */
const sansUrl = lireFixture('fiche-fnac-sans-magasin.html');
ok('sans URL ni canonique, aucun identifiant produit n’est inventé',
  sansUrl.produitId === '' && sansUrl.livre.id === '');
const canonique = lireFixture('fiche-fnac-indisponible.html');
ok('l’URL canonique de la page fournit l’identifiant produit',
  canonique.produitId === '99000004' && canonique.livre.id === 'fnac-a99000004');

/* ===================================================================== */
titre('3. Bloc disponibilité — ce que la page AFFIRME, rien de plus');
/* ===================================================================== */
ok('« En stock en magasin » + « Retrait gratuit sous 1H » → exploitable',
  atlas.etat === 'en-stock-magasin' && atlas.delai === 'sous 1H' && atlas.exploitable === true);
ok('le magasin annoncé est recopié tel quel', atlas.magasinAnnonce === 'Toulouse - Labège');
ok('le magasin annoncé est rattaché à l’identifiant officiel', atlas.magasinId === 'cl57');
ok('la disponibilité est attribuée au magasin choisi',
  atlas.livre.disponibilite.cl57 && atlas.livre.disponibilite.cl57.statut === 'disponible'
  && atlas.livre.disponibilite.cl57.delai === 'sous 1H');
ok('la disponibilité est horodatée (fenêtre de fraîcheur du jeu)',
  !!atlas.livre.disponibilite.cl57.checkedAt && Date.parse(atlas.livre.disponibilite.cl57.checkedAt) > 0);
ok('aucune alerte bloquante sur une fiche claire', atlas.ok === true && atlas.alertes.length === 0);

const livrable = lireFixture('fiche-fnac-livrable-1j.html');
ok('« Livrable en magasin » + « sous 1J » → refusé (l’ouvrage n’est pas en rayon)',
  livrable.etat === 'livrable-magasin' && livrable.delai === 'sous 1J'
  && livrable.exploitable === false && livrable.disponibilite.statut === 'indisponible');
ok('le motif explique pourquoi, sans jargon',
  /acheminer/i.test(livrable.motif) && /rayon/i.test(livrable.motif));
ok('un magasin ANNONCÉ DIFFÉRENT du magasin choisi est signalé',
  livrable.alertes.some((a) => a.code === 'magasin-different'));
ok('…et la disponibilité n’est PAS attribuée au magasin choisi',
  !livrable.livre.disponibilite.cl57 && livrable.magasinId === '');

const sansMagasin = lireFixture('fiche-fnac-sans-magasin.html');
ok('page sans magasin annoncé : aucun délai, aucune attribution',
  sansMagasin.magasinAnnonce === '' && sansMagasin.delai === '' && sansMagasin.exploitable === false);
ok('« En stock en magasin » sans délai précisé n’est JAMAIS pris pour « sous 1 h »',
  /non précisé/.test(sansMagasin.motif) && sansMagasin.alertes.some((a) => a.code === 'delai-non-precise'));
ok('l’absence de magasin est signalée à l’opérateur',
  sansMagasin.alertes.some((a) => a.code === 'magasin-non-annonce'));

const indispo = lireFixture('fiche-fnac-indisponible.html');
ok('« Indisponible en magasin » l’emporte sur « Stock en ligne épuisé »',
  indispo.etat === 'indisponible-magasin' && indispo.exploitable === false);
ok('des offres uniquement partenaires sont marquées comme telles',
  indispo.vendeur === 'partenaire' && indispo.vendeursPartenaires.length === 1);
ok('une offre partenaire NE DISQUALIFIE PAS l’offre Fnac',
  livrable.vendeur === 'fnac' && livrable.vendeursPartenaires.indexOf('GibertFictif') >= 0);

ok('une page sans aucun libellé connu reste « inconnue » (jamais devinée)',
  (() => {
    const r = L.interpreterDisponibilite(L.htmlVersLignes('<html><body><p>Prix 12 €</p></body></html>'),
      { magasins: MAGASINS, magasinId: 'cl57', maintenant });
    return r.etat === 'inconnu' && r.statut === 'indisponible' && r.exploitable === false
      && r.alertes.some((a) => a.code === 'disponibilite-illisible');
  })());

/* ===================================================================== */
titre('4. Texte collé (markdown) — le même lecteur, sans HTML');
/* ===================================================================== */
const colle = lireFixture('fiche-fnac-texte-colle.md');
ok('le titre vient de la ligne « # Titre »', colle.titre === 'Guide fictif des escales inventees');
ok('le libellé défilant collé à la date est découpé proprement',
  colle.livre.etiquetteFnac === 'Guide de voyage (broché)');
ok('le nom d’auteur ne pollue PAS le libellé',
  !/Navigatrice|Auteur/i.test(colle.livre.etiquetteFnac) && !/Paru/i.test(colle.livre.categorieFnac));
ok('le magasin et le délai sont lus depuis du texte brut',
  colle.magasinAnnonce === 'Toulouse - Labège' && colle.delai === 'sous 1H' && colle.exploitable === true);
ok('éditeur et EAN lus depuis du markdown',
  colle.livre.editeur === 'Éditions du Large Fictif' && colle.livre.ean === '2000000001029');

/* ===================================================================== */
titre('5. Rapprochement du magasin annoncé — on ne tranche jamais au hasard');
/* ===================================================================== */
const resoudre = (nom) => L.resoudreMagasin(nom, MAGASINS);
ok('« Fnac Toulouse - Labège » → cl57', resoudre('Fnac Toulouse - Labège').id === 'cl57');
ok('« Fnac Labège » → cl57 (variante courte)', resoudre('Fnac Labège').id === 'cl57');
ok('« Fnac Bordeaux » → le magasin de Bordeaux', resoudre('Fnac Bordeaux').id === 'cl116');
ok('« Fnac Bordeaux Lac » ne tombe PAS sur Bordeaux', resoudre('Fnac Bordeaux Lac').id === 'cl115');
ok('« Fnac Paris - Saint-Lazare » → la fiche officielle correspondante',
  !!resoudre('Fnac Paris - Saint-Lazare').id);
ok('« Fnac Toulouse Jeanne d’Arc » : les lettres isolées ne cassent pas la résolution',
  !!resoudre('Fnac Toulouse Jeanne d Arc').id);
ok('« Fnac Lyon Part-Dieu » est AMBIGU : refus de trancher',
  resoudre('Fnac Lyon Part-Dieu').id === null && resoudre('Fnac Lyon Part-Dieu').ambigu === true);
ok('un magasin fermé est signalé comme tel, jamais retenu',
  (() => { const r = resoudre('Fnac Sainte-Marie-Des-Champs'); return r.id === null && r.inactif === true; })());
ok('« Fnac Billetterie » n’est pas un magasin', resoudre('Fnac Billetterie').id === null);
ok('« Fnac+ » n’est pas un magasin', resoudre('Fnac+').id === null);
ok('un nom inconnu reste inconnu', resoudre('Fnac Atlantide').id === null);
ok('les candidats sont listés pour que l’opérateur tranche',
  resoudre('Fnac Lyon Part-Dieu').candidats.length >= 2);

/* ===================================================================== */
titre('6. Délais — le vocabulaire réel du site, sans interprétation');
/* ===================================================================== */
const delai = (t) => L.lireDelai(t).delai;
ok('« Retrait gratuit sous 1H » → sous 1H', delai('Retrait gratuit sous 1H') === 'sous 1H');
ok('« Retrait 1H en magasin » → sous 1H', delai('Retrait 1H en magasin') === 'sous 1H');
ok('« Retrait gratuit sous 1J » → sous 1J', delai('Retrait gratuit sous 1J') === 'sous 1J');
ok('« Retirer en 1J en magasin » → sous 1J', delai('Retirer en 1J en magasin') === 'sous 1J');
ok('« Disponible sous 2H » → sous 2H (lu, puis refusé par le moteur)', delai('Disponible sous 2H') === 'sous 2H');
ok('« Retrait gratuit » seul → aucun délai lu (jamais « 1 h » par défaut)', delai('Retrait gratuit') === '');
ok('rien de lisible → aucun délai', delai('Voir toutes les options de livraison') === '');

/* ===================================================================== */
titre('7. Pont avec le moteur — la disponibilité lue est-elle exploitable ?');
/* ===================================================================== */
const dispoAtlas = atlas.livre.disponibilite.cl57;
ok('le moteur accepte la disponibilité lue sur la fiche',
  M.disponibiliteValide(dispoAtlas, 'cl57', { maintenant }).ok === true);
ok('le moteur refuse un retrait sous 1 jour',
  M.disponibiliteValide(Object.assign({}, dispoAtlas, { delai: 'sous 1J' }), 'cl57', { maintenant }).ok === false);
ok('le moteur refuse un délai absent',
  M.disponibiliteValide(Object.assign({}, dispoAtlas, { delai: '' }), 'cl57', { maintenant }).ok === false);
ok('le moteur refuse une disponibilité périmée (fenêtre de 15 min)',
  M.disponibiliteValide(Object.assign({}, dispoAtlas,
    { checkedAt: new Date(maintenant - 20 * 60000).toISOString() }), 'cl57', { maintenant }).ok === false);
ok('le moteur refuse une disponibilité attribuée à un autre magasin',
  M.disponibiliteValide(dispoAtlas, 'cl116', { maintenant }).ok === false);
ok('« en rayon » / « retrait immédiat » sont des affirmations acceptées',
  M.delaiAccepte('en rayon') && M.delaiAccepte('retrait immédiat') && M.delaiAccepte('Retrait gratuit sous 1H'));
ok('« demain » et « sous 1J » restent refusés par le moteur',
  !M.delaiAccepte('demain') && !M.delaiAccepte('sous 1J') && !M.delaiAccepte('1 h 30'));

/* Sélection : seul l'ouvrage confirmé sous 1 h est retenu. */
const catalogue = [atlas.livre, livrable.livre, sansMagasin.livre, canonique.livre]
  .filter((l) => l.ean)
  .map((l) => (l.id ? l : Object.assign({}, l, { id: 'fnac-' + l.ean })));
const sel = M.candidats(catalogue, 'cl57', { maintenant, fenetreMinutes: 15 });
ok('la sélection ne retient QUE l’ouvrage confirmé sous 1 h au magasin choisi',
  sel.retenus.length === 1 && sel.retenus[0].ean === '2000000001005');
ok('les autres sont écartés avec un motif lisible',
  sel.ecartes.length === 3 && sel.ecartes.every((e) => e.motif && e.motif.length > 5));
ok('les motifs parlent de délai, de stock ou de magasin — jamais d’un titre',
  sel.ecartes.every((e) => /d[ée]lai|disponibilit|indisponible|rayon|magasin|partenaire|th[ée]matique/i.test(e.motif))
  && sel.ecartes.every((e) => catalogue.every((l) => !l.titre || e.motif.indexOf(l.titre) < 0)));
const choix = M.choisirLivre(catalogue, 'cl57', { sel: 'test-lecteur', maintenant, fenetreMinutes: 15 });
ok('choisirLivre retombe sur l’ouvrage disponible', choix.livre && choix.livre.ean === '2000000001005');
ok('aucun ouvrage disponible → aucun tirage, et un motif clair',
  (() => {
    const r = M.choisirLivre([livrable.livre], 'cl57', { sel: 'x', maintenant });
    return !r.livre;
  })());

/* ===================================================================== */
titre('8. La cartouche publique ne révèle rien de la fiche');
/* ===================================================================== */
const gen = M.genererCartouche(atlas.livre, {
  magasinId: 'cl57', sel: 'sel-lecteur', maintenant,
  iterations: { ean: 2000, texte: 500 }
});
const publique = JSON.stringify(gen.cartouche);
ok('aucun titre', publique.indexOf(atlas.livre.titre) < 0 && !/oceans perdus/i.test(publique));
ok('aucun EAN', publique.indexOf(atlas.livre.ean) < 0);
ok('aucun SKU', publique.indexOf(atlas.livre.sku) < 0);
ok('aucun nom d’éditeur', publique.indexOf(atlas.livre.editeur) < 0);
ok('aucun nom de magasin annoncé (le joueur ne sait pas d’où vient la donnée)',
  publique.indexOf('Toulouse - Labège') < 0 && publique.indexOf('Labège') < 0);
ok('le secret, lui, contient les réponses (coffre chiffré uniquement)',
  gen.secret.reponses.ean === atlas.livre.ean && !!gen.secret.reponses.premierMot);
ok('la disponibilité de la cartouche reste nominative mais muette',
  gen.cartouche.disponibilite.delai === 'sous 1H' && !gen.cartouche.disponibilite.magasinAnnonce);

/* ===================================================================== */
titre('9. Découverte de fiches depuis une page de rayon');
/* ===================================================================== */
const liens = L.extraireLiensFiches(fixture('rayon-fnac-livres.html'));
ok('les fiches /a<id> sont découvertes', liens.length === 3);
ok('les identifiants sont dédoublonnés', new Set(liens.map((l) => l.produitId)).size === liens.length);
ok('les liens qui ne sont pas des fiches sont ignorés',
  !liens.some((l) => /aide|s20/.test(l.url)));
ok('les URL absolues et relatives sont toutes deux comprises',
  liens.some((l) => l.produitId === '99000002') && liens.some((l) => l.produitId === '99000001'));
ok('urlFiche normalise un identifiant ou une URL',
  L.urlFiche('99000001') === 'https://www.fnac.com/a99000001'
  && L.urlFiche('https://www.fnac.com/a99000003/x?wanderlu=1') === 'https://www.fnac.com/a99000003'
  && L.urlFiche('n importe quoi') === '');

/* ===================================================================== */
titre('10. Respect de robots.txt et absence de contournement');
/* ===================================================================== */
const permis = (u) => L.robotsAutorise(u).ok;
ok('une fiche produit est publique', permis('https://www.fnac.com/a99000001/x'));
ok('une page de rayon est publique', permis('https://www.fnac.com/s20/Roman-et-Nouvelles'));
ok('une page d’éditeur et d’auteur sont publiques',
  permis('https://www.fnac.com/e99999/Editeur') && permis('https://www.fnac.com/ia7641/Auteur'));
ok('une page magasin est publique', permis('https://www.fnac.com/Toulouse-Labege/Fnac-Labege/cl57/w-4'));
ok('le localiseur officiel est public', permis('https://www.fnac.com/localiser-magasin-fnac/w-4'));
ok('la recherche filtrée est INTERDITE (robots.txt : SFilt)',
  !permis('https://www.fnac.com/SearchResult/ResultList.aspx?SFilt=1'));
ok('la recherche paginée est INTERDITE (robots.txt : PageIndex)',
  !permis('https://www.fnac.com/SearchResult/ResultList.aspx?PageIndex=2'));
ok('la page de recherche n’est pas utilisée du tout',
  !permis('https://www.fnac.com/SearchResult/ResultList.aspx?Search=atlas'));
ok('les espaces compte et commande sont interdits',
  !permis('https://www.fnac.com/Account/x') && !permis('https://www.fnac.com/OrderPipe/x')
  && !permis('https://www.fnac.com/basket/add'));
ok('/api/* est écarté (Noindex robots.txt)', !permis('https://www.fnac.com/api/availability'));
ok('un autre hôte est refusé', !permis('https://example.com/a99000001'));
ok('une URL illisible est refusée', !permis('pas-une-url'));
ok('les jetons anti-bot sont CONSTATÉS, jamais fabriqués',
  L.jetonsAntiBot('https://www.fnac.com/a99000003/x?wanderlu=477660&quizzi=505238').join(',') === 'wanderlu,quizzi');
ok('aucun jeton inventé sur une URL propre', L.jetonsAntiBot('https://www.fnac.com/a99000001').length === 0);
ok('le lecteur ne contient AUCUN appel réseau',
  !/\bfetch\s*\(|XMLHttpRequest|axios|https?\.request/.test(lire('fnac-lecteur.js')));
ok('le panneau admin n’appelle jamais fnac.com',
  !/fnac\.com\/a\d/.test(lire('admin-artefact.js'))
  && !/fetch\s*\(\s*['"]https?:\/\/[^'"]*fnac/i.test(lire('admin-artefact.js')));

/* ===================================================================== */
titre('11. Garde-fous de l’outil de collecte');
/* ===================================================================== */
ok('un mur anti-bot (403/429/503) est reconnu',
  OUTIL.estMurAntiBot(403, '') && OUTIL.estMurAntiBot(429, '') && OUTIL.estMurAntiBot(503, ''));
ok('une page de vérification à la place de la fiche est reconnue',
  OUTIL.estMurAntiBot(200, '<html>Veuillez vérifier que vous n’êtes pas un robot</html>')
  && OUTIL.estMurAntiBot(200, 'Datadome challenge'));
ok('une fiche normale n’est PAS prise pour un mur',
  !OUTIL.estMurAntiBot(200, fixture('fiche-fnac-en-stock-1h.html')));
ok('le rapport masque les données par défaut',
  OUTIL.masquer('Atlas fictif des oceans perdus', 18).startsWith('…')
  && OUTIL.masquer('2000000001005', 4) === '…1005');

const fusion = OUTIL.fusionnerCatalogue(
  [{ id: 'a', ean: '2000000001005', titre: 'Ancien', disponibilite: { cl57: { statut: 'disponible' } } }],
  [{ id: 'a', ean: '2000000001005', titre: '', disponibilite: { cl116: { statut: 'indisponible' } } },
   { id: 'b', ean: '2000000001005', titre: 'Doublon d’EAN', disponibilite: {} }]
);
ok('la fusion dédoublonne par identifiant', fusion.filter((l) => l.id === 'a').length === 1);
ok('la fusion dédoublonne par EAN (deux éditions = deux EAN, pas deux fois le même)',
  fusion.filter((l) => l.ean === '2000000001005').length === 1);
ok('la fusion ADDITIONNE les disponibilités par magasin',
  !!fusion[0].disponibilite.cl57 && !!fusion[0].disponibilite.cl116);
ok('la fusion n’écrase pas un titre existant avec du vide', fusion[0].titre === 'Ancien');

ok('un chemin publié par GitHub Pages est refusé pour le catalogue réel',
  OUTIL.cheminProtege(path.join(racine, 'data', 'magasins-fnac.json'), {}).ok === false);
ok('le chemin gitignoré est accepté',
  OUTIL.cheminProtege(path.join(racine, 'data', 'catalogue-artefacts.local.json'), {}).ok === true);
ok('un chemin hors dépôt est accepté', OUTIL.cheminProtege('/tmp/catalogue.json', {}).ok === true);
ok('le refus explique pourquoi', /GitHub Pages|gitignore/i.test(
  OUTIL.cheminProtege(path.join(racine, 'data', 'magasins-fnac.json'), {}).motif));

const verifVide = OUTIL.verifierCatalogue([], 'cl57', { strict: true });
ok('un catalogue vide est refusé', verifVide.problems.length > 0 && verifVide.prets === 0);
const verifPret = OUTIL.verifierCatalogue([atlas.livre], 'cl57', { strict: true });
ok('un ouvrage confirmé sous 1 h rend la mission possible',
  verifPret.problems.length === 0 && verifPret.prets === 1 && verifPret.selection.retenus === 1);
const verifPerime = OUTIL.verifierCatalogue(
  [Object.assign({}, atlas.livre, {
    disponibilite: { cl57: Object.assign({}, dispoAtlas, { checkedAt: new Date(maintenant - 60 * 60000).toISOString() }) }
  })], 'cl57', { strict: true });
ok('une disponibilité périmée bloque la mission (à reconfirmer)',
  verifPerime.prets === 0 && verifPerime.problems.length > 0);
ok('la vérification utilise la fenêtre de fraîcheur du jeu',
  verifPret.selection.fenetreMinutes === M.FENETRE_FRAICHEUR_MINUTES);

const opts = OUTIL.lireOptions(['node', 'x', '--magasin', 'cl57', '--fiche', 'https://www.fnac.com/a99000001',
  '--max', '5', '--dry-run', '--verbose', '--large']);
ok('les options sont lues', opts.magasin === 'cl57' && opts.fiches.length === 1 && opts.max === 5
  && opts.dryRun === true && opts.verbose === true && opts.strict === false);
ok('le plafond de fiches est borné',
  OUTIL.lireOptions(['node', 'x', '--max', '99999']).max <= 60);
ok('une option inconnue est refusée', (() => {
  try { OUTIL.lireOptions(['node', 'x', '--inconnu']); return false; } catch (e) { return true; }
})());

/* ===================================================================== */
titre('12. Staticité — aucune donnée Fnac réelle dans le dépôt publié');
/* ===================================================================== */
const fichiersNouveaux = ['fnac-lecteur.js', 'tools/sync-catalogue-artefacts.mjs',
  'tools/tests-fnac-lecteur.mjs', 'admin-artefact.js'];
const fixturesListe = fs.readdirSync(path.join(racine, 'tools', 'fixtures'))
  .filter((f) => /\.(html|md|json)$/.test(f)).map((f) => 'tools/fixtures/' + f);
const tous = fichiersNouveaux.concat(fixturesListe).map((f) => ({ f, s: lire(f) }));
ok('aucun EAN de livre réel (978/979…) dans les nouveaux fichiers ni les fixtures',
  tous.every(({ s }) => !/\b9(?:78|79)\d{10}\b/.test(s)));
ok('les fixtures ne portent que des EAN fictifs de la plage interne, valides',
  tous.filter((x) => x.f.startsWith('tools/fixtures/')).every(({ s }) => (s.match(/\b\d{13}\b/g) || [])
    .every((e) => /^2\d{12}$/.test(e) && M.eanValide(e))));
ok('aucun SKU numérique à 7 chiffres (format Fnac) dans les nouveaux fichiers',
  tous.every(({ s }) => !/sku['"]?\s*[:=]\s*['"]?\d{7}\b/i.test(s)));
ok('le lecteur annonce ses limites noir sur blanc',
  /NE DEVINE JAMAIS/i.test(lire('fnac-lecteur.js')) && /session du visiteur/i.test(lire('fnac-lecteur.js')));
ok('l’outil annonce l’absence d’API de stock et la validation humaine',
  /DÉCLARATIVE/i.test(lire('tools/sync-catalogue-artefacts.mjs'))
  && /contournement/i.test(lire('tools/sync-catalogue-artefacts.mjs')));
ok('le catalogue local réel est ignoré par git',
  /catalogue-artefacts\.local\.json/.test(lire('.gitignore'))
  && /\.local\.json/.test(lire('.gitignore')));

/* ===================================================================== */
titre('13. Exécution CI — lecture publique, rapport anonyme, dépôt intact');
/* ===================================================================== */
const wfDispo = lire('.github/workflows/verifier-disponibilite-artefact.yml');
const fn = lire('functions/index.js');
ok('déclenchement MANUEL uniquement : on ne mitraille pas fnac.com à heure fixe',
  /workflow_dispatch/.test(wfDispo) && !/^\s*schedule:/m.test(wfDispo));
ok('aucun commit, aucun push, aucune pull request : le dépôt n’est jamais modifié',
  !/git commit|git push|gh pr create/.test(wfDispo));
ok('le dépôt est vérifié intact en fin d’exécution', /Dépôt intact|git diff --quiet/.test(wfDispo));
ok('la collecte tourne en dry-run et en rapport ANONYME',
  /--dry-run/.test(wfDispo) && /--anonyme/.test(wfDispo));
ok('permissions minimales : lecture seule du dépôt', /contents: read/.test(wfDispo));
ok('le cookie de session est posé HORS du dépôt, verrouillé, puis supprimé',
  /RUNNER_TEMP/.test(wfDispo) && /chmod 600/.test(wfDispo) && /rm -f/.test(wfDispo));
/* Le NOM du secret peut apparaître dans un message d'erreur ; sa VALEUR
   ne doit jamais passer par une sortie de journal. */
const lignesSecret = wfDispo.split('\n').filter((l) => l.includes('secrets.FNAC_SESSION_COOKIE'));
ok('la valeur du secret n’est jamais journalisée',
  lignesSecret.length >= 2 && lignesSecret.every((l) => !/\becho\b/.test(l)));
ok('l’exécution annonce la limite honnête : le magasin suit la session du visiteur',
  /SESSION du visiteur/i.test(wfDispo));
ok('un mur anti-bot arrête l’exécution, sans contournement',
  /anti-bot/.test(wfDispo) && /403\/429\/503/.test(wfDispo));
ok('la page de recherche est explicitement écartée (robots.txt)',
  /SFilt/.test(wfDispo) && /PageIndex/.test(wfDispo));
ok('le workflow de la liste des magasins reste hebdomadaire (donnée non sensible)',
  /cron: '0 3 \* \* 0'/.test(lire('.github/workflows/sync-magasins-fnac.yml')));

/* La fonction serveur ne collecte RIEN : elle vérifie ce qui a été confirmé. */
ok('la fonction serveur ne charge PAS le lecteur de fiches',
  !/require\('\.\/fnac-lecteur\.js'\)/.test(fn));
ok('la fonction serveur n’émet aucune requête sortante',
  !/\bfetch\s*\(/.test(fn) && !/https?:\/\/[^\s'"]*fnac/i.test(fn));
ok('la fonction explique POURQUOI elle ne lit pas fnac.com',
  /SESSION du visiteur/i.test(fn) && /anti-bot/i.test(fn));
ok('UNE seule source de lecture, partagée par l’outil Node, le panneau admin et la page',
  /NautilusFnacLecteur\s*=/.test(lire('fnac-lecteur.js'))
  && /window\.NautilusFnacLecteur/.test(lire('admin-artefact.js'))
  && /fnac-lecteur\.js/.test(lire('tools/sync-catalogue-artefacts.mjs'))
  && /fnac-lecteur\.js/.test(lire('1831411720.html')));

/* ===================================================================== */
console.log('\n' + '─'.repeat(60));
console.log(reussis + ' test(s) réussi(s), ' + echoues + ' échec(s).');
console.log('RESULTAT_HEX=' + Buffer.from(reussis + '/' + echoues).toString('hex'));
if (echoues) { console.log('❌ Lecteur Fnac : des règles ont dérivé — corrige avant de publier.'); process.exit(1); }
console.log('✅ Lecteur Fnac : disponibilité lue sans rien deviner, collecte bornée, aucune donnée réelle au dépôt.');
process.exit(0);
