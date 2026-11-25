#!/usr/bin/env python3
"""Prépare le signal demandé pour l'ouverture de 1,5 seconde.

Source : « Underwater, Signal » de LilMati (Freesound 448743, CC0 1.0) :
https://freesound.org/people/LilMati/sounds/448743/

L'original dure deux secondes. Il est accéléré sans changer volontairement sa
hauteur, puis amplifié de 10 dB. Ses crêtes étant déjà proches de 0 dBFS, un
limiteur évite l'écrêtage ; elles ne peuvent donc pas toutes gagner 10 dB.
FFmpeg avec libmp3lame est requis.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent


def build(source: Path, output: Path, ffmpeg: str) -> None:
    # Limiteur suréchantillonné, sans compensation automatique du niveau, pour
    # appliquer +10 dB tout en protégeant les crêtes déjà proches de 0 dBFS.
    filters = (
        'atempo=1.3333333333,apad=whole_dur=1.5,atrim=duration=1.5,'
        'volume=10dB,aresample=176400,'
        'alimiter=limit=0.89:attack=1:release=30:level=false:latency=true,'
        'aresample=44100,afade=t=in:st=0:d=0.005,afade=t=out:st=1.45:d=0.05'
    )
    with tempfile.TemporaryDirectory(prefix='nautilus-signal-') as directory:
        mp3 = Path(directory) / 'signal.mp3'
        subprocess.run([
            ffmpeg, '-v', 'error', '-y', '-i', str(source), '-af', filters,
            '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '192k',
            '-ac', '2', '-ar', '44100', str(mp3),
        ], check=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(mp3.read_bytes())
    print(f'Signal choisi généré : {output} (1,5 s ; gain +10 dB, pics limités)')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'tools/audio-source/signal-lilmati.wav')
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/alerte-open.mp3')
    parser.add_argument('--ffmpeg', default='ffmpeg', help='chemin vers FFmpeg (par défaut : ffmpeg)')
    args = parser.parse_args()
    build(args.source, args.output, args.ffmpeg)


if __name__ == '__main__':
    main()
