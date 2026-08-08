# secrets/

Ce dossier est **ignoré par git**. Il ne contient que des identifiants de développement.

| Variable | Rôle |
|---|---|
| `SCENARIO_API_KEY` | Clé API Scenario |
| `SCENARIO_API_SECRET` | Secret API Scenario |
| `SCENARIO_ACCOUNT_NAME` | Nom du compte de développement dans le sélecteur. Optionnel — « Development » par défaut |
| `APPLE_ID` | Identifiant Apple Developer, pour la notarisation macOS |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mot de passe d'application dédié, créé sur appleid.apple.com |
| `APPLE_TEAM_ID` | Identifiant d'équipe Apple Developer |

## Les trois variables Apple ne servent qu'au packaging

Jamais à l'exécution. `scripts/dist.sh` charge ce fichier avant d'appeler electron-builder,
qui les lit dans l'environnement.

Laissées **vides**, electron-builder saute la signature et la notarisation en le journalisant,
et `pnpm dist` aboutit quand même : l'application produite n'est simplement pas signée, et
Gatekeeper le signalera à la première ouverture. Les renseigner suffit à activer la chaîne
complète — aucun code à changer.

## Comment ils sont utilisés

`secrets/.env` est lu **à l'exécution** par le process main, en développement seulement
(`app.isPackaged === false`). Il n'est jamais passé au bundler : injecter un secret à la
compilation le graverait dans `out/`, et un `.asar` se lit avec un éditeur de texte.

Ils forment un **compte à part entière** — celui d'un dépôt fraîchement cloné. Il apparaît
dans la liste des comptes et dans le sélecteur du header, en tête, et il est actif tant
qu'aucun autre n'a été choisi. Les comptes saisis dans les réglages viennent à côté, pas à la
place : basculer de l'un à l'autre est un clic, et le choix est retenu d'un lancement à l'autre.

Ce compte est en **lecture seule** : il ne se renomme et ne se supprime pas depuis l'application,
puisque ce fichier est ce qui le décrit. Il n'entre **jamais** dans le trousseau — modifier
`secrets/.env` suffit à le changer, et l'effacer le fait disparaître sans rien laisser derrière.

Le renderer ne les voit jamais. Il demande « suis-je authentifié ? », pas « quelle est ma clé ? ».
