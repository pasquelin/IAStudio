# ADR-02 — Déclencheur de release

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Il faut un geste unique et sans ambiguïté qui produise une release complète, et un moyen
d'exercer toute la chaîne sans rien publier — le pipeline devant être validable avant qu'un
seul certificat n'existe.

## Décision

Deux déclencheurs, et deux seulement :

- `push` sur un tag `v*` → build des trois plateformes puis création de la GitHub Release.
- `workflow_dispatch` avec une entrée booléenne `dry_run`, **défaut `true`** → build complet et
  téléversement des artefacts, sans job de release.

**Le tag est la source de vérité de la version.** `package.json` doit être aligné avant que le
tag ne soit posé ; la procédure est dans [`../RELEASE.md`](../RELEASE.md).

## Alternatives écartées

- **Déclencher sur `push` vers `main`** : chaque merge produirait une release. La release
  cesserait d'être un acte délibéré.
- **Dériver la version du tag et réécrire `package.json` en CI** : un commit produit par la CI
  sur une branche protégée, pour une valeur que le développeur connaît déjà au moment du tag.
- **`dry_run` à `false` par défaut** : un dispatch distrait publierait.

## Conséquences

- Un tag mal formé ne déclenche rien — silence, pas d'échec bruyant.
- Un désalignement entre le tag et `package.json` produit des manifestes d'auto-update dont la
  version ne correspond pas au nom du tag. `RELEASE.md` en fait une étape numérotée, et la
  vérification de complétude du job `release` (ADR-06) contrôle la version des manifestes.
