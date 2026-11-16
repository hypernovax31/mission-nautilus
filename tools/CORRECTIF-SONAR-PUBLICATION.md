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

Le bruit de bulles vient d’un véritable enregistrement sous-marin réalisé
lors d’une plongée : [Scuba_bubbles.mp3](https://freesound.org/people/sbvitug/sounds/634225/)
de sbvitug, sous licence [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
L’extrait continu de 48,25 à 49,75 secondes est conservé en WAV dans
`tools/audio-source/bulles-plongee.wav` (SHA-256 :
`a759d4182a7cf00a3371968e37eb210ae481e5951ae87628b86d4ec5f2255362`).
La [prise d’origine est aussi disponible sur GitHub](https://github.com/alefa03/OpenSCUBA/blob/6b9805e3665be003c2dbd2a92e6f49e459965adc/sounds/scuba_bubbles.mp3)
(SHA-256 : `eaec4e0bdd205c2db9414577ee57e7e839db114af03d3f0654b715491f266891`).
Le traitement conserve la stéréo et n’ajoute ni boucle, ni superposition, ni
changement de hauteur ; il applique une légère montée de volume et de courts
fondus. Le fichier final garde le nom historique `assets/alerte-open.mp3`,
mais ne contient pas d’alarme. Pour le reconstruire (FFmpeg avec libmp3lame) :

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
