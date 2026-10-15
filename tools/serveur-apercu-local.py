#!/usr/bin/env python3
"""Serveur local pour REGARDER les écrans du jeu (outil de développement).

Pourquoi ce fichier ? Les pages du jeu sont de simples fichiers statiques :
on les ouvre d'ordinaire en double-cliquant dessus. Mais certaines pages
ont besoin d'un vrai serveur — l'aperçu du popup de confirmation lit
palier1.html par fetch(), ce que le navigateur interdit depuis un fichier
local (file://).

Usage :
    python3 tools/serveur-apercu-local.py            # port 8000
    python3 tools/serveur-apercu-local.py 8123       # autre port

Ce serveur ne modifie RIEN et n'envoie RIEN au réseau : il se contente de
distribuer le dossier du jeu à ton navigateur. La racine « / » ouvre
l'aperçu du popup ; le jeu complet reste accessible à ses adresses
habituelles (http://localhost:8000/index.html, /palier1.html…).
"""
import http.server
import socketserver
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
APERCU = '/tools/apercu-popup-sacrifice.html'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RACINE), **kwargs)

    def do_GET(self):
        # La racine du serveur (et index.html?apercu=1) ouvre l'aperçu :
        # c'est le seul écran qu'on vient regarder ici.
        if self.path in ('/', '/index.html', '/index.html?apercu=1'):
            self.path = APERCU
        return super().do_GET()

    def end_headers(self):
        # Jamais de cache : on regarde justement des fichiers qu'on vient
        # de modifier.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass  # journal silencieux : la console reste lisible


socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), Handler) as httpd:
    print(f'Aperçu prêt : http://localhost:{PORT}/  (dossier {RACINE})', flush=True)
    httpd.serve_forever()
