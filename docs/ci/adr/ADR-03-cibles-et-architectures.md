# ADR-03 — Cibles et architectures par OS

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

`electron-builder.yml` déclare déjà des cibles, et l’audit a établi que le projet embarque une
dépendance native (`better-sqlite3`) et un binaire tiers par architecture (ffmpeg).

## Décision

Conserver les cibles existantes, inchangées :

| OS | Formats | Architectures |
|---|---|---|
| macOS | `dmg` + `zip` | `arm64` et `x64`, en artefacts séparés |
| Windows | `nsis` | `x64` |
| Linux | `AppImage` + `deb` | `x64` |

Le `zip` macOS n’est pas destiné à la distribution : `electron-updater` le consomme.
`minimumSystemVersion: '12.0'` est déclaré explicitement — c’est la valeur qu’Electron 43 porte
déjà dans son `Info.plist`, écrite ici pour qu’elle cesse d’être implicite.

**Pas de binaire `universal`.**

## Alternatives écartées

- **Binaire macOS `universal`** : double le poids, complique l’auto-update, et casse en présence
  de modules natifs sans `lipo` manuel. `scripts/before-pack.mjs` rejette d’ailleurs déjà
  explicitement `arch === 'universal'` — il ne saurait pas quel ffmpeg télécharger.
- **Windows arm64** : aucune demande, et chaque architecture ajoutée est un ffmpeg de plus à
  approvisionner et à tester sans machine pour le faire.
- **Linux arm64** : `fetch-ffmpeg.mjs` sait le servir, mais rien ne le teste.

## Conséquences

- Cinq installeurs distribuables par release, plus deux `zip` techniques.
- Le runner macOS est en arm64 : produire le x64 exige une déclaration d’architecture explicite,
  pas un build par défaut (cf. `TROUBLESHOOTING.md`).
- Ajouter une architecture impose d’ajouter la cible correspondante dans `fetch-ffmpeg.mjs`,
  sommes de contrôle comprises (ADR-12).
