# Palier 3 — Cloud Function `artefact` (facultative)

Le Palier 3 « l'artefact du Nautilus » fonctionne **sans** cette fonction :
le mode par défaut (`operateur`) tourne sur un simple hébergement statique
(GitHub Pages / Firebase Hosting), la disponibilité étant confirmée à la main
dans le panneau admin.

Cette fonction sert uniquement à **déplacer côté serveur** les deux décisions
qu'un client pourrait trafiquer :

| Route              | Rôle                                                              |
|--------------------|-------------------------------------------------------------------|
| `POST /selectionner` | choisit l'ouvrage d'un équipage et verrouille la session          |
| `POST /verifier`     | vérifie une réponse (empreintes salées) et compte les erreurs     |
| `POST /introuvable`  | signale un ouvrage introuvable (aucune erreur comptée)            |
| `GET  /etat`         | progression d'une session (jamais de titre, d'EAN ni de SKU)      |
| `GET  /sante`        | version, mode, fenêtre de fraîcheur                               |

## Ce qu'elle ne fait pas

- **Aucune requête vers `fnac.com`.** Aucun formulaire d'authentification,
  CAPTCHA ou anti-bot n'est contourné. La disponibilité provient de la
  confirmation de l'organisateur (ou, un jour, d'un flux officiel/partenaire
  contractuel : il se brancherait dans `verifierDisponibilite()`, et nulle
  part ailleurs).
- **Aucune donnée d'ouvrage n'est renvoyée** : les réponses contiennent les
  mêmes empreintes que la cartouche publique.

## Déploiement

```bash
cd ..                                   # à la racine du dépôt
npm install -g firebase-tools
firebase login
firebase use mission-nautilus
firebase deploy --only functions:artefact
```

Le plan **Blaze** est requis (fonctions sortantes). Le `predeploy` copie
`artefact-moteur.js` dans `functions/` : le moteur est pur et partagé, une
seule source de vérité pour les règles du jeu (cette copie est ignorée par
git).

Puis, dans le panneau admin → onglet **📖 Artefact** → *Configuration du
service* :

1. mode = `fonction` ;
2. endpoint = `https://artefact-<hash>.ew.r.cloudfunctions.net/artefact`
   (l'URL affichée par `firebase deploy`) ;
3. **Enregistrer**.

Enfin, basculer sur les **règles Firestore strictes** (bloc commenté en fin
de `firestore.rules`) pour que les sessions ne soient plus écrites par le
navigateur : seule la fonction écrit, avec le SDK admin.

## Test local

```bash
firebase emulators:start --only functions,firestore
curl http://127.0.0.1:5001/mission-nautilus/europe-west1/artefact/sante
```
