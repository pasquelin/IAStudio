# ADR-09 — Budget de minutes CI

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Le cadrage supposait un budget contraint : sur dépôt privé, les minutes sont pondérées Linux ×1,
Windows ×2, **macOS ×10**. L'audit établit que `pasquelin/scenario` est **public** — les runners
hébergés y sont gratuits et illimités.

La contrainte budgétaire tombe, mais les raisons de ne pas lancer la matrice complète à chaque
poussée demeurent : durée (le packaging des trois OS avec deux téléchargements ffmpeg de 96 Mo
côté macOS se compte en dizaines de minutes) et bruit (un échec de packaging sur une branche de
feature n'apprend rien d'utile).

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

- La décision de conception est **la même que sous contrainte budgétaire**, pour d'autres
  raisons. Si le dépôt passait en privé, seule la justification changerait, pas le pipeline.
- Une régression propre au packaging (une entrée manquante dans `files`, un ffmpeg introuvable)
  n'est détectée qu'au `dry_run` ou au tag. `RELEASE.md` fait du `dry_run` une étape de la
  procédure, précisément pour que ce ne soit pas le tag qui la découvre.
