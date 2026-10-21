#!/bin/bash
# Met à jour l'horodatage COMMIT HHMMSS dans la page de démarrage (écoutille)
# Appelé automatiquement par le hook pre-commit et manuellement avant chaque push
set -e
cd "$(dirname "$0")/.."
STAMP=$(TZ="Europe/Paris" date +"%H%M%S")
# Page de garde visible
if grep -q 'class="ec-version"' index.html; then
  perl -i -pe "s|<span class=\"ec-version\">.*?</span>|<span class=\"ec-version\">COMMIT $STAMP</span>|g" index.html
fi
# Commentaires (optionnel, pour traçabilité)
perl -i -pe "s|« garde v[0-9]+ »|« COMMIT $STAMP »|g; s|garde v[0-9]+|COMMIT $STAMP|gi" index.html || true
perl -i -pe "s|« garde v[0-9]+ »|« COMMIT $STAMP »|g; s|garde v[0-9]+|COMMIT $STAMP|gi" ecoutille.js || true
echo "→ stamp COMMIT $STAMP"
