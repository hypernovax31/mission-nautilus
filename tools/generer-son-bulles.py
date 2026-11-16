#!/usr/bin/env python3
"""Reconstruit le son de bulles progressif utilisé à l'ouverture.

Source : « Skippy Fish Water Sound Collection », jcpmcdonald, CC0 1.0.
https://opengameart.org/content/skippy-fish-water-sound-collection

Le fichier est un vrai enregistrement de bulles dans l'eau. Plusieurs passages
décalés et de vitesses variées donnent un bouillonnement croissant, sans
ajouter de musique, d'alarme ni de deuxième son au clic. FFmpeg et son
encodeur libmp3lame sont nécessaires uniquement pour régénérer le MP3.
"""
from __future__ import annotations

import argparse
from array import array
from pathlib import Path
import subprocess
import sys
import tempfile
import wave


ROOT = Path(__file__).resolve().parent.parent
RATE = 44100
DURATION = 1.5
# Départ, début et fin dans la prise d'origine, vitesse, niveau relatif.
# Les événements se rapprochent et gagnent progressivement en intensité.
EVENTS = (
    (0.00, 0.00, 0.604, 0.95, 0.40),
    (0.38, 0.05, 0.604, 1.02, 0.55),
    (0.70, 0.00, 0.520, 1.08, 0.72),
    (0.98, 0.04, 0.540, 0.96, 0.85),
    (1.18, 0.08, 0.490, 1.07, 1.00),
)


def read_source(path: Path) -> list[float]:
    with wave.open(str(path), 'rb') as sound:
        if (sound.getnchannels(), sound.getsampwidth(), sound.getframerate()) != (2, 2, RATE):
            raise ValueError('La source doit être stéréo, 16 bits et 44 100 Hz.')
        samples = array('h')
        samples.frombytes(sound.readframes(sound.getnframes()))
    if sys.byteorder != 'little':
        samples.byteswap()
    return [(samples[i] + samples[i + 1]) / 65536 for i in range(0, len(samples), 2)]


def normalize(samples: list[float] | array, target: float = 0.86) -> list[float]:
    peak = max(abs(value) for value in samples)
    if peak == 0:
        raise ValueError('Le son ne contient aucun signal.')
    return [value * target / peak for value in samples]


def write_wave(path: Path, samples: list[float]) -> None:
    pcm = array('h', (round(max(-1.0, min(1.0, value)) * 32767) for value in samples))
    if sys.byteorder != 'little':
        pcm.byteswap()
    with wave.open(str(path), 'wb') as sound:
        sound.setnchannels(1)
        sound.setsampwidth(2)
        sound.setframerate(RATE)
        sound.writeframes(pcm.tobytes())


def mix(source: list[float]) -> list[float]:
    output = [0.0] * round(RATE * DURATION)
    for start, begin, end, speed, gain in EVENTS:
        end = min(end, len(source) / RATE)
        offset = round(start * RATE)
        length = min(len(output) - offset, int((end - begin) * RATE / speed))
        for i in range(length):
            pos = begin * RATE + i * speed
            left = int(pos)
            frac = pos - left
            sample = source[left] * (1 - frac) + source[min(left + 1, len(source) - 1)] * frac
            # Petits fondus de chaque prise : aucune coupure ou clic ajouté.
            envelope = min(1.0, i / (0.008 * RATE), (length - 1 - i) / (0.015 * RATE))
            output[offset + i] += sample * gain * envelope

    for i, sample in enumerate(output):
        t = i / RATE
        # Le volume accompagne la densité croissante des bulles. Le très
        # court fondu final évite un claquement en fin de lecture.
        crescendo = 0.62 + 0.38 * min(t / 1.43, 1.0)
        debut = min(1.0, t / 0.012)
        fin = min(1.0, (DURATION - t) / 0.070)
        output[i] = sample * crescendo * debut * fin
    return normalize(output)


def build(source: Path, output: Path, ffmpeg: str) -> None:
    samples = mix(read_source(source))
    with tempfile.TemporaryDirectory(prefix='nautilus-bulles-') as directory:
        work = Path(directory)
        initial = work / 'bulles.wav'
        compressed = work / 'bulles-compressees.wav'
        encoded = work / 'bulles.mp3'
        write_wave(initial, samples)
        # Compression douce pour rendre les bulles audibles sur un téléphone,
        # tout en conservant la montée de niveau et une marge sans saturation.
        raw = subprocess.run([
            ffmpeg, '-v', 'error', '-i', str(initial),
            '-af', 'acompressor=threshold=0.06:ratio=3:attack=3:release=80',
            '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '1', '-ar', str(RATE), 'pipe:1',
        ], check=True, stdout=subprocess.PIPE).stdout
        filtered = array('f')
        filtered.frombytes(raw)
        if sys.byteorder != 'little':
            filtered.byteswap()
        if len(filtered) != round(RATE * DURATION):
            raise ValueError('Durée audio inattendue après compression.')
        write_wave(compressed, normalize(filtered))
        subprocess.run([
            ffmpeg, '-v', 'error', '-y', '-i', str(compressed),
            '-c:a', 'libmp3lame', '-b:a', '96k', '-ac', '1', '-ar', str(RATE), str(encoded),
        ], check=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(encoded.read_bytes())
    print(f'Son de bulles généré : {output} ({DURATION} s)')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'tools/audio-source/bulles-skippy.wav')
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/alerte-open.mp3')
    parser.add_argument('--ffmpeg', default='ffmpeg', help='chemin vers FFmpeg (par défaut : ffmpeg)')
    args = parser.parse_args()
    build(args.source, args.output, args.ffmpeg)


if __name__ == '__main__':
    main()
