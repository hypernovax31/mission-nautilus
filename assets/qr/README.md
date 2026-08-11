# QR Codes des sas — paliers 2 à 7

Chaque QR encode l'URL de la page du palier (`https://mission-nautilus.firebaseapp.com/<code>.html`).
Scanné dans l'app (écran « Zone scellée »), il déverrouille le sas du palier correspondant.

## Fichiers

| Fichier | Usage |
|---|---|
| `QR-palier-<n>_noir-sur-blanc.png` | version impression classique |
| `QR-palier-<n>_jaune-sur-noir.png` | version « ambiance Nautilus » (jaune Fnac #f5b027 sur noir) |
| `planche-qr.png` | planche d'impression : les 12 codes étiquetés (2020 × 6600 px) |

Codes embarqués (identiques à `palier-sas.js`) :

| Palier | Code / page |
|---|---|
| 2 | `1721310619` |
| 3 | `1831411720` |
| 4 | `1941512821` |
| 5 | `2051613922` |
| 6 | `21617141023` |
| 7 | `22718151124` |

## Impression

- Taille conseillée : **≥ 6 × 6 cm** par code (2009 px → ~300 dpi à 17 cm, large marge).
- Ne pas rogner la **zone de silence** (marge blanche/noire autour du code).
- La variante jaune-sur-noir est un QR **inversé** : le scanner intégré à l'app
  (`jsQR`, `inversionAttempts: 'attemptBoth'`) la lit, mais **testez-la avec le
  téléphone prévu** avant de la coller — certains scanners natifs iOS/Android
  refusent les QR inversés. En cas de doute, imprimez la variante noire.
- Chaque fichier a été validé par décodage jsQR (le même moteur que l'app) en
  sortie de génération.

## Régénération

```bash
pip install qrcode pillow opencv-python-headless   # jsqr via npm pour la validation
python3 tools/generate_qr.py
```

Le script régénère les 12 PNG + la planche et **refuse de s'achever si un code
n'est pas relu par jsQR** (bissections documentées dans les commentaires).
