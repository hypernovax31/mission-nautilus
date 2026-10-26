# Fixture — extrait du localiseur officiel Fnac (format markdown)

Utilisée par `tools/tests-artefact-palier3.mjs` pour vérifier l'adaptateur
markdown de `tools/sync-magasins-fnac.mjs` SANS accès réseau.
Extrait volontairement court : la synchronisation complète doit REFUSER une
liste aussi petite (garde-fou `MIN_MAGASINS`) — c'est précisément ce que le
test vérifie.

Source réelle : https://www.fnac.com/localiser-magasin-fnac/w-4

---

[Fnac Labège](https://www.fnac.com/Toulouse-Labege/Fnac-Labege/cl57/w-4)
Fnac Labège
700 La Pyrénéenne
Centre commercial Labège 2, ZAC Grande Borde
31670 Labège
Ouvre – dans 2 h 15 min

[Fnac Toulouse](https://www.fnac.com/Toulouse/Fnac-Toulouse/cl55/w-4)
Fnac Toulouse
10 Rue Alsace Lorraine
31000 Toulouse
Fermé

[Fnac Colmar](https://www.fnac.com/Houssen/Fnac-Colmar/cl106/w-4)
Fnac Colmar
Zone Artisanale, Route de Bâle
68125 Houssen
Ouvre – dans 1 h 05 min

[Fnac Lyon Part-Dieu](https://www.fnac.com/Lyon/Fnac-Lyon-Part-Dieu/cl89/w-4)
Fnac Lyon Part-Dieu
Centre Commercial Part-Dieu, 17 Rue Docteur Bouchut
69003 Lyon
Ouvre – dans 3 h 40 min

[Fnac Chartres](https://www.fnac.com/Chartres/Fnac-Chartres/cl108/w-4)
Fnac Chartres
10 Place des Halles
28000 Chartres
Fermé

Fnac Basse-Terre
Rue du Cimetière
97100 Basse-Terre
Fermé

<!-- Fiche sans lien : l'outil doit la signaler, PAS inventer un identifiant. -->
