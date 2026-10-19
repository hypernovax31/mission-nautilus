# Contrat serveur du palier 3

Les endpoints doivent être implémentés côté Firebase Functions ou backend équivalent, avec authentification administrateur pour les opérations d’administration.

## Client → serveur

- `POST /palier3/session/start`: reçoit uniquement `storeId` et crée la session.
- `POST /palier3/session/scan`: reçoit `sessionId` et `scannedEan`.
- `POST /palier3/session/answer`: reçoit `sessionId`, `stage`, `answer`.
- `POST /palier3/session/hint`: reçoit `sessionId` et le type d’indice.
- `POST /palier3/session/book-unavailable`: reçoit `sessionId`.

## Réponse publique

Le serveur ne renvoie jamais l’EAN attendu, le SKU, l’URL Fnac, les réponses, les données de stock détaillées ni les métadonnées confidentielles du livre.

## Règles métier

- le livre est verrouillé pour la session au lancement ;
- la fraîcheur du stock concerne uniquement la sélection initiale ;
- le joueur n’est pas pénalisé si l’ouvrage disparaît ;
- la troisième erreur déclenche la remontée ;
- un indice impose respectivement 1 h, 2 h ou 4 h de blocage ;
- le remplacement administrateur conserve la progression validée ;
- chaque import Web est validé dans une zone temporaire avant publication ;
- les sessions en cours conservent leur snapshot et ne changent pas rétroactivement.
