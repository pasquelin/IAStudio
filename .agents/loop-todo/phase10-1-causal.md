# Phase 10.1 — rapport causal Mission Runtime

Campagne finale du 4 septembre 2026 : `deepseek/deepseek-chat`, 9 scénarios, 3 runs isolés.
Artefacts : `logs/mission-runtime/phase-10-1-delivery/`.

## Fidélité du harnais

Quatre écarts avec la production ont été corrigés avant cette campagne : snapshot canonique via
`studio.state` et `parseSnapshot`, `projectId` du projet ouvert, remise à zéro des modèles armés et
presets entre runs, et lecteur canonique `createMissionRevisionReader`. Une campagne préparatoire
avait prouvé la fuite de modèle : `20.1/run 2` héritait de `flux.1-dev` du run précédent.

Le runtime de production, les prompts, ActionIndex, ContextBuilder, Scheduler, Planner, scénarios
et oracles sont inchangés.

## Résultat mesuré

- 15/27 succès : 56 % ; 12 échecs ;
- 277 505 tokens d'entrée ; 229 111 caractères de contexte ;
- 65 rounds runtime ; 69 appels provider ;
- 840 actions candidates envoyées ; 0 recherche d'action demandée par le modèle ;
- 47 actions exécutées, dont 14 inutiles selon l'oracle historique inchangé ;
- 0 replan, conflit de révision, attente utilisateur ou attente job ;
- concurrence maximale observée : 1 mission.

## Classification des échecs

| Scénario/run | Cause | Round | Preuve |
|---|---|---:|---|
| 6.2/1 | RETRIEVAL | 1 | `node.rename` absent des 12 candidats ; `nodeId` et `Cube` présents. DeepSeek affirme un renommage sans appel. |
| 6.2/2 | RETRIEVAL | 1–2 | `node.rename` absent ; deux `scene.state`, le second refusé pour champ interdit, sans action d'écriture possible. |
| 6.2/3 | RETRIEVAL | 1 | `node.rename` absent ; DeepSeek conclut à tort que la sélection ne contient pas le cube. |
| 12.2/1 | RETRIEVAL | 1–3 | `node.setMeshMaterial` absent ; identifiant de `Bloc` présent. Trois lectures identiques, puis fausse affirmation de succès. |
| 12.2/2 | RETRIEVAL | 1 | `node.setMeshMaterial` absent. `material.setSurfaceSettings` vise un document matière ; `wrongSurface`. |
| 12.2/3 | RETRIEVAL | 1 | Même candidat manquant et même mauvais remplacement, refusé `wrongSurface`. |
| 20.1/1 | RETRIEVAL | 1 | `models.search` absent alors que `generator.prepare` exige un `modelId`. `flux.1-dev` inventé, puis quatre lectures catalogue sans submit. |
| 20.1/2 | RETRIEVAL | 1 | Même identifiant inventé. Au round 2, `generator.submit` est candidat et appelé ; `failed: no model flux.1-dev`. |
| 20.1/3 | RETRIEVAL | 1 | `models.search` absent ; identifiant inventé, préparation seule, puis terminaison sans submit. |
| 22.1/1 | PLANNING | 1 | `models.search` appelé, puis `models.readGenerationModelFields(modelId: dummy)` dans le même round avant le résultat ; refus. |
| 22.1/2 | CONTEXT | 2–8 | `models.search(wooden chest, 3d)` rend `[]`. Les actions de suite restent candidates sans `modelId` ; huit recherches au total. |
| 22.1/3 | CONTEXT | 2 | `models.search(chest wood, 3d)` rend `[]`; actions de suite présentes, aucun `modelId` exploitable. |

Aucun échec final ne relève de `EXECUTION`, `MODEL` ou `BENCHMARK`.

## Classification quantitative

| Cause | Échecs | Répétitions inutiles | % des échecs |
|---|---:|---:|---:|
| RETRIEVAL | 9 | 8 | 75 % |
| CONTEXT | 2 | 3 | 16,7 % |
| PLANNING | 1 | 3 | 8,3 % |
| EXECUTION | 0 | 0 | 0 % |
| MODEL | 0 | 0 | 0 % |
| BENCHMARK | 0 | 0 | 0 % |

Les 14 actions inutiles sont :

- RETRIEVAL, 8 : un `scene.state` refusé sur 6.2, quatre relectures/refus ou mauvais appels matière
  sur 12.2, deux relectures catalogue et le submit voué à l'échec sur 20.1 ;
- CONTEXT, 3 : trois répétitions exactes de `models.search` sur 22.1/2 après résultats vides ;
- PLANNING, 3 : l'identifiant `dummy` sur 22.1/1, un second `memory.write` identique sur 57.4/2,
  et un `git.commit` répété sur 58.7/1.

Le compteur historique compte tout refus et toute répétition exacte action+input. Il ignore donc
des répétitions sémantiques dont l'ordre des clés ou le texte varie.

## Cas ciblés

### 12.2

`node.setMeshMaterial` n'est candidat dans aucun des cinq rounds. Le `nodeId` reste présent. Le
résultat `scene.state` est tronqué dans `previousResults`, mais l'action d'écriture manquait avant
cette troncature. Les lectures antérieures sont visibles au round suivant : DeepSeek voit qu'il
relit.

### 20.1

`generator.prepare` est présent au premier round et `generator.submit` au second. `models.search`
manque au premier alors que `modelId` est obligatoire. Les trois runs inventent `flux.1-dev` ; un
seul tente le submit, refusé. Aucun prompt tracé ne contient d'interdiction de générer.

### 22.1

`models.search` est présent au premier round. Les recherches rendent `[]`, car le cloud du banc
filtre littéralement le nom `Demo 3d` avec des descriptions de contenu. `models.select`,
`generator.prepare` et `generator.submit` restent candidats sans identifiant disponible. Le
premier run invente en plus `dummy` avant de recevoir le résultat.

### 57.4

Les trois runs appellent `memory.write` et persistent réellement. Un run répète l'écriture ;
l'oracle orienté état réel accepte correctement les trois résultats.

### 58.7

Les trois runs réussissent. `git.init` est candidat et choisi avant tout `git.commit`. L'ancien cas
« commit avant init » n'est pas reproduit. Un run fait trois commits ; les résultats restent `ok`
avec `head: null` faute de fichiers, ce qui entretient la vérification.

## Correctifs potentiels par impact mesuré

1. **Retrieval des actions opératoires et prérequis de génération** — cible 9/12 échecs et 8/14
   actions inutiles : remonter `node.rename`, `node.setMeshMaterial` et `models.search` lorsqu'un
   `modelId` est nécessaire. Arbitrage requis sur scoring ou métadonnées ActionIndex.
2. **Contrat de découverte des modèles** — cible 2/12 échecs et 3/14 répétitions : décider si une
   recherche de contenu doit retrouver un modèle par capacité, ou si le runtime reformule vers le
   catalogue. Arbitrage requis entre recherche, dépendances et cloud du banc.
3. **Continuité et discipline d'enchaînement** — cible 1/12 échec : ne pas exécuter une action
   dépendante dans le même round avec une valeur inventée. Arbitrage requis sur les workflows.
4. **Anti-répétition informé par les résultats** — ne récupère pas seul un des 12 échecs, mais
   cible les 14 actions inutiles, notamment les recherches et écritures déjà effectuées.

Aucun correctif comportemental n'est implémenté dans ce lot.
