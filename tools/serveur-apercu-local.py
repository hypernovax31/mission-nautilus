#!/usr/bin/env python3
"""Serveur local pour REGARDER les écrans du jeu (outil de développement).

Pourquoi ce fichier ? Les pages du jeu sont de simples fichiers statiques :
on les ouvre d'ordinaire en double-cliquant dessus. Mais certaines pages ont
besoin d'un vrai serveur — l'aperçu du popup lit palier1.html par fetch(),
ce que le navigateur interdit depuis un fichier local (file://).

Usage :
    python3 tools/serveur-apercu-local.py            # port 8000
    python3 tools/serveur-apercu-local.py 8123       # autre port

Adresses :
    http://localhost:8000/                → le VRAI accueil, page de garde
                                            comprise (c'est ici qu'on regarde)
    http://localhost:8000/apercu-popup    → aperçu du popup de sacrifice
    http://localhost:8000/palier1.html    → le jeu, à ses adresses habituelles

L'ÉCOUTILLE DANS L'APERÇU — deux règles propres à cet outil
-----------------------------------------------------------
1. Elle s'affiche À CHAQUE CHARGEMENT de l'accueil, comme sur le vrai site
   depuis que la règle est : « le son se débloque à chaque chargement, donc
   l'écoutille se montre à chaque chargement ». Rien à faire ici : c'est le
   comportement normal. Ce serveur efface malgré tout l'ancien marqueur de
   session avant chaque rendu, pour ne pas garder de trace des versions
   précédentes de la page de garde.
   Pour la sauter volontairement : http://localhost:8000/?ecoutille=0
2. Toute adresse inconnue ramène à l'accueil, comme l'hébergement du jeu
   (firebase.json : « ** » → /index.html). /ecoutille, /ecoutille/1 et
   /splash ramènent donc à l'accueil AVEC la page de garde.

JOURNAL DES REQUÊTES
--------------------
Chaque requête est notée dans .nautilus-requetes.log (ignoré par Git) :
adresse demandée, navigateur, réponse. C'est ce qui permet de vérifier, sans
être devant l'écran, ce qu'un navigateur a réellement demandé — et donc de
distinguer « la page n'a pas été rechargée » de « la page ne s'affiche pas ».

Ce serveur ne modifie RIEN et n'envoie RIEN au réseau : il distribue le
dossier du jeu à ton navigateur, et n'enregistre que ce qui est demandé.
"""
import http.server
import socketserver
import sys
import time
from datetime import datetime
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
APERCU_POPUP = '/tools/apercu-popup-sacrifice.html'
JOURNAL = RACINE / '.nautilus-requetes.log'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

# Injecté juste après <head>, AVANT tout le reste. Trois missions :
#   1. effacer l'ancien marqueur de session de l'écoutille (voir en-tête) ;
#   2. DÉSINSCRIRE le service worker et VIDER son cache. C'est le piège qui a
#      fait croire que rien ne s'affichait : le service worker du jeu garde
#      une copie de la page et la ressert quand le réseau manque (et le
#      serveur d'aperçu est arrêté entre deux sessions !). On nettoyait donc
#      l'ancienne page, sans la page de garde, indéfiniment. Ici, en aperçu,
#      on repart du serveur à chaque fois.
#   3. recharger UNE fois si un service worker était encore actif, pour que le
#      visiteur voie la version fraîche sans rien faire (jamais deux fois :
#      le marqueur « apercu-purge » l'en empêche).
SNIPPET = (
    '<script>(function(){try{'
    "sessionStorage.removeItem('nautilusEcoutille');"
    "sessionStorage.removeItem('nautilusEcoutilleForce');"
    '}catch(e){}'
    "if('serviceWorker' in navigator){"
    'navigator.serviceWorker.getRegistrations().then(function(rs){'
    'var actif = rs.length > 0;'
    'return Promise.all(rs.map(function(r){return r.unregister();})).then(function(){'
    'return caches.keys().then(function(ks){'
    'return Promise.all(ks.map(function(k){return caches.delete(k);}));'
    '});}).then(function(){'
    "var deja = false; try{ deja = sessionStorage.getItem('apercu-purge') === '1'; }catch(e){}"
    'if(actif && !deja){'
    "try{ sessionStorage.setItem('apercu-purge','1'); }catch(e){}"
    'location.reload();'
    '}'
    '});})'
    ".catch(function(){});}"
    '})();</script>\n'
)


def journaliser(chemin, ua, etat):
    """Note la requête : c'est la seule trace de ce qu'a vu le navigateur."""
    try:
        ligne = '{}\t{}\t{}\t{}\n'.format(
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            etat,
            chemin,
            (ua or '')[:110],
        )
        with JOURNAL.open('a', encoding='utf-8') as f:
            f.write(ligne)
    except OSError:
        pass  # un journal qu'on ne peut pas écrire ne doit pas casser l'aperçu


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RACINE), **kwargs)

    # ---------- choix de la page ----------
    def chemin_vise(self):
        """Adresse demandée, sans paramètre ni ancre."""
        return self.path.split('?')[0].split('#')[0]

    def parametre(self, nom):
        if '?' not in self.path:
            return ''
        requete = self.path.split('?', 1)[1].split('#')[0]
        for morceau in requete.split('&'):
            cle, _, valeur = morceau.partition('=')
            if cle == nom:
                return valeur
        return ''

    def do_GET(self):
        chemin = self.chemin_vise()
        if chemin in ('/', '/index.html') or chemin.startswith('/ecoutille') or chemin == '/splash':
            self.servir_accueil()
            return
        if chemin in ('/apercu-popup', '/apercu-popup.html'):
            self.path = APERCU_POPUP
        journaliser(self.path, self.headers.get('User-Agent'), 'fichier')
        return super().do_GET()

    # ---------- l'accueil, page de garde comprise ----------
    def servir_accueil(self):
        """Sert index.html en effaçant le marqueur de session de l'écoutille.

        Le script est inséré JUSTE APRÈS <head>, donc avant la sentinelle qui
        décide de jouer ou non la page de garde : au moment où elle décide,
        c'est bien « première visite ».
        """
        fichier = RACINE / 'index.html'
        try:
            html = fichier.read_text(encoding='utf-8')
        except OSError:
            self.send_error(500, 'index.html illisible')
            return

        force = self.parametre('ecoutille') not in ('0', 'non')
        if force and '<head>' in html:
            html = html.replace('<head>', '<head>\n' + SNIPPET, 1)
        corps = html.encode('utf-8')

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(corps)))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        self.wfile.write(corps)
        journaliser(self.path, self.headers.get('User-Agent'),
                    'accueil + garde' if force else 'accueil')

    def end_headers(self):
        # Jamais de cache : on regarde justement des fichiers qu'on vient
        # de modifier.
        if not self._headers_buffer or b'Cache-Control' not in b''.join(self._headers_buffer):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass  # journal silencieux : la console reste lisible


socketserver.TCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), Handler) as httpd:
    print(f'Accueil  : http://localhost:{PORT}/            (page de garde à CHAQUE chargement)', flush=True)
    print(f'Aperçus  : http://localhost:{PORT}/apercu-popup  ·  ?ecoutille=0 pour la sauter', flush=True)
    print(f'Journal  : {JOURNAL}', flush=True)
    httpd.serve_forever()
