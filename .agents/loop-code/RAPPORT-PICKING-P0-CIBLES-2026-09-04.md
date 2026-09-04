# Picking P0 — suppression de la matérialisation des sources

## Conditions

| Élément | Valeur | Classement |
|---|---|---|
| Base AVANT | `37c24202bf631f60d7b8088654cd33282ffa1f24` | MESURÉ |
| APRÈS | même base + diff `9d2819fa3a43eee3159b273652c5b4bc5d5f06367300417e63c77f44e2d3a2b4` | MESURÉ |
| Machine | MacBook Pro Mac14,6, Apple M2 Max 12 cœurs, 96 Go, macOS 26.5.2 | MESURÉ |
| Runtime | Node 24.8.0, pnpm 8.15.4 | MESURÉ |
| Données | 500 000 cubes déterministes, 3 907 lots initiaux | MESURÉ |
| Protocole | 5 paires alternées AVANT/APRÈS, processus distincts, même fixture | MESURÉ |
| Bruts | `/tmp/ia-studio-picking-p0/final-rebased/{before,after}/pair-{1..5}.log` | MESURÉ |

## Commandes exactes

| Objet | Commande |
|---|---|
| Mesure | `pnpm exec tsx /tmp/ia-studio-picking-p0/final-rebased/run-final.ts before\|after <pair>` |
| Tests ciblés | `pnpm test src/renderer/src/engines/scene/optimizedGrouping.test.ts src/renderer/src/engines/scene/groupingPicking.test.ts src/renderer/src/engines/scene/mergedGrouping.test.ts src/renderer/src/engines/scene/cellInstancingGroups.test.ts` |
| Interaction | `pnpm test src/renderer/src/engines/scene/sceneRendererGrouping.test.ts` |
| Boucle courte | `pnpm check` |
| Duplication | `pnpm duplication` puis `pnpm duplication:report` |
| Code mort main | `pnpm unused:main` |
| Porte finale | `pnpm validate` |

## Séries et statistiques

Les journaux bruts sont conservés sous `/tmp`. Statistiques : médiane `[minimum–maximum]`, étendue et MAD, en millisecondes.

| Mesure | AVANT | APRÈS | ÉCART | BRUIT | VERDICT |
|---|---:|---:|---:|---:|---|
| Construction `editorPickable()` | 147,415 `[124,214–157,193]`, ét. 32,979, MAD 9,778 | 0,332 `[0,295–0,449]`, ét. 0,154, MAD 0,018 | −99,775 % | Plages disjointes | Gain MESURÉ |
| Raycast des cibles | 1,788 `[1,726–1,883]`, ét. 0,157, MAD 0,062 | 0,336 `[0,298–0,581]`, ét. 0,283, MAD 0,008 | −81,2 % | Plages disjointes, effet secondaire probable de pression mémoire | MESURÉ, non attribué |
| Chemin chaud total avec hit | 149,189 `[125,855–159,067]`, ét. 33,213, MAD 9,421 | 0,703 `[0,641–0,902]`, ét. 0,261, MAD 0,062 | −99,529 %, ×212,2 | Maximum APRÈS inférieur au minimum AVANT | Gain MESURÉ |

Ratios du témoin fixture : `0,989 ; 0,975 ; 1,026 ; 0,986 ; 0,931`. Les cinq paires sont comparables.

## Non-régression

| Comportement | AVANT | APRÈS | Verdict |
|---|---|---|---|
| Identité au clic initial | `pick-0`, 5/5 | `pick-0`, 5/5 | Vérifiée |
| Clic après déplacement à x=1 | `pick-0`, 5/5 | `pick-0`, 5/5 | Vérifiée |
| Ancienne position x=0 après déplacement | aucun hit, 5/5 | aucun hit, 5/5 | Vérifiée |
| Cibles runtime initiales | 3 907 | 3 907 | Vérifiée |
| Cibles après promotion/déplacement | 3 908 | 3 908 | Vérifiée |
| Seuil 24 999/25 000 | test avec espions | test avec espions | Vérifiée |
| Instances, batches, merges et modèles imbriqués | 70 tests adverses verts | 70 tests adverses verts | Vérifiée |
| Régression visuelle | aucune sonde pixel automatisée dans ce lot | aucune sonde pixel automatisée dans ce lot | NON VÉRIFIABLE |

La mutation qui force la matérialisation des sources fait rougir trois tests ; sa restauration rend la suite verte. La validation runtime reste explicitement branchée sur `pickable()` et indépendante du choix adaptatif de l’éditeur.

## CPU, GPU, mémoire et tâches longues

| Métrique | Résultat | Classement |
|---|---|---|
| CPU, chemin chaud | 149,189 → 0,703 ms | MESURÉ |
| Tâche > 16 ms supprimée | construction des cibles : médiane 147,415 ms → 0,332 ms | MESURÉ |
| Heap AVANT/APRÈS | AVANT dominé par le GC signé, séries non comparables | NON VÉRIFIABLE |
| Heap APRÈS | +8 927 320 octets sur 10 appels, ~892,7 ko/appel | MESURÉ |
| RSS APRÈS | +294 912 octets médian | MESURÉ |
| GPU, FPS, frame time GPU | hors chemin CPU de ce lot | NON VÉRIFIABLE |

## Choix technique et classement

| Élément | État | Motif |
|---|---|---|
| Comptage sans allocation avant sélection | Vérifiée | évite de construire 500 000 références avant de choisir les lots |
| Lots runtime existants | Vérifiée | identité `instanceId`, `batchId` et plages de faces déjà branchée |
| Rafraîchissement des sources déplacées | Vérifiée | dessin et clic restent synchronisés |
| `ObjectBVH` sur les sources | Inefficace/risquée ici | construction historique médiane 92,535 ms, au-dessus de 16 ms, sérialisation publique absente |
| Worker/utility process dédié | Non nécessaire pour ce P0 | le travail coûte désormais 0,332 ms ; l’ajout augmenterait risque et complexité |

## Contrôles qualité

| Contrôle | Résultat |
|---|---|
| Revue adverse indépendante | aucun finding ; 58 tests de grouping + 12 tests d’interaction verts |
| Simplification | pas de nouvelle structure ni de parcours supplémentaire ; compteur alimenté dans le rebuild existant |
| Limite de fichier | `cellInstancingGroups.ts` : 499 lignes |
| Duplication | vert, 559 clones existants ; aucune hausse attribuée au lot |
| `unused:main` | vert |
| `pnpm validate` | vert : 1 576 fichiers / 16 386 tests TypeScript, 195 tests Python |

## Classement des preuves et suite

| Classe | Éléments |
|---|---|
| MESURÉ | gain CPU, seuil, identité, déplacement, anciennes positions, nombres de cibles, gates ciblées |
| MESURE HISTORIQUE | coût de construction `ObjectBVH` 92,535 ms sur la base précédente |
| SUPPOSÉ | baisse du raycast due à une pression mémoire/GC moindre |
| NON VÉRIFIABLE | métriques GPU, gain heap comparatif, absence absolue de régression visuelle |

| Priorité suivante | Gain attendu | Risque | Difficulté |
|---|---|---|---|
| P1 : banc pixel déterministe du déplacement groupé | preuve, pas gain runtime | faible | moyenne |
| P1 : instrumenter allocations/GC avec heap contrôlé | quantification mémoire | faible | moyenne |
| P2 : index spatial seulement si une scène réelle dépasse le budget après ce P0 | inconnu | élevé | élevée |

**Recommandation : arrêter l’optimisation du picking ici.** Le chemin mesuré passe sous 1 ms, le gain est très supérieur au bruit, les comportements de sélection et déplacement sont reproduits indépendamment, et un BVH supplémentaire coûterait plus cher à construire sans besoin mesuré.
