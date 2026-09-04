# Recette contradictoire — picking adaptatif

## Conditions

| Élément | Valeur |
|---|---|
| Machine | Apple Silicon arm64, Darwin 25.5.0 |
| Système | macOS 26.5.2 (25F84) |
| Node / pnpm | 24.8.0 / 8.15.4 |
| SHA AVANT | `2371828824c02be99996e14f9bd76eb82d097f9b` |
| APRÈS | diff du worktree `feat/picking-object-bvh` rebasé sur ce SHA |
| Données | grilles déterministes de meshes identiques |
| Protocole | 5 processus consécutifs par taille, 10 raycasts par processus |
| Bruts | `/tmp/ia-studio-source-bvh/adverse-rebased/` |

## Commandes exactes

| Objet | Commande |
|---|---|
| Mesure AVANT | `(cd /tmp/ia-studio-source-bvh/adverse-rebased-before && ADVERSE_COUNT=$count pnpm exec vitest run --config vitest.adverse.config.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose) > /tmp/ia-studio-source-bvh/adverse-rebased/${count}-run-${run}-before.log 2>&1` |
| Mesure APRÈS | `(cd /tmp/ia-studio-source-bvh/adverse-rebased-after && ADVERSE_COUNT=$count pnpm exec vitest run --config vitest.adverse.config.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose) > /tmp/ia-studio-source-bvh/adverse-rebased/${count}-run-${run}-after.log 2>&1` |
| Tests ciblés | `pnpm test src/renderer/src/engines/scene/optimizedGrouping.test.ts src/renderer/src/engines/scene/groupingPicking.test.ts` |
| Gates annexes | `pnpm duplication`, `pnpm duplication:report`, `pnpm unused:main` |
| Porte finale | `pnpm validate` |

La porte finale a été lancée une fois. Elle s'est arrêtée sur `format:check`; après correction
mécanique, ce maillon est vert. Les maillons suivants ont été exécutés séparément : `unused:main`
vert, `engine:check` 195/195, et 16 384 tests JS. Huit fichiers nécessitant sockets locales,
surveillance de fichiers ou processus ont échoué sous sandbox (`EPERM`), puis sont passés 48/48
hors sandbox. Aucun échec fonctionnel ne reste.

## Séries brutes et statistiques

Notation : médiane `[min–max]` ; étendue ; MAD. Temps en millisecondes.

| Taille | Série AVANT | Statistiques AVANT |
|---|---|---|
| 25k | 5,376 · 4,952 · 5,069 · 5,556 · 5,023 | 5,069 `[4,952–5,556]` ; 0,604 ; 0,117 |
| 50k | 12,560 · 10,822 · 11,844 · 12,224 · 12,019 | 12,019 `[10,822–12,560]` ; 1,738 ; 0,205 |
| 500k | 225,453 · 255,197 · 703,815 · 693,510 · 319,195 | 319,195 `[225,453–703,815]` ; 478,362 ; 93,743 |

| Taille | Série APRÈS | Statistiques APRÈS |
|---|---|---|
| 25k | 2,140 · 2,291 · 2,405 · 2,156 · 2,445 | 2,291 `[2,140–2,445]` ; 0,305 ; 0,135 |
| 50k | 4,776 · 5,178 · 4,360 · 4,641 · 4,771 | 4,771 `[4,360–5,178]` ; 0,817 ; 0,130 |
| 500k | 161,945 · 222,680 · 178,299 · 277,184 · 230,773 | 222,680 `[161,945–277,184]` ; 115,240 ; 44,380 |

## AVANT / APRÈS / ÉCART / BRUIT / VERDICT

| Taille | AVANT | APRÈS | Écart médian | Bruit retenu | Verdict |
|---|---:|---:|---:|---:|---|
| 25k | 5,069 | 2,291 | −53,74 % | MAD AVANT 0,117 | MESURÉ — gain confirmé |
| 50k | 12,019 | 4,771 | −61,97 % | MAD AVANT 0,205 | MESURÉ — gain confirmé |
| 500k | 319,195 | 222,680 | −28,17 % | MAD AVANT 93,743 | MESURÉ — amélioration observée, gain non démontré |

## Non-régression fonctionnelle

| Contrat | Preuve | Classement |
|---|---|---|
| Identité individuelle | `pick-0` rendu avant et après dans 30/30 processus | vérifiée |
| Instance simple | test intégré au seuil | vérifiée |
| Batch | hit `batch-0` via `nodeIdOf` | vérifiée |
| Merge | hit `merge-0` via `nodeIdOf` | vérifiée |
| Modèle multi-mesh imbriqué déplacé | hit à x=100, aucun hit à l’ancien x=15 | vérifiée |
| Purge et reconstruction | cibles vides après rebuild vide, identité retrouvée après reconstruction | vérifiée |
| Cellule hors champ | tests `cellInstancing` de `develop` | vérifiée |
| Régression visuelle | aucun rendu Electron capturé dans ce lot | NON VÉRIFIABLE |

## CPU, GPU, mémoire et tâches longues

| Métrique | Résultat | Classement |
|---|---|---|
| Temps CPU du raycast | tableaux ci-dessus | MESURÉ |
| Nombre de cibles | 25k: 25 000→196; 50k: 50 000→391; 500k: 500 000→3 907 | MESURÉ |
| Tâche >16 ms à 25k / 50k | supprimée dans les médianes APRÈS | MESURÉ |
| Tâche >16 ms à 500k | 222,680 ms médiane APRÈS | MESURÉ — persiste |
| Frame GPU / FPS | harnais CPU sans contexte WebGL | NON VÉRIFIABLE |
| Mémoire JS / GPU | non instrumentée par ce harnais | NON VÉRIFIABLE |

## Optimisations runtime et classement

| Élément | Branchement réel | Classement |
|---|---|---|
| Lots cell/instance/batch/merge | `SceneRendererPicking.nodeAt` consomme `editorPickable()` | vérifiée |
| Bascule adaptative à 25 000 cibles | `createOptimizedGroups.editorPickable()` | vérifiée |
| Résolution d’identité des lots | fallback `instances.nodeIdOf(hit)` | vérifiée |
| `ObjectBVH` sur sources | non branché : build/refit synchrones et arbre non sérialisable publiquement | risquée |
| Gain 500k | écart inférieur au bruit AVANT | non vérifiable comme gain |

## Régressions et suites

| Priorité | Candidat | Gain attendu | Risque | Difficulté |
|---|---|---|---|---|
| P0 | Réduire les 222,680 ms restants à 500k sans build synchrone UI | élevé | élevé | élevée |
| P1 | Mettre en cache le tableau composite de cibles entre deux rebuild/follow | faible à moyen | faible | faible |
| P2 | Instrumenter mémoire JS/GPU et frame GPU du picking Electron | preuve, pas gain direct | faible | moyenne |

| Type | Résultat |
|---|---|
| MESURÉ | gains 25k/50k, séries CPU, identité 30/30, cibles, tests fonctionnels |
| MESURE HISTORIQUE | calibration du seuil sur `b5d434da3`, non utilisée comme avant/après final |
| SUPPOSÉ | cache composite potentiellement rentable, à mesurer avant codage |
| NON VÉRIFIABLE | GPU, FPS, mémoire et régression visuelle dans ce harnais |

## Recommandation

| Décision | Motif |
|---|---|
| Continuer, mais livrer ce lot isolément | Gain net et sans régression mesurée à 25k/50k. Le cas 500k reste une longue tâche et exige un lot distinct avec architecture hors thread UI réellement démontrée. |
