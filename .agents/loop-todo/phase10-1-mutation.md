# Rapport de mutation — Phase 10.1

Tests : `scripts/banc/playMission.test.ts` et `scripts/banc/studioIsolation.test.ts`.

| Mutation | Résultat |
|---|---|
| Ne plus conserver la réponse provider brute | MORD — 3/4 tests réussissent au lieu de 4/4 |
| Ne plus réinitialiser les modèles armés | MORD — 3/4 tests réussissent au lieu de 4/4 |
| Ne plus transmettre le scope projet | MORD — 3/4 tests réussissent au lieu de 4/4 |

Résultat : 3 mordent, 0 survivent, 0 verdict refusé. Le harnais a restauré chaque fichier à
l'octet près.
