# Mission Nautilus — Escape game Fnac Labège

Jeu de piste en magasin : 5 équipages s'affrontent pour résoudre des mini-jeux
chronométrés et trouver des QR codes cachés dans les rayons. Plus les échecs
s'accumulent, plus l'équipage est bloqué longtemps avant de retenter.

## Stack
- **Front** : HTML/CSS/JS statique
- **Backend** : Firebase Firestore (sessions + état des équipes en temps réel)
- **Hosting** : Firebase Hosting

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | Accueil / embarquement |
| `palier1.html` | Palier 1 : Morse (CSS+JS+HTML inline, standalone) |
| `pwa-install.js` | Modale d'installation PWA (instructions par OS) + enregistrement du SW |
| `manifest.json` | Manifeste PWA (nom, couleurs, icônes) |
| `sw.js` | Service worker (cache offline) |
| `firebase.json` | Config hosting |
| `assets/` | Audio ambiance, fond d'écran et icônes |

## Icônes
`assets/icon.svg` est **la source unique**. Tous les PNG en sont dérivés :

| Fichier | Usage |
|---|---|
| `icon.svg` | Favicon moderne + entrée `manifest` (toutes tailles) |
| `favicon-16.png` / `favicon-32.png` | Favicon de repli (sans texte, sous-marin zoomé pour rester lisible) |
| `apple-touch-icon.png` (180px) | Écran d'accueil iOS (fond opaque, iOS ne gère pas la transparence) |
| `icon-192.png` / `icon-512.png` | Écran d'accueil Android / desktop (`purpose: any`) |
| `icon-maskable-512.png` | Icône adaptative Android (`purpose: maskable`, contenu dans 78 % centraux) |

Après modification de `icon.svg`, régénérer les PNG (nécessite `sharp`) et bumper
`CACHE_NAME` dans `sw.js` pour invalider le cache des anciennes icônes.

## Codage des URL palier
URLs masquées, dérivées de "PALIER" (positions alphabétiques) :
- Palier 1 = `161129518` → `palier1.html`
- Palier 2 = `1721310619` → (à venir)

## Codes d'équipe
- `NEMO`, `NAUTILUS`, `ARONNAX`, `NEDLAND`, `CALAMAR`

## Lancement local
```bash
cd mission-nautilus
python3 -m http.server 8000
# Ouvrir http://localhost:8000
```

## Déploiement
```bash
firebase deploy --only hosting
```
