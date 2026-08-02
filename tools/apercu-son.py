# -*- coding: utf-8 -*-
"""Reproduit a l'identique le son de frappe de l'ordre de mission (index.html)
   et l'enregistre en WAV, pour pouvoir l'ecouter hors du navigateur.
   Le fichier produit est ignore par Git (voir .gitignore)."""
import math, struct, wave

SR   = 48000
STEP = 0.018        # 18 ms par caractere  (index.html : const speed = 18)
BUS  = 0.45         # volume general       (index.html : _typeBus.gain.value)
DUR  = 0.028        # duree d'un bip  (8 ms etait inaudible : voir commit)
GAP  = 0.007        # ecart minimal entre deux bips

TEXTE = ("En 1870, le Nautilus disparaît au large des îles Lofoten, englouti par le maelström. "
         "156 ans plus tard, son signal résonne de nouveau — sous les rayons de la Fnac Labège. "
         "Le premier équipage à le ramener à la surface entrera dans la légende du magasin. "
         "Le sonar est allumé, matelot. À vous de jouer !")

buf = [0.0] * int(SR * (len(TEXTE) * STEP + 1.2))

def carre(t0, freq, pic, duree):
    """Onde carree tres courte, enveloppe attaque 1 ms puis extinction."""
    n = int(SR * duree)
    for i in range(n):
        p = i / SR
        e = (p / 0.001) if p < 0.001 else math.exp(-(p - 0.001) / (duree / 4.0))
        v = 1.0 if math.sin(2 * math.pi * freq * p) >= 0 else -1.0
        k = int(t0 * SR) + i
        if 0 <= k < len(buf):
            buf[k] += v * pic * min(e, 1.0) * BUS

t = 0.0
dernier = -1.0
for c in TEXTE:
    if c.strip():                       # les espaces ne sonnent pas
        grave = c in '.,;:!?—'
        # garde-fou : on DECALE le bip, on ne le jette pas
        quand = max(t, dernier + GAP)
        if quand - t <= 0.060:
            carre(quand, 1046.5 if grave else 2093, 0.9 if grave else 0.6, DUR)
            dernier = quand
    t += STEP

# accuse de reception de fin : deux notes montantes
carre(t + 0.05,  1568, 0.34, 0.075)
carre(t + 0.115, 2093, 0.34, 0.075)

pic = max(abs(v) for v in buf) or 1
print('duree %.1f s | pic reel %.3f (%.1f dBFS) — sans normalisation'
      % (len(buf) / SR, pic, 20 * math.log10(pic)))
with wave.open('apercu-son-frappe.wav', 'w') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in buf))
