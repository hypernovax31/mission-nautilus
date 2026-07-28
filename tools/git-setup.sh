#!/usr/bin/env bash
# =============================================================================
#  Mission Nautilus - reparation de la configuration Git
# =============================================================================
#
#  POURQUOI CE SCRIPT EXISTE
#
#  L'environnement de travail recree periodiquement le depot avec une
#  configuration incomplete :
#
#    1. remote.origin.fetch = +refs/heads/main:refs/remotes/origin/main
#       -> seule la branche "main" est rapatriee. La branche de travail
#          arena/... est ignoree par un "git fetch" ordinaire.
#
#    2. la branche de travail n'a aucune branche amont configuree
#       -> git ne peut pas comparer le local et le distant. "git log" affiche
#          alors une base ancienne (le dernier commit de main), et le push est
#          refuse avec "Updates were rejected... fetch first".
#
#  Ce n'est PAS une perte de donnees : les commits distants sont intacts, le
#  depot local ne sait simplement pas qu'ils existent.
#
#  ATTENTION : le fichier .git/config n'est pas conserve d'une session a
#  l'autre (il est exclu des sauvegardes). La correction doit donc etre
#  reappliquee au debut de chaque session : c'est le role de ce script.
#
#  USAGE :  bash tools/git-setup.sh
#
# =============================================================================

set -euo pipefail

BRANCH="arena/019fa0d2-mission-nautilus"

echo "== Configuration Git de Mission Nautilus =="

# 1) Rapatrier TOUTES les branches, pas seulement main.
git config --unset-all remote.origin.fetch 2>/dev/null || true
git config --add remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
echo "  [1/3] remote.origin.fetch : toutes les branches"

# 2) Recuperer l'etat reel du depot distant.
git fetch origin --quiet
echo "  [2/3] fetch effectue"

# 3) Lier la branche de travail a son equivalent distant.
if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  git branch --set-upstream-to="origin/${BRANCH}" "${BRANCH}" >/dev/null 2>&1 || true
  echo "  [3/3] suivi : ${BRANCH} -> origin/${BRANCH}"
else
  echo "  [3/3] branche distante absente (premier envoi a venir)"
fi

echo
echo "Etat :"
git status -sb | head -1

# Avertit si le local est en retard : signe que la base est desynchronisee.
if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  BEHIND=$(git rev-list --count "HEAD..origin/${BRANCH}" 2>/dev/null || echo 0)
  if [ "${BEHIND}" != "0" ]; then
    echo
    echo "  ATTENTION : ${BEHIND} commit(s) distant(s) absent(s) en local."
    echo "  Verifier que les fichiers de travail sont bien a jour, puis :"
    echo "    git reset --hard origin/${BRANCH}"
  fi
fi
