#!/usr/bin/env python3
"""Vérifie les noms de keyframes CSS utilisés par chaque page HTML.

Usage : python3 tools/verifier-animations.py [--root /chemin/site]

Analyse les feuilles CSS locales, les blocs <style> et les attributs style de
chaque page. Cela détecte notamment une déclaration `animation: nom ...` dont
aucune règle @keyframes ne définit `nom` : le navigateur l'accepte pourtant
sans erreur et l'élément reste immobile. L'analyse ne couvre pas les styles
injectés à l'exécution par JavaScript ; les tests navigateur les complètent.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

KEYWORDS = {
    "none", "inherit", "initial", "unset", "revert", "revert-layer",
    "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start",
    "step-end", "infinite", "alternate", "alternate-reverse", "normal",
    "reverse", "running", "paused", "forwards", "backwards", "both",
    "auto", "important", "var", "cubic-bezier", "steps",
}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.styles: list[tuple[str, str]] = []
        self.links: list[str] = []
        self._style: list[str] | None = None
        self._line = 0

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "style":
            self._style = []
            self._line = self.getpos()[0]
        if tag == "link" and "stylesheet" in attributes.get("rel", "").split():
            self.links.append(attributes.get("href", ""))
        if attributes.get("style"):
            self.styles.append((f"attribut style ligne {self.getpos()[0]}", attributes["style"]))

    def handle_data(self, data):
        if self._style is not None:
            self._style.append(data)

    def handle_endtag(self, tag):
        if tag == "style" and self._style is not None:
            self.styles.append((f"<style> ligne {self._line}", "".join(self._style)))
            self._style = None


def without_functions(value: str) -> str:
    """Retire le contenu des fonctions CSS, notamment cubic-bezier(…)."""
    depth = 0
    result = []
    for character in value:
        if character == "(":
            depth += 1
        elif character == ")":
            depth = max(0, depth - 1)
        elif depth == 0:
            result.append(character)
    return "".join(result)


def animation_names(value: str):
    for animation in without_functions(value).split(","):
        for word in re.findall(r"(?<![\w-])(?:--[\w-]+|[A-Za-z_][\w-]*|[0-9.]+(?:ms|s)?)(?![\w-])", animation):
            if word in KEYWORDS or word.startswith("--") or re.match(r"^[0-9.]", word):
                continue
            yield word
            break


def audit(root: Path) -> int:
    missing_total = 0
    for html in sorted(root.glob("*.html")):
        page = Page()
        page.feed(html.read_text(encoding="utf-8"))
        sources = [(f"{html.name} {name}", css) for name, css in page.styles]
        for href in page.links:
            url = urlsplit(href)
            if url.scheme or url.netloc or not url.path:
                continue
            candidate = (html.parent / unquote(url.path)).resolve()
            if not candidate.is_relative_to(root) or not candidate.is_file():
                continue
            sources.append((href, candidate.read_text(encoding="utf-8")))

        clean = [(name, re.sub(r"/\*.*?\*/", "", css, flags=re.S)) for name, css in sources]
        definitions = set(re.findall(r"@(?:-webkit-)?keyframes\s+([\w-]+)", "\n".join(css for _, css in clean)))
        missing: dict[str, set[str]] = defaultdict(set)
        for source, css in clean:
            for match in re.finditer(r"(?<![\w-])animation(?:-name)?\s*:\s*([^;{}]+)", css):
                for name in animation_names(match.group(1)):
                    if name not in definitions:
                        missing[name].add(source)
        print(f"{html.name} : {len(definitions)} keyframes, {len(missing)} nom(s) manquant(s)")
        for name, places in sorted(missing.items()):
            print(f"  - {name} : {', '.join(sorted(places))}")
        missing_total += len(missing)
    return missing_total


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    root = args.root.resolve()
    if not root.is_dir():
        parser.error("le dossier du site n'existe pas")
    total = audit(root)
    if total:
        print(f"ÉCHEC : {total} nom(s) d'animation non défini(s).", file=sys.stderr)
        return 1
    print("Noms d'animation CSS : OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
