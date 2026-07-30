#!/usr/bin/env bash
# =============================================================================
#  Mission Nautilus — ancien script, REMPLACE
# =============================================================================
#
#  Ce script ne faisait que reparer la configuration Git. Il ne protegeait
#  pas le travail non encore envoye sur GitHub, qui etait donc perdu a
#  chaque remise a zero de l'atelier.
#
#  Il est remplace par tools/git-guard.sh, qui fait la meme chose ET met le
#  travail a l'abri. Pour ne rien casser, l'ancienne commande continue de
#  fonctionner : elle appelle simplement la nouvelle.
#
# =============================================================================

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

echo "Note : git-setup.sh est remplace par git-guard.sh (qui protege aussi"
echo "       le travail non envoye). Lancement de la nouvelle version…"
echo

exec bash tools/git-guard.sh "${1:-start}"
