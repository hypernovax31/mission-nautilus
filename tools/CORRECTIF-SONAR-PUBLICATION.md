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
- le clic sur OPEN joue une seule fois le signal sous-marin choisi par le
  joueur, sans alarme supplémentaire ; il reste silencieux si le sonar a été
  coupé. La plongée et le son durent 1,5 seconde et sont synchronisés ;
  l’animation conserve cette durée si la lecture audio est indisponible ;
- le zoom suit une trajectoire continue centrée sur le hublot, sans doubler
  les agrandissements. Un voile assombrit progressivement la fin avant le
  fondu vers l’accueil ; les défilements et mouvements réduits sont respectés ;
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

Le son choisi est [« Underwater, Signal » de LilMati](https://freesound.org/people/LilMati/sounds/448743/),
mis à disposition sous [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Le WAV d’origine est conservé dans `tools/audio-source/signal-lilmati.wav`
(SHA-256 : `c4a9aac1e2ed58af32792ceb6e5af22eb64dee039242ec82d62bcded9f2142fe`).
Une copie est également [disponible sur GitHub](https://github.com/invadium/gulf.mod/blob/5308053f5ed1b0291e564b435994479998ec3267/res/sfx/signal.wav).

L’original dure 2 secondes : il est accéléré à 1,5 seconde en conservant sa
hauteur autant que possible. Un gain de +10 dB est appliqué avant un limiteur :
les crêtes déjà proches de 0 dBFS sont limitées pour éviter l’écrêtage, donc
le gain effectif est inférieur à 10 dB sur ces passages. Le lecteur utilise son
niveau maximal, sans modifier le réglage de coupure du son. Le fichier final garde
le nom historique `assets/alerte-open.mp3`. Pour le reconstruire (FFmpeg avec
libmp3lame) :

```sh
python3 tools/generer-son-bulles.py
```

Le lecteur attend brièvement que le son soit prêt avant de démarrer la
plongée. En cas de chargement trop lent, il annule la lecture en attente
pour éviter que le signal ne retentisse après l’ouverture.

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
