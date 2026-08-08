# ADR-08 — Reconstruction des modules natifs

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

`better-sqlite3` 13.0.3 est la seule dépendance native de production (`fsevents` est en dev et
limité à darwin). L'audit a établi trois faits :

1. Le paquet livre **8 prebuilds N-API**, dont les quatre cibles du pipeline —
   `darwin-arm64`, `darwin-x64`, `win32-x64`, `linux-x64`.
2. `lib/binding.js` résout `prebuilds/<platform>-<arch>.node` **avant** `build/Release/` : un
   artefact recompilé n'est pas chargé tant que le prebuild correspondant existe.
3. `pnpm rebuild:native` n'est appelé par aucun script de build — ni `build`, ni `dist`, ni
   `postinstall`. C'est une commande manuelle.

L'ABI N-API est stable d'une version de Node ou d'Electron à l'autre : c'est précisément ce que
cette interface garantit.

## Décision

**Aucune reconstruction native en CI.** Ni `@electron/rebuild`, ni `app-dependencies`. Les
prebuilds N-API sont copiés tels quels, et `asarUnpack: ['**/*.node']` les sort de l'archive —
un module natif ne se charge pas depuis un asar.

## Alternatives écartées

- **`@electron/rebuild` dans le job de build** : compilerait dans `build/Release/`, d'où rien ne
  serait jamais chargé. Minutes dépensées, toolchain C++ à provisionner sur trois runners, effet
  nul.
- **Filtrer les prebuilds inutiles par plateforme** : chaque installeur embarque les 8 (16 Mo)
  là où un seul suffirait, soit ~14 Mo de trop. Les macros `${platform}`/`${arch}` de
  `electron-builder` le permettraient, mais se tromper de filtre produit une application qui ne
  démarre pas — un risque réel contre 14 Mo sur un installeur de 200 Mo. Dette assumée.

## Conséquences

- Le job de build n'a besoin d'aucun compilateur natif : `pnpm install --frozen-lockfile` suffit.
- **Si `better-sqlite3` cessait un jour de livrer des prebuilds N-API**, ou si une seconde
  dépendance native sans prebuild apparaissait, cet ADR devrait être amendé et la reconstruction
  réintroduite. Le symptôme serait un échec de chargement au démarrage de l'application packagée,
  pas une erreur de build.
- `pnpm rebuild:native` reste utile en développement après une mise à jour d'Electron.
