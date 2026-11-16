#!/usr/bin/env python3
"""Prépare une immersion sonore de 2 s à partir de prises réelles.

Bulles : « Scuba_bubbles.mp3 » de sbvitug (CC0 1.0), 48,25–50,25 s :
https://freesound.org/people/sbvitug/sounds/634225/
Immersion : « Scuba 1.mp3 » de digifishmusic (CC BY 4.0), 5–7 s de
l'extrait scuba1bubbles.ogg : https://freesound.org/people/digifishmusic/sounds/45521/

Les deux enregistrements sous-marins restent stéréo et continus : aucune
boucle ni modification de hauteur. Le mixage et les fondus sont appliqués
avant l'encodage. FFmpeg avec libmp3lame est requis pour produire le MP3.
"""
from __future__ import annotations

import argparse
from array import array
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import wave

ROOT = Path(__file__).resolve().parent.parent
RATE = 44100
CHANNELS = 2
DURATION = 2.0


def load(path: Path) -> array:
    with wave.open(str(path), 'rb') as sound:
        if (sound.getnchannels(), sound.getsampwidth(), sound.getframerate(), sound.getnframes()) != (
            CHANNELS, 2, RATE, round(RATE * DURATION)
        ):
            raise ValueError(f'{path} : attendu 2 s, stéréo 16 bits à 44 100 Hz.')
        samples = array('h')
        samples.frombytes(sound.readframes(sound.getnframes()))
    if sys.byteorder != 'little':
        samples.byteswap()
    return samples


def mix(bubbles: array, water: array) -> array:
    # Le mouvement de l'eau reste derrière les bulles, sans masquer les sons
    # perceptibles sur les petits haut-parleurs ; la stéréo est conservée.
    rms_bubbles = math.sqrt(sum(sample * sample for sample in bubbles) / len(bubbles))
    rms_water = math.sqrt(sum(sample * sample for sample in water) / len(water))
    if not rms_bubbles or not rms_water:
        raise ValueError('Une prise ne contient aucun signal.')
    water_gain = 0.60 * rms_bubbles / rms_water
    data = array('f')
    for i in range(0, len(bubbles), CHANNELS):
        t = (i // CHANNELS) / RATE
        # La prise s'intensifie naturellement ; un fondu doux supprime les clics.
        gain = 0.90 + 0.10 * min(t / 1.90, 1.0)
        fade_in = min(1.0, t / 0.030)
        fade_out = min(1.0, (DURATION - t) / 0.080)
        for channel in range(CHANNELS):
            sample = (bubbles[i + channel] + water_gain * water[i + channel]) / 32768
            data.append(sample * gain * fade_in * fade_out)
    peak = max(abs(sample) for sample in data)
    if not peak:
        raise ValueError('Le mixage ne contient aucun signal.')
    # Marge pour l'encodage et l'écoute, sans écrêtage.
    pcm = array('h', (round(sample * 0.84 / peak * 32767) for sample in data))
    if sys.byteorder != 'little':
        pcm.byteswap()
    return pcm


def build(bubbles: Path, water: Path, output: Path, ffmpeg: str) -> None:
    pcm = mix(load(bubbles), load(water))
    with tempfile.TemporaryDirectory(prefix='nautilus-immersion-') as directory:
        work = Path(directory)
        wav, mp3 = work / 'immersion.wav', work / 'immersion.mp3'
        with wave.open(str(wav), 'wb') as sound:
            sound.setnchannels(CHANNELS)
            sound.setsampwidth(2)
            sound.setframerate(RATE)
            sound.writeframes(pcm.tobytes())
        subprocess.run([
            ffmpeg, '-v', 'error', '-y', '-i', str(wav), '-map_metadata', '-1',
            '-c:a', 'libmp3lame', '-b:a', '192k', '-ac', str(CHANNELS), '-ar', str(RATE), str(mp3),
        ], check=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(mp3.read_bytes())
    print(f'Immersion sous-marine générée : {output} ({DURATION} s)')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bubbles', type=Path, default=ROOT / 'tools/audio-source/bulles-plongee.wav')
    parser.add_argument('--water', type=Path, default=ROOT / 'tools/audio-source/immersion-hydrophone.wav')
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/alerte-open.mp3')
    parser.add_argument('--ffmpeg', default='ffmpeg', help='chemin vers FFmpeg (par défaut : ffmpeg)')
    args = parser.parse_args()
    build(args.bubbles, args.water, args.output, args.ffmpeg)


if __name__ == '__main__':
    main()
