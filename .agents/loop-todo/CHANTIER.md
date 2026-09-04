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
| 10.2 | Fiabilisation retrieval, continuité et scope structuré | en cours, campagne bloquée sans `EVAL_KEY` |

## Phase 10.2 — état mesuré

- Dilution supprimée : la requête lexicale ne contient plus l’état structurel sérialisé.
- Scope document/sélection transmis séparément au score ActionIndex.
- Relations `inputs` / `returns` et `requires` / `produces` distinctes ; résultats vides exclus de
  la continuité.
- Relecture imposée uniquement lorsqu’un input dépend d’un résultat encore inconnu ;
  `generator.prepare` puis `generator.submit` reste exécutable dans un seul batch.
- Revue adverse effectuée et défauts critiques corrigés.
- Verts : 35 tests ciblés, 46 tests socket/watcher hors sandbox, typecheck, lint, format, tailles,
  knip, 195 tests Python.
- Non conclusif : catalogue TypeScript complet interrompu après blocage sans erreur affichée.
- Non exécuté : campagne DeepSeek 27 runs, clé absente de l’environnement.

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
