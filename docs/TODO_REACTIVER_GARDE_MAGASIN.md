# TODO — Réactiver la garde magasin d’origine

**Date de désactivation :** 2026-10-27  
**Fichier :** `magasin-guard.js` — variable `_GARDE_DESACTIVEE = true`

## Contexte
Sur demande : *« nous allons mettre de côté la géolocalisation dans le magasin pour entrer dans les mini jeu. Donc laisse rentrer tous les joueurs qui le sont pas dans le magasin d’origine. »*

La vérification `500m` + `changement-magasin` est **temporairement désactivée**.

Actuellement `verifierAcces()` retourne toujours :
```js
{ autorise:true, motif:'garde-desactivee-temporaire', gardeDesactivee:true }
```

## À faire quand le jeu global sera totalement terminé (ou sur demande)

1. Ouvrir `magasin-guard.js`
2. Mettre `_GARDE_DESACTIVEE = false` (ligne ~155)
3. Ou supprimer entièrement le bloc `if(_GARDE_DESACTIVEE){ ... }` (10 lignes)
4. Bump `index.html` COMMIT + `sw.js` CACHE_NAME
5. Commit + push + déployer Firestore rules si modifiées

## Vérification après réactivation
- `NautilusMagasinGuard.verifierAcces()` doit à nouveau retourner `autorise:false` pour :
  - `changement-magasin`
  - `hors-zone` (>0.5km)
  - `geoloc-refus` / `geoloc-imprecise`
- `1831411720.html` (Palier 3) doit à nouveau afficher `Hors magasin d’origine` si hors zone.

## Traçabilité
- Commit de désactivation : `COMMIT 014043 / sw v352`
- Rappel demandé par : utilisateur — *« Rappelle moi de faire cela quand le jeu global sera totalement terminé. Ou quand je te le demanderais »*
