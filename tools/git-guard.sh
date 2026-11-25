#!/usr/bin/env bash
# =============================================================================
#  Mission Nautilus — FILET DE SECURITE GIT
# =============================================================================
#
#  A QUOI CA SERT (en clair)
#
#  De temps en temps, l'atelier de travail est recree a neuf. Quand cela
#  arrive, l'historique Git local repart du depart (commit 85ade5e) alors
#  que les FICHIERS, eux, sont bien a jour. Git croit alors qu'on a 79
#  commits de retard et refuse d'envoyer le travail.
#
#  IMPORTANT : rien n'a jamais ete perdu sur GitHub. Tout ce qui a ete
#  envoye y est toujours. Le probleme, c'est le travail PAS ENCORE envoye.
#
#  Ce script fait trois choses :
#    1. il met le travail en cours a l'abri (copie de secours) ;
#    2. il repare la configuration Git et rattrape l'historique ;
#    3. il previent clairement si quelque chose ne colle pas.
#
#  La copie de secours vit dans .nautilus-safe/, un dossier que Git ignore.
#  Verifie : un dossier ignore par Git SURVIT a une remise a zero
#  (git reset --hard) — c'est justement ce qui detruisait le travail avant.
#
#  COMMANDES
#    bash tools/git-guard.sh check     etat des lieux (ne modifie rien)
#    bash tools/git-guard.sh save      met le travail en cours a l'abri
#    bash tools/git-guard.sh sync      repare Git + rattrape l'historique
#    bash tools/git-guard.sh restore   remet la derniere copie de secours
#    bash tools/git-guard.sh start     save + sync   (a lancer en arrivant)
#    bash tools/git-guard.sh finish    save + verifie que tout est envoye
#
# =============================================================================

set -uo pipefail

# La branche de travail change a chaque session (arena/<nouveau-id>-mission-nautilus).
# On la lit donc depuis la branche courante au lieu de la figer en dur :
# une valeur figee devenait fausse des la session suivante.
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'arena/inconnue')"
SAFE=".nautilus-safe"
KEEP=8                      # nombre de copies de secours conservees

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1

# ---------------------------------------------------------------- affichage --
if [ -t 1 ]; then
  R=$'\e[31m'; V=$'\e[32m'; J=$'\e[33m'; B=$'\e[1m'; N=$'\e[0m'
else
  R=""; V=""; J=""; B=""; N=""
fi
titre()  { printf '\n%s== %s ==%s\n' "$B" "$1" "$N"; }
ok()     { printf '  %sOK%s    %s\n' "$V" "$N" "$1"; }
alerte() { printf '  %s(!)%s   %s\n' "$J" "$N" "$1"; }
erreur() { printf '  %sERR%s   %s\n' "$R" "$N" "$1"; }
info()   { printf '        %s\n' "$1"; }

# ------------------------------------------------------------------ helpers --
# Fichiers a proteger : tout ce qui est suivi par Git, plus ce qui est
# nouveau et pas encore ajoute. On ne devine pas une liste figee : une liste
# ecrite en dur oublierait tout fichier cree plus tard.
lister_fichiers(){
  {
    git ls-files 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } | sort -u | grep -v "^${SAFE}/" || true
}

# .gitignore doit contenir le dossier de secours, sinon il partirait dans un
# commit et polluerait le depot.
assurer_gitignore(){
  if [ ! -f .gitignore ] || ! grep -qx "${SAFE}/" .gitignore 2>/dev/null; then
    printf '%s/\n' "${SAFE}" >> .gitignore
    info "ajoute ${SAFE}/ a .gitignore"
  fi
}

# ------------------------------------------------------------------- SAVE ----
cmd_save(){
  titre "Mise a l'abri du travail en cours"
  assurer_gitignore
  local horo dest n
  horo="$(date +%Y%m%d-%H%M%S)"
  dest="${SAFE}/${horo}"
  mkdir -p "${dest}"

  n=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    mkdir -p "${dest}/$(dirname "$f")"
    cp -a "$f" "${dest}/${f}"
    n=$((n+1))
  done < <(lister_fichiers)

  # On note l'etat Git du moment : indispensable pour comprendre plus tard
  # d'ou vient cette copie.
  {
    echo "date        : $(date '+%F %T')"
    echo "commit local: $(git rev-parse HEAD 2>/dev/null || echo '?')"
    echo "message     : $(git log -1 --format=%s 2>/dev/null || echo '?')"
    echo "modifie     : $(git status --porcelain 2>/dev/null | wc -l) fichier(s) non commite(s)"
  } > "${dest}/_ETAT.txt"

  # LISTE DES FICHIERS REELLEMENT MODIFIES (le travail pas encore commite).
  # C'est LA information qui compte : elle seule distingue "du travail a
  # sauver" de "une copie ordinaire du depot".
  #
  # Sans cette distinction, une copie prise APRES une panne (donc contenant
  # de vieux fichiers) serait restauree par-dessus les bons fichiers et
  # ferait perdre le travail au lieu de le sauver. Le cas s'est produit
  # pendant la mise au point de ce script.
  git status --porcelain 2>/dev/null | sed 's/^...//' > "${dest}/_MODIFIES.txt"
  git rev-parse HEAD 2>/dev/null > "${dest}/_BASE.txt" || true

  ok "${n} fichier(s) copies dans ${dest}"

  # Menage : on ne garde que les dernieres copies.
  local vieux
  vieux=$(ls -1d "${SAFE}"/20* 2>/dev/null | sort | head -n -${KEEP})
  if [ -n "${vieux}" ]; then
    echo "${vieux}" | xargs rm -rf
    info "anciennes copies supprimees (on garde les ${KEEP} dernieres)"
  fi
  echo "${dest}" > "${SAFE}/DERNIERE"
}

# ------------------------------------------------------------------- SYNC ----
cmd_sync(){
  titre "Reparation de la configuration Git"

  # 1) Rapatrier TOUTES les branches (le clone d'origine ne suit que main).
  git config --unset-all remote.origin.fetch 2>/dev/null || true
  git config --add remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
  ok "toutes les branches seront rapatriees"

  # 2) Le depot est un clone superficiel : il ne contient qu'une tranche
  #    d'histoire. Sans --unshallow, les commits distants restent invisibles.
  if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
    info "depot superficiel : recuperation de l'historique complet…"
    git fetch --unshallow --quiet 2>/dev/null || git fetch --quiet 2>/dev/null || true
  fi
  git fetch origin --quiet 2>/dev/null || { erreur "impossible de joindre GitHub"; return 1; }
  ok "etat du depot distant recupere"

  # 3) Lier la branche locale a la distante.
  if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
    git branch --set-upstream-to="origin/${BRANCH}" "${BRANCH}" >/dev/null 2>&1 || true
    ok "suivi : ${BRANCH} -> origin/${BRANCH}"
  else
    alerte "branche distante absente (premier envoi a venir)"
    return 0
  fi

  # 4) Rattraper l'historique si le local est en retard.
  local behind ahead
  behind=$(git rev-list --count "HEAD..origin/${BRANCH}" 2>/dev/null || echo 0)
  ahead=$(git rev-list --count "origin/${BRANCH}..HEAD" 2>/dev/null || echo 0)

  if [ "${behind}" != "0" ] && [ "${ahead}" = "0" ]; then
    titre "Historique en retard de ${behind} commit(s) — rattrapage"
    # Les fichiers de travail sont peut-etre plus recents que l'historique.
    # On les met a l'abri AVANT toute remise a zero.
    cmd_save >/dev/null
    git reset --hard "origin/${BRANCH}" --quiet
    ok "historique aligne sur GitHub ($(git rev-parse --short HEAD))"

    # QUELLE copie de secours contient du travail a recuperer ?
    #
    # Surtout PAS la plus recente : celle qu'on vient de prendre a ete faite
    # APRES la panne, elle ne contient donc que de vieux fichiers. La bonne
    # copie est la derniere qui a ete prise alors que l'historique etait
    # encore sain — on la reconnait a son commit de base, qui correspond a
    # celui qu'on vient de recuperer.
    local cible="" b HEADNOW
    HEADNOW="$(git rev-parse HEAD)"
    for c in $(ls -1d "${SAFE}"/20* 2>/dev/null | sort -r); do
      [ -f "${c}/_BASE.txt" ] || continue
      b="$(cat "${c}/_BASE.txt" 2>/dev/null)"
      if [ "${b}" = "${HEADNOW}" ] && [ -s "${c}/_MODIFIES.txt" ]; then
        cible="${c}"; break
      fi
    done
    local sauve="${cible}"

    # On ne restaure QUE les fichiers qui etaient reellement modifies au
    # moment de la sauvegarde : c'est le seul travail qui risque d'etre
    # perdu. Tout le reste est deja dans l'historique GitHub, qu'on vient
    # justement de recuperer.
    #
    # PIEGE EVITE : restaurer tous les fichiers de la copie remettrait de
    # VIEILLES versions par-dessus les bonnes. C'est exactement ce qui
    # detruisait le travail dans la premiere version de ce script.
    local restaures=0 f
    if [ -z "${sauve}" ]; then
      ok "aucun travail non commite a recuperer"
      local nb; nb=$(ls -1d "${SAFE}"/20* 2>/dev/null | wc -l)
      info "(${nb} copie(s) de secours conservees dans ${SAFE}/ si besoin)"
    elif [ -s "${sauve}/_MODIFIES.txt" ]; then
      info "copie utilisee : ${sauve}"
      while IFS= read -r f; do
        [ -z "$f" ] && continue
        [ -f "${sauve}/${f}" ] || continue
        if ! cmp -s "${sauve}/${f}" "$f" 2>/dev/null; then
          mkdir -p "$(dirname "$f")"
          cp -a "${sauve}/${f}" "$f"
          restaures=$((restaures+1))
          info "travail non commite restaure : ${f}"
        fi
      done < "${sauve}/_MODIFIES.txt"
    fi

    if [ "${restaures}" = "0" ]; then
      ok "aucun travail en attente : tout etait deja sur GitHub"
    else
      alerte "${restaures} fichier(s) de travail non commite restaures"
      info "pense a les commiter puis a les envoyer"
    fi
  elif [ "${ahead}" != "0" ] && [ "${behind}" != "0" ]; then
    erreur "historiques divergents : ${ahead} local(aux) / ${behind} distant(s)"
    info "ne rien ecraser. Demande de l'aide avant d'aller plus loin."
    return 1
  elif [ "${ahead}" != "0" ]; then
    alerte "${ahead} commit(s) pas encore envoye(s) sur GitHub"
    info "envoi :  git push origin ${BRANCH}"
  else
    ok "historique local et GitHub identiques"
  fi
}

# ------------------------------------------------------------------ CHECK ----
cmd_check(){
  titre "Etat des lieux"
  info "branche  : $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  info "commit   : $(git rev-parse --short HEAD 2>/dev/null) — $(git log -1 --format=%s 2>/dev/null)"

  [ "$(git rev-parse --abbrev-ref HEAD)" = "${BRANCH}" ] \
    && ok "bonne branche" \
    || erreur "MAUVAISE BRANCHE : le travail doit rester sur ${BRANCH}"

  if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
    local behind ahead
    behind=$(git rev-list --count "HEAD..origin/${BRANCH}" 2>/dev/null || echo '?')
    ahead=$(git rev-list --count "origin/${BRANCH}..HEAD" 2>/dev/null || echo '?')
    [ "${behind}" = "0" ] && ok "a jour avec GitHub" \
      || erreur "EN RETARD de ${behind} commit(s) -> lance : bash tools/git-guard.sh sync"
    [ "${ahead}" = "0" ] || alerte "${ahead} commit(s) pas encore envoye(s)"
  else
    alerte "etat distant inconnu -> lance : bash tools/git-guard.sh sync"
  fi

  local sales
  sales=$(git status --porcelain 2>/dev/null | wc -l)
  [ "${sales}" = "0" ] && ok "aucune modification en attente" \
    || alerte "${sales} fichier(s) modifie(s) non commite(s)"

  if [ -d "${SAFE}" ]; then
    local nb; nb=$(ls -1d "${SAFE}"/20* 2>/dev/null | wc -l)
    ok "${nb} copie(s) de secours disponible(s) dans ${SAFE}/"
  else
    alerte "aucune copie de secours -> lance : bash tools/git-guard.sh save"
  fi
}

# ---------------------------------------------------------------- RESTORE ----
cmd_restore(){
  titre "Restauration de la derniere copie de secours"
  local src="${1:-}"
  [ -z "${src}" ] && src="$(cat "${SAFE}/DERNIERE" 2>/dev/null || true)"
  if [ -z "${src}" ] || [ ! -d "${src}" ]; then
    erreur "aucune copie de secours trouvee"
    info "copies disponibles :"; ls -1d "${SAFE}"/20* 2>/dev/null | sed 's/^/       /'
    return 1
  fi
  echo "  source : ${src}"
  [ -f "${src}/_ETAT.txt" ] && sed 's/^/       /' "${src}/_ETAT.txt"
  local n=0 f
  while IFS= read -r f; do
    case "$f" in _ETAT.txt|_MODIFIES.txt|_BASE.txt) continue;; esac
    mkdir -p "$(dirname "$f")"
    cp -a "${src}/${f}" "$f"
    n=$((n+1))
  done < <(cd "${src}" && find . -type f | sed 's|^\./||')
  ok "${n} fichier(s) restaures"
}

# ------------------------------------------------------------ START/FINISH ---
cmd_start(){ cmd_save; cmd_sync; cmd_check; }
cmd_finish(){
  cmd_save
  titre "Verification de fin de session"
  local sales ahead
  sales=$(git status --porcelain 2>/dev/null | wc -l)
  [ "${sales}" = "0" ] && ok "tout est commite" \
    || erreur "${sales} fichier(s) NON COMMITE(S) — ils ne sont pas sur GitHub"
  ahead=$(git rev-list --count "origin/${BRANCH}..HEAD" 2>/dev/null || echo '?')
  [ "${ahead}" = "0" ] && ok "tout est envoye sur GitHub" \
    || erreur "${ahead} commit(s) NON ENVOYE(S) -> git push origin ${BRANCH}"
}

case "${1:-start}" in
  check)   cmd_check ;;
  save)    cmd_save ;;
  sync)    cmd_sync; cmd_check ;;
  restore) cmd_restore "${2:-}" ;;
  start)   cmd_start ;;
  finish)  cmd_finish ;;
  *) echo "usage: bash tools/git-guard.sh [check|save|sync|restore|start|finish]"; exit 1 ;;
esac
echo
