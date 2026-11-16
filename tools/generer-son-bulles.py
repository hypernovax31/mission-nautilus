#!/usr/bin/env python3
"""Adapte à 2 secondes le son « Bubbles » choisi pour l'ouverture.

Source : hotpin7, Freesound 840042, CC0 1.0 :
https://freesound.org/people/hotpin7/sounds/840042/

L'original dure environ 1,19 s et se termine par une queue presque
silencieuse. On garde toute la partie audible, puis on l'étire sans changer
volontairement sa hauteur, sans répétition ni ajout d'autres sons. De courts
fondus évitent les clics. FFmpeg avec libmp3lame est requis.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent.parent


def build(source: Path, output: Path, ffmpeg: str) -> None:
    # La fin de l'original est sous le seuil audible. Deux étirements à 0,66
    # gardent la hauteur et utilisent au mieux les deux secondes demandées.
    filters = (
        'atrim=duration=0.9,asetpts=PTS-STARTPTS,atempo=0.66,atempo=0.66,'
        'apad=whole_dur=2,atrim=duration=2,afade=t=in:st=0:d=0.005,'
        'afade=t=out:st=1.95:d=0.05,volume=1.6'
    )
    with tempfile.TemporaryDirectory(prefix='nautilus-bulles-') as directory:
        mp3 = Path(directory) / 'bulles.mp3'
        subprocess.run([
            ffmpeg, '-v', 'error', '-y', '-i', str(source), '-af', filters,
            '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '192k',
            '-ac', '2', '-ar', '44100', str(mp3),
        ], check=True)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(mp3.read_bytes())
    print(f'Son de bulles choisi généré : {output} (2 s)')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'tools/audio-source/bulles-hotpin7.wav')
    parser.add_argument('--output', type=Path, default=ROOT / 'assets/alerte-open.mp3')
    parser.add_argument('--ffmpeg', default='ffmpeg', help='chemin vers FFmpeg (par défaut : ffmpeg)')
    args = parser.parse_args()
    build(args.source, args.output, args.ffmpeg)


if __name__ == '__main__':
    main()
