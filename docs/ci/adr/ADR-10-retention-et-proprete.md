# ADR-10 — Rétention et propreté

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Un pipeline de packaging produit des artefacts lourds — de l’ordre de 200 Mo par installeur,
1,3 à 1,6 Go par run complet. Sans règles, ils s’accumulent, et un runner bloqué tourne jusqu’à
la limite de six heures de la plateforme.

## Décision

- **Rétention des artefacts intermédiaires : 7 jours.** Assez pour inspecter un run et rejouer
  une validation, trop court pour servir d’archive — c’est la GitHub Release qui archive.
- **Groupes de concurrence** sur les deux workflows. `cancel-in-progress: true` sur `ci.yml`
  (une PR poussée deux fois n’a pas besoin de deux validations) ; **`false` sur `release.yml`**
  (annuler un packaging à mi-course laisserait une release incomplète).
- **`timeout-minutes` obligatoire sur chaque job** : 15 pour `ci.yml`, 45 pour `build`,
  10 pour `release`.

## Alternatives écartées

- **Rétention par défaut (90 jours)** : des gigaoctets conservés trois mois pour des binaires que
  la release publie déjà.
- **`cancel-in-progress: true` partout** : sur `release.yml`, une poussée de tag concurrente
  tuerait un packaging en cours et produirait une release à laquelle il manque une plateforme —
  exactement ce que la vérification de complétude de l’ADR-06 cherche à empêcher.
- **Pas de `timeout-minutes`** : le plafond implicite de la plateforme est de six heures.

## Conséquences

- Les artefacts d’un `dry_run` disparaissent au bout d’une semaine : une validation manuelle
  différée doit être relancée.
- Le timeout de 45 minutes du job `build` couvre le cas macOS, le plus lent (deux architectures,
  deux téléchargements ffmpeg). Il devra être relevé le jour où la notarisation s’active
  (ADR-04) : elle est asynchrone et sa durée dépend d’Apple.
