# ADR-15 — Modèle de branches

- **Statut** : Accepté — décision imposée par l'audit
- **Date** : 2026-08-08

## Contexte

L'audit relève un état incompatible avec un pipeline déclenché par tag :

- la branche par défaut du dépôt distant est `feat/scenario-pipeline`, une branche de feature ;
- `main` local est en avance de **83 commits** sur `origin/main`, jamais poussés ;
- il n'existe aucune branche d'intégration : `CLAUDE.md` fait partir chaque worktree de `main`,
  qui sert donc à la fois de base de travail et de référence.

Une branche ne peut pas être à la fois le tronc où tout arrive et la référence de ce qui est
publiable. Tant qu'elle l'est, « poser un tag sur `main` » ne veut rien dire de précis.

## Décision

Deux branches longues, aux rôles disjoints :

- **`develop`** — branche par défaut du dépôt, base de tous les worktrees, destination des
  merges de feature.
- **`main`** — ne reçoit que des merges de release. Elle porte les tags `v*`, et un tag poussé
  déclenche le pipeline de packaging.

`develop` est créée depuis `main` local, qui contient l'intégralité du travail. `CLAUDE.md` est
mis à jour en conséquence : création de worktree depuis `develop`, rebase sur `develop`.

## Alternatives écartées

- **Garder `main` comme base unique et taguer dessus** : rien ne distinguerait un commit
  publiable d'un commit d'intégration, et chaque tag serait une pure question de discipline.
- **Laisser `feat/scenario-pipeline` comme branche par défaut** : une branche de feature comme
  visage du dépôt, et 83 commits de travail invisibles pour qui le clone.
- **`main` par défaut, `develop` seulement locale** : les PR cibleraient `main`, ce qui ramène le
  problème.

## Conséquences

- **Publier `main` et `develop` sur `origin` et basculer la branche par défaut du dépôt sont des
  actions externes visibles**, laissées au développeur — la procédure est dans
  [`../RELEASE.md`](../RELEASE.md). Tant qu'elles ne sont pas faites, les workflows ne peuvent
  pas être validés sur GitHub.
- `origin` cesse d'être un dépôt mort. La consigne de `CLAUDE.md` « ne jamais `fetch` » n'a plus
  lieu d'être : un `git fetch origin develop` avant rebase redevient utile. Le rebase continue
  de se faire sur `develop` **local**, jamais sur `origin/develop` — sans quoi des fusions
  locales non publiées disparaîtraient.
- Les 24 branches de feature existantes restent en place. Elles seront rebasées sur `develop` au
  fil de leur reprise, pas en masse.
