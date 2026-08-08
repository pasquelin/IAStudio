# ADR-06 — Stratégie de publication des artefacts

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Trois jobs de matrice qui publieraient chacun vers la même GitHub Release entrent en course :
releases dupliquées, manifestes d'auto-update écrasés l'un par l'autre. Le mode d'échec est
connu et silencieux — la release paraît complète et ne l'est pas.

## Décision

**Architecture à deux étages.**

1. Job `build` (matrice, trois OS) : produit les installeurs, ne publie **rien**. Les artefacts
   partent via `actions/upload-artifact`. `permissions: contents: read`.
2. Job `release` : `needs: build`, télécharge tous les artefacts, les agrège dans un dossier
   plat, **vérifie la présence de `latest.yml`, `latest-mac.yml` et `latest-linux.yml`**, puis
   crée la GitHub Release en **draft**. `permissions: contents: write`, **scopé à ce seul job**.

La vérification de complétude est **bloquante** : un manifeste manquant fait échouer le job
avec un message explicite, avant toute publication.

## Alternatives écartées

- **`--publish always` dans chaque job de matrice** : c'est exactement la condition de course
  décrite ci-dessus.
- **Publier en `release` plutôt qu'en `draft`** : prive de toute inspection des binaires avant
  que la base installée ne les voie.
- **`permissions: contents: write` au niveau du workflow** : donnerait le droit d'écriture aux
  trois jobs de build, qui n'en ont aucun usage.

## Conséquences

- La publication reste un geste humain : la draft doit être ouverte et publiée à la main.
- **Une release sans manifeste casse l'auto-update de toute la base installée, sans erreur
  visible côté serveur.** C'est la raison d'être de la vérification bloquante ; la retirer
  ramènerait ce mode d'échec.
- Remettre en cause cette architecture ramène aussi la course entre jobs.
