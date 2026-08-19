# ADR-02 — Déclencheur de release

- **Statut** : Accepté
- **Date** : 2026-08-08

## Contexte

Il faut un geste unique et sans ambiguïté qui produise une release complète, et un moyen
d’exercer toute la chaîne sans rien publier — le pipeline devant être validable avant qu’un
seul certificat n’existe.

## Décision

Deux déclencheurs, et deux seulement :

- `push` sur un tag `v*` → build des trois plateformes puis création de la GitHub Release.
- `workflow_dispatch` avec une entrée booléenne `dry_run`, **défaut `true`** → build complet et
  téléversement des artefacts, sans job de release.

**Le tag est la source de vérité de la version.** `package.json` doit être aligné avant que le
tag ne soit posé ; la procédure est dans [`../RELEASE.md`](../RELEASE.md).

## Alternatives écartées

- **Déclencher sur `push` vers `main`** : chaque merge produirait une release. La release
  cesserait d’être un acte délibéré.
- **Dériver la version du tag et réécrire `package.json` en CI** : un commit produit par la CI
  sur une branche protégée, pour une valeur que le développeur connaît déjà au moment du tag.
- **`dry_run` à `false` par défaut** : un dispatch distrait publierait.

## Conséquences

- Un tag mal formé ne déclenche rien — silence, pas d’échec bruyant.
- Un désalignement entre le tag et `package.json` produit des manifestes d’auto-update dont la
  version ne correspond pas au nom du tag. `RELEASE.md` en fait une étape numérotée, et la
  vérification de complétude du job `release` (ADR-06) contrôle la version des manifestes.

## Amendement du 19 août 2026 — rien ne compare le tag, `package.json` et les manifestes

**La § Conséquences annonce que « la vérification de complétude du job `release` (ADR-06) contrôle
la version des manifestes ». Elle ne la contrôle pas.** `scripts/check-manifests.mjs` lit bien la
ligne `version:` de chacun des trois manifestes, mais il l’**imprime** — un `console.log` par
manifeste — sans jamais la comparer au tag (`GITHUB_REF_NAME`), ni les trois entre elles. Ce qu’il
refuse est un manifeste absent, ou un `.blockmap` que l’un d’eux liste sans qu’il soit à côté.

ADR-06 ne revendique d’ailleurs nulle part ce contrôle : le mot « version » n’y figure pas.

**Deux gardes attrapent malgré tout une PART du désalignement, et par un détour** — chacune exige
qu’une section de `CHANGELOG.md` existe pour un numéro, sans jamais confronter deux numéros entre
eux. `src/main/releaseNotes.test.ts` la demande pour la version de `package.json`, donc la porte
`pnpm validate` rougit si le manifeste avance sans changelog ; `scripts/release-notes.mjs` la
demande pour la version du tag, et fait échouer la publication à sa première étape bloquante. Un
`package.json` resté à `0.2.0` sous un tag `v0.3.0` s’arrête donc là — faute de section `0.3.0`,
et non parce qu’un désalignement a été constaté. **Un changelog qui porte les deux numéros passe
entre les deux gardes.**

**Ce qui manque est la comparaison directe**, tag ↔ `package.json` ↔ manifestes. C’est un œil qui
la fait, et [`../RELEASE.md`](../RELEASE.md) le dit déjà : à la relecture de la draft, il range
« le numéro de version » dans *ce qui reste à vos yeux*, en regard de ce que la machine a vérifié.
Les deux documents se contredisaient donc, et c’est celui qui rassure qui avait tort — le plus
coûteux des deux sens, puisqu’il fait sauter une vérification en la croyant automatique.

**Le reste de la § Conséquences tient, mais pas au même titre.** Vérifiés au 19/08 : le filtre
`tags: ['v*']` et la garde `startsWith(github.ref, 'refs/tags/v')` font qu’un tag mal formé ne
déclenche rien, et `RELEASE.md` en fait bien une étape numérotée. En revanche, que le désalignement
produise des manifestes au mauvais numéro **n’est mesuré nulle part dans ce dépôt** : ce numéro
vient d’electron-builder, et aucun test ni artefact ne l’observe.

**Rien n’est décidé ici sur l’avenir de ce contrôle.** Ajouter la comparaison à
`check-manifests.mjs` est un changement de code, pas de documentation ; cet amendement se borne à
rendre l’état réel lisible.
