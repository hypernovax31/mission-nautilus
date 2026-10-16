# Ne plus rien perdre — mode d'emploi

## Le problème, en clair

De temps en temps, l'atelier de travail est **recréé à neuf**. Quand ça arrive :

- l'**historique** Git local repart tout au début (commit `85ade5e`) ;
- les **fichiers** reviennent eux aussi à cette vieille version ;
- Git croit qu'on a 80 commits de retard et **refuse d'envoyer** le travail.

**Rien n'est jamais perdu sur GitHub.** Tout ce qui a été *envoyé* y est
toujours. Le vrai danger, c'est le travail **pas encore envoyé**.

## La cause exacte (vérifiée)

Le dépôt est recréé avec un clone **superficiel** (`shallow`) qui ne
rapatrie que la branche `main` :

```
fetch = +refs/heads/main:refs/remotes/origin/main
```

La branche de travail `arena/...` n'est donc jamais récupérée, et le dépôt
ne contient qu'une tranche d'histoire. Comme `.git/config` **n'est pas
conservé** entre les sessions, le réglage doit être refait à chaque fois.

## La solution : deux commandes

### En arrivant

```bash
bash tools/git-guard.sh start
```

Cela : met le travail en cours à l'abri → répare Git → récupère
l'historique complet → **restaure automatiquement le travail non commité**
s'il avait été écrasé.

### Avant de partir

```bash
bash tools/git-guard.sh finish
```

Cela sauvegarde et **prévient en rouge** s'il reste quoi que ce soit qui
n'est pas sur GitHub.

## Les autres commandes

| Commande | Ce qu'elle fait |
|---|---|
| `bash tools/git-guard.sh check` | État des lieux, ne modifie rien |
| `bash tools/git-guard.sh save` | Met le travail en cours à l'abri |
| `bash tools/git-guard.sh sync` | Répare Git et rattrape l'historique |
| `bash tools/git-guard.sh restore` | Remet la dernière copie de secours |

## Où sont les copies de secours

Dans `.nautilus-safe/`, un dossier **ignoré par Git**. C'est important :
un dossier ignoré **survit** à une remise à zéro (`git reset --hard`),
contrairement aux fichiers suivis. C'est ce qui permet de rattraper le
travail.

Les **8 dernières** copies sont conservées, avec la date et l'heure.
Chacune contient un `_ETAT.txt` qui dit d'où elle vient.

## La règle d'or

> **Commiter et envoyer souvent.**

Une fois envoyé sur GitHub, un travail ne peut plus être perdu par une
remise à zéro. Les copies de secours sont un filet, pas un remplacement.

## Un piège rencontré pendant la mise au point

La première version du filet restaurait **tous** les fichiers de la copie
de secours. Résultat : une copie prise *après* une panne (donc contenant
de vieux fichiers) écrasait les bons fichiers — le filet **détruisait** le
travail au lieu de le sauver.

Corrigé : le filet ne restaure que les fichiers **réellement modifiés**, et
il choisit la copie dont le commit de base correspond à celui récupéré sur
GitHub. Vérifié par un test qui reproduit la panne en vrai.

## LE PIÈGE LE PLUS COÛTEUX : le site est publié depuis une AUTRE branche

**Le site public — https://hypernovax31.github.io/mission-nautilus/ — est publié
par GitHub Pages depuis la branche `arena/01a01e78-mission-nautilus`.**

Ce n'est ni `main`, ni la branche de la session en cours. Conséquence vécue :
tout un travail d'amélioration de la page d'accueil a été poussé, testé, annoncé
— et le site n'a rien montré pendant trois essais. La cause était là :
GitHub Pages servait toujours la version d'août de `arena/01a01e78`.

### La règle à retenir

> Pousser sur la branche de la session ne change RIEN sur le site.
> Il faut **fusionner dans `arena/01a01e78-mission-nautilus`**.
> GitHub Pages reconstruit alors le site tout seul, en une minute environ.

### Comment vérifier, à tout moment

```bash
# Où en est le site publié, et depuis quelle branche ?
gh api repos/hypernovax31/mission-nautilus/pages \
  --jq '"source : \(.source.branch) · état : \(.status)"'

# La dernière reconstruction (et son commit) :
gh api repos/hypernovax31/mission-nautilus/pages/builds/latest \
  --jq '"\(.status) · \(.commit[0:7])"'
```

### Le chemin pour publier

1. travailler et pousser sur la branche de session (`arena/25f66f93-…`) ;
2. ouvrir une demande de fusion **vers `arena/01a01e78-mission-nautilus`** :
   `gh pr create --base arena/01a01e78-mission-nautilus --head <branche de session>` ;
3. la fusionner (`gh pr merge <numéro> --merge`) ;
4. attendre que la reconstruction soit terminée (deux minutes au plus) —
   la commande `pages/builds/latest` ci-dessus le dit.

### Côté visiteur : le service worker garde une copie

Le jeu installe un service worker qui met les fichiers en cache. Après une
publication, un visiteur peut donc revoir l'ancienne page une fois de plus :
un rechargement suffit (les pages sont en « réseau d'abord »), et le service
worker se met à jour de lui-même. En cas de doute : rechargement forcé
(Ctrl+Maj+R, ou Cmd+Maj+R sur Mac).
