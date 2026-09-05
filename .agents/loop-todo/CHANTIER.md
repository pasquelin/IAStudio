# CHANTIER — Assistant / Missions / Contexte / Actions

Source : spécification utilisateur du 4 septembre 2026 et
`docs/plans/assistant-mission-runtime.md`. `AGENTS.md` et `.agents/rules/*.md` priment sur le
protocole ; la spec prime sur le périmètre fonctionnel.

## Lots

| # | Lot | État |
|---|---|---|
| 1 | Baseline et domaine pur | terminé |
| 2 | Mission Store / Manager main persistant | terminé |
| 3 | Scheduler déterministe | terminé |
| 4 | ActionIndex FTS/fingerprint/worker | terminé |
| 5 | AssistantContextBuilder | terminé |
| 6 | Document State / Revision | terminé |
| 7 | Branchement LLM progressif | terminé |
| 8 | Capabilities et contexte visuel | terminé |
| 9 | Flux d’activité UI | terminé |
| 10 | Métriques et banc comparatif | terminé, objectif de score non atteint |
| 10.1 | Instrumentation causale et campagne DeepSeek isolée | terminé, 12 échecs classés |
| 10.2 | Fiabilisation retrieval, continuité et scope structuré | terminé |
| 10.3 | Workflows opératoires et provenance | terminé, référence DeepSeek 27/27 |
| 10.4 | Extension progressive du banc | terminé, Palier B 43/91 |
| 10.5A–E | Instrumentation et retrieval algorithmique | terminé, R@12 76,09 % |
| 10.5F | Réduction ciblée par les métadonnées existantes | terminé, plafond démontré |
| 10.5G | Convergence produit et continuité des prérequis | en cours |

## État mesuré actuel

- HEAD valide : dernier commit de la branche `feat/assistant-mission-runtime`.
- Référence Mission Runtime : 27/27 sur le mini-banc Phase 10.3.
- Retrieval offline : 414 cas, R@12 76,09 %, MRR 0,4538, 99 actions attendues hors top-12.
- Palier B historique : 43/91 ; ne pas le relancer avant un gain offline significatif.
- Causes restantes : Metadata 35, Paraphrase 16, Domain collision 43, Workflow 4, Benchmark 1.
- Verts : 16 745 tests TypeScript, 195 tests Python, `pnpm validate`.
- Expériences rejetées : descriptions françaises globales, poids des options, hausse globale ou
  canonique du poids d'intention. Elles dégradent des familles sans gain net.
- Audit 10.5G : les contrats métier sont justifiés, mais ne peuvent reranker structurellement la
  recherche initiale sans signal correspondant produit par le Context Router.
- Reclassification cas par cas : 15 Metadata, 17 Paraphrase, 38 Domain collision, 2 Scope/target,
  16 Workflow et 11 Benchmark. `COVERAGE` est une intention de mesure, pas un oracle d'appel ; le
  R@12 offline actuel mesure donc aussi une compatibilité historique et non la seule applicabilité.
- Gate produit : mini-banc 27/27 avec 340 545 tokens, 10 actions inutiles et 89 rounds. Palier B
  53/91, contre 43/91 en 10.4, avec 1 311 894 tokens, 118 actions inutiles et 317 rounds.
- Causes Palier B relues : 22 Retrieval, 6 Context, 3 Planning, 3 Model et 4 Benchmark. Lot en cours :
  fidéliser documents ouverts, jobs actifs et état structurel tronqué avant tout nouveau scoring.
- Convergence ciblée 62.3 : la réutilisation du verify déjà planifié réduit le run réussi de 20 à
  4 rounds, de 25 à 4 appels provider et de 9 à 1 action inutile. Prochaine gate : revue et validation
  du lot runtime, puis mini-banc de non-régression.
- Revue adverse : appliquer aussi la déduplication après conflit de révision. Dettes suivantes
  mesurables : borner un batch avant de dépasser 48 steps et restreindre la provenance des IDs aux
  références réellement retournées par le contrat, sans parcourir tout objet imbriqué.
- Gate final du lot convergence : mini-banc 27/27, 318 721 tokens, 81 rounds, 83 appels provider,
  6 actions inutiles. Palier B : 54/91, 1 535 423 tokens, 353 rounds, 388 appels provider et 188
  actions inutiles. Causes relues : 20 Retrieval, 2 Context, 3 Planning, 3 Model, 6 Benchmark,
  1 Execution et 2 Harness.
- Lot sécurité terminé : les batches dépassant 48 steps sont refusés avant insertion et seules les
  références top-level réellement retournées par une ressource deviennent fiables.
- Continuité des prérequis : les consommateurs textuellement pertinents jusqu'au top-12 peuvent
  désormais faire remonter leur producteur avec un score décroissant. Le retrieval offline reste
  stable (R@12 76,09 %, MRR 0,4536) et les scénarios settings ciblés passent 2/2. Gate complète :
  16 753 tests TypeScript et 195 tests Python verts.
- Prochain lot : distinguer génériquement découverte optionnelle et précondition obligatoire pour
  les fichiers ; `file.open` doit rester directement utilisable avec un chemin déjà résolu.
- Découverte de fichiers : `uses` décrit désormais une ressource utile mais non obligatoire.
  `files.list` et `files.search` retournent des chemins de projet et remontent avec `file.open`,
  sans bloquer un chemin déjà connu ni forcer un round après un simple listing. Offline : famille
  file 90,63 %, rang moyen 6,47 ; global R@12 75,85 %, la perte unique est un workflow réellement
  multi-action (`files.search` puis `node.setMeshMaterial`) jugé mono-action par l'oracle offline.
  Le run DeepSeek ciblé a été refusé par la garde d'exécution externe ; prochaine mesure produit :
  intégrer ces cas au prochain mini-lot autorisé.
- Métadonnée asset mesurée : la description canonique de `assets.counts` nomme désormais les six
  catégories réellement retournées. Le scénario 1.3 passe du rang 117 au rang 12. Le global reste
  à 75,85 % car l'action déplace au rang 13 `world.setSceneLighting` dans un cas historique qui
  demande d'abord de lire le skybox courant avant de le remplacer ; cette divergence est un biais
  de l'oracle mono-action, pas une incompatibilité produit.
- Cible document : le Context Router reconnaît désormais un document ouvert nommé sans confondre
  document actif et cible certaine. Une sélection nommée reste prioritaire. L'intention de
  navigation et la compatibilité de cible se renforcent seulement pour une cible document résolue.
  Offline : R@12 76,57 %, trois gains nets sans sortie du top-12 ; `document.activate` passe du
  rang 109 au rang 12 sur 2.7.
- Revue de la cible document : les titres et chemins ne deviennent une cible que pour une intention
  de navigation ; les types et workspaces restent des signaux structurels. Une cible document
  résolue et une intention compatible gagnent un point explicable, sans renforcer une sélection
  seulement active. Mesure finale : R@12 76,57 %, MRR 0,4524, trois entrées nettes dans le top-12
  et aucune sortie.
- Secours retrieval : le briefing borné autorisait `actions.find` et expliquait son appel, mais ne
  l'imprimait pas dans le Catalogue dont sa propre règle impose l'usage exclusif. L'action de
  contrôle est désormais visible séparément des douze candidats, sans charger son manuel ni
  modifier le top-K. Les tests du briefing tiennent les trois propriétés ensemble.

## Ce que tu ne tranches pas seul

- Aucun appel payant au banc sans accord explicite.
- Aucun nouveau prestataire, aucune dépendance et aucune seconde porte d’exécution.
- Aucun changement d’oracle du banc pour améliorer le score.
- Aucun push, tag ou merge dans `main`.

## Décisions

- L’autorité mission vit dans le main et son journal versionné survit au redémarrage dès la V1.
- Une action retrouvée `running` après crash n’est jamais rejouée automatiquement.
- Les scénarios A à D sont des intégrations réelles ; le dépôt n’a pas de harnais E2E.
- Les embeddings ActionIndex sont optionnels et SQLite reste un cache reconstructible.
