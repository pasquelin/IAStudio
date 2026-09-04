# Rig / Auto Rig — fermeture des gates avant merge

Date de recette : 5 septembre 2026. Base : `develop@13a2c1661`. Candidat initial :
`feat/rig-integration-clean@b9145e8d7`.

## Verdict

`NOT READY TO MERGE`

Les gates dépôt et package public sont closes. La recette P0 automatisée est verte, mais le parcours
utilisateur réel complet sur B6KV, JRPG et le personnage multi-mesh n'a pas été exécuté jusqu'au
round-trip GLB et aux smokes IK/timeline/retargeting. Il reste l'unique blocker de merge.

| Gate | Verdict |
| --- | --- |
| Repository validation | PASS — `pnpm validate` intégralement vert |
| Public package | PASS — package macOS arm64 construit et inspecté |
| P0 Simple | BLOCKER — contrats automatisés verts, recette utilisateur complète non démontrée |
| P0 MIA dev | N/A — environnement développeur MIA non matérialisé pendant cette recette |
| GLB | PASS automatisé ; recette réelle A/B/C non démontrée |
| Undo/Redo | PASS automatisé ; recette réelle A/B/C non démontrée |
| Animation/IK/Timeline | BLOCKER — smokes utilisateur non exécutés |
| Security/races | PASS automatisé |
| Performance Simple | PASS — médianes à cinq runs, écart inférieur à 1 % après correction |

## Gate A — validation du dépôt

La comparaison a été faite dans le même environnement sur `develop` et sur le candidat avant toute
correction.

| Test en échec | `develop` | candidat initial | Conclusion |
| --- | --- | --- | --- |
| MCP | 30 échecs sur 75, `listen EPERM 127.0.0.1` | identique | ENVIRONMENT |
| `pythonProcess` | 8 échecs sur 8, socket Unix refusée | identique | ENVIRONMENT |
| watcher | 1 échec sur 10 | identique | ENVIRONMENT |
| integration bench | 22/22 | 2 échecs `rig.fit` | REGRESSION |
| timeout | conséquence des sockets refusées | identique | ENVIRONMENT |

La régression du banc venait d'une scène factice qui ne matérialisait pas le nouveau chemin
`AutoRigService`. La fixture construit désormais un renderer headless minimal avec une cible et un
binding valides. Une seconde régression de test utilisait des modèles Diffusers/ONNX désormais
refusés par la gate de sécurité ; la fixture déclare maintenant le format sûr attendu.

Résultat final isolé, avec les sockets locales autorisées :

- `pnpm validate` : PASS ;
- Vitest : 1 605 fichiers, 16 550 tests verts ;
- Python : 202 tests verts, 1 test conditionnel ignoré ;
- Knip : aucune anomalie ;
- licences : 73 paquets permissifs, mentions présentes ;
- typecheck, lint, format, tailles et build moteur : PASS.

## Gate B — package public

L'échec Electron Builder initial n'était pas une régression Rig. Le binaire global
`/usr/local/bin/pnpm` était en version 8.15.4 alors que le projet exige `pnpm@11.21.0`, ce qui
faisait échouer le collecteur avec `reference.startsWith is not a function`. Le même échec existait
sur `develop`. Le package a été reconstruit avec Corepack/pnpm 11.21.0 et la signature automatique
désactivée pour cette recette locale.

Commande validée :

```text
corepack pnpm exec electron-builder --dir --mac --arm64
```

Artefact : `release/mac-arm64/IA Studio.app`.

| Élément | Mesure |
| --- | ---: |
| Package public candidate | 776 584 Kio |
| Moteur Python public | 75 116 Kio |
| Checkpoints MIA | 0 octet |
| Runtime lourd MIA / Torch | 0 octet |
| Implémentation Python MIA | 0 octet |
| Instance Rig / BodyPix / SkinTokens / TokenRig / Motius | 0 octet |

Le filtre de packaging conserve seulement le point d'enregistrement Python générique requis au
démarrage du worker et exclut l'implémentation MIA ainsi que son code vendored. Le code TypeScript
léger du backend peut rester compilé, mais la politique
centrale refuse sélection, installation et exécution sous les surfaces UI, Command/MCP et host.
Les tests confirment aussi qu'une ancienne préférence MIA retombe sur Simple, même si runtime et
checkpoints sont physiquement présents.

Un smoke exécuté avec l'interpréteur et le `PYTHONPATH` du package importe réellement
`ia_studio_engine.workers.door`. Il a détecté puis permis de corriger une première exclusion trop
large du dossier `autorig`, qui cassait le worker avant même son démarrage.

Un package `develop` de 1 667 104 Kio a été produit avec un cache moteur historique contenant
956 448 Kio de Torch. Il n'est pas comparable au candidat propre : aucun delta develop/candidate
n'est donc publié.

## Gate C — recette P0

Les trois assets réels ont été retrouvés :

| Corpus | Caractéristiques mesurées |
| --- | --- |
| B6KV | 11 020 vertices, mono-mesh |
| JRPG / Tripo | 716 371 vertices, mono-mesh |
| Multi-mesh | 6 meshes, 12 primitives, 30 414 vertices uniques, accessors partagés, 8 matériaux, 6 transforms non identité |

Les tests P0 automatisés Auto Rig, transaction multi-mesh, adapter MIA, skin GLB et round-trip Rig
sont verts : 50/50. Ils couvrent notamment validation, échec injecté au milieu du commit,
Undo/Redo sans nouvelle inférence, cancellation tardive, document/objet disparu, crash Python,
accessors partagés, confinement des chemins et transforms locales.

La tentative de recette via l'application de développement a démarré Electron et le port DevTools,
mais aucune fenêtre renderer n'a été publiée dans la liste CDP. Le parcours complet Open → Auto Rig
→ pose → Undo/Redo → Save/Reopen → export/réimport, ainsi que les smokes IK, timeline et
retargeting, ne sont donc pas mesurés. Ces contrôles ne sont pas remplacés par une supposition : la
Gate C reste ouverte.

Une seconde tentative a utilisé le package public lui-même avec un profil utilisateur isolé. Le
projet réel et B6KV ont été ouverts depuis l'explorateur ; le document a été créé, mais le personnage
n'a pas pu être sélectionné de manière vérifiable dans le viewport instrumenté. Aucune étape aval
n'est donc marquée comme réussie.

| Parcours | B6KV | JRPG | Multi |
| --- | --- | --- | --- |
| Auto Rig | NON MESURÉ | NON MESURÉ | NON MESURÉ |
| Skeleton | NON MESURÉ | NON MESURÉ | NON MESURÉ |
| Pose | NON MESURÉ | NON MESURÉ | NON MESURÉ |
| Undo | NON MESURÉ | NON MESURÉ | NON MESURÉ |
| Redo | NON MESURÉ | NON MESURÉ | NON MESURÉ |
| Save/Reopen | NON MESURÉ | NON MESURÉ | NON MESURÉ |
| Export/Reimport | NON MESURÉ | NON MESURÉ | NON MESURÉ |
| Materials | NON MESURÉ | NON MESURÉ | NON MESURÉ |
| Transforms | N/A mono-mesh | N/A mono-mesh | NON MESURÉ |

| Smoke | Verdict |
| --- | --- |
| Bone edit | NON MESURÉ |
| IK | NON MESURÉ |
| Timeline | NON MESURÉ |
| Playback | NON MESURÉ |
| Retargeting | NON MESURÉ |

## Performance Simple

Mesure locale M2 Max, cinq runs par chemin, mêmes données et mêmes calculs. Une première mesure a
révélé +11,1 % sur JRPG, causé par une allocation `slice()` pour chaque vertex dans la validation
commune. La boucle a été remplacée par une validation sans allocation intermédiaire.

| Asset | Médiane directe | Médiane `AutoRigService` | Écart final |
| --- | ---: | ---: | ---: |
| B6KV | 30,777 ms | 30,668 ms | -0,35 % |
| JRPG | 836,035 ms | 841,396 ms | +0,64 % |

Ces résultats ne montrent plus de régression significative du chemin Simple.

## Corrections de cette fermeture

- fixtures du banc alignées sur le vrai contrat `AutoRigService` ;
- fixture Model Manager rendue conforme à la politique de format sûr ;
- validation top-4 réécrite sans allocations par vertex ;
- runtime Python MIA exclu du package public ;
- import du worker public restauré en conservant uniquement son point d'enregistrement Auto Rig
  sans l'implémentation MIA ;
- test de garde du filtre Electron Builder ajouté ;
- type de la factory de renderer de test élargi au contrat réellement surchargé.

## Dette et blocker restant

### Blocker

Exécuter la recette utilisateur complète Simple sur B6KV, JRPG et multi-mesh, puis au moins un
smoke bone/IK/timeline/playback/retargeting. Tant que cette preuve n'existe pas, le verdict ne peut
pas devenir `READY TO MERGE`.

### Dettes non bloquantes

- l'annulation ne peut pas interrompre un kernel tiers déjà engagé ; tout résultat tardif reste
  rejeté avant mutation ;
- les droits des checkpoints MIA restent non établis ; ils sont techniquement exclus du package
  public et leur distribution reste bloquée ;
- le package `develop` historique ne fournit pas de baseline de taille comparable à cause de son
  cache Torch contaminé.

## Commits proposés au merge

Ne merger aucune branche historique complète. Après fermeture de la recette P0, proposer seulement :

1. `b9145e8d7` — patch Rig/Auto Rig correctif propre ;
2. le commit de fermeture courant — corrections des gates, exclusion du runtime MIA public, tests
   et présent rapport.

Les branches SkinTokens, Instance Rig, Motius et les assets/captures de recette n'apportent aucun
code au patch.
