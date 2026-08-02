# Reproduit EXACTEMENT l'algorithme du navigateur, en WAV, pour ecouter.
import math, random, struct, wave

SR = 48000
TEXTE = ("En 1870, le Nautilus disparaît au large des îles Lofoten, englouti par le maelström. "
         "156 ans plus tard, son signal résonne de nouveau — sous les rayons de la Fnac Labège. "
         "Le premier équipage à le ramener à la surface entrera dans la légende du magasin. "
         "Le sonar est allumé, matelot. À vous de jouer !")

DUREE = len(TEXTE)/3*0.030 + 1.0
buf = [0.0]*int(SR*DUREE)

def bandpass(x, f0, Q, sr=SR):
    # biquad passe-bande, memes formules que la Web Audio API
    w0 = 2*math.pi*f0/sr; alpha = math.sin(w0)/(2*Q)
    b0, b1, b2 = alpha, 0.0, -alpha
    a0, a1, a2 = 1+alpha, -2*math.cos(w0), 1-alpha
    b0,b1,b2,a1,a2 = b0/a0, b1/a0, b2/a0, a1/a0, a2/a0
    y=[0.0]*len(x); x1=x2=y1=y2=0.0
    for i,s in enumerate(x):
        o = b0*s + b1*x1 + b2*x2 - a1*y1 - a2*y2
        x2,x1 = x1,s; y2,y1 = y1,o; y[i]=o
    return y

random.seed(7)
NOISE = [random.uniform(-1,1) for _ in range(int(SR*0.03))]

def clic(t0, fort):
    rate = 0.85 + random.random()*0.45
    freq = (1100+random.random()*200) if fort else (1900+random.random()*700)
    dur  = 0.030 if fort else 0.022
    vol  = (1 if fort else 0.72) * (0.8+random.random()*0.4) * 0.13
    n = int(SR*dur)
    src = [NOISE[min(int(i*rate), len(NOISE)-1)] for i in range(n)]
    src = bandpass(src, freq, 6)
    start = int(t0*SR)
    for i in range(n):
        # enveloppe : attaque 2 ms puis extinction exponentielle
        p = i/SR
        e = (p/0.002) if p < 0.002 else math.exp(-(p-0.002)/(dur/4.5))
        k = start+i
        if 0 <= k < len(buf): buf[k] += src[i]*vol*min(e,1.0)

def ding(t0):
    n = int(SR*0.34)
    for i in range(n):
        p = i/SR
        e = (p/0.008) if p < 0.008 else math.exp(-(p-0.008)/0.075)
        k = int(t0*SR)+i
        if 0 <= k < len(buf): buf[k] += math.sin(2*math.pi*1760*p)*0.16*min(e,1.0)

t = 0.0; i = 0
while i < len(TEXTE):
    i = min(len(TEXTE), i+3)
    c = TEXTE[i-1]
    clic(t, c == ' ' or c in '.,;:!?—')
    t += 0.030
ding(t+0.05)

mx = max(abs(v) for v in buf) or 1
with wave.open('/home/user/mission-nautilus/apercu-son-frappe.wav','w') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes(b''.join(struct.pack('<h', int(max(-1,min(1,v/mx*0.85))*32767)) for v in buf))
print('duree %.2f s' % DUREE)
