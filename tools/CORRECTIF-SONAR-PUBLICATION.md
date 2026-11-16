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
- le clic sur OPEN joue une seule alerte courte, sans écho ou souffle
  supplémentaire, et reste silencieux si le sonar a été coupé ; la plongée
  démarre avec cette alerte et se termine avec elle (1,5 seconde),
  avec le même rythme si la lecture audio est refusée ou indisponible ;
  le son est une seule impulsion de l’alarme du bord, prolongée puis
  fondue, sans répétition ;
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

Pour reconstruire l’alerte de 1,5 s à partir de l’alarme du bord :

```sh
ffmpeg -i assets/Submarine_alarm.mp3 \
  -af 'atrim=duration=0.54,asetpts=PTS-STARTPTS,atempo=0.5,atempo=0.7,apad=whole_dur=1.5,atrim=duration=1.5,afade=t=in:st=0:d=0.015,afade=t=out:st=1.38:d=0.12,volume=0.82' \
  -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k assets/alerte-open.mp3
```

Le lecteur attend brièvement que le son soit prêt avant de démarrer la
plongée. En cas de chargement trop lent, il annule la lecture en attente
pour éviter qu’une alerte ne retentisse après l’ouverture.

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
