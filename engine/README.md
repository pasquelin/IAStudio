# Local AI Engine

Le moteur d'IA locale d'IA Studio : un processus Python supervisé par le processus principal
d'Electron, qui **mesure et exécute** — jamais un second ordonnanceur.

## Ce qu'il est aujourd'hui

Le socle et le tuyau. Le noyau se connecte, se présente, répond `hardware.info`, et rien d'autre.
Aucun worker, aucun modèle, aucun tenseur.

## Le partage des rôles

Le processus principal **décide** : admission mémoire, quelle porte libérer, arbitrage entre
portes. Le moteur **mesure et exécute** : sa file technique, l'état de ses workers, les octets
réellement résidents, le device employé. Il peut refuser pour ce qu'il est seul à voir ; il ne
replanifie jamais. C'est la raison pour laquelle le module s'appelle `core/jobqueue.py` et pas
`core/scheduler.py` — un fichier nommé « scheduler » finit par en devenir un.

## Le contrat

Socket unix (macOS, Linux) ou named pipe (Windows), cadres **NDJSON**, un objet JSON par ligne.
Le moteur parle en premier : `engine.hello` porte la version du protocole, et un désaccord tue le
processus plutôt que de le dégrader.

```jsonc
{"v": 1, "id": 42, "op": "hardware.info", "params": {}}   // requête
{"v": 1, "id": 42, "ok": {…}}                             // réponse
{"v": 1, "id": 42, "err": {"code": "…", "message": "…"}}  // refus
{"v": 1, "evt": "engine.hello", …}                        // événement
```

**Des chemins, jamais des octets.** Une génération écrit son résultat dans un fichier que le
principal contrôle, et le cadre porte le chemin.

## Autonomie

`engine/` **n'importe rien du dépôt à l'exécution**. Ce qu'il lui faut lui est passé par le
protocole. C'est la condition de son extraction future : le jour où elle se décide, c'est un
`git filter-repo --subdirectory-filter engine` et un workflow à déplacer.

## Développer

Le moteur est gardé par la porte du dépôt, sixième maillon :

```bash
pnpm engine:check        # ruff check + ruff format --check + pytest
```

À la main, depuis la racine du dépôt :

```bash
uv run --project engine ruff check engine
uv run --project engine ruff format engine
uv run --project engine pytest engine/tests
```

`uv` matérialise l'environnement seul ; aucun `pip install` n'est à lancer. Python 3.12 minimum.

## Angle mort connu

Le named pipe Windows n'a **jamais été exécuté** — aucune machine Windows n'a été mesurée. Node
sert le pipe nativement, et Python l'ouvre comme un fichier ; c'est écrit dans `_open_stream`, et
la spécification garde la question ouverte.
