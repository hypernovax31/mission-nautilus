# Correctif du sonar pour la version publiée

GitHub Pages est configuré sur `arena/4cb16a93-mission-nautilus`. Le
correctif `correctif-sonar-site-publie.patch` est préparé pour sa version
`95c9c20325f0af186d15f2886a09dc1b7c594629` : il ne remplace ni le contenu
du site ni les fonctions récentes des paliers.

Il modifie uniquement :

- les rayons, caustiques, particules et bulles de l'écoutille, qui utilisaient
  quatre noms de keyframes inexistants ; leurs animations d'origine sont
  rétablies, et le réglage de mouvements réduits reste respecté ;
- le calcul de visibilité dans `index.html`, pour suivre l'écran du radar
  plutôt que l'ensemble de la carte des équipages ;
- la conservation du radar lorsqu'une lecture Firestore échoue ;
- l'ajout d'un secours local pour l'ordre de mission si Firebase ne charge
  pas, qui attend bien l'ouverture de l'écoutille ;
- le cache PWA (`v392` vers `v393`), notamment la revalidation des scripts
  et styles ainsi que le précache des versions réellement utilisées par les
  pages (dont `css/index.css?v=79`). Une ressource indisponible n'annule plus
  tout le précache ; l'ancien cache est conservé si le nouveau est incomplet.

Depuis une copie de la **version publiée**, récupérer le correctif depuis
la branche de cette session, puis vérifier avant de l'appliquer :

```sh
git fetch origin arena/01a01e78-mission-nautilus
git show origin/arena/01a01e78-mission-nautilus:tools/correctif-sonar-site-publie.patch > /tmp/correctif-sonar.patch
git apply --check /tmp/correctif-sonar.patch
git apply /tmp/correctif-sonar.patch
```

Si la vérification échoue, ne pas forcer l'application : la version publiée
a changé et le correctif doit être adapté. Une fois appliqué, publier par la
procédure habituelle du site. Ne pas remplacer la version publiée par cette
branche entière : elles ont divergé et contiennent des fonctions différentes.

Les tests Chromium peuvent également viser une copie de la version publiée
**après application du correctif**, avec Firebase simulé et sans écrire de
vraies données :

```sh
NAUTILUS_PUBLISHED_ROOT=/chemin/vers/la/copie node tools/test-animations-browser.cjs
```

Ces tests requièrent `playwright-core` et un navigateur Chromium installé ;
`CHROMIUM_BIN` peut indiquer le chemin du navigateur. Le contrôle des noms
CSS ne nécessite que Python :

```sh
python3 tools/verifier-animations.py --root /chemin/vers/la/copie
```

Pour un aperçu local isolé, sans aucune écriture dans la base réelle :

```sh
python3 tools/serveur-apercu-animations.py --source /chemin/vers/la/copie
```

L'aperçu remplace Firebase par des données fictives dans le navigateur et
bloque les connexions extérieures. Il ne constitue pas un déploiement.
