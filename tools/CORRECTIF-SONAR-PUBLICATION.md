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
- le clic sur OPEN joue une seule fois le son « Bubbles » choisi par le
  joueur, sans alarme supplémentaire ; il reste silencieux si le sonar a été
  coupé. La plongée et le son durent 2 secondes et sont synchronisés ;
  l’animation conserve cette durée si la lecture audio est indisponible ;
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

Le son choisi est [« Bubbles » de hotpin7](https://freesound.org/people/hotpin7/sounds/840042/),
mis à disposition sous [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Le WAV original est conservé dans `tools/audio-source/bulles-hotpin7.wav`
(SHA-256 : `6bc428c9766585ba2dda036bd4b059e65a795ca30b636a9d8561eb9685cf4bfa`).
Une copie est également [disponible sur GitHub](https://github.com/jacobvillard/PotionShop/blob/8f85d878253ea8666dc7a28f27df815c7fd70909/Assets/SFX/Freesound/Caldron/840042__hotpin7__bubbles.wav).

L’original dure environ 1,19 seconde et se termine par une queue très faible.
À la demande du joueur, la partie audible est étirée à 2 secondes en conservant
la hauteur autant que possible, sans répétition ni ajout d’autres sons. Le
fichier final garde le nom historique `assets/alerte-open.mp3`. Pour le
reconstruire (FFmpeg avec libmp3lame) :

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
