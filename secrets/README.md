# secrets/

Ce dossier est **ignoré par git**. Il ne contient que des identifiants de développement.

| Variable | Rôle |
|---|---|
| `SCENARIO_API_KEY` | Clé API Scenario |
| `SCENARIO_API_SECRET` | Secret API Scenario |

## Comment ils sont utilisés

`secrets/.env` est lu **à l'exécution** par le process main, en développement seulement
(`app.isPackaged === false`). Il n'est jamais passé au bundler : injecter un secret à la
compilation le graverait dans `out/`, et un `.asar` se lit avec un éditeur de texte.

Ils servent de repli quand aucun identifiant n'a encore été saisi dans les réglages. Dès que
l'utilisateur en enregistre, ce sont ceux-là qui priment — chiffrés par le trousseau du
système via `safeStorage`.

Le renderer ne les voit jamais. Il demande « suis-je authentifié ? », pas « quelle est ma clé ? ».
