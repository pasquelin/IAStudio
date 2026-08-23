# Local AI Engine

Le moteur d'IA locale d'IA Studio : un processus Python supervisé par le processus principal
d'Electron, qui **mesure et exécute** — jamais un second ordonnanceur.

## Ce qu'il est aujourd'hui

Le socle, le tuyau, et **cinq portes**, une par modalité. Le noyau se connecte, se présente,
répond `hardware.info`, et route vers un worker ce qu'il ne peut pas répondre lui-même —
`models.load`, `models.unload`, `generate`, `worker.status`. **C'est le principal qui nomme la
porte** sur chaque requête : lui seul sait quel modèle a été choisi pour quel emploi.

**Le noyau n'importe jamais torch.** Mesuré le 22/08 sur la chaîne complète : le noyau salue à
**33 ms**, le worker paie l'import une fois, et le modèle reste chaud entre deux générations.

## Les portes

Une porte est un **processus**, et c'est ce qu'un plan de libération peut tuer. Le noyau la
démarre à la première demande — une porte que personne n'a demandée est un processus qui n'a
jamais tourné — et lui parle par un `socketpair` hérité, dans le même NDJSON.

Ce qui diffère entre deux portes est une modalité et un nom : la boucle est écrite une fois
(`workers/door.py`), et les cinq modules qui la nomment font quatre lignes chacun.

| Porte | Modalité | Adapter | Backend |
|---|---|---|---|
| `engine/diffusion` | image | `RoutingAdapter` (diffusers, plugin au swap) | PyTorch (MPS, CUDA ou CPU, **rapporté** par run) |
| `engine/video` | vidéo | idem | idem |
| `engine/audio` | son | idem | idem |
| `engine/3d` | maillage | idem | idem |
| `engine/skybox` | panorama 360 | idem | idem |

Les familles hors diffusers (TripoSR, TRELLIS, TRELLIS.2, TripoSG, InstantMesh, LGM, MMAudio)
passent par `plugin_adapter.py`. TripoSR est vendu sous `vendor/tsr` (MIT, `weights_only=True`),
TripoSG sous `vendor/triposg`, InstantMesh sous `vendor/instantmesh` (Apache-2.0) et LGM sous
`vendor/lgm` (MIT). Tous sauf TripoSR et MMAudio demandent CUDA — sur Metal la carte le dit.
MMAudio tourne sur MPS. Extra `plugin`, pas dans `engine:check`.

**Deux extensions CUDA sont volontairement absentes, et ce n'est pas un oubli** : `nvdiffrast`
(licence NVIDIA non commerciale) et `diff_gaussian_rasterization` (Inria, non commerciale). Le
code vendu ne les atteint jamais — InstantMesh sort en couleurs de sommets plutôt qu'en carte de
texture, LGM écrit son nuage de gaussiens plutôt qu'un maillage. Les rétablir changerait la
licence de ce qui est distribué.

**Une op routée répond IMMÉDIATEMENT avec le job qu'elle a ouvert**, jamais avec son résultat :
un chargement lit des gigaoctets et une génération dure des secondes. Le résultat arrive en
`job.completed` ou `job.failed`.

## Ce que le moteur ne décide pas

Il **mesure et exécute**. Il peut refuser pour ce qu'il est seul à voir — aucun modèle chargé, un
dossier de poids qui porte du Python — et il ne **replanifie jamais**.

**Une garde à connaître** : l'adapter refuse un dossier de poids contenant un `.py`, **avant tout
import**. Mesuré le 22/08 : `trust_remote_code=False` ne protège PAS un dossier local dont
l'architecture est connue de Transformers — le `.py` s'exécute sans que rien ne soit demandé. Ce
qui protège vraiment est la liste de fichiers du manifeste, côté studio ; ceci est le second
verrou, et il nomme le fichier plutôt que de faire confiance à un drapeau.

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

**La porte n'installe JAMAIS le groupe `diffusion`** — elle téléchargerait 682 Mo pour être verte.
Les tests d'`engine/tests` sont écrits pour n'en avoir aucun besoin : ce qu'un vrai backend fait
est prouvé par une exécution de bout en bout, pas par la porte. Pour travailler sur un worker :

```bash
uv pip install --project engine --extra diffusion
```

## Angle mort connu

Le named pipe Windows n'a **jamais été exécuté** — aucune machine Windows n'a été mesurée. Node
sert le pipe nativement, et Python l'ouvre comme un fichier ; c'est écrit dans `_open_stream`, et
la spécification garde la question ouverte.
