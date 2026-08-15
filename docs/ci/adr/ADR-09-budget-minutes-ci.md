# ADR-09 — Budget de minutes CI

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Le cadrage supposait un budget contraint. `pasquelin/scenario` est **public** : les runners
hébergés y sont gratuits et illimités, et la contrainte tombe.

Elle ne tombe que tant que le dépôt reste public. Sur dépôt privé, les minutes sont pondérées
Linux ×1, Windows ×2, **macOS ×10**, ce qui donne, aux durées attendues :

| Job | Durée | Coefficient | Minutes facturées |
|---|---|---|---|
| macOS (deux architectures, deux ffmpeg) | ~30 min | ×10 | **300** |
| Windows | ~15 min | ×2 | 30 |
| Linux | ~15 min | ×1 | 15 |
| | | | **~345 par release** |

Le chiffre est écrit ici parce qu’il a failli s’appliquer, et parce qu’il désigne où regarder :
le job macOS pèse à lui seul 87 % du total.

Restent, indépendamment du prix, la durée d’attente et le bruit : un échec de packaging sur une
branche de feature n’apprend rien d’utile.

## Décision

- **La matrice des trois OS ne se déclenche que sur tag `v*` ou `workflow_dispatch`**, jamais sur
  `push` ni `pull_request`.
- **La validation continue tourne sur Linux uniquement** (`ci.yml`).

## Alternatives écartées

- **Matrice complète sur chaque PR** : maintenant abordable, mais chaque PR attendrait le
  packaging de trois plateformes pour apprendre ce que le typecheck dit en deux minutes.
- **Runners auto-hébergés** : sans objet, et un runner macOS auto-hébergé serait le poste de
  développement lui-même.

## Conséquences

- **Un `dry_run` exécute la même matrice qu’une vraie release.** Gratuit tant que le dépôt est
  public, mais long — ce n’est pas un geste à répéter sans raison.
- Une régression propre au packaging (une entrée manquante dans `files`, un ffmpeg introuvable)
  n’est détectée qu’au `dry_run` ou au tag. `RELEASE.md` fait du `dry_run` une étape de la
  procédure, précisément pour que ce ne soit pas le tag qui la découvre.
- **Si le dépôt repassait en privé, le job macOS pèserait à lui seul 87 % de la facture.** C’est
  là qu’il faudrait regarder en premier : renoncer à l’architecture x64 diviserait ce job par
  deux, au prix des Mac Intel. À ne trancher que si le besoin se présente.
