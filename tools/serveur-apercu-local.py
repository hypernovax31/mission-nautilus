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
distribuer le dossier du jeu à ton navigateur. La racine « / » ouvre le
VRAI accueil (page de garde comprise) ; l'aperçu du popup de confirmation
reste à part : http://localhost:8000/apercu-popup.

POUR REVOIR LA PAGE DE GARDE : elle ne s'affiche qu'à la première visite
(ensuite, le marqueur de session la saute, comme en vrai). Trois adresses
pour la piloter :
    http://localhost:8000/?ecoutille=1     → on la rejoue
    http://localhost:8000/?ecoutille=0     → on la passe
    (sans paramètre)                       → première visite : elle s'affiche
"""
import http.server
import socketserver
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
APERCU_POPUP = '/tools/apercu-popup-sacrifice.html'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RACINE), **kwargs)

    def do_GET(self):
        # La racine ouvre le VRAI accueil : c'est lui qu'on vient regarder
        # (page de garde « écoutille » comprise). L'aperçu du popup de
        # sacrifice garde son adresse dédiée.
        if self.path in ('/', '/index.html?apercu=1', '/apercu-popup', '/apercu-popup.html'):
            self.path = APERCU_POPUP if self.path != '/' else '/index.html'
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
    print(f'Accueil  : http://localhost:{PORT}/            (page de garde au 1er chargement)', flush=True)
    print(f'Aperçus  : http://localhost:{PORT}/apercu-popup  ·  ?ecoutille=1 pour rejouer l\'écoutille', flush=True)
    httpd.serve_forever()
