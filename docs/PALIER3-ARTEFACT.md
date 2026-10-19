# Palier 3 — « l'artefact du Nautilus »

> Chasse à l'ouvrage en magasin, adaptative, vérifiée par scan du code-barres.
> Ce document s'adresse à l'organisateur (le « capitaine ») et à toute personne
> qui reprend le code. Il dit ce qui est protégé, **et ce qui ne l'est pas**.

---

## 1. Ce qui a changé

| Avant | Après |
|---|---|
| Palier 3 = puzzle photo (`puzzle-palier3.js`, 36 éclats) | Palier 3 = **chasse à l'ouvrage** dans un magasin Fnac |
| Épreuve jouable devant un écran | Épreuve **réelle** : il faut marcher jusqu'au rayon |
| Contenu figé dans le dépôt | Ouvrage **choisi à chaque lancement** parmi ceux qui sont disponibles |
| `css/palier3.css` | `css/artefact.css` |
| 3 révélations → remontée | **3 réponses refusées** → remontée (même barème global) |

L'identifiant d'étape reste **`son`** et l'étape suivante **`zone51`** : les
fiches d'équipage, les records et le cockpit ne bougent pas.

`puzzle-palier3.js` et `css/palier3.css` sont conservés mais **dépréciés**
(en-tête dans chaque fichier, plus aucun chargement, plus de precache).

---

## 2. Le jeu, côté matelot

1. **Le magasin.** À l'accueil (carte « MAGASIN DE LA MISSION ») ou au début du
   Palier 3 : liste officielle des 191 magasins Fnac, recherche par ville ou
   code postal, géolocalisation **sur un geste**. Le choix est mémorisé sur
   l'appareil (`localStorage`, clé `nautilusMagasin`) — **aucune coordonnée GPS
   n'est conservée ni transmise**.
2. **L'indice.** Une énigme décrit l'ouvrage **sans jamais nommer** le rayon, le
   titre, l'auteur, l'éditeur ni l'édition. Elle dépend de la *famille*
   thématique de l'ouvrage (11 familles, toutes reliées à l'univers du
   Nautilus : atlas du monde, atlas maritimes, guides, récits d'exploration,
   sciences des profondeurs, littérature d'aventure, nature marine, technique,
   jeunesse, images, études).
3. **Le sceau.** Le matelot présente l'ouvrage : lecture du code-barres
   (EAN-13) par `BarcodeDetector` natif, sinon ZXing, sinon **saisie des 13
   chiffres**. Aucune image n'est envoyée nulle part.
4. **Trois épreuves**, tirées de la couverture et de la fiche — jamais de
   l'intérieur du livre (aucune page, aucune carte, aucun index) :
   * **la couverture** : le premier mot *significatif* du titre (article initial
     ignoré) ;
   * **la signature** : `NN-L-NN`, calculée selon une des trois règles tirées
     pour cette piste (lettres du premier mot + initiale du signataire + numéro
     d'édition, ou dernière lettre de l'éditeur, ou mots du titre + année) ;
   * **la chambre forte** : quatre fragments assemblés dans un **ordre annoncé**
     propre à la piste.

### Règles de jeu

* **3 réponses refusées** → remontée forcée en surface, barème global
  (`matelot-blocages.js`) : 1 h, 2 h, 4 h, 8 h, 12 h, puis 24 h. Le cran se
  compte en **remontées** (échecs + indices). Un rechargement de page ne change
  rien : le compteur vit dans Firestore.
* Un **code-barres illisible** ou une **réponse vide** ne comptent **pas** pour
  un échec : on ne punit pas la caméra d'un téléphone.
* **Relais** : pendant une remontée, un autre membre de l'équipage joue avec son
  Code Matelot. Message affiché, mot pour mot :
  > « Le poste de navigation est libre — Un membre de ton équipage est
  > temporairement retenu à la surface. Tu peux prendre le relais et poursuivre
  > la mission du Nautilus pendant son blocage. »
* **Trois indices payants** : le rayon (1 h), l'édition (2 h), l'auteur (4 h).
  Chacun exige un **sacrifice volontaire et confirmé**. L'indice reste acquis à
  **tout l'équipage** ; la remontée ne bloque que le matelot qui l'a demandé.
* **« Livre introuvable »** : signalement au capitaine, **aucune erreur**, la
  mission est suspendue jusqu'à ce qu'une autre piste soit affectée.
* **La forme est libre, le fond ne l'est pas** : `6-C-07`, `06-C-07`, `06C07`,
  `06 c 07` et `6c7` sont la même réponse (forme canonique calculée par le
  moteur).

---

## 3. Routine du capitaine (avant la partie)

Tout se passe dans le panneau admin → onglet **📖 Artefact** (présent sur
`index.html` **et** sur les pages palier, injecté par `admin-artefact.js` sans
dupliquer le HTML du panneau).

1. **Phrase d'administration** — c'est la seule vraie clé du système. Le code
   d'ouverture du panneau (`admin-button.js`) est **public dans le bundle** : il
   ne protège rien. La phrase, elle, n'est écrite **nulle part** (ni
   `localStorage`, ni Firestore, ni URL) et s'efface en fermant la page.
   Prends une **phrase longue** (≥ 20 caractères), différente du code admin.
2. **Magasin de référence** — choisis le magasin où joue l'équipage.
3. **Catalogue** — ajoute les ouvrages compatibles (titre, auteur + nature de la
   signature, éditeur, mention et numéro d'édition, année, **EAN**, **SKU**,
   libellé déroulant Fnac, rayon, type). Import JSON possible ; export local
   possible **vers `.nautilus-safe/`** (dossier ignoré par git) — **jamais dans
   le dépôt**, GitHub Pages servirait les solutions au monde entier.
4. **Disponibilité** — vérifie **à la main** sur fnac.com que ces ouvrages sont
   bien « retrait sous 1 h » dans ce magasin, saisis le libellé exact, puis
   clique **« Reconfirmer toutes les pistes du magasin »**. Cette confirmation
   est horodatée et n'est valable que **15 minutes au lancement** d'une mission
   (jamais un chrono pour le matelot).
5. **Pistes** — clique **« Générer les pistes du magasin »** : une cartouche
   anonymisée par ouvrage disponible.
6. **Pendant la partie** — l'onglet affiche chaque session : étape, réponses
   refusées, indice demandé, ouvrage signalé introuvable. Actions :
   * **📯 Transmettre l'indice** (la valeur exacte est pré-remplie depuis le
     coffre chiffré, modifiable avant envoi) ;
   * **🔁 Resélectionner le livre** (autre piste, **aucune erreur**, progression
     conservée ; si le sceau avait déjà reconnu l'ancien ouvrage, la séquence
     liée au livre repart de zéro — on ne mélange jamais deux éditions) ;
   * **🚫 Marquer l'ouvrage indisponible** (puis resélection) ;
   * **♻️ Réinitialiser la session**.

**Aperçu organisateur** : `1831411720.html?apercu=jeu&k=…` joue une partie
complète **hors ligne** avec le catalogue d'exemple (ouvrages fictifs, EAN de la
plage interne 200-299) et affiche les solutions dans le journal de bord. Aucun
blocage, aucune écriture réelle.

---

## 4. Architecture

```
artefact-moteur.js      règles pures (aucun DOM, aucun réseau) : empreintes,
                        EAN, familles, règles d'énigme, cartouche, messages
artefact-service.js     données : stockage (Firestore / mémoire / local),
                        chiffrement du catalogue, pistes, sessions
magasin-fnac.js         liste des magasins, recherche, géoloc, sélecteur
artefact-palier3.js     le jeu : écrans, sceau (scan EAN), pupitre, indices
admin-artefact.js       onglet admin, injecté dans le panneau existant
1831411720.html         page du Palier 3 (sas QR → briefing → épreuve)
index.html              carte « MAGASIN DE LA MISSION »
css/artefact.css        .af-* (jeu), .magasin-* (sélecteur), .adm-af-* (admin)
data/magasins-fnac.json 191 magasins (source : localiseur officiel Fnac)
data/catalogue-artefacts.example.json   structure + aperçu + tests (FICTIF)
tools/sync-magasins-fnac.mjs            synchronisation hebdomadaire
functions/                              Cloud Function facultative (mode serveur)
```

Le moteur est **UMD** : le même fichier sert au navigateur, aux tests Node et à
la Cloud Function (copié au prédeploy). Une seule source de vérité pour les
règles.

### Collections Firestore (`artefacts/…`)

| Document | Lecture | Contenu |
|---|---|---|
| `config` | publique | mode (`operateur`/`fonction`), endpoint, fenêtre de fraîcheur, versions |
| `magasins` | publique | miroir publié de la liste (prioritaire si plus récent) |
| `cartouches/{id}` | publique | l'énigme + les **empreintes** des réponses. Aucun titre, EAN, SKU |
| `sessions/{EQUIPE}` | publique | progression, erreurs, indices, historique, **copie de la cartouche** |
| `catalogue` | **authentifiée** | les ouvrages réels, **chiffrés AES-GCM** |
| `coffres/{id}` | **authentifiée** | les réponses en clair, **chiffrées AES-GCM** |

Écritures : session Firebase requise (authentification **anonyme**, comme le
reste du jeu).

La **cartouche est copiée dans la session** : si le stock bouge en cours de
partie, l'énigme du matelot ne change pas.

### Chiffrement

AES-GCM 256, clé dérivée de la phrase d'administration par **PBKDF2-SHA256,
200 000 itérations**, sel et IV aléatoires par coffre. WebCrypto exige un
contexte sécurisé : en HTTP simple ou `file://`, le module **refuse** et le dit
(pas de repli « en clair »).

---

## 5. Sécurité — ce qui tient, et ce qui ne tient pas

**Ce qui tient**

* Aucune donnée d'ouvrage dans le dépôt, dans le HTML, dans les CSS ni dans les
  scripts servis : un test **statique** interdit tout EAN `978/979…`, tout SKU
  et tout titre réel dans les fichiers joueurs.
* Le joueur ne voit que des **empreintes salées** (SHA-256 itéré) : la cartouche
  publique ne contient ni titre, ni EAN, ni SKU, ni éditeur, ni catégorie Fnac,
  ni réponse.
* Les textes d'énigme et les aides de méthode sont publics **par conception** :
  ils décrivent le contenu sans jamais nommer le rayon, l'éditeur, l'édition ou
  l'auteur (vérifié par test pour les 11 familles).
* Le catalogue et les coffres sont chiffrés ; la phrase n'est jamais stockée.
* Aucune requête vers `fnac.com` depuis le navigateur **ni** depuis la fonction
  serveur : aucun contournement d'authentification, de CAPTCHA ou d'anti-bot.
* La liste des magasins est extraite **côté CI**, validée, versionnée, publiée
  par pull request.
* Chaque champ venant du web est **nettoyé** avant d'entrer dans le DOM
  (`nettoyerTexte`, `echapper`) : pas d'injection HTML par la liste des
  magasins.

**Ce qui ne tient PAS (assumé, documenté)**

* **Le code admin est public.** `ADMIN_CODE` est dans le bundle : n'importe qui
  peut ouvrir le panneau. Ce qui protège le catalogue, c'est la **phrase**.
* **Un client peut tricher avec les règles Firestore.** En mode `operateur`,
  les sessions sont écrites par le navigateur : un joueur qui connaît Firestore
  peut s'écrire une victoire. La parade est le **mode `fonction`** : la Cloud
  Function choisit l'ouvrage et vérifie les réponses, et les règles passent en
  écriture interdite au client (bloc commenté à la fin de `firestore.rules`).
* **Une empreinte publiée se brute-force hors ligne.** Le compteur d'itérations
  (6 000 pour une réponse texte, 24 000 pour un EAN) est un **ralentisseur**,
  pas une protection : un attaquant motivé utilise du code natif ou un GPU. Le
  réglage est volontairement bas pour rester fluide sur téléphone (~30 ms par
  réponse, ~120 ms par scan). En mode `fonction`, aucune empreinte n'est
  publiée et la question disparaît.
* **La disponibilité est déclarative.** Pas d'API publique Fnac fiable : c'est
  l'organisateur qui confirme, et la confirmation n'est valable que 15 minutes
  au lancement. Si un flux officiel/partenaire existe un jour, il se branche
  dans `verifierDisponibilite()` (`functions/index.js`) — et nulle part ailleurs.
* **Les coordonnées des magasins sont des centroïdes de commune** (précision
  déclarée dans le fichier). Elles **suggèrent** le magasin le plus proche,
  elles ne le prouvent pas.

---

## 6. La liste des magasins

* **Source** : `https://www.fnac.com/localiser-magasin-fnac/w-4` (localiseur
  officiel, 191 magasins en octobre 2026).
* **Extraction** : `tools/sync-magasins-fnac.mjs`, deux adaptateurs (HTML pour
  la vraie page, markdown pour les fixtures/tests hors ligne).
* **Cadence** : `.github/workflows/sync-magasins-fnac.yml`, dimanche 03:00 UTC
  + déclenchement manuel. Résultat : une **pull request**, jamais un commit
  direct.
* **Garde-fous bloquants** : source injoignable, page vide, format changé,
  moins de 100 magasins, perte de plus de 20 % de la liste précédente,
  identifiants manquants ou dupliqués, fiches incomplètes → **publication
  refusée**, la liste en place est conservée.
* **Identifiants** : `cl<N>` (l'identifiant stable des fiches du localiseur).
  Quatre fiches n'ont **aucun lien** dans la page source (dont des DOM-TOM) :
  elles sont conservées avec `actif: false` et un motif — l'outil **n'invente
  jamais** d'identifiant.
* **Coordonnées** : le localiseur n'en publie aucune. L'outil **reporte** celles
  déjà vérifiées à la main et marque les nouveaux magasins
  `precision: "inconnue"` sans coordonnées (sélectionnables, mais absents des
  suggestions « le plus proche »). À compléter à la main avant publication.
* **Publication joueur** : le fichier statique, ou le miroir Firestore publié
  depuis l'admin (prioritaire s'il est plus récent).

---

## 7. Tests

```bash
node tools/tests-mission-nautilus.mjs       # 224 assertions (suite existante)
node tools/tests-artefact-palier3.mjs       # 266 assertions (règles, service, sécurité, intégration)
node tools/tests-artefact-interface.mjs     #  55 assertions (le jeu rendu pour de vrai, via jsdom)
```

Les deux premières suites tournent **sans aucune dépendance**. La troisième a
besoin de jsdom, installé hors dépôt :

```bash
npm install --prefix tools/.deps jsdom --no-audit --no-fund   # tools/.deps est ignoré par git
```

Sans jsdom, elle affiche un avertissement et rend la main avec un code de retour
nul.

Ce qu'elles vérifient, entre autres : sélection et exclusions motivées,
fraîcheur appliquée **au lancement seulement**, cartouche sans fuite, empreintes
déterministes, mauvais EAN rejeté, code illisible non compté, 3ᵉ erreur =
remontée, indices payants non répétés, livre introuvable sans pénalité,
resélection (avec et sans sceau déjà validé), chiffrement/déchiffrement et refus
sans la phrase, textes (relais mot pour mot, vocabulaire « matelot » /
« équipier », jamais « plongeur », jamais « balise »), garde-fous de
synchronisation, et — pour l'interface — l'enchaînement réel des écrans avec la
vérification qu'**aucune donnée d'ouvrage n'apparaît jamais dans le DOM**.

---

## 8. Déploiement

**GitHub Pages** (le site actuel) : rien à faire de plus que pousser. Le Palier
3 fonctionne en mode `operateur`.

**Firebase Hosting + Firestore** :

```bash
firebase deploy --only hosting,firestore:rules
```

`firebase.json` n'expose ni `functions/`, ni `tools/`, ni `docs/`, ni les `*.md`.

**Cloud Function (facultative, plan Blaze)** :

```bash
firebase deploy --only functions:artefact
```

Puis, dans l'admin : mode `fonction` + endpoint, **et** bascule sur les règles
strictes (bloc commenté en fin de `firestore.rules`). Détails :
`functions/LISEZ-MOI.md`.

Le service worker passe en `nautilus-v317` et précharge les nouveaux modules +
les deux fichiers de données (le sélecteur et l'aperçu fonctionnent hors ligne).

---

## 9. Limites connues / suites possibles

* `1941512821.html` (Palier 4) est **référencé** par l'écran de victoire mais
  **absent** du dépôt : le lien reste en place, la page est à créer.
* `LIEU_DESCRIPTION`, `QR_LOCATION_HINT` et `ZONE_RECHERCHE_HINT` (où trouver le
  QR du Palier 4) sont des **espaces réservés** à remplir par l'organisateur.
* Le mode `fonction` n'est **pas déployé** : le code est prêt, testé en logique,
  mais aucun déploiement n'a été effectué.
* Un jour : brancher un flux officiel de disponibilité (partenaire Fnac) dans
  `verifierDisponibilite()`, et passer les règles en écriture serveur exclusive.
* Le catalogue se saisit à la main. Un import assisté (coller une fiche produit,
  extraction des métadonnées **côté CI** puis validation humaine) est la suite
  logique — jamais depuis le navigateur.
