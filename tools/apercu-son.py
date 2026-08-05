# -*- coding: utf-8 -*-
"""Reproduit a l'identique le son de frappe de l'ordre de mission (index.html)
   et l'enregistre en WAV, pour pouvoir l'ecouter hors du navigateur.
   Le fichier produit est ignore par Git (voir .gitignore)."""
import math, struct, wave

SR   = 48000
STEP = 0.018        # 18 ms par caractere   (index.html : const speed = 18)
BUS  = 0.55         # volume general        (index.html : _typeBus.gain.value)
GAP  = 0.007        # ecart minimal entre deux notes

TEXTE = ("En 1870, le Nautilus disparaît au large des îles Lofoten, englouti par le maelström. "
         "156 ans plus tard, son signal résonne de nouveau — sous les rayons de la Fnac Labège. "
         "Le premier équipage à le ramener à la surface entrera dans la légende du magasin. "
         "Le sonar est allumé, matelot. À vous de jouer !")

buf = [0.0] * int(SR * (len(TEXTE) * STEP + 2.0))

def note(t0, freq, pic, duree, att, fc, drop, sub=0.0, quinte=0.0):
    """UNE SEULE voix : onde triangle filtree (1 caractere = 1 note).
       Les parametres sub/quinte sont conserves pour compatibilite mais
       ne servent plus : le corps du son vient desormais des harmoniques
       naturelles du triangle, pas d'oscillateurs supplementaires."""
    n = int(SR * duree)
    ph = 0.0
    brut = []
    for i in range(n):
        p = i / SR
        fr = freq * (drop ** (p / duree))
        ph += 2 * math.pi * fr / SR
        # onde triangle
        v = 2.0 / math.pi * math.asin(math.sin(ph))
        e = (p / att) if p < att else math.exp(math.log(0.0001) * (p - att) / (duree - att))
        brut.append(v * min(e, 1.0) * pic)
    a = math.exp(-2 * math.pi * fc / SR)      # passe-bas 1 pole
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
            if grave:
                note(quand, 196, 0.70, 0.075, 0.014, 700, 0.93)
            else:
                note(quand, 262, 0.62, 0.065, 0.012, 820, 0.93)
            dernier = quand
    t += STEP

# accuse de reception de fin : deux notes montantes, meme matiere
note(t + 0.05, 196,   0.52, 0.30, 0.018, 800, 0.98)
note(t + 0.16, 261.6, 0.52, 0.42, 0.018, 850, 0.98)

pic = max(abs(v) for v in buf) or 1
print('duree %.1f s | pic reel %.3f (%.1f dBFS) — sans normalisation'
      % (len(buf) / SR, pic, 20 * math.log10(pic)))
with wave.open('apercu-son-frappe.wav', 'w') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in buf))
