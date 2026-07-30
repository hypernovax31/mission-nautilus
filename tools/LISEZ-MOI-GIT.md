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
