#!/usr/bin/env bash
# ============================================================
# Build script — génère palier1.html standalone
# ============================================================
# Prend la version source (161129518.html) + le module partagé
# (nautilus-core.js) et produit un fichier HTML unique prêt à
# déployer, sans aucune dépendance externe (sauf Firebase qui
# reste en réseau).
#
# Usage :   ./build.sh
# Output :  palier1.html (dans le même dossier)
# ============================================================

set -euo pipefail

cd "$(dirname "$0")"

SRC="161129518.html"
CORE="nautilus-core.js"
OUT="palier1.html"

if [ ! -f "$SRC" ]; then
  echo "❌ Fichier source introuvable : $SRC" >&2
  exit 1
fi
if [ ! -f "$CORE" ]; then
  echo "❌ Module partagé introuvable : $CORE" >&2
  exit 1
fi

echo "📦 Build standalone en cours…"

# 1) Extraire le bloc <script type="module"> du HTML source
# 2) Y injecter le contenu de nautilus-core.js
# 3) Remplacer l'import par un commentaire
# 4) Sortir dans palier1.html

python3 - <<'PY'
import re, pathlib

src_path   = pathlib.Path("161129518.html")
core_path  = pathlib.Path("nautilus-core.js")
out_path   = pathlib.Path("palier1.html")

html   = src_path.read_text(encoding="utf-8")
core   = core_path.read_text(encoding="utf-8")

# Trouve le bloc <script type="module">…</script>
m = re.search(r'(<script\s+type="module">)([\s\S]*?)(</script>)', html)
if not m:
    raise SystemExit("❌ Aucun <script type=\"module\"> trouvé dans 161129518.html")

script_body = m.group(2)

# Supprime l'import './nautilus-core.js' (n'importe quelle syntaxe valide)
script_body = re.sub(
    r"^\s*import\s+['\"]\./nautilus-core\.js['\"]\s*;?\s*$",
    "/* nautilus-core.js inliné ci-dessous */",
    script_body,
    flags=re.MULTILINE,
)

# Bundle : colle d'abord le core (il doit définir window.Nautilus),
# puis le script principal.
bundled = (
    "/* === nautilus-core.js (inlined) === */\n"
    + core
    + "\n\n/* === 161129518.html script (inlined) === */\n"
    + script_body
)

# Remplace le bloc <script> par la version bundlée.
new_script = f'<script type="module">\n{bundled}\n</script>'
new_html = html[:m.start()] + new_script + html[m.end():]

out_path.write_text(new_html, encoding="utf-8")

# Stats
src_kb  = src_path.stat().st_size / 1024
out_kb  = out_path.stat().st_size / 1024
core_kb = core_path.stat().st_size / 1024
print(f"   {src_path.name:24s} {src_kb:7.1f} KB")
print(f"   {core_path.name:24s} {core_kb:7.1f} KB")
print(f"   {out_path.name:24s} {out_kb:7.1f} KB  (bundlé)")
PY

echo "✅ Bundle généré : $OUT"
echo ""
echo "Tu peux maintenant déployer uniquement palier1.html n'importe où."
