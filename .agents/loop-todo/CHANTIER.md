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
| 10.5G | Contrats métier `reads` / `writes` / `effects` | audit terminé, arbitrage Context Router requis |

## État mesuré actuel

- HEAD valide : `18c6bdd63`.
- Référence Mission Runtime : 27/27 sur le mini-banc Phase 10.3.
- Retrieval offline : 414 cas, R@12 76,09 %, MRR 0,4538, 99 actions attendues hors top-12.
- Palier B historique : 43/91 ; ne pas le relancer avant un gain offline significatif.
- Causes restantes : Metadata 35, Paraphrase 16, Domain collision 43, Workflow 4, Benchmark 1.
- Verts : 16 745 tests TypeScript, 195 tests Python, `pnpm validate`.
- Expériences rejetées : descriptions françaises globales, poids des options, hausse globale ou
  canonique du poids d'intention. Elles dégradent des familles sans gain net.
- Audit 10.5G : les contrats métier sont justifiés, mais ne peuvent reranker la recherche initiale
  sans signal structuré de ressource/effet produit par le Context Router.

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
