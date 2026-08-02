# -*- coding: utf-8 -*-
"""
Apercu ECOUTABLE du son de frappe de l'ordre de mission.

Reproduit a l'identique ce que fabrique le navigateur dans index.html
(_typeClick / _typeDing), pour pouvoir juger le son sans ouvrir la page.
Genere apercu-son-frappe.wav, ignore par Git.

    python3 tools/apercu-son.py
"""
import math, struct, wave

SR  = 48000
BUS = 0.16          # _typeBus.gain.value dans index.html
PAS = 0.030         # un bip tous les 3 caracteres, soit 30 ms

TEXTE = ("En 1870, le Nautilus disparaît au large des îles Lofoten, englouti par le maelström. "
         "156 ans plus tard, son signal résonne de nouveau — sous les rayons de la Fnac Labège. "
         "Le premier équipage à le ramener à la surface entrera dans la légende du magasin. "
         "Le sonar est allumé, matelot. À vous de jouer !")

buf = [0.0] * int(SR * (len(TEXTE) / 3 * PAS + 1.0))

def square(freq, phase):
    return 1.0 if math.sin(2 * math.pi * freq * phase) >= 0 else -1.0

def bip(t0, freq, peak, dur):
    """Onde carree courte : montee 1 ms, extinction exponentielle."""
    start = int(t0 * SR)
    for i in range(int(SR * dur)):
        p = i / SR
        e = (p / 0.001) if p < 0.001 else math.exp(-(p - 0.001) / ((dur - 0.001) / 9.2))
        k = start + i
        if 0 <= k < len(buf):
            buf[k] += square(freq, p) * peak * min(e, 1.0) * BUS

# --- la frappe : un bip par groupe de 3 caracteres ---
t, i = 0.0, 0
while i < len(TEXTE):
    i = min(len(TEXTE), i + 3)
    c = TEXTE[i - 1]
    fort = (c == ' ' or c in '.,;:!?—')
    bip(t, 1046.5 if fort else 2093, 0.9 if fort else 0.6, 0.008)
    t += PAS

# --- accuse de reception : deux notes montantes ---
bip(t + 0.05,  1568, 0.5, 0.077)
bip(t + 0.115, 2093, 0.5, 0.077)

pic = max(abs(v) for v in buf)
print('pic reel : %.4f (%.1f dBFS) - sans normalisation' % (pic, 20 * math.log10(pic)))
print('duree    : %.2f s' % (len(buf) / SR))

with wave.open('apercu-son-frappe.wav', 'w') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes(b''.join(
        struct.pack('<h', int(max(-1.0, min(1.0, v)) * 32767)) for v in buf))
