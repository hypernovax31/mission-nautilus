# Mots recherchés — Mission Nautilus

> Généré automatiquement — source de vérité : `palier1.html:MORSE_WORDS`, `1721310619.html:MOTS`, `data/catalogue-artefacts.example.json` + coffres chiffrés Palier 3.

## Palier 1 — Signal morse

40 mots possibles. Chaque équipage se voit attribuer **un seul mot fixe** (`teams/{code}.morseWordHash`). L'indice n°2 donne le nombre de lettres, le n°3 la première lettre.

| # | Mot recherché | Indice thématique |
|---|---|---|
| 1 | NAUTILE | Animal marin à coquille spiralée |
| 2 | ABYSSES | Profondeurs inexplorées de l'océan |
| 3 | EPAVES | Épave = navire échoué au fond |
| 4 | EQUATEUR | Ligne imaginaire autour de la Terre |
| 5 | OCEANES | Vastes mers salées |
| 6 | RECIFAL | Qualifie un récif corallien |
| 7 | SOUSMARIN | Bateau qui plonge sous l'eau |
| 8 | BARQUES | Petits bateaux de pêche |
| 9 | PHOQUES | Mammifères marins à nageoires |
| 10 | CETACES | Famille des baleines et dauphins |
| 11 | CORAIL | Animal qui forme les récifs |
| 12 | MEDUSES | Animaux gélatineux urticants |
| 13 | OURSINS | Petits animaux à piquants |
| 14 | CRUSTACE | Famille du crabe et de la crevette |
| 15 | BALEINES | Plus grands animaux marins |
| 16 | DAUPHINS | Cétacés intelligents et joueurs |
| 17 | REQUINS | Prédateurs au sourire de dents |
| 18 | ANCHOIS | Petits poissons bleus en banc |
| 19 | SARDINES | Petits poissons pêchés en boîte |
| 20 | MOULES | Mollusques des rochers |
| 21 | HUITRES | Mollusques précieux pour leurs perles |
| 22 | CREVETTES | Petits crustacés roses |
| 23 | LANGOUSTE | Grand crustacé à longues antennes |
| 24 | MAREEES | Mouvement quotidien de la mer |
| 25 | COURANTS | Flux d'eau continus dans l'océan |
| 26 | VAGUES | Elles roulent vers le rivage |
| 27 | ECUMES | Mousse blanche sur les crêtes |
| 28 | ALGUES | Végétaux marins |
| 29 | MANGROVE | Forêt des zones côtières tropicales |
| 30 | PROMENADE | Chemin le long de la côte |
| 31 | PHARE | Tour qui guide les navires |
| 32 | MARINIER | Qui concerne les marins |
| 33 | PIRATES | Ecumeurs des mers du temps de la voile |
| 34 | FLIBUSTIER | Pirate des Antilles |
| 35 | EQUIPAGES | Équipes à bord d'un navire |
| 36 | MATELOTS | Marins d'équipage |
| 37 | CAPITAINE | Commandant d'un navire |
| 38 | AMIRAUTE | Commandement supérieur de la marine |
| 39 | CHALUTIER | Bateau de pêche au filet |
| 40 | SOUSMARINE | Autre orthographe du sous-marin |

**Où voir le mot par équipe :** panneau admin → onglet **🔑 Réponses** → section *Palier 1* (référentiel statique). Le mot réel d'un équipage est stocké en Firestore : `teams/NEMO.morseWordHash` → à résoudre via `MORSE_WORDS.find(h===hash)`. Prochaine évolution : affichage direct du mot résolu après sélection d'équipage.

---

## Palier 2 — Mots croisés

Grille commune à tous les équipages — 11 mots (fichier `1721310619.html`).

| # | Mot recherché | Secteur | Définition affichée aux matelots |
|---|---|---|---|
| 1 | STEELBOOK | rayon | Coffret plat à deux volets, trempé contre l'oubli, dont la surface polie renvoie au possesseur son propre visage avant de lui concéder l'accès à la fiction qu'il abrite. |
| 2 | ECOTAXE | caisse | Obole de compensation opérée à l'instant de l'acquisition, destinée à provisionner la cérémonie ultérieure de démantèlement et la restauration des équilibres que l'objet aura fatigués par sa seule circulation. |
| 3 | PICKING | stock | Protocole chrono-opérationnel de matérialisation sélective, piloté par une matrice d'allocation omnicanale, qui convertit une intention transactionnelle en micro-séquences de navigation tactile au sein d'un environnement indexé, jusqu'à stabilisation de l'unité désignée dans son vecteur de circulation. |
| 4 | ANTISKATING | rayon | Procédé métaphysique chargé de stabiliser la dérive latérale d'un vecteur acoustico-mental en injectant, dans la trajectoire d'un sillon cognitif, une contre-résonance spectrale destinée à empêcher la pensée non formulée de glisser vers son propre centre. |
| 5 | NEURONAL | rayon | Accélérateur matériel pour opérations de réduction dimensionnelle sur espaces vectoriels de grande dimension, avec pipeline dédié aux produits scalaires massivement parallèles. |
| 6 | RAYTRACING | rayon | Opération de cartographie négative où l'on ne décrit pas ce qui est, mais ce qu'un parcours hypothétique aurait dû rencontrer pour que l'apparence finale puisse justifier sa propre présence. |
| 7 | REASSORT | stock | Cycle régénératif à cadence différée qui restaure l'équilibre densitaire d'un ensemble ordonné, en réinjectant depuis une réserve latente les unités manquantes d'une trame consommée, jusqu'à rétablissement de la continuité perceptive de l'alignement. |
| 8 | REPRISE | sav | Clause de filiation inversée consentie à tout bien vieillissant : l'opérateur d'origine l'absorbe à nouveau, en négocie la déchéance selon un barème d'érosion, puis lui désigne un successeur qui ignorera tout de l'aîné. |
| 9 | PLEIADE | rayon | Fratrie lumineuse issue d'un unique embrasement, dont le nombre consacré dépasse d'une unité le témoignage du regard — matrice de toutes les confréries d'éclat, jusqu'à cette bibliothèque de peau fine où l'on inhume les œuvres qu'on estime achevées. |
| 10 | DEFROISSEUR | rayon | Dispositif moderne qui ajuste les fréquences internes d'une matière pour apaiser les tensions invisibles entre ses états, sans jamais intervenir physiquement. |
| 11 | DIAPHRAGME | rayon | Module orbiculaire à rétraction polyphasique, saturé d'un bruit électro-spectral, qui contracte un interstice d'éclat pour dériver la densité du visible comme un mécanisme optico-analogique en dérive temporelle. |

Visible dans admin → **🔑 Réponses** → *Palier 2* (détails ouverts).

---

## Palier 3 — L'Artefact du Nautilus

4 étapes par cartouche : **Hublot (EAN) → Couverture (premier mot) → Signature → Chambre forte**.

### Livre à chercher en rayon

Le livre est **tiré au sort parmi le catalogue du magasin choisi** (191 magasins Fnac). Il est chiffré (AES-GCM) — jamais en clair dans le dépôt.

**À voir dans l'admin :** onglet **🔑 Réponses** → *Sessions en cours* → choisir équipage → *Voir les réponses* (après déverrouillage phrase admin 8+ caractères). L'en-tête vert **📖 Livre du Palier 3 — nom & EAN** affiche :

- **Titre complet** + auteur + éditeur
- **EAN 13 chiffres** (avec bouton *Copier l'EAN*)
- SKU, édition, année
- Les 4 réponses attendues (EAN, premier mot, signature `NN-L-NN`, code final)

Les **tentatives erronées** des équipages sont conservées dans `artefacts/sessions/{EQUIPE}.historique[].essai` et affichées dans l'historique (`essai : « … »`).

### Exemple (catalogue fictif, EAN internes 200-299 — jamais un vrai produit)

| id | Titre | Auteur | Éditeur | EAN | SKU |
|---|---|---|---|---|---|
| exemple-atlas-monde | Atlas fictif du monde illustré | Collectif Éditions Fictives | Éditions Exemple | 2000000000008 | EXEMPLE-0001 |
| exemple-recit-abysse | Voyage au centre des abysses | Jules Exemple | Le Navire Fictif | 2000000000015 | EXEMPLE-0002 |
| exemple-sciences-ocean | Les océans et leurs secrets | Marie Exemple | Sciences Fictives | 2000000000022 | EXEMPLE-0003 |

> ⚠️ Le vrai catalogue (livres réels, vrais EAN) est saisi dans l'admin et chiffré dans Firestore `artefacts/catalogue`. Ne jamais committer `data/*.local.json`.

---

## Notes par équipage (admin)

Nouveau bloc **📝 Mots recherchés — notes par équipage** en bas de l'onglet **🔑 Réponses** :

- Sélecteur d'équipage + textarea
- *Charger* / *Enregistrer* (stockage `localStorage` clé `nautilusNotesMotsRecherches`)
- *Exporter JSON* (`mots-recherches-notes-YYYY-MM-DD.json`)
- Liste récapitulative de toutes les notes enregistrées sur l'appareil

Utilisation : noter à la volée ce que chaque équipe cherche (`NEMO: P1=BALEINES · P3 Atlas EAN …`) pendant la course en magasin.

---

*Dernière mise à jour : 2026-10-22 — COMMIT 083748+ — admin-artefact.js v3 + artefact-service.js (journal essai) + docs/MOTS-RECHERCHES.md*
