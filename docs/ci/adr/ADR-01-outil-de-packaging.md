# ADR-01 — Outil de packaging

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Le dépôt utilise déjà `electron-builder` 26.15.3, avec une configuration externalisée dans
`electron-builder.yml` : cibles des trois plateformes, `electronFuses` complets, `asarUnpack`,
hook `beforePack`, `extraResources`, entitlements macOS. `pnpm dist` produit un `.dmg` local
fonctionnel. Aucune trace d'`electron-forge`.

## Décision

Conserver `electron-builder`. Le pipeline se greffe sur la configuration existante : on la
**complète**, on ne la réécrit pas.

## Alternatives écartées

- **Migrer vers `electron-forge`** : aucun gain, et la perte de tout ce que le YAML encode déjà
  — notamment les fuses et la signature des binaires ffmpeg sous hardened runtime.
- **Repartir d’une configuration neuve** : les commentaires du YAML documentent des décisions
  non évidentes (pourquoi `productName` en est absent, pourquoi le `zip` macOS est conservé).
  Les jeter reviendrait à les redécouvrir par l’erreur.

## Conséquences

- `electron-updater`, du même écosystème, devient le choix naturel pour l’auto-update (ADR-05).
- La publication GitHub Release est intégrée à l’outil : le job de release n’a pas à
  reconstruire les manifestes à la main.
- Les ajouts se limitent au bloc `publish`, à `artifactName`, et aux compléments de plateforme
  détaillés dans les ADR suivants.
