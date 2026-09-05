# Spike Semantic Action Search

## A — Mission Runtime finalisé

Verdict : `MISSION RUNTIME MERGED AND CLEAN`.

- La passe `simplify` a relu tout le diff contre `develop`; aucun changement de comportement n'a
  été retenu.
- La revue adverse n'a trouvé aucun blocker. La limite acceptée est le plafond lexical des 46 cas
  difficiles, isolé dans le présent spike.
- Le rebase des 67 commits a résolu les conflits de `serviceTypes.ts`, `fakeBridge.ts`, `ipc.ts`,
  `serviceLocalAi.ts` et `services.ts` en conservant les deux contrats.
- Le merge est `6827884fa` (`Merge branch 'feat/assistant-mission-runtime' into develop`).
- La validation avant et après merge a passé 16 941 tests TypeScript, 213 tests Python, typecheck,
  lint, format, Knip, licences et tailles.
- Le worktree et la branche `feat/assistant-mission-runtime` ont été supprimés après vérification.
- Le worktree `assistant-context-architecture-audit` a été conservé : son commit est intégré, mais
  il contient le rapport non suivi `docs/audits/assistant-context-architecture-audit.md`.
- Le worktree `valide-mission` a été conservé : son HEAD n'est pas ancêtre de `develop`.
- Aucun worktree sans rapport avec le chantier n'a été supprimé.

## B — Spike Semantic Action Search

### Périmètre

Le spike est isolé sur `feat/semantic-action-search-spike`, rebasé sur `develop` `af9686eb0`. Il
n'active rien dans le produit, n'ajoute aucun téléchargement et n'effectue aucun appel provider.
Le corpus lexical canonique reste inchangé. Les textes d'embedding ne contiennent que les contrats
réels des 297 actions; l'oracle n'est consulté qu'après classement.

### Modèle et provenance

| Élément | Valeur |
|---|---|
| Modèle source | `intfloat/multilingual-e5-small` |
| Révision source | `fd1525a9fd15316a2d503bf26ab031a61d056e98` |
| Dimensions / contexte | 384 / 512 tokens |
| Langues annoncées | 94, dont français et anglais |
| Poids source | 470 641 600 octets (`model.safetensors`) |
| SHA-256 source | `1a55775f53449dac10a2bcbc312469fac40b96d53198c407081a831f81c98477` |
| Conversion | `llama.cpp` `6a1a922d269908a29cbd4b49c27e6a8e7fd10fae` |
| Artefact | GGUF Q8_0, 132 440 128 octets |
| SHA-256 artefact | `bb5bd6b99b66ccba1bdaf58821954ce5d21fd021c5d5a5cd87c2f99c67792639` |

La conversion est reproductible à partir de la révision source, mais nécessite de déclarer
`XLMRobertaModel` au convertisseur : le dépôt publie `BertModel` tout en utilisant
`XLMRobertaTokenizer`. Les similarités de contrôle gardent le même ordre que Transformers, mais
`llama.cpp` avertit que le vocabulaire n'a pas de token newline et expose 511 positions utiles.

Le model card officiel déclare `license: mit`, mais la révision vérifiée ne contient aucun fichier
`LICENSE`. Le code `node-llama-cpp` est MIT. L'artefact converti n'a pas de licence autonome. La
redistribution commerciale du modèle n'est donc pas établie au niveau de preuve exigé pour une
recommandation produit.

Sources :

- https://huggingface.co/intfloat/multilingual-e5-small/tree/main
- https://huggingface.co/intfloat/multilingual-e5-small/raw/main/README.md
- https://github.com/ggml-org/llama.cpp/blob/master/examples/model-conversion/README.md
- https://github.com/withcatai/node-llama-cpp

### Runtime et méthode

- Runtime existant : `node-llama-cpp` 3.20.0, CPU Apple Silicon. Aucun runtime produit ajouté.
- Format E5 respecté : préfixes `query:` et `passage:`, mean pooling du modèle, normalisation L2,
  produit scalaire équivalent à la similarité cosinus.
- Les 297 passages sont calculés une fois. Cache brut : 456 192 octets
  (`297 × 384 × 4`), indexé par fingerprint du corpus et identifiant/version/quantification modèle.
- Chargement chaud après compilation native : 1,77 s. Embedding des 297 contrats métier : 15,07 s
  sur le run frais final (9,58 s sur le run précédent).
- Query CPU : p50 6,00 ms, p95 21,35 ms. Recherche SQLite + comparaison/reranking : p50 31,62 ms,
  p95 85,03 ms lors du run frais final.
- RAM incrémentale au chargement : environ 382 Mo. Après calcul et écriture des 297 embeddings, le
  RSS incrémental atteint environ 961 Mo, malgré un cache vectoriel brut de seulement 456 Ko.
- Le premier lancement sans prébuild a compilé `node-llama-cpp`; ce coût de développement n'est pas
  compté comme cold load du modèle.
- Le fallback sans modèle existe déjà conceptuellement : sans encodeur compatible,
  `ActionSearchService` conserve le ranking algorithmique actuel.

Un défaut générique a été découvert : un BLOB `Uint8Array` provenant d'un autre realm était rejeté
par `instanceof`, ce qui mettait tous les scores sémantiques à zéro. Le spike utilise désormais
`ArrayBuffer.isView`, couvert par un test cross-realm. Cette correction reste dans le spike.

### Benchmark global — 414 scénarios historiques

La suite comporte 414 évaluations historiques et 12 contrôles indépendants, soit 426 tests.

| Variante | R@1 | R@3 | R@5 | R@12 | MRR | Rang moyen |
|---|---:|---:|---:|---:|---:|---:|
| Algorithmique actuel | 34,54 % | 55,31 % | 65,94 % | 82,13 % | 0,4903 | 15,07 |
| Sémantique seul | 22,95 % | 38,89 % | 46,86 % | 59,90 % | 0,3458 | 33,65 |
| Algorithmique + sémantique, RRF 1:1 | 39,37 % | 58,21 % | 64,25 % | 76,57 % | 0,5137 | 13,92 |
| Hybride, RRF algorithmique 2:1 | 39,13 % | 60,63 % | 66,18 % | 81,88 % | 0,5266 | 12,80 |

Le RRF 2:1 est la meilleure variante équilibrée : MRR et rang moyen progressent, mais R@12 baisse
de 0,24 point. Il gagne 15 évaluations globales et en fait régresser 16.

### Benchmark des 46 scénarios difficiles — 50 actions attendues

| Variante | R@1 | R@3 | R@5 | R@12 | MRR | Rang moyen |
|---|---:|---:|---:|---:|---:|---:|
| Algorithmique actuel | 0 % | 0 % | 0 % | 0 % | 0,0309 | 67,04 |
| Sémantique seul | 2 % | 6 % | 16 % | 18 % | 0,0794 | 76,60 |
| Algorithmique + sémantique, RRF 1:1 | 2 % | 6 % | 14 % | 26 % | 0,0888 | 62,78 |
| Hybride, RRF algorithmique 2:1 | 0 % | 4 % | 8 % | 24 % | 0,0636 | 62,72 |

La baseline historique de 13,85 % portait sur les 65 actions du lot initial. Après les neuf
corrections déjà mergées, les 50 actions résiduelles sont toutes hors top-12 par définition. La
fusion hybride en récupère 12, dans 12 scénarios distincts. Rapporté aux 65 actions initiales,
l'upper bound passe donc de 9/65 (13,85 %) à 21/65 (32,31 %).

### Analyse causale — meilleure fusion hybride

| Cause | Scénarios | Récupérés complètement |
|---|---:|---:|
| PARAPHRASE | 16 | 0 |
| DOMAIN_COLLISION | 15 | 7 |
| WORKFLOW | 5 | 0 |
| METADATA | 4 | 2 |
| MISSING_RESOURCE_SIGNAL | 4 | 2 |
| APPLICABILITY | 1 | 0 |
| GENERIC_ACTION_OVERWEIGHT | 1 | 1 |

Le sémantique aide surtout les collisions de domaine. Il ne déplace pas le plafond des paraphrases
dans la fusion qui protège le global. Le sémantique seul n'en récupère que 2/16.

### Contrôle indépendant FR/EN

Sur 12 formulations non utilisées pour régler la fusion :

| Variante | R@12 | MRR |
|---|---:|---:|
| Algorithmique actuel | 83,33 % | 0,4198 |
| Sémantique seul | 75,00 % | 0,5397 |
| RRF 1:1 | 83,33 % | 0,5109 |
| Hybride 2:1 | 83,33 % | 0,4947 |

### Régressions de la meilleure fusion

Sortent du top-12 : `file.open` (2.6), `document.activate` (2.7), `files.search` (3.1),
`assets.searchProjectCatalogue` (3.2, 3.3), `workspace.open` (5.2, 5.3), `node.setVisible` (8.6),
`settings.write` (10.5), `command.runStudioCommand` (10.9), `file.rename` (18.2),
`layer.reorderInStack` (19.4), `node.transform` (25.4), `files.undoFileOperation` (29.6),
`favorite.pinAssetRecipe` (55.10) et `component.detach` (60.4).

Entrent dans le top-12 : `scene.state` (1.7, 9.6), `node.add` (6.8, 9.1), `node.addModel` (11.5,
22.4), `node.setMeshMaterial` (12.6), `files.duplicate` (18.1), `files.canUndoRedo` (42.2),
`task.cancelLocalTask` (44.4), `node.setPathShape` (46.4), `channel.setMuteSoloLock` (49.7),
`canvas.flipOrRotate` (51.8), `media.capabilities` (56.6) et `context.readProjectCards` (57.3).

### Conclusion

Le signal sémantique est réel, mais il n'est pas assez robuste pour justifier 132,4 Mo de modèle,
environ 961 Mo de RSS pendant la construction et une latence p95 totale proche de 106 ms. La meilleure fusion régresse le
R@12 global, ne récupère que 12/50 actions difficiles et ne résout aucune des 16 paraphrases. La
licence de redistribution reste en outre insuffisamment matérialisée dans le dépôt source.

Le JSON reproductible détaillé est `semantic-action-search-results.json`. Aucun retest DeepSeek
n'est proposé : le gate offline n'est pas atteint.

### Validation du spike

- Benchmark : 2/2 variantes vertes; 414 évaluations historiques, 50 actions difficiles et 12
  contrôles par variante.
- Tests ciblés : 27/27 (`sqlRow` et `ActionIndex`).
- Typecheck, lint, format et garde de taille : verts.
- `pnpm check` est rouge sur `folder05Part01.test.ts` : le watcher réel n'a reçu aucun événement
  après 10 s lors de deux exécutions isolées. Aucun fichier de ce sous-système ne diffère de
  `develop`.
- `pnpm validate` franchit toutes les gardes statiques puis termine avec 16 925 tests verts et une
  suite rouge : `canvasHandlers01.test.ts` échoue au chargement (`SyntaxError: Invalid or unexpected
  token`) après les avertissements canvas de jsdom. Ce fichier ne diffère pas de `develop`. Ces deux
  défauts sont apparus avec la modernisation Vitest 5 déjà intégrée à `develop`; ils ne sont ni
  contournés ni corrigés dans ce spike.

`SEMANTIC SEARCH REJECTED`
