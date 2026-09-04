# Rig / Auto Rig — phase corrective avant merge

Date de recette : 4 septembre 2026. Base finale : `develop@13a2c1661`.

## Verdict

`NOT READY TO MERGE`

Le patch corrige les cinq blockers techniques de code. Le merge reste bloqué par l'absence de
recette produit P0 complète et par l'échec du packaging public macOS arm64. Les droits des
checkpoints MIA restent non établis ; le modèle est donc bloqué par une politique centrale et le
runtime lourd n'est pas distribué.

## Statut des blockers

| Blocker | Avant | Correction | Test ou mesure | Statut |
| --- | --- | --- | --- | --- |
| Gate MIA | `restricted` informatif | `distributionStatus: blocked` alimente `modelRefusalOf`; sélection, installation, chargement et host refusent sous les surfaces | tests domaine, manager, host et release | RESOLVED |
| Simple bypass | hook et assistant appelaient directement `rigFit` | backend Simple enregistré ; UI et `rig.fit` passent par `AutoRigService` | tests service/backend/assistant | RESOLVED |
| Atomicité | remplacement progressif des meshes | préparation complète, commit groupé et rollback inverse de tous les meshes | succès, propriétés préservées, échec injecté au mesh 2 | RESOLVED au niveau `applyRig` |
| IPC | forme superficielle | contrôle composantes, finitude, indices, partitions et budget avant host/Python | tests payload malformé et budget | RESOLVED |
| Path confinement | noms de fichiers fournis par le résultat | noms attendus stricts, `O_NOFOLLOW`, fichier régulier, taille exacte, backend et dimensions vérifiés | traversal, absolu, symlink, backend incohérent | RESOLVED |
| Recette/performance | non démontrée sur la même base | mesure comparative B6KV/JRPG effectuée ; tests automatisés renforcés | voir section performance | BLOCKER : recette UI/GLB/IK/timeline et multi-mesh réel non rejoués |
| Droits checkpoints | provenance non établie | aucun checkpoint embarqué ou téléchargeable ; modèle bloqué indépendamment des fichiers présents | tests du catalogue et du host | SAFELY EXCLUDED FROM PUBLIC BUILD |
| Runtime distribution | risque de Torch dans le paquet public | hook de préparation MIA retiré du packaging ; runtime public mesuré sans Torch/checkpoint | build applicatif et inspection des ressources | SAFELY EXCLUDED, mais packaging final en échec |

## Corrections techniques

- `AutoRigService` possède les backends Simple et MIA, et rejette un backend inconnu ou un résultat
  invalide. Simple reste CPU local : aucun appel bridge, Python, modèle ou réseau dans son test.
- `AutoRigResult` centralise la validation du Rig, des cibles et des quatre influences par vertex.
  Les transforms non finies, parents invalides et cycles sont refusés avant application.
- `applyRig` construit bones, géométries et `SkinnedMesh` hors scène. Le commit multi-mesh restaure
  parents, ordre, enfants et géométries si une mutation échoue.
- Les propriétés conservées explicitement couvrent transforms/Object3D, visibilité, layers,
  shadows, ordre de rendu, frustum, `userData`, enfants, matériaux, callbacks et morph targets.
- Le main valide le payload avant création du dossier temporaire. Le budget par défaut réutilise
  `MAX_MESH_BYTES` (1 Gio) et peut être abaissé dans les tests.
- Le résultat Python n'ouvre que les quatre fichiers binaires attendus dans le dossier contrôlé ;
  symlinks et tailles incohérentes sont rejetés.
- Un lease du Model Manager interdit désormais la suppression d'un modèle pendant son utilisation.
- Le fallback « Simple » transmet explicitement `simple` au lieu de réutiliser la sélection capturée
  par le rendu précédent. Une identité holder/géométries et l'identité du state sont vérifiées avant
  commit afin qu'un résultat tardif ne remplace ni une édition/Undo ni un mesh remplacé.
- Les lectures Python sont bornées à `maximumBytes + 1` sur le handle déjà contrôlé et refusent la
  plateforme lorsque `O_NOFOLLOW` n'est pas disponible.
- `fetchEngine` rematérialise toujours l'interpréteur public depuis l'archive épinglée : un runtime
  MIA installé lors d'une recette ne peut plus survivre via le stamp de cache.
- La passe de simplification a supprimé les wrappers asynchrones imbriqués du skinning et ramené
  les fonctions modifiées sous les budgets de taille et de complexité.

## Gate MIA public

La politique commune dérive le refus depuis la fiche du modèle. La fiche MIA porte
`licenceStatus: restricted` et `distributionStatus: blocked`. Cette dernière propriété prévaut
sur l'état installé :

- `choose`/`chooseMany` refusent la sélection locale ;
- `installModel` refuse avant de contacter le runtime ;
- `runLoad` refuse le chargement ;
- `AutoRigHost` refuse avant le contrôle des fichiers installés ;
- une ancienne préférence ne devient pas le provider effectif, car le candidat est `refused` ;
- l'action assistant ne demande que le backend Simple.

Le runtime public matérialisé par `beforePack` mesure 69 600 Kio. Il contient le moteur Python et
104 Kio de source Auto Rig/MIA, mais ni Torch, ni checkpoint `.pth`/`.ckpt`, ni ressource d'un
candidat NO-GO. La source expérimentale seule ne rend pas MIA exécutable et le gate reste appliqué
même si des fichiers privés sont présents.

## Validation et sécurité

- Tests ciblés après correction : 158/158 verts.
- Suite Python : 202 tests verts, 1 test conditionnel ignoré.
- Typecheck : vert.
- Lint : vert.
- Gate de taille/complexité : 4 109 fichiers conformes.
- Licences : 73 paquets, tous permissifs et mentions présentes.
- `pnpm build` : vert ; 419 fichiers de sortie, aucun doublon empaqueté.
- `pnpm validate` : les gates site, documentation, licences, tailles, typecheck, lint et format sont
  vertes. La suite Vitest complète échoue ensuite sur des tests d'infrastructure hors Rig (serveurs
  MCP, subprocess Python, watchers et banc) par timeouts/permissions ; la porte complète n'est donc
  pas verte.
- Aucun `InstanceRig`, BodyPix, SkinTokens, TokenRig ou Motius dans `src/`, `engine/` ou les manifests.
- Aucun checkpoint, `.npz`, GLB/FBX de recette ou capture dans le patch.

## Performance Simple

Mesure locale M2 Max sur les deux assets réels, dans le même processus et sur la même base Git.
Le chemin « avant » appelle directement les algorithmes existants ; le chemin « après » exécute
exactement ces calculs par `AutoRigService`. Les chiffres RSS sont des deltas de processus et non
des pics isolés reproductibles.

| Asset | Vertices | Bones | Bindings | Direct | Via service | Écart observé | RSS direct | RSS service |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| B6KV | 11 020 | 22 | 1 | 551,6 ms | 271,1 ms | -280,5 ms | +55,4 Mo | +31,5 Mo |
| JRPG | 716 371 | 22 | 1 | 23 007,3 ms | 23 334,2 ms | +326,9 ms (+1,42 %) | +17,3 Mo | +17,3 Mo |

La mesure B6KV est dominée par l'échauffement JIT et ne constitue pas un gain mesuré. Le JRPG ne
montre pas de copie ou de coût MIA ; l'écart observé reste faible devant le skinning géométrique.
Le corpus multi-mesh réel n'est plus présent localement : aucune cellule n'est inventée.

## Build et taille

| Élément | Mesure candidate |
| --- | ---: |
| Sortie `pnpm build` | 74 216 Kio |
| Runtime Python public téléchargé | 69 600 Kio |
| FFmpeg/ffprobe public | 98 436 Kio |
| STT public | 636 Kio |
| Runtime MIA lourd | 0 octet |
| Checkpoints MIA | 0 octet |

Le build de `develop` n'a pas pu être reconstruit avant rebase : son ancien
`pnpm-workspace.yaml` était refusé par pnpm 11. Le delta binaire exact n'est donc pas mesuré. Le
packaging `electron-builder --dir --mac --arm64` atteint l'étape de collecte des dépendances puis
échoue dans le collecteur pnpm. Le répertoire partiel `release/` (313 900 Kio) n'est pas un paquet
public validé et ne doit pas servir de baseline.

## Recette restante et dettes

### Blockers de merge

1. Corriger/reproduire l'échec du collecteur pnpm d'`electron-builder`, puis produire et inspecter
   un bundle public complet.
2. Rejouer la recette P0 utilisateur B6KV, JRPG et multi-mesh : Auto Rig, skeleton, pose,
   Undo/Redo, sauvegarde, réouverture, export/réimport GLB, IK, timeline et retargeting.
3. Retrouver le corpus multi-mesh réel ou fournir un remplacement de provenance équivalente pour
   mesurer l'atomicité et les performances hors tests synthétiques.

### Dette explicite non bloquante pour le code

- L'annulation ne peut pas interrompre un kernel Python tiers déjà engagé ; le contrat garantit
  cependant que tout résultat tardif est rejeté.
- Les sources MIA expérimentales (104 Kio) restent dans le runtime Python public de base. Elles
  sont inertes sans Torch/checkpoints et protégées sous les surfaces, mais pourraient être retirées
  du runtime public lors d'un futur travail de packaging différencié.
- Les droits des checkpoints MIA restent à clarifier en amont. Aucune activation publique ne peut
  précéder cette clarification et le passage de `distributionStatus` à `public`.

## Patch proposé

Ne merger aucune branche historique complète. Le patch doit provenir uniquement de
`feat/rig-integration-clean`, organisé par responsabilités :

1. contrats Auto Rig, validation et convergence Simple ;
2. transaction `applyRig`, bindings multi-mesh et Undo ;
3. IPC, host Python et confinement des résultats ;
4. politique de distribution et Model Manager ;
5. backend MIA expérimental désactivé, runtime et licences ;
6. tests et audits.

Les branches SkinTokens, Instance Rig, Motius et les harnais/captures/assets de recette n'apportent
aucun code au patch.
