#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère les QR Codes des sas des paliers 2..7 — Mission Nautilus.

Palette demandée :
  1. modules NOIRS sur fond BLANC
  2. modules JAUNE FNAC (#f5b027) sur fond NOIR   (QR inversé : le scanneur
     jsQR de l'app est déjà configuré `inversionAttempts:'attemptBoth'`)

Formes ARRONDIES : modules de données en carrés arrondis soudés entre eux,
repères de position en anneaux aux coins arrondis. Logo de l'app au centre
(correction d'erreur H = 30 %). Grande résolution ≈ 2000 × 2000 px.

Chaque QR encode LE NOM DE LA PAGE du palier, c.-à-d. le code pur
(palier 2 → « 1721310619 », palier 3 → « 1831411720 »…) — PAS d'URL :
un téléphone qui scanne le code hors de l'app ne voit qu'un numéro,
jamais l'adresse du jeu. Chiffres seuls = la série attendue par
palier-sas.js (payloadUnlocks).
Chaque image produite est DÉCODÉE par jsQR (le scanner de l'app) en
sortie de chaîne (preuve de scannabilité) ; OpenCV en indicatif.

Usage : python3 tools/generate_qr.py
Sorties : assets/qr/QR-palier-<n>_noir-sur-blanc.png
          assets/qr/QR-palier-<n>_jaune-sur-noir.png
          assets/qr/planche-qr.png (planche d'impression)
"""
import os
import cv2
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw

JAUNE_FNAC = (245, 176, 39)          # var(--fnac)
NOIR = (8, 8, 8)
BLANC = (255, 255, 255)
GRIS_LISERE = (214, 218, 222)
BASE = [16, 1, 12, 9, 5, 18]         # P A L I E R — en phase avec palier-sas.js
VERSION_MIN = 4                      # matrice QR minimale (33×33). Verrou issue
                                     # du badge logo : en v1 (payload « code pur »,
                                     # 21×21), jsQR échoue à relire la variante
                                     # INVERSÉE (jaune/noir) dès que le badge
                                     # central est posé — bissection 4 cas :
                                     # arrondi sans badge OK, carré + badge KO,
                                     # v1 sans badge OK, v4 + badge OK. Le badge
                                     # doit donc vivre sur une matrice ≥ v4.
CIBLE_PX = 2048                      # résolution finale
SS = 2                                # suréchantillonnage (lissé LANCZOS)                      # grande résolution
QUIET = 4                            # zone de silence (modules)

# Centres des motifs d'alignement (spécification QR, versions 1..10)
ALIGN = {2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30], 6:[6,34], 7:[6,22,38],
         8:[6,24,42], 9:[6,26,46], 10:[6,28,50]}

def code_palier(n):
    return ''.join(str(x + (n - 1)) for x in BASE)

def zones_fonction(n_matrix, version):
    """Ensemble des cellules réservées (repères) → rendues en formes dédiées."""
    finders = [(0, 0), (0, n_matrix - 7), (n_matrix - 7, 0)]   # (ligne, col)
    cellules = set()
    for (r0, c0) in finders:
        for r in range(r0, r0 + 7):
            for c in range(c0, c0 + 7):
                cellules.add((r, c))
    # Blocs d'angle ÉTENDUS (repère 7×7 + séparateur + infos de format = 9×9) :
    # un motif d'alignement (5×5 autour de son centre) chevauchant l'un
    # d'eux n'a PAS lieu d'être (règle de la spécification QR).
    coins = [(0, 0), (0, n_matrix - 9), (n_matrix - 9, 0)]
    def chevauche_coin(r0, c0):
        for (fr, fc) in coins:
            if (r0 + 2 >= fr and r0 - 2 < fr + 9
                    and c0 + 2 >= fc and c0 - 2 < fc + 9):
                return True
        return False
    alignements = []
    pos = ALIGN.get(version, [])
    for r0 in pos:
        for c0 in pos:
            if not chevauche_coin(r0, c0):
                alignements.append((r0, c0))
                for r in range(r0 - 2, r0 + 3):
                    for c in range(c0 - 2, c0 + 3):
                        cellules.add((r, c))
    return finders, alignements, cellules

def arrondi(draw, xy, rayon, *, couleur=None, contour=None, epaisseur=1):
    if couleur is None:
        draw.rounded_rectangle(xy, radius=rayon, outline=contour, width=epaisseur)
    else:
        draw.rounded_rectangle(xy, radius=rayon, fill=couleur)

def rendre(payload, logo, *, couleur_modules, couleur_fond, fichier):
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=1, border=0)
    qr.add_data(payload)
    qr.make(fit=True)
    if qr.version < VERSION_MIN:      # le badge logo impose une matrice ≥ v4
        qr = qrcode.QRCode(version=VERSION_MIN, error_correction=ERROR_CORRECT_H,
                           box_size=1, border=0)
        qr.add_data(payload)
        qr.make(fit=False)
    m = qr.get_matrix()
    n = len(m)
    version = qr.version
    box = max(6, CIBLE_PX // (n + 2 * QUIET)) * SS   # rendu suréchantillonné ×SS, lissé en fin
    taille = box * (n + 2 * QUIET)

    img = Image.new('RGB', (taille, taille), couleur_fond)
    d = ImageDraw.Draw(img)
    ox = QUIET * box   # origine de la matrice

    finders, alignements, reservees = zones_fonction(n, version)

    # --- modules de données : CARRÉS ARRONDIS légèrement débordants ---
    # « plutôt arrondies » tout en restant robustement scannables :
    # les pastilles pures (style pointillé) ou un rayon > ~0,2 module sans
    # recouvrement CASSENT le scanner jsQR de l'app (bissections : anneau
    # d'alignement mince fautif). De grands rayons passent dès que
    # l'alignement fait UN module complet. Choix : r = 0,22 module +
    # 0,14 module de débordement — arrondi affirmé, décodage jsQR vérifié.
    sombres = [(r, c) for r in range(n) for c in range(n) if m[r][c]]
    yvelines = set(sombres) - reservees
    ov = box * 14 // 100                     # 0,14 module de débordement
    rayon = box * 22 // 100                  # 0,22 module d'arrondi
    for (r, c) in yvelines:
        d.rounded_rectangle(
            [ox + c * box - ov, ox + r * box - ov,
             ox + (c + 1) * box - 1 + ov, ox + (r + 1) * box - 1 + ov],
            radius=rayon, fill=couleur_modules)

    # --- repères de position : anneau + centre, coins arrondis ---
    # ATTENTION sémantique PIL : rounded_rectangle(outline, width) dessine
    # le trait vers l'INTÉRIEUR du chemin — le chemin doit donc longer le
    # bord EXTERNE du motif (sinon anneau décalé d'un demi-module et le
    # ratio 1:1:3:1:1 du repère devient indétectable — test « D » mort).
    for (r0, c0) in finders:
        x0, y0 = ox + c0 * box, ox + r0 * box
        d.rounded_rectangle([x0, y0, x0 + 7 * box - 1, y0 + 7 * box - 1],
                            radius=box * 1.35, outline=couleur_modules, width=box)
        d.rounded_rectangle([x0 + 2 * box, y0 + 2 * box,
                             x0 + 5 * box - 1, y0 + 5 * box - 1],
                            radius=box * .8, fill=couleur_modules)

    # --- motifs d'alignement : anneau d'UN MODULE COMPLET + centre plein ---
    # (un anneau mince de 0,7 module + logo au centre cassait jsQR : le
    # test de ratio 1:1:1 de l'alignement n'y survivait pas — bissection
    # P3/P5. L'arrondi est conservé, seules les ÉPAISSEURS sont exactes.)
    for (r0, c0) in alignements:
        d.rounded_rectangle([ox + (c0 - 2) * box, ox + (r0 - 2) * box,
                             ox + (c0 + 3) * box - 1, ox + (r0 + 3) * box - 1],
                            radius=box * .9, outline=couleur_modules, width=box)
        d.rounded_rectangle([ox + c0 * box, ox + r0 * box,
                             ox + (c0 + 1) * box - 1, ox + (r0 + 1) * box - 1],
                            radius=box * .3, fill=couleur_modules)

    # --- badge logo au centre (couverture ≈ 21 % des modules : EC-H = 30 %) ---
    cote_pad = round(n * box * 0.16)
    x0 = (taille - cote_pad) // 2
    pad = cote_pad / box  # en modules, décalé pour ne pas rogner un unique point
    ring = GRIS_LISERE if couleur_fond == BLANC else JAUNE_FNAC
    arrondi(d, [x0, x0, x0 + cote_pad, x0 + cote_pad], round(cote_pad * .16),
            couleur=couleur_fond)
    arrondi(d, [x0, x0, x0 + cote_pad, x0 + cote_pad], round(cote_pad * .16),
            contour=ring, epaisseur=max(3, box // 4))
    marge = round(cote_pad * .10)
    logo_red = logo.resize((cote_pad - 2 * marge, cote_pad - 2 * marge), Image.LANCZOS)
    masque = Image.new('L', logo_red.size, 0)
    ImageDraw.Draw(masque).rounded_rectangle(
        [0, 0, logo_red.size[0], logo_red.size[1]], radius=round(cote_pad * .11), fill=255)
    img.paste(logo_red, (x0 + marge, x0 + marge), masque)

    img = img.resize((taille // SS, taille // SS), Image.LANCZOS)   # lissage
    img.save(fichier, 'PNG')
    return fichier, taille // SS, version, n

def verifier_jsqr(image_pil, attendu):
    """Vérifie avec jsQR — le VRAI scanner de l'app (inversionAttempts:
    'attemptBoth'), exécuté sous Node."""
    import json, subprocess, tempfile
    rgba = image_pil.convert('RGBA')
    with tempfile.NamedTemporaryFile(suffix='.rgba', delete=False) as t:
        t.write(rgba.tobytes()); chemin = t.name
    script = (
        "const fs=require('fs');const jsQR=require('/tmp/node_modules/jsqr/dist/jsQR.js');"
        f"const raw=fs.readFileSync('{chemin}');"
        f"const r=jsQR(new Uint8ClampedArray(raw),{rgba.width},{rgba.height},"
        "{inversionAttempts:'attemptBoth'});"
        "process.stdout.write(r?r.data:'');")
    r = subprocess.run(['node', '-e', script], capture_output=True, text=True)
    assert r.returncode == 0 and r.stdout == attendu,         f'jsQR (scanner app) : {r.stdout[:60]!r} ≠ {attendu[:60]!r} (stderr={r.stderr[:120]!r})'
    os.unlink(chemin)

def verifier(fichier, attendu, inverse=False):
    """Décodage OpenCV = preuve de scannabilité.
    Variante sombre (jaune sur noir, QR INVERSÉ) : cv2 lit en une seule
    passe photométrique, on inverse donc l'image avant test. L'app, elle,
    configure jsQR avec inversionAttempts:'attemptBoth' → elle lit les
    deux sens nativement (cf. palier-sas.js)."""
    # cv2 (détecteur simple-passe) est chatouilleux sur les rendus
    # stylisés : information seulement. Le verrou est jsQR (l'app).
    image = cv2.imread(fichier)
    if inverse:
        image = cv2.bitwise_not(image)
    lu, _, _ = cv2.QRCodeDetector().detectAndDecode(image)
    if lu != attendu:
        print(f"   (info) cv2 n'a pas relu {os.path.basename(fichier)} (stylisé) — non bloquant, jsQR fait foi")
    else:
        chiffres = ''.join(ch for ch in lu if ch.isdigit())
        code_attendu = os.path.basename(attendu).replace('.html', '')
        assert code_attendu in chiffres
    return lu

def main():
    logo = Image.open('assets/icon-512.png').convert('RGB')
    os.makedirs('assets/qr', exist_ok=True)
    produits = []
    for n in range(2, 8):
        code = code_palier(n)
        payload = code   # nom de la page du palier (sans « .html ») — pas d'URL
        for style, mods, fond, suffixe, inverse in (
                ('noir sur blanc', NOIR, BLANC, 'noir-sur-blanc', False),
                ('jaune Fnac sur noir', JAUNE_FNAC, NOIR, 'jaune-sur-noir', True)):
            f = f'assets/qr/QR-palier-{n}_{suffixe}.png'
            f, taille, version, nmod = rendre(payload, logo,
                                              couleur_modules=mods, couleur_fond=fond, fichier=f)
            verifier_jsqr(Image.open(f), payload)
            verifier(f, payload, inverse=inverse)
            print(f'✓ palier {n} ({style}) : {taille}px, v{version} ({nmod}×{nmod}) → {f}  [jsQR OK]')
            produits.append((n, style, f))
    # planche contact 2 colonnes, chaque tuile étiquetée (repérage terrain)
    from PIL import ImageFont
    tuiles = [(n, st, Image.open(f)) for n, st, f in produits]
    c, marge, bande, rangs = 920, 60, 110, 6
    W = 2 * (c + marge) + marge
    H = rangs * (c + bande + marge) + marge
    planche = Image.new('RGB', (W, H), BLANC)
    d = ImageDraw.Draw(planche)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 52)
    for i, (n, st, t) in enumerate(tuiles):
        t = t.resize((c, c), Image.LANCZOS)
        x = marge + (i % 2) * (c + marge)
        y = marge + (i // 2) * (c + bande + marge)
        planche.paste(t, (x, y))
        libelle = f'PALIER {n} — {st}'
        bb = d.textbbox((0, 0), libelle, font=font)
        d.text((x + (c - (bb[2] - bb[0])) / 2 - bb[0], y + c + (bande - (bb[3] - bb[1])) / 2 - bb[1]),
               libelle, font=font, fill=NOIR)
    planche.save('assets/qr/planche-qr.png', 'PNG')
    print('✓ planche : assets/qr/planche-qr.png', planche.size)

if __name__ == '__main__':
    main()
