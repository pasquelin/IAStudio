# ADR-14 — Portée de la validation continue

- **Statut** : Accepté — amende le cadrage initial
- **Date** : 2026-08-08

## Contexte

Le cahier de mission pose « aucun test automatisé ». C’est inexact : le dépôt a une suite vitest
à deux projets (node et jsdom), et `pnpm validate` enchaîne typecheck, lint, vérification de
format et tests **avec couverture**.

> **Au 2026-08-12, la suite compte TROIS projets** : `node`, `renderer` (jsdom) et
> `renderer-node`, ce dernier prenant les tests du rendu qui ne touchent aucun navigateur — 25 à
> 30 % de CPU en moins sur la suite entière. La décision de cette ADR n’en est pas affectée :
> ce qu’elle tranche est **ce que la CI exécute**, pas comment la suite se répartit. La phrase
> ci-dessus reste telle qu’elle a été écrite le 2026-08-08, comme tout contexte d’ADR.

La couverture est configurée en **budgets absolus négatifs** par glob — un nombre maximal
d’instructions et de branches non couvertes, non un pourcentage. Ces seuils sont sensibles à
tout ce qui fait varier les chemins exécutés, y compris la plateforme : du code gardé par
`process.platform` n’est pas couvert de la même façon sur Linux et sur macOS. Un `validate` vert
sur le poste peut donc rougir sur un runner Linux, pour une raison qui n’apprend rien.

## Décision

- **`ci.yml` lance `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`**
  — `test`, pas `test:coverage`.
- **`pnpm validate`, budgets de couverture compris, reste la porte du poste de développement**,
  imposée par la Definition of done de `CLAUDE.md` avant tout commit.

## Alternatives écartées

- **`pnpm validate` en CI** : ferait échouer des PR sur une variation de couverture propre à la
  plateforme, sans rapport avec le changement soumis. Un signal rouge qu’on apprend à ignorer ne
  vaut pas mieux qu’aucun signal.
- **Convertir les budgets en pourcentages** : refonte de la politique de couverture du projet,
  hors périmètre de ce pipeline, et perte de ce que les budgets absolus apportent — ils font
  baisser la dette au lieu de la maintenir.
- **Ne pas lancer les tests en CI** : la suite est la meilleure protection dont dispose le dépôt.

## Conséquences

- Une PR peut passer la CI alors que `pnpm validate` échouerait localement, sur le seul critère
  de couverture. C’est délibéré : la couverture est un budget de dette, pas un critère
  d’intégration.
- La Definition of done du projet n’est pas assouplie — `ci.yml` en couvre une partie, il ne la
  remplace pas.
- Ajouter du code au processus principal (`src/main/updater.ts`, par exemple) impose d’ajuster
  les budgets du glob concerné dans `vitest.config.ts`, sur le poste, avant de committer.
