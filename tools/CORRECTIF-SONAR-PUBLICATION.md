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
- le clic sur OPEN joue un seul son d’immersion stéréo, avec des bulles,
  sans alarme supplémentaire ; il reste silencieux si le sonar a été coupé.
  La plongée et le son durent 2 secondes et sont synchronisés ; l’animation
  conserve cette durée si la lecture audio est refusée ou indisponible ;
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

Le son d’immersion est composé de deux prises stéréo réelles :

- [Scuba_bubbles.mp3](https://freesound.org/people/sbvitug/sounds/634225/)
  de sbvitug, enregistré en plongée et publié sous [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
  Son extrait de 48,25 à 50,25 secondes est conservé dans
  `tools/audio-source/bulles-plongee.wav` (SHA-256 :
  `4a7860582976dd4b9b26ed19ea780f6b4f612de75d1bb638a2ab1dff52d0e5c6`).
  [Copie de la prise originale sur GitHub](https://github.com/alefa03/OpenSCUBA/blob/6b9805e3665be003c2dbd2a92e6f49e459965adc/sounds/scuba_bubbles.mp3).
- [Scuba 1.mp3](https://freesound.org/people/digifishmusic/sounds/45521/)
  de digifishmusic, enregistré à l’hydrophone dans les bulles d’un plongeur
  et publié sous [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Le passage de 5 à 7 secondes de [l’extrait scuba1bubbles.ogg de MeseCraft](https://github.com/mesecraft/MeseCraft/blob/fd25896649beb50030267718eb6be9d7c329e954/mods/mesecraft_soundscapes/sounds/scuba1bubbles.ogg)
  est conservé dans `tools/audio-source/immersion-hydrophone.wav` (SHA-256 :
  `61dc81c3af2f4d270450ee29f3e179c0cb7970c3c09e878e59edfa168768eef8`).
  L’attribution et la mention de l’adaptation sont visibles en pied de page.

Les deux extraits sont mixés, sans boucle ni changement de hauteur, avec une
légère progression et de courts fondus. Le fichier final garde le nom
historique `assets/alerte-open.mp3`, mais ne contient pas d’alarme. Pour le
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
