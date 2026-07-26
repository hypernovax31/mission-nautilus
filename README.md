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
| `firebase.json` | Config hosting |
| `assets/` | Audio ambiance + fond d'écran |

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
