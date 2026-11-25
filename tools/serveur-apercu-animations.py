#!/usr/bin/env python3
"""Aperçu isolé d'une copie du site pour vérifier ses animations.

Usage : python3 tools/serveur-apercu-animations.py --source /chemin/copie
La copie de la version publiée peut être préparée à partir de l'archive du
commit indiqué dans CORRECTIF-SONAR-PUBLICATION.md, puis patchée avec
correctif-sonar-site-publie.patch. Ce serveur ne modifie aucun de ses fichiers.

Les modules Firebase sont remplacés par des modules locaux éphémères et une
politique CSP interdit les connexions extérieures : même un clic sur le site
ne peut pas écrire dans la vraie base Firestore. Les données du navigateur
restent propres à l'origine de cet aperçu. Ce serveur est destiné à un aperçu,
pas à un déploiement de production.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


APP = """
const app = {name: '[APERCU]'};
export const initializeApp = () => app;
export const getApp = () => app;
export const getApps = () => [app];
"""

AUTH = """
const auth = {currentUser: {uid: 'apercu-local'}};
export const getAuth = () => auth;
export const signInAnonymously = async () => ({user: auth.currentUser});
export const onAuthStateChanged = (auth, next) => { queueMicrotask(() => next(auth.currentUser)); return () => {}; };
"""

FIRESTORE = """
// État entièrement dans la mémoire de cet onglet — aucune vraie écriture.
const data = new Map();
const equipes = [
  ['NEMO', 'Nemo', 'Alice', 'start'],
  ['NAUTILUS', 'Nautilus', 'Lou', 'livres'],
  ['ARONNAX', 'Aronnax', 'Sam', 'son'],
  ['NEDLAND', 'Ned Land', 'Camille', 'start']
];
for (const [id, nom, matelot, etape] of equipes) {
  data.set('teams/' + id, {
    teamCode: id, teamName: nom, currentStep: etape, status: 'active',
    lockedUntil: null, failCount: 0, lastLockHours: 0, completedSteps: [],
    members: [{name: matelot, service: 'PE', codeMatelot: 'DEMO-2345'}],
    onlinePlayers: {}
  });
}
data.set('game/config', {customTeams: [], obsoleteTeams: []});
const listeners = new Set();
function parts(args) { return args.flatMap(x => x && typeof x === 'object' && x.path ? [x.path] : typeof x === 'string' ? [x] : []); }
function reference(kind, args) { return {kind, path: parts(args).join('/').replace(/^\\/+|\\/+$/g, '')}; }
function documentSnapshot(path) {
  return {id: path.split('/').pop(), ref: {kind: 'doc', path},
    exists: () => data.has(path), data: () => data.get(path)};
}
function collectionSnapshot(path) {
  const prefix = path + '/';
  const docs = [...data.keys()].filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes('/')).map(documentSnapshot);
  return {docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn), docChanges: () => []};
}
function snapshot(ref) { return ref.kind === 'doc' ? documentSnapshot(ref.path) : collectionSnapshot(ref.path); }
function informer() { for (const fn of [...listeners]) queueMicrotask(fn); }
export const getFirestore = () => ({demo: true});
export const doc = (...args) => reference('doc', args);
export const collection = (...args) => reference('collection', args);
export const getDoc = async ref => snapshot(ref);
export const getDocs = async ref => snapshot(ref);
export async function setDoc(ref, value, options) {
  data.set(ref.path, options && options.merge ? {...(data.get(ref.path) || {}), ...value} : {...value}); informer();
}
export async function updateDoc(ref, value) { data.set(ref.path, {...(data.get(ref.path) || {}), ...value}); informer(); }
export async function deleteDoc(ref) { data.delete(ref.path); informer(); }
export async function addDoc(ref, value) { const next = doc(ref, 'demo-' + Math.random().toString(36).slice(2)); await setDoc(next, value); return next; }
export const deleteField = () => null;
export const serverTimestamp = () => new Date();
export const arrayUnion = (...values) => values;
export const arrayRemove = (...values) => values;
export const increment = value => value;
export const query = ref => ref;
export const where = (...args) => args;
export const orderBy = (...args) => args;
export const limit = (...args) => args;
export const onSnapshot = (ref, next) => {
  const fn = () => next(snapshot(ref)); listeners.add(fn); queueMicrotask(fn);
  return () => listeners.delete(fn);
};
export const runTransaction = async (db, fn) => fn({get: getDoc, set: setDoc, update: updateDoc, delete: deleteDoc});
"""

SCRIPTS = {
    "/__apercu__/firebase-app.js": APP,
    "/__apercu__/firebase-auth.js": AUTH,
    "/__apercu__/firebase-firestore.js": FIRESTORE,
}

IMPORTS = {
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js": "/__apercu__/firebase-app.js",
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js": "/__apercu__/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js": "/__apercu__/firebase-firestore.js",
}

# Sur toutes les pages, bloquer le réseau vers Firebase et les autres domaines.
CSP = ("default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; "
       "style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; "
       "media-src 'self' data: blob:; font-src 'self' data:; "
       "form-action 'self'; object-src 'none'; base-uri 'self'")

BANNER = ("<div aria-label=\"Aperçu avec données fictives\" "
          "style=\"position:fixed;bottom:6px;left:6px;z-index:2147483647;"
          "pointer-events:none;padding:6px 9px;border-radius:8px;"
          "font:700 11px/1.2 system-ui,sans-serif;color:#07232e;"
          "background:#a9efff;box-shadow:0 2px 10px #0008\">"
          "APERÇU · données fictives</div>")


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def _body(self, content: bytes, content_type: str, head: bool = False):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if not head:
            self.wfile.write(content)

    def _respond(self, head: bool = False):
        path = urlsplit(self.path).path
        if path in SCRIPTS:
            return self._body(SCRIPTS[path].encode(), "text/javascript; charset=utf-8", head)
        # Ne pas installer le service worker de production sur l'origine de démo.
        if path.rstrip("/").endswith("/sw.js"):
            self.send_error(404, "Service worker désactivé dans l'aperçu")
            return
        filename = Path(self.translate_path(self.path))
        if filename.is_dir():
            filename /= "index.html"
        if filename.suffix.lower() in {".html", ".htm"} and filename.is_file():
            document = filename.read_text(encoding="utf-8")
            imports = '<script type="importmap">' + json.dumps({"imports": IMPORTS}) + '</script>'
            # La carte des imports doit précéder tous les modules Firebase.
            document = document.replace("<head>", "<head>\n" + imports, 1)
            if "<body>" in document:
                document = document.replace("<body>", "<body>\n" + BANNER, 1)
            return self._body(document.encode(), "text/html; charset=utf-8", head)
        return super().do_HEAD() if head else super().do_GET()

    def do_GET(self):
        return self._respond()

    def do_HEAD(self):
        return self._respond(head=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Dossier de la copie du site")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    source = args.source.resolve()
    if not (source / "index.html").is_file():
        parser.error("la copie doit contenir index.html")
    mimetypes.add_type("text/javascript", ".js")
    server = ThreadingHTTPServer(("0.0.0.0", args.port), partial(Handler, directory=str(source)))
    print(f"Aperçu isolé sur le port {server.server_address[1]} — aucune connexion à Firebase", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
