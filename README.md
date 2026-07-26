# Mission Nautilus — Escape game Fnac Labège

Jeu de piste en magasin : 5 équipages s'affrontent pour résoudre des mini-jeux chronométrés
et trouver des QR codes cachés dans les rayons. Plus les échecs s'accumulent, plus l'équipage
est bloqué longtemps avant de retenter.

## Stack
- **Front** : HTML/CSS/JS statique (ES modules)
- **Backend** : Firebase Firestore (sessions + état des équipes en temps réel)
- **Hosting** : Firebase Hosting

## Architecture
```
index.html              ← Accueil / embarquement
nautilus-core.js        ← Module ES partagé (Firebase, audio, helpers)
161129518.html          ← Palier 1 : Morse (URL publique masquée)
1721310619.html         ← Palier 2 : (à venir)
…                       ← Autres paliers selon progression
assets/                 ← Audio ambiance + fond d'écran
firebase.json           ← Config hosting (rewrite vers index.html)
build.sh                ← Génère palier1.html standalone (CSS+JS+HTML)
```

## Build standalone
Pour produire un palier en fichier unique (CSS+JS+HTML inline, sans
dépendance externe) — utile si tu veux héberger ailleurs que sur Firebase :

```bash
./build.sh
# Génère palier1.html (73KB) prêt à déployer n'importe où
```

Le bundle est régénéré à chaque exécution à partir des sources
(`161129518.html` + `nautilus-core.js`). Si tu modifies le code, relance
le build avant de déployer le standalone.

## Codage des URL palier
Pour éviter les URLs en clair, chaque palier a un identifiant numérique dérivé de "PALIER" :
- Palier 1 = `16-1-12-9-5-18` → URL : `161129518.html`
- Palier 2 = `17-2-13-10-6-19` → URL : `1721310619.html`
- Palier 3 = `18-3-14-11-7-20` → URL : `1831411720.html`
- etc.

## Codes d'équipe
- `NEMO`, `NAUTILUS`, `ARONNAX`, `NEDLAND`, `CALAMAR`

## Lancement local
```bash
cd /home/user/mission-nautilus
python3 -m http.server 8000
# Ouvrir http://localhost:8000
```

## Déploiement
```bash
firebase deploy --only hosting
```
