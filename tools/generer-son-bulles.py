#!/usr/bin/env python3
"""Prépare le son d'ouverture à partir d'une vraie prise de plongée.

Source : « Scuba_bubbles.mp3 » par sbvitug, CC0 1.0 :
https://freesound.org/people/sbvitug/sounds/634225/

L'extrait est continu (48,25 à 49,75 s de l'enregistrement original) : pas de
boucle, de superposition ni de changement de hauteur. Seuls une légère
montée de volume et de courts fondus évitent les coupures brusques.
FFmpeg avec libmp3lame est requis pour reconstruire le MP3.
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
CHANNELS = 2
DURATION = 1.5


def load(path: Path) -> array:
    with wave.open(str(path), 'rb') as sound:
        if (sound.getnchannels(), sound.getsampwidth(), sound.getframerate(), sound.getnframes()) != (
            CHANNELS, 2, RATE, round(RATE * DURATION)
        ):
            raise ValueError('La prise doit durer 1,5 s, en stéréo 16 bits à 44 100 Hz.')
        samples = array('h')
        samples.frombytes(sound.readframes(sound.getnframes()))
    if sys.byteorder != 'little':
        samples.byteswap()
    return samples


def shape(samples: array) -> array:
    data = array('f')
    for i in range(0, len(samples), CHANNELS):
        t = (i // CHANNELS) / RATE
        # La prise monte naturellement ; cette légère progression accompagne
        # l'animation sans répéter, déformer ou rajouter de bruit.
        gain = 0.82 + 0.18 * min(t / 1.42, 1.0)
        fade_in = min(1.0, t / 0.025)
        fade_out = min(1.0, (DURATION - t) / 0.070)
        for channel in range(CHANNELS):
            data.append((samples[i + channel] / 32768) * gain * fade_in * fade_out)
    peak = max(abs(sample) for sample in data)
    if peak == 0:
        raise ValueError('La prise ne contient aucun signal.')
    # Marge de sécurité : pas d'écrêtage ni de clic final.
    pcm = array('h', (round(sample * 0.86 / peak * 32767) for sample in data))
    if sys.byteorder != 'little':
        pcm.byteswap()
    return pcm


def build(source: Path, output: Path, ffmpeg: str) -> None:
    pcm = shape(load(source))
    with tempfile.TemporaryDirectory(prefix='nautilus-bulles-') as directory:
        work = Path(directory)
        wav, mp3 = work / 'bulles.wav', work / 'bulles.mp3'
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
    print(f'Bulles sous-marines générées : {output} ({DURATION} s)')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'tools/audio-source/bulles-plongee.wav')
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/alerte-open.mp3')
    parser.add_argument('--ffmpeg', default='ffmpeg', help='chemin vers FFmpeg (par défaut : ffmpeg)')
    args = parser.parse_args()
    build(args.source, args.output, args.ffmpeg)


if __name__ == '__main__':
    main()
