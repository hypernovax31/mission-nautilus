# -*- coding: utf-8 -*-
"""Reproduit a l'identique le son de frappe de l'ordre de mission (index.html)
   et l'enregistre en WAV, pour pouvoir l'ecouter hors du navigateur.
   Le fichier produit est ignore par Git (voir .gitignore)."""
import math, struct, wave

SR   = 48000
STEP = 0.018        # 18 ms par caractere   (index.html : const speed = 18)
BUS  = 0.45         # volume general        (index.html : _typeBus.gain.value)
DUR  = 0.038        # duree d'une note
ATT  = 0.005        # attaque douce : evite le claquement
GAP  = 0.007        # ecart minimal entre deux notes
LP   = 1800         # passe-bas : arrondit les aigus
OCT  = 0.18         # niveau de l'octave superieure (grain "numerique")

TEXTE = ("En 1870, le Nautilus disparaît au large des îles Lofoten, englouti par le maelström. "
         "156 ans plus tard, son signal résonne de nouveau — sous les rayons de la Fnac Labège. "
         "Le premier équipage à le ramener à la surface entrera dans la légende du magasin. "
         "Le sonar est allumé, matelot. À vous de jouer !")

buf = [0.0] * int(SR * (len(TEXTE) * STEP + 1.4))

def note(t0, freq, pic, duree, oct_niv=OCT, lp=LP):
    """Sinus + octave discrete, attaque douce, le tout passe au filtre."""
    n = int(SR * duree)
    brut = []
    ph = ph2 = 0.0
    for i in range(n):
        p = i / SR
        fr = freq * (0.96 ** (p / 0.038))       # legere descente
        ph  += 2 * math.pi * fr / SR
        ph2 += 2 * math.pi * fr * 2 / SR
        v = math.sin(ph) + oct_niv * math.sin(ph2)
        e = (p / ATT) if p < ATT else math.exp(math.log(0.0001) * (p - ATT) / (duree - ATT))
        brut.append(v * min(e, 1.0) * pic)
    a = math.exp(-2 * math.pi * lp / SR)        # passe-bas 1 pole
    y = 0.0
    k0 = int(t0 * SR)
    for i, x in enumerate(brut):
        y = (1 - a) * x + a * y
        k = k0 + i
        if 0 <= k < len(buf):
            buf[k] += y * BUS

t = 0.0
dernier = -1.0
for c in TEXTE:
    if c.strip():                       # les espaces ne sonnent pas
        grave = c in '.,;:!?—'
        quand = max(t, dernier + GAP)   # on DECALE, on ne jette pas
        if quand - t <= 0.060:
            note(quand, 440 if grave else 660, 0.60 if grave else 0.50, DUR)
            dernier = quand
    t += STEP

# accuse de reception de fin : deux notes montantes, meme matiere
note(t + 0.05, 784,    0.42, 0.100, 0.12, 1900)
note(t + 0.13, 1046.5, 0.42, 0.140, 0.12, 1900)

pic = max(abs(v) for v in buf) or 1
print('duree %.1f s | pic reel %.3f (%.1f dBFS) — sans normalisation'
      % (len(buf) / SR, pic, 20 * math.log10(pic)))
with wave.open('apercu-son-frappe.wav', 'w') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in buf))
