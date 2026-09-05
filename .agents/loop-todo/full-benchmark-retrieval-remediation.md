# Full Benchmark — remédiation du retrieval

## Mesures

Le replay cible utilise les requêtes, scopes et ressources réellement persistés dans les traces,
puis repasse par `ActionSearchService → ActionIndex`. Les 55 scénarios RETRIEVAL représentent 65
actions attendues, car quatre workflows attendent plusieurs actions. Six divergences fonctionnelles
correctes ont été retirées des 61 scénarios initialement détectés par l'oracle historique.

| Corpus | R@1 | R@3 | R@5 | R@12 | MRR | Rang moyen | p95 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Cible avant, 65 actions | 0 % | 0 % | 0 % | 0 % | 0,0306 | 67,20 | — |
| Cible après, 65 actions | 1,54 % | 1,54 % | 9,23 % | 13,85 % | 0,0662 | 63,86 | — |
| Global avant, 426 | 34,30 % | 53,86 % | 64,25 % | 81,40 % | 0,4825 | 14,21 | 19,47 ms |
| Global après, 426 | 34,54 % | 55,31 % | 65,94 % | 82,13 % | 0,4903 | 15,07 | 19,37 ms |

## Les 55 scénarios

| Scénario | Famille | Action attendue principale | Rang avant | Sous-cause |
|---|---|---|---:|---|
| 10.6 | scene | world.setBackground | 35 | PARAPHRASE |
| 12.6 | scene | node.setMeshMaterial | 18 | DOMAIN_COLLISION |
| 14.1 | rig | key.writePoseKeys | 29 | DOMAIN_COLLISION |
| 14.3 | rig | key.writePoseKeys | 57 | PARAPHRASE |
| 15.5 | montage | clip.add | 53 | METADATA |
| 15.6 | montage | clip.speed | 167 | PARAPHRASE |
| 17.2 | montage | clip.move | 161 | PARAPHRASE |
| 17.3 | montage | clip.gain | 119 | PARAPHRASE |
| 17.4 | montage | clip.gain | 116 | PARAPHRASE |
| 18.1 | file | files.duplicate | 18 | DOMAIN_COLLISION |
| 21.2 | core | generator.submit | 209 | WORKFLOW |
| 22.4 | scene | node.addModel | 20 | MISSING_RESOURCE_SIGNAL |
| 23.3 | scene | node.setMeshMaterial | 13 | DOMAIN_COLLISION |
| 24.2 | scene | node.addModel | 31 | MISSING_RESOURCE_SIGNAL |
| 24.4 | scene | node.setLightSettings | 171 | PARAPHRASE |
| 24.5 | scene | camera.aimShotAt | 188 | PARAPHRASE |
| 24.9 | scene | node.setMeshMaterial | 19 | DOMAIN_COLLISION |
| 33.1 | montage | clip.add | 44 | WORKFLOW |
| 39.2 | canvas | canvas.resize | 114 | DOMAIN_COLLISION |
| 40.4 | montage | clip.select | 24 | DOMAIN_COLLISION |
| 42.2 | file | files.canUndoRedo | 17 | METADATA |
| 43.1 | asset | asset.get | 16 | DOMAIN_COLLISION |
| 44.4 | job | task.cancelLocalTask | 20 | MISSING_RESOURCE_SIGNAL |
| 45.3 | core | chat.close | 24 | DOMAIN_COLLISION |
| 46.1 | scene | node.setPrimitiveParameters | 35 | DOMAIN_COLLISION |
| 46.4 | scene | node.setPathShape | 15 | DOMAIN_COLLISION |
| 48.2 | scene | world.setFog | 231 | PARAPHRASE |
| 48.3 | scene | world.setGroundPlane | 28 | PARAPHRASE |
| 49.7 | rig | channel.setMuteSoloLock | 13 | DOMAIN_COLLISION |
| 5.5 | state | document.activate | 23 | APPLICABILITY |
| 50.2 | rig | rig.fit | 50 | PARAPHRASE |
| 50.6 | rig | bone.setRole | 31 | METADATA |
| 50.7 | rig | bone.remove | 17 | METADATA |
| 51.8 | canvas | canvas.flipOrRotate | 16 | DOMAIN_COLLISION |
| 54.5 | cloud | cloud.pull | 22 | PARAPHRASE |
| 55.10 | shell | favorite.pinAssetRecipe | 21 | DOMAIN_COLLISION |
| 55.11 | shell | favorite.unpinAssetRecipe | 39 | DOMAIN_COLLISION |
| 55.9 | shell | favorites.listPinnedRecipes | 26 | DOMAIN_COLLISION |
| 56.6 | shell | media.capabilities | 29 | METADATA |
| 56.7 | shell | media.indexFileInPlace | 86 | MISSING_RESOURCE_SIGNAL |
| 57.3 | context | context.readProjectCards | 41 | DOMAIN_COLLISION |
| 58.16 | git | git.stashDrop | 177 | PARAPHRASE |
| 58.23 | git | git.pull | 35 | PARAPHRASE |
| 58.6 | git | git.stashes | 156 | PARAPHRASE |
| 58.8 | git | git.stage | 28 | PARAPHRASE |
| 58.9 | git | git.unstage | 137 | PARAPHRASE |
| 6.12 | scene | node.combineIntoSolid | 113 | PARAPHRASE |
| 6.8 | scene | node.add | 13 | DOMAIN_COLLISION |
| 61.13 | studio | studio.batch | 72 | METADATA |
| 66.1 | core | generator.prepare | 46 | WORKFLOW |
| 66.2 | core | generator.prepare | 26 | WORKFLOW |
| 66.4 | core | generator.prepare | 53 | WORKFLOW |
| 68.4 | canvas | canvas.drawPixels | 43 | DOMAIN_COLLISION |
| 68.6 | canvas | canvas.drawPixels | 18 | DOMAIN_COLLISION |
| 9.6 | scene | scene.state | 17 | GENERIC_ACTION_OVERWEIGHT |

## Répartition

| Sous-cause | Scénarios |
|---|---:|
| METADATA | 6 |
| DOMAIN_COLLISION | 20 |
| PARAPHRASE | 18 |
| WORKFLOW | 5 |
| APPLICABILITY | 1 |
| MISSING_RESOURCE_SIGNAL | 4 |
| GENERIC_ACTION_OVERWEIGHT | 1 |
| OTHER | 0 |

| Famille | RETRIEVAL | Évaluations offline famille | Part |
|---|---:|---:|---:|
| scene | 15 | 110 | 13,64 % |
| montage | 7 | 30 | 23,33 % |
| rig | 6 | 26 | 23,08 % |
| core | 5 | 19 | 26,32 % |
| git | 5 | 24 | 20,83 % |
| shell | 5 | 22 | 22,73 % |
| canvas | 4 | 37 | 10,81 % |
| file | 2 | 32 | 6,25 % |
| asset | 1 | 13 | 7,69 % |
| cloud | 1 | 5 | 20,00 % |
| context | 1 | 3 | 33,33 % |
| job | 1 | 6 | 16,67 % |
| state | 1 | 11 | 9,09 % |
| studio | 1 | 3 | 33,33 % |

## Décisions

Le lot conservé ajoute des cibles métier canoniques partagées par le registre dérivé et le Context
Router. Les namespaces fournissent automatiquement la cible de l'action ; les noms FR/EN du domaine
résolvent une cible explicitement nommée. Le signal reste positif et borné : aucune incompatibilité
n'est déduite d'un simple nom.

Trois expériences ont atteint le plafond demandé : TF-IDF distinctif et FTS localisé ont été rejetés
pour gain marginal ou régression ; augmenter le poids de cible de 4 à 6 a récupéré deux cas ciblés de
plus mais a fait tomber le global à 79,95 % R@12, donc a été rejeté. Le plafond résiduel est dominé
par la paraphrase et des contrats métier encore trop pauvres, pas par un poids global.

Les quatre HARNESS 41.10–41.13 ne créaient aucune mission parce que `playMission` exigeait un projet
ouvert après le setup. La production accepte un scope sans `projectId`. Le harnais est aligné sur ce
contrat et couvert par un test déterministe ; aucun code du runtime n'a été modifié pour eux.
