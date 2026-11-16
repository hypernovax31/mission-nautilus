# Restauration de l’accueil et des animations

L’accueil récent a été récupéré depuis le commit
`95c9c20325f0af186d15f2886a09dc1b7c594629`, puis intégré dans la branche
`arena/01a01e78-mission-nautilus`, utilisée pour la publication du site.
Les pages et moteurs des paliers actuels ont été conservés.

Les corrections sont intégrées directement dans les fichiers du site :

- les rayons, caustiques, particules et bulles de l’écoutille utilisent leurs
  vraies animations ; le réglage de mouvements réduits est respecté ;
- le sonar suit la visibilité de son écran et ne disparaît pas lors d’une
  erreur Firestore ;
- l’ordre de mission dispose d’un secours local si Firebase ne charge pas ;
- le clic sur OPEN joue un seul son de bulles qui s’intensifie, sans
  alarme ou autre bruit supplémentaire, et reste silencieux si le sonar a été
  coupé ; la plongée commence et se termine avec le son (1,5 seconde),
  avec le même rythme si la lecture audio est refusée ou indisponible ;
- si le navigateur refuse la lecture automatique, un bouton discret permet de
  lancer la vidéo ; la lecture reprend aussi après une mise en arrière-plan
  ou une rotation de l’écran, et l’affiche reste visible en cas d’erreur ;
- si l’appareil demande des mouvements réduits, ce choix est respecté par
  défaut ; un bouton permet d’activer les animations sur cet appareil, puis
  disparaît. Le sonar dispose d’un pilote de secours tant qu’il est visible ;
  le choix peut être réinitialisé depuis le code par
  `window.NautilusAnimations.reinitialiser()` ;
- le cache PWA contient les ressources des deux versions réunies ; une
  ressource indisponible n’annule plus tout le précache, et les requêtes
  vidéo partielles sont laissées au navigateur.

Le bruit de bulles est construit à partir d’un vrai enregistrement de la
[Skippy Fish Water Sound Collection](https://opengameart.org/content/skippy-fish-water-sound-collection)
de jcpmcdonald, publié sous licence [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
La source, conservée dans `tools/audio-source/bulles-skippy.wav`, est aussi
[disponible chez son auteur](https://github.com/jcpmcdonald/skippy-fish/blob/2a91b5c5f46be99ba097ffcfe9ba6c174137d8d9/assets/bubbles.wav)
(SHA-256 : `c4f0a47bd5eaa3c4a5a34a1889c6189661360fb874ebf120147f3cc98fc84165`).
Le fichier final garde son nom historique `assets/alerte-open.mp3`, mais ne
contient plus d’alarme. Pour le reconstruire (FFmpeg avec libmp3lame requis) :

```sh
python3 tools/generer-son-bulles.py
```

Le lecteur attend brièvement que le son soit prêt avant de démarrer la
plongée. En cas de chargement trop lent, il annule la lecture en attente
pour éviter que les bulles ne retentissent après l’ouverture.

`correctif-sonar-site-publie.patch` reste une archive destinée **uniquement**
à une copie non modifiée de l’ancien commit `95c9c203…`. Il ne faut pas
l’appliquer à l’accueil restauré : les corrections y sont déjà présentes.

## Vérifications

Le contrôle des noms d’animation CSS ne nécessite que Python :

```sh
python3 tools/verifier-animations.py
```

Les tests du navigateur simulent Firebase et n’écrivent pas de vraies données :

```sh
node tools/test-animations-browser.cjs
```

Ils requièrent `playwright-core` et un navigateur Chromium installé ; la
variable `CHROMIUM_BIN` peut indiquer le chemin du navigateur. Pour viser une
copie du site plutôt que le dossier courant, définir `NAUTILUS_PUBLISHED_ROOT`.

## Aperçu isolé

```sh
python3 tools/serveur-apercu-animations.py --source . --port 8000
```

L’aperçu remplace Firebase par des données fictives dans le navigateur et
bloque les connexions extérieures. Il ne constitue pas un déploiement.
