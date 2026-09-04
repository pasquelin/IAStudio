# Recette du picking dans l’artefact Electron de production — 4 septembre 2026

## Conditions

| Élément | Valeur | Classement |
|---|---|---|
| Base `develop` mesurée après rebase | `08894203ccae2b396a74f243cd3d8bfabf60ce3d` | MESURÉ |
| Lot du harnais mesuré | `a9a7c041199bfdc3c66ffd5ea3a749a8a1b06a17` | MESURÉ |
| Machine | MacBook Pro Mac14,6, Apple M2 Max, 12 CPU, 96 Go | MESURÉ |
| GPU | Apple M2 Max, 38 cœurs, Metal 4 | MESURÉ |
| Système | macOS 26.5.2 arm64 | MESURÉ |
| Runtime | Electron 43.4.0, Three.js 0.185.1, React 19.2.8 | MESURÉ |
| Profil | `/tmp/picking-production-harness/profile`, réutilisé sur les cinq runs | MESURÉ |
| Données | fixture déterministe S5, modèle et texture synthétiques | MESURÉ |
| Sorties brutes | `/tmp/picking-production-harness/runs/run-{1..5}.json` | MESURÉ |

Les chiffres ci-dessous ont été repris après rebase. Aucun changement du moteur de picking
n’appartient à ce lot.

## Commandes exactes

| Objet | Commande |
|---|---|
| Construction production | `pnpm build` |
| Une exécution | `node_modules/electron/dist/IA\ Studio.app/Contents/MacOS/IA\ Studio --user-data-dir=/tmp/picking-production-harness/profile out/main/pickingValidation.js` |
| Série | `for run in 1 2 3 4 5; do … > /tmp/picking-production-harness/runs/run-${run}.json; done` |
| Test ciblé | `pnpm test src/main/pickingValidation.test.ts` |
| Boucle courte | `pnpm check` |
| Taille, après correction | `pnpm sizes:check` |
| Duplication | `pnpm duplication` puis `pnpm duplication:report` |
| Code main inutilisé | `pnpm unused:main` |

## Séries brutes et statistiques

| Run | Durée (ms) | Rayons | Frames | Picking | Ratios pixels changés | Écarts canal max |
|---:|---:|---:|---:|---|---|---|---|
| 1, froid | 1 514,1 | 96 | 6 | identique | 0 / 0 / 0 | 0 / 0 / 0 |
| 2 | 277,2 | 96 | 6 | identique | 0 / 0 / 0 | 0 / 0 / 0 |
| 3 | 277,8 | 96 | 6 | identique | 0 / 0 / 0 | 0 / 0 / 0 |
| 4 | 283,1 | 96 | 6 | identique | 0 / 0 / 0 | 0 / 0 / 0 |
| 5 | 274,8 | 96 | 6 | identique | 0 / 0 / 0 | 0 / 0 / 0 |
| Statistiques | médiane 277,8 · min 274,8 · max 1 514,1 · étendue 1 239,3 · MAD 3,0 | 480 cumulés | 30 cumulées | 5/5 | tous nuls | tous nuls |

## Avant / après / bruit / verdict

| Mesure | AVANT | APRÈS | ÉCART | BRUIT | VERDICT | Classement |
|---|---:|---:|---:|---:|---|---|
| Identité des rayons original / runtime optimisé | 96 échantillons | 96 échantillons | 0 divergence | 0 | vérifiée | MESURÉ |
| Matrices des lots réellement dessinés | — | — | inaccessible par l’oracle actuel | — | non vérifiable | NON VÉRIFIABLE |
| Raster original / runtime optimisé | 3 caméras | 3 caméras | 0 pixel | tolérance 1 canal, ratio 0,002 | vérifiée | MESURÉ |
| Durée totale du validateur | — | 277,8 ms médiane | comparaison impossible | MAD 3,0 ms | non vérifiable comme gain | NON VÉRIFIABLE |
| Picking groupé du lot antérieur, 10 000 corps | 0,080 ms | 1,295 ms | +1,215 ms, ×16,2 | série brute absente de ce lot | régression historique signalée | MESURE HISTORIQUE |

## Couverture et absences

| Comportement ou métrique | Résultat | Classement |
|---|---|---|
| Raycasting de la représentation réellement construite | 96 rayons par run, 5/5 identiques | vérifiée — MESURÉ |
| Rendu original / optimisé, trois caméras | 0 pixel différent, 5/5 | vérifiée — MESURÉ |
| Matrices monde des sources après construction | disponibles mais impropres à prouver les slots dessinés | inefficace — NON VÉRIFIABLE |
| Clic DOM réel, multi-sélection, marquee et geste gizmo | aucun scénario d’entrée utilisateur dans ce harnais | non vérifiable — NON VÉRIFIABLE |
| Tâches dépassant 16 ms | durée globale seulement, aucune trace de longues tâches | non vérifiable — NON VÉRIFIABLE |
| Frame time CPU / GPU et FPS | aucune instrumentation par frame | non vérifiable — NON VÉRIFIABLE |
| Mémoire JS / GPU, caches et dispose | `dispose` exécuté, aucune télémétrie mémoire | partielle — NON VÉRIFIABLE |
| Régression fonctionnelle | aucune sur les 480 rayons synthétiques ; interactions réelles absentes | partielle — MESURÉ |
| Régression visuelle | aucune sur 30 frames comparées | vérifiée — MESURÉ |
| Régression de performance | aucun avant/après chronométré séparément | non vérifiable — NON VÉRIFIABLE |

## Optimisations présentes au runtime

| Élément | Preuve | Classement |
|---|---|---|
| Compilateur de monde optimisé | l’artefact appelle `compileRuntimeWorld` puis construit sa représentation | vérifiée |
| Groupement / picking S5 | 96 rayons traversent la représentation optimisée et retrouvent les mêmes identités | vérifiée |
| Destruction des deux représentations | `dispose` est appelé en `finally` | partielle, mémoire non instrumentée |
| BVH, index spatial, instancing et batching pris séparément | non isolés par ce harnais ciblé | non vérifiable |

## Risques et priorités

| Priorité | Candidat | Gain attendu | Risque | Difficulté | État |
|---|---|---|---|---|---|
| P0 | Piloter clic, multi-sélection, marquee et gizmo dans l’artefact | ferme les absences fonctionnelles les plus critiques | moyen | moyen | à faire |
| P1 | Séparer les durées original / optimisé et le coût par rayon | prouve ou réfute le gain du picking | faible | faible | à faire |
| P1 | Tracer longues tâches, CPU/GPU et mémoire sur S5 | détecte gel UI et fuite | faible | moyen | à faire |
| P2 | Isoler instancing, batching, BVH et index spatial | attribue précisément les coûts | moyen | élevé | à faire |

## Gates et régressions

| Contrôle | Résultat |
|---|---|
| Mutation : retrait de l’entrée main | test rouge, puis restauration |
| `pnpm build` | vert, 417 fichiers, aucun doublon d’artefact |
| `pnpm check` | tests, typecheck, lint et format verts ; garde de taille rouge à 52 lignes |
| Correction de taille | helper d’assertion extrait ; reviewer : `pnpm sizes:check` vert, 4 052 fichiers conformes |
| `pnpm duplication` | vert ; 2,65 % global, aucune duplication attribuée au harnais |
| `pnpm duplication:report` | vert ; 26 clones production-production existants |
| `pnpm unused:main` | vert |
| Revue adverse indépendante | changements requis : faux oracle transformations retiré ; interactions réelles toujours bloquantes |
| Reproduction adverse | 278,3 / 296,7 / 287,1 / 285,1 / 307,4 ms ; médiane 287,1, MAD 8,8 ; 5/5 verts |
| Coût artefact | environ 28 Kio directs supplémentaires, entrée jamais appelée par le chemin normal |
| `pnpm validate` | à exécuter une fois après rebase et revue |

## Recommandation

**Continuer la recette, arrêter la fusion de ce lot.** Le harnais de production prouve les rayons
synthétiques et pixels de S5, mais il ne permet pas de déclarer le picking utilisateur entièrement
protégé ni plus rapide. Le prochain lot rentable est le pilotage réel clic / multi-sélection /
marquee / gizmo ; aucune optimisation supplémentaire ne doit être fusionnée avant cette couverture.
