# Scenario Studio — architecture

Comment le studio est bâti, et pourquoi il l’est ainsi. Écrit pour qui reprend le code. Vous
cherchez plutôt comment *s’en servir* ? Voir [guide-utilisateur.md](guide-utilisateur.md).

> 🇬🇧 This document is also available [in English](../en/architecture.md).

---

## Sommaire

1. [La forme générale](#la-forme-générale)
2. [Six invariants](#six-invariants)
3. [Traverser la frontière des processus](#traverser-la-frontière-des-processus)
4. [Le processus principal](#le-processus-principal)
5. [Le renderer](#le-renderer)
6. [Les moteurs](#les-moteurs)
7. [Une génération, de bout en bout](#une-génération-de-bout-en-bout)
8. [Projets et catalogue](#projets-et-catalogue)
9. [Le design system](#le-design-system)
10. [Internationalisation](#internationalisation)
11. [La configuration](#la-configuration)
12. [Les tests](#les-tests)
13. [Ajouter quelque chose](#ajouter-quelque-chose)
14. [Livrer une version](#livrer-une-version)

---

## La forme générale

Electron, trois cibles, un dépôt.

```
        ┌─────────────────────────────────────────────┐
        │  processus principal   Node, tous droits    │
        │                                             │
        │  · identifiants API, chiffrés par l'OS      │
        │  · client SDK Scenario                      │
        │  · JobManager — le seul qui poll            │
        │  · ModelRegistry — schémas → descripteurs   │
        │  · catalogue SQLite, dossiers de projet     │
        │  · menu natif, fenêtres, protocoles         │
        └───────────────────┬─────────────────────────┘
                            │  ipcMain.handle / webContents.send
        ┌───────────────────┴─────────────────────────┐
        │  preload             le pont, et rien d'autre│
        │  contextBridge.exposeInMainWorld             │
        └───────────────────┬─────────────────────────┘
                            │  window.studio, typé
        ┌───────────────────┴─────────────────────────┐
        │  renderer     bac à sable, ni Node ni fs    │
        │                                             │
        │  · shell React 19 — rails, zones, docks     │
        │  · moteurs : canvas, scène, timeline, audio │
        │  · stores zustand, TanStack Query           │
        └─────────────────────────────────────────────┘
```

`contextIsolation` et `sandbox` sont actifs et le restent. Le renderer n’a ni `fs`, ni
`child_process`, ni `nodeIntegration`. La navigation est verrouillée au niveau `app`, et
`openExternal` ne laisse passer que `https:`.

---

## Six invariants

Ils gouvernent tout. En enfreindre un casse le projet dans ce qu’il a de défendable.

### 1. Le renderer ne voit jamais de secret

La clé et le secret vivent dans le processus principal, chiffrés par l’OS via le `safeStorage`
d’Electron. Le renderer demande « suis-je authentifié ? » — **jamais** « quelle est ma clé ? ».

### 2. Toute frontière passe par `shared/ipc.ts`

Typé des deux côtés. Aucun `ipcRenderer.invoke('un-truc')` dans un composant. `shared/` n’a
**aucune dépendance runtime** — types et constantes uniquement, ce qui permet aux deux processus
de l’importer.

`main/ipc/handle.ts` dérive la signature de chaque handler du canal lui-même : un handler qui ne
respecte pas son contrat déclaré ne compile pas.

### 3. Un moteur est recréable depuis son état, jamais depuis son DOM

`CanvasEngine`, `SceneRenderer`, `TimelineEngine` se reconstruisent intégralement depuis leur
état sérialisé.

La raison est concrète : un contexte WebGL ne survit pas au déplacement entre documents, et
détacher un panneau dans une autre fenêtre l’exige. Le save/load et l’undo deviennent fiables
gratuitement.

### 4. Les moteurs ignorent React ; React les pilote

`engines/` ne contient **aucun import React**. Les composants lisent l’état et appellent des
méthodes ; ils ne détiennent pas la scène.

### 5. Aucun formulaire de génération écrit à la main

Les entrées de `POST /generate/custom/{modelId}` sont **propres à chaque modèle** et se
découvrent via `GET /models/{modelId}`. Le `ModelRegistry` les traduit en `FieldDescriptor[]`,
et `<DynamicForm/>` les rend.

Coder un formulaire en dur pour un modèle donné est un bug, pas un raccourci. Un `kind` inconnu
retombe en saisie brute — jamais un formulaire qui disparaît.

### 6. Le thread UI ne fait que de l’UI

Toute opération susceptible de dépasser 16 ms part ailleurs, dans cet ordre de réflexe :

1. **GPU** — filtres, blend, normal map, AO, redimensionnement.
2. **Web Worker** — vignettes, formes d’onde, BVH, parsing de gros GLB.
3. **OffscreenCanvas + Worker** — rendus hors écran.
4. **`utilityProcess`** — ffmpeg, indexation, hachage, transferts.

Toute tâche longue est **annulable**, **rapporte sa progression**, et tourne dans un pool borné à
`hardwareConcurrency − 2`.

`better-sqlite3` est synchrone : une requête lourde dans le processus principal bloque toutes les
fenêtres, donc les requêtes de catalogue non triviales passent par `worker_threads`.

Deux fils existent précisément pour cela. `main/project/catalog-worker.ts` détient la base et
répond à une boucle de messages : une recherche parmi des milliers d’assets ne gèle plus aucune
fenêtre. `renderer/src/engines/audio/audio.worker.ts` sort la chaîne sonore du thread de la
fenêtre, les buffers d’échantillons étant **transférés** plutôt que copiés. Les deux ne sont que
de la tuyauterie : le catalogue, le dispatch et l’arithmétique audio se testent seuls, sans
worker.

**Et un processus, pour la reconnaissance vocale.** `main/dictation/stt-worker.ts` tient Parakeet
— six cents millions de paramètres, 640 Mo de poids — dans un `utilityProcess` à lui. Un thread
n'aurait pas suffi : il partage le heap et le cycle de vie de son processus, donc les 700 Mo
resteraient dans l'empreinte du principal et un plantage de l'addon natif emporterait le studio.
Ce qui décide quoi que ce soit — le tampon, la file, la machine à états — vit à côté et se teste
sans lui. Voir [`docs/stt/`](stt/00-architecture.md) et
[`ADR-17`](ci/adr/ADR-17-moteur-de-dictee-hors-processus.md).

---

## Traverser la frontière des processus

`src/shared/ipc.ts` déclare les canaux en types littéraux et la forme du `StudioBridge`. Les deux
côtés l’importent ; aucun ne peut dériver.

```
renderer                    preload                  main
────────                    ───────                  ────
getBridge()          →  window.studio         →  ipcMain.handle(CHANNELS.x)
  .scenario                 exposeInMainWorld       handler dérivé du canal
  .searchModels(q)          contextBridge           renvoie des données typées
```

Soixante canaux sont déclarés, en quatre familles :

| Famille | Ce qu’elle porte |
|---|---|
| `window:*` | état de fenêtre, plein écran |
| `settings:*` | lecture, écriture, identifiants, état d’authentification |
| `scenario:*` | recherche de modèles, description, génération, contrôle des jobs |
| `project:*` / `assets:*` | cycle de vie du projet, requêtes de catalogue, ingestion |

Dix d’entre eux vont dans l’autre sens — le main poussant vers le renderer : progression des jobs
et des imports, lignes de journal, changements de projet et de réglages, état de fenêtre, et le
menu natif qui demande à l’UI d’ouvrir un outil ou une section de réglages, d’exécuter une
commande, ou de déposer un nœud dans la scène.

Les fichiers locaux sont servis au renderer par un protocole `scenario://`. L’URL est dérivée de
l’identifiant de l’asset : une grille de vignettes ne coûte donc aucun IPC — et le renderer ne
manipule toujours aucun chemin de fichier.

---

## Le processus principal

```
src/main/
├── scenario/
│   ├── client.ts            le client @scenario-labs/sdk, bâti sur les identifiants stockés
│   ├── credentials.ts       lecture, validation, état d'authentification
│   ├── model-registry.ts    GET /models/{id} → FieldDescriptor[]
│   ├── model-catalog.ts     listing paginé des modèles, mis en cache
│   ├── job-manager.ts       la file, la concurrence, le polling
│   ├── runner.ts            ce qui appelle réellement generate
│   ├── schema.ts            traduction de schéma et déduction de famille
│   ├── retry.ts             le backoff exponentiel, sorti du JobManager et partagé
│   ├── asset-catalog.ts     la bibliothèque distante, lue et paginée
│   ├── asset-normalizer.ts  un asset de l'API ramené à la forme du studio
│   ├── owner-scope.ts       à quel projet la clé active donne accès
│   ├── filter-expression.ts la recherche traduite pour l'API
│   ├── limits.ts            les tailles de lot que l'API impose
│   ├── prompt-assist.ts     variantes, traduction, lecture de style
│   ├── assist-queue.ts      la file bornée de l'assistance de fond
│   ├── uploader.ts          l'envoi d'un fichier vers la bibliothèque
│   └── handlers.ts          les canaux scenario:*
├── project/
│   ├── store.ts             créer et ouvrir un dossier de projet, lire/écrire le manifeste
│   ├── catalog.ts           l'index SQLite des assets
│   ├── catalog-thread.ts    le worker qui le porte, et son protocole
│   ├── activity-log.ts      ce que le studio a fait et raté
│   ├── documents.ts         l'écriture atomique d'un document
│   ├── sqlite.ts            le port SqliteDriver
│   ├── sqlite-native.ts     better-sqlite3 — production
│   └── sqlite-memory.ts     node:sqlite — tests
├── assets/
│   ├── local-backend.ts     les assets du projet, sur le disque
│   ├── cloud-backend.ts     les mêmes, du côté de la bibliothèque
│   ├── sync-plan.ts         ce que deux côtés devraient faire l'un de l'autre
│   ├── collector.ts         ce qu'une génération dépose dans le projet
│   ├── auto-caption.ts      nommer une image d'après ce que l'API y voit
│   └── protocol.ts          le protocole scenario://
├── settings/                le store chiffré, son adaptateur, ses handlers
├── diagnostics/             le canal par lequel le renderer signale un échec
├── media/                   importer un fichier : sonde, hachage, proxy, forme d'onde
├── fonts/                   les polices embarquées et celles du système
├── menu/                    le menu natif, bâti depuis les registres partagés
├── update/                  la vérification de mise à jour
└── window/                  cycle de vie et verrouillage de la navigation
```

### Le JobManager est le seul à poller

Le `job.wait()` du SDK ne rapporte aucune progression et plafonne à 120 secondes — inutilisable
pour une barre de progression, inutilisable pour une génération vidéo. Le `JobManager` poll donc
`jobs.retrieve` lui-même — deux secondes étant le **plancher** et non la cadence, voir plus bas —
et pousse la progression au renderer par
`evt:job-progress`.

**Poller ailleurs est un bug.** Le manager détient aussi la concurrence (trois par défaut,
réglable) et le backoff exponentiel sur 429 et 5xx — aucun seuil de débit n’est publié, donc
aucun n’est supposé. Contourner la file par un appel direct au SDK, c’est ainsi qu’on récolte une
rafale de 429.

### Deux backends d’assets, un seul planificateur

Le projet et la bibliothèque du compte sont deux stocks, servis par deux backends de même forme :
`local-backend.ts` pour le dossier sur le disque, `cloud-backend.ts` pour l’API. Ce qui décide de
ce qui devrait bouger entre les deux est ailleurs, et **pur** : `sync-plan.ts`.

Cette séparation porte deux promesses :

- **un plan peut être montré avant de coûter une requête** — « 12 à envoyer, 3 à rapatrier » se
  calcule sans rien transférer ;
- **la synchronisation bidirectionnelle reste une politique, pas une réécriture.** `planSync` gère
  déjà `two-way`, testée, bien que le studio ne demande jamais que `push` ou `pull` depuis une
  sélection explicite. C’est la comparaison pour laquelle les trois horodatages ont été
  enregistrés ; l’écrire plus tard, c’est la greffer.

Trois horodatages, lus l’un contre l’autre : `remoteSyncedAt` sert de référence, `localChangedAt`
et `remoteUpdatedAt` disent qui a bougé depuis. Ils sont **analysés, pas comparés comme du
texte** — un décalage horaire au lieu d’un `Z` donnerait silencieusement la mauvaise réponse. Une
date illisible compte comme « n’a pas bougé » : refuser d’agir sur une date que personne ne
comprend vaut mieux qu’écraser un fichier sur sa foi.

Côté renderer, le badge d’une vignette est **dérivé** par `assetBadgeOf` et jamais stocké : il
dépend du compte actif, et une clé API ouvre sur un projet et un seul. Le stocker obligerait à
réécrire chaque ligne à chaque changement de clé — et à montrer une réponse périmée entre les
deux.

### Le journal d’activité

`project/activity-log.ts` tient le compte de ce que le studio a fait et raté. Trois décisions y
sont figées, et chacune répond à un défaut précis :

- **`record` rend la main immédiatement.** Il est appelé depuis des chemins d’échec : un journal
  qui ferait attendre ses appelants mettrait le disque sur le chemin critique de chaque erreur.
- **Les lignes sont écrites par lots** (`ACTIVITY_FLUSH_MS`, 200 ms), assez court pour qu’un échec
  reste immédiat à l’œil.
- **Le catalogue est relu à chaque vidage, jamais retenu.** Un projet peut être fermé et un autre
  ouvert pendant que des lignes attendent encore dans la file.

### L’import de médias

Importer un fichier est un pipeline à étapes nommées — `probe`, `hash`, `proxy`, `peaks` —
chacune rapportant un ratio sur l’import *entier*, pas sur elle-même : une barre de progression
veut donc dire la même chose à toutes les étapes. Il est annulable à tout moment : le proxy d’un
rush de vingt minutes doit pouvoir s’arrêter sur demande.

`ffprobe` lit ce que le fichier est réellement ; le codec décide de la suite. Ce que WebCodecs
décode nativement se lit directement, le reste reçoit un proxy — les deux orthographes de chaque
codec sont reconnues (`h264` et `avc1`, `av1` et `av01`), parce qu’une sonde lue par la mauvaise
réclame un proxy dont personne n’a besoin.

ffmpeg est résolu à l’exécution et peut être absent. Dans ce cas l’import fonctionne quand même —
on perd le proxy et la forme d’onde, et l’interface sait exactement quelle partie est
indisponible plutôt que d’échouer opaquement.

### SQLite derrière un port

`catalog.ts` parle à une interface `SqliteDriver`, pas à une bibliothèque. La production branche
`better-sqlite3` ; les tests branchent le `node:sqlite` intégré. Un test qui importe
`better-sqlite3` directement est un test qui échouera bizarrement — branchez le port.

`pnpm rebuild:native` est obligatoire après toute montée d’Electron, sinon le module natif refuse
de se charger.

---

## Le renderer

```
src/renderer/src/
├── app/          le shell
│   ├── Shell.tsx        rails, zones, poignées, espace des documents
│   ├── Rail.tsx         les bandes d'icônes
│   ├── ToolWindow.tsx   un outil ancré, mémoïsé
│   ├── DocumentArea.tsx Dockview, documents uniquement
│   ├── TitleBar.tsx     espaces de travail, feux natifs
│   └── documents.tsx    quel éditeur rend quel type de document
├── design/       le design system maison — voir plus bas
├── engines/      canvas, scène, timeline, audio, viewport, skybox, texture, et l'historique partagé
├── spaces/       un éditeur par type de document
│   ├── image/      le canvas Pixi et ses outils
│   ├── three/      la vue three.js et ses outils
│   ├── video/      la timeline, le moniteur, ses outils
│   └── audio/      la forme d'onde, ses outils, le décodeur
├── panels/       les outils ancrables
├── stores/       zustand : documents, tools, layouts, models, assets, jobs, settings, keymap
├── hooks/        raccourcis, menu natif, densité, état de fenêtre, debounce…
├── helpers/      fonctions pures, toutes testées
└── services/     l'accès au pont et la traduction des échecs
```

### Le premier écran

**Tout ce qu’un import statique atteint depuis `main.tsx` est dans le morceau que l’écran de
démarrage attend.** C’est la seule règle, et elle décide de ce que coûte l’ouverture d’une fenêtre
vide. Le splash lui-même a son entrée à part, précisément pour ne jamais tirer ce bundle.

Sept choses en sont tenues dehors, chacune parce qu’une session ordinaire ne les ouvre pas toutes :

| Ce qui est chargé à la demande | Pourquoi |
|---|---|
| Les **sept éditeurs** | une session en ouvre un ou deux ; les sept pèsent cinq mégaoctets |
| Les **quinze panneaux** | un espace en montre trois ou quatre, jamais les quinze |
| Le **formulaire de génération**, et zod, `react-hook-form`, `@hookform/resolvers` avec lui | on ouvre un générateur, on n’arrive pas dessus |
| La fenêtre des **Réglages** — son registre, ses sections, son brouillon | une cinquantaine de kilooctets d’une autre fenêtre |
| La fenêtre des **Licences** | le texte intégral de chaque licence embarquée, que personne ne lit dans une session ordinaire |
| La fenêtre de **Consommation** | pour une raison plus dure que sa taille : la bibliothèque de graphiques |
| Le **parseur de polices** (`opentype.js`) | seul le texte en volume et les légendes en ont besoin |

**Un `lazy()` qui échoue ne se rattrape pas par un réessai** : React met le rejet en cache, si
bien que le bouton « Réessayer » de la frontière d’erreur ne peut pas gagner sur ces routes. La
frontière est au-dessus des routes — celles des panneaux couvrent les docks, pas le shell qui les
tient — et elle n’attrape que les rendus : ni les gestionnaires d’événements, ni les promesses
rejetées, ni l’évaluation de `main.tsx` lui-même, dont un jet précède la frontière et laisse une
fenêtre vide qu’aucun React ne voit.

**Un test tient les sept lignes**, `eager-graph.test.ts` : il marche le graphe des imports
statiques depuis `main.tsx` et échoue si l’un d’eux réapparaît. Sans lui, un `import` ajouté sans
y penser défait le gain sans rien casser de visible — le pire des régressions, celle qui ne se
voit qu’au chronomètre.

**Les panneaux sont sortis à leur tour**, et c’est ce qui a rétréci la liste des voisins.
`app/tool-components.ts` les importait tous d’un coup ; il déclare désormais, par panneau, **le
module à charger et ce que son en-tête fait** — cette seconde moitié est nécessaire, parce que la
ligne de titre se dispose au premier rendu et qu’un séparateur qui arriverait une frame plus tard
décalerait une rangée déjà à l’écran. Mesuré sur le même commit des deux côtés, préchargés
comptés, sans sourcemaps : **2 331 395 → 2 081 385 octets, −250 010, soit −10,7 %.**

> **Un glob sur le dossier supprimerait la copie du nom de chaque panneau, et il a été écrit puis
> retiré.** `eager-graph.test.ts` marche les imports **statiques** : un glob lui est invisible, et
> la garde qui surveille précisément cette propriété serait restée verte quoi que le glob fasse au
> chunk d’entrée. La copie reste, et `tool-components.test.ts` la tient — un `layers` qui
> nommerait le module des mailles échangerait les deux en silence.

**Il reste deux voisins**, et aucun n’est un éditeur : ce sont des helpers que quelque chose du
premier écran va chercher à côté d’un éditeur. Ils étaient six ; **quatre sont partis avec les
panneaux**, puisqu’ils entraient par un panneau et non par le shell. Le test en fait un
**budget** : la liste peut rétrécir, jamais grandir. Une troisième entrée veut dire que le premier
écran est allé chercher plus loin que nécessaire.

**Le graphe est le seul espace dont le lecteur n’est pas derrière son éditeur** : `document-io.ts`
parse un graphe comme il parse les autres genres, donc `engines/graph/serialize.ts` entre. Le
moteur de mutation et le canvas, eux, restent dehors — `@xyflow/react` n’est jamais dans le chunk
d’entrée. C’était deux modules de plus jusqu’à ce que l’id de nœud réservé descende dans
`shared/domain/graph.ts` : un prédicat atteint depuis le lecteur tirait `mutations.ts`, qui tirait
`connect.ts` et `handles.ts` — la moitié du moteur, pour une comparaison de chaînes.

**Il vise des dossiers, pas des fichiers.** Une garde posée sur quatre fichiers du dossier des
réglages laisse entrer le cinquième ; c’est ce qui a été corrigé en même temps que les réglages
eux-mêmes.

Les six éditeurs sont chargés à l’ouverture d’un document de leur type, jamais avant : celui
qu’une session ouvre coûte quelques centaines de millisecondes qu’elle allait dépenser de toute
façon.

### Le shell

Dockview tient le centre et **uniquement** le centre : les documents et leurs onglets. Les
fenêtres d’outil sont posées sur la gouttière du châssis par le shell lui-même, parce que leur
comportement — un rail qui bascule entre elles, des moitiés qui coupent une zone — n’est pas ce
qu’une bibliothèque de docking modélise.

Les fenêtres d’outil sont mémoïsées : un glissement de zone écrit une nouvelle taille à chaque
`pointermove`, et sans cela chaque frame re-rend les deux moitiés et tout ce qu’elles
contiennent, y compris une grille d’assets virtualisée. Leurs callbacks sont maintenus stables
pour que cette mémoïsation morde.

### Des registres, pas des listes

`shared/domain/tool.ts` déclare où vit chaque outil et quels espaces il sert.
`shared/domain/workspace.ts` déclare les espaces. Le renderer les enrichit d’icônes et de
composants ; le **menu natif lit les mêmes tables**. Déclarer un septième espace tient en une
entrée, et le compilateur réclame ensuite son icône et sa famille.

C’est pourquoi le registre d’outils vit dans `shared/` et non dans le renderer : le processus
principal a besoin de `{ id, zone, slot, workspaces }` pour ne proposer que ce que la section peut
ouvrir, et le dupliquer dégraderait `ToolId` en `string`.

Un outil peut déclarer **plusieurs placements**, pour des ensembles d’espaces disjoints —
l’étagère est dans la bande basse presque partout, et dans la colonne de droite en Vidéo et en
Audio, où le montage possède la bande. `tool.test.ts` verrouille les deux invariants qui rendent cela lisible :
les espaces de deux placements ne se recouvrent jamais, et les placements d’un même outil partagent
leur moitié — un outil qui changerait de moitié en même temps que de zone atterrirait dans une
autre rangée du rail selon l’endroit d’où l’on vient.

**L’ordre de `TOOL_PLACEMENTS` est celui du rail**, et c’est aussi lui qui désigne le panneau par
défaut ci-dessous — un test l’épingle espace par espace.

**Deux règles échappent au registre**, et deux seulement, parce qu’elles dépendent de l’état ou de
l’espace, quand `shared/` n’a aucune dépendance runtime. D’où une couche au-dessus, dans
`helpers/tool-registry.ts`, plutôt qu’à l’intérieur :

- le générateur n’est offert que là où un modèle est choisi ou préféré ;
- une moitié que personne n’a choisie affiche le **premier panneau que l’espace y déclare**. Elle
  vaut `null` dans le store — clé absente, la moitié est fermée ; un identifiant, c’est un choix de
  l’utilisateur. La disposition est retenue une fois pour les six espaces alors que ce premier
  panneau diffère dans chacun : y inscrire un identifiant imposerait la réponse d’un espace aux
  cinq autres. `shownTool` distingue les trois cas, et la migration vers la version 8 repose au
  défaut toute disposition antérieure, moitié par moitié.

---

## Les moteurs

Six, aucun React à l’intérieur d’aucun.

| Moteur | Adossé à | Détient |
|---|---|---|
| `CanvasEngine` | PixiJS 8.19 | le document image : calques, formes, tracés |
| `SceneRenderer` | three.js 0.185 | la scène 3D : maillages, lumières, gizmos, caméra |
| `TimelineEngine` | mediabunny + Canvas | la séquence : clips, lecture, formes d’onde, vignettes |
| `engines/audio` | tableaux d’échantillons | l’édition sonore : rogner, fondus, gain, normaliser, silences |
| `SkyboxRenderer` | `ViewportEngine` | le ciel vu de l’intérieur : soleil, étalonnage, sondes |
| `TextureRenderer` | `ViewportEngine` | la matière posée sur une forme : canaux PBR, environnement, tiling |

Les trois qui montrent de la 3D partagent `engines/viewport/` — canevas, caméra, orbite,
redimensionnement, boucle à la demande, éclairage par image. Chacun écrivant le sien, c’était
trois chances de ne pas être d’accord sur un redimensionnement ou une libération.

Celui du son est une paire de modules plutôt qu’une classe — `audio-data.ts` fait le travail sur
les échantillons, `edits.ts` tient un `AudioEditState` rejouable depuis le fichier source. Même
invariant que les trois autres : l’édition est l’état, jamais le buffer en mémoire.

Chacun va de pair avec un module d’état pur (`canvas-state.ts`, `scene-state.ts`,
`timeline-state.ts`) et un module de commandes. Les commandes sont la seule voie par laquelle
l’état change, ce qui fait de l’undo un mécanisme générique dans `engines/core/history.ts` plutôt
que trois mécaniques sur mesure.

**La provenance d’une commande se déclare ; elle ne se devine pas.** Un geste ouvert — un curseur
tenu, un glissement en cours — fusionne les commandes qui arrivent pendant qu’il dure, ce qui est
tout son intérêt. Mais **une commande venue d’ailleurs** — une génération qui aboutit, un
double-clic, un dépôt — n’appartient pas au curseur qu’un panneau tient peut-être, et fusionnée
dedans elle fait disparaître une entrée d’undo. Elle passe donc par `runOutsideGesture` plutôt que
par `runCommand`. **Le store ne peut pas déduire cette différence** : aucune règle sur
`command.id` ne dit d’où vient l’écriture, et deviner à partir de la première commande d’un geste
déplace la fenêtre de course au lieu de la fermer — un champ ouvre son geste **au focus**, sans
aucune commande. Un seul appelant est concerné aujourd’hui, `setSkyboxSource`, qui sert les trois
chemins d’entrée d’une image dans un ciel.

`node-factory.ts`, `mesh-primitives.ts`, `light-types.ts` et `three-factory.ts` gardent la
*description* d’un nœud séparée de son instanciation three.js — une scène se sérialise donc sans
traîner le moteur de rendu avec elle, et se reconstruit depuis cette seule sérialisation.

La lecture passe par un jeton unique détenu par le `PlaybackManager` : deux lecteurs actifs, et
le scrubbing se met à saccader sans raison visible.

---

## Une génération, de bout en bout

```
1. l'utilisateur choisit un modèle   panneau Modèles → stores/models
2. le renderer demande son schéma    scenario:describe-model
3. le main le récupère               GET /models/{id}
4. le ModelRegistry traduit          schéma JSON → FieldDescriptor[]
5. DynamicForm le rend               react-hook-form + un schéma zod bâti sur les descripteurs
5b. le prix s'affiche                scenario:estimate-cost → POST ?dryRun=true → 200 (402 en repli)
6. soumission                        scenario:generate
7. le JobManager met en file         concurrence bornée
8. il poll                           jobs.retrieve — 2 s est le PLANCHER, pas la cadence
9. la progression remonte            evt:job-progress → ligne d'état
10. succès                           metadata.assetIds → téléchargés dans le projet
11. le catalogue l'enregistre        SQLite → l'asset paraît dans l'étagère
```

Les étapes 3 et 4 sont la raison d’être de l’invariant 5. Les entrées d’un modèle lui
appartiennent ; un formulaire écrit à la main est juste pour exactement un modèle, exactement un
jour.

Un `kind` de champ inconnu se rend en saisie brute plutôt que de faire échouer le descripteur —
un formulaire de génération qui perd un champ en silence est pire qu’un formulaire laid.

**L’étape 8 ralentit quand la charge monte, et c’est ce qui la rend sûre.** L’intervalle est
`max(plancher, ceil(jobs_en_cours × 60 000 ÷ POLL_REQUESTS_PER_MINUTE))` : deux secondes est ce
qu’obtiennent une ou deux générations, pas une cadence fixe. À cadence fixe, quatre générations
simultanées demandent 120 requêtes par minute contre les cent que l’API accorde — le limiteur
retient alors chaque poll, le SDK réessaie, et **une génération qui tourne et qui est facturée est
rapportée comme un échec de débit au bout de quinze secondes**. Le budget lui-même est *dérivé*
des constantes de `rate-limiter.ts` et non écrit en clair, précisément pour qu’il ne devienne pas
faux en silence le jour où l’une d’elles bouge.

**L’étape 5b lit un prix dans deux formes de réponse, parce que la référence et le serveur ne
disent pas la même chose.** Un `?dryRun=true` ne crée aucun job et ne dépense rien. La référence
documente un **402** portant `estimatedCost` ; le serveur, observé sur les deux endpoints, répond
**200** avec `creativeUnitsCost` à côté d’un `job` vide. `main/scenario/cost.ts` lit les deux, le
200 d’abord, le 402 en repli — un 500 ou un réseau mort remonte comme n’importe quelle panne,
jusqu’au journal.

> **C’est en ne lisant que le 402 documenté qu’aucun badge n’a jamais affiché de prix.** Le défaut
> était invisible par construction : un bouton sans chiffre se lit comme un modèle que l’API
> refuse de tarifer, exactement comme les trois autres cas qui donnent `null`. Il a fallu lancer
> une App pour de vrai pour le voir. **Devant une API, la référence dit ce qui était prévu, pas ce
> qui répond.**

Le port est une fonction, pas une méthode, parce que `generate.runModel` et `workflows.run`
tarifent un dry run de la même façon : lequel des deux est visé regarde la cible, pas le port.

Côté renderer, `useCostEstimate` débounce à 600 ms **et** garde un plancher entre deux envois,
dérivé de `INTERACTIVE_REQUESTS_PER_MINUTE` : un débounce seul n’a pas de plafond, seulement une
falaise — tapé plus lentement que son délai, chaque frappe part en requête. La même estimation
n’est pas achetée deux fois, et elle ne se réessaie pas.

**`DynamicForm` est chargé paresseusement**, et les trois fonctions qui appellent zod vivent dans
`helpers/dynamic-form-schema` séparément de `helpers/dynamic-form`. Les deux moitiés vont
ensemble : sans la seconde, `referencePictures` retenait zod dans le graphe eager. zod,
`react-hook-form` et `@hookform/resolvers` sont à **zéro** dans le chunk initial, qui passe de
2 030,50 à 1 810,88 kB — mesuré par décodage VLQ des sourcemaps, et verrouillé par des tests qui
lisent la source. C’est un cas particulier de la règle du [premier écran](#le-premier-écran).

---

## Projets et catalogue

Un projet est un dossier. `project.json` en est le manifeste (version, nom, dates) ; le reste est
la structure que le studio crée à l’ouverture — l’arborescence est dans le
[manuel](manuel/04-projets.md).

Le **catalogue** est `.index/catalog.db`, un index SQLite de chaque asset : identifiant, nom,
type, emplacement, étiquettes, dates, et le chemin quand l’asset est local. Il existe pour que
l’étagère puisse chercher parmi des milliers d’éléments sans toucher au système de fichiers, et
pour qu’un projet reste transportable — supprimez `.index/` et il se reconstruit.

Un asset est soit `local` (un fichier du projet), soit `cloud` (encore uniquement chez Scenario).
Une image locale est servie au renderer sous la forme `scenario://<id>`.

Les **documents** sont des fichiers JSON dans `documents/`, un par document, nommé d’après son
identifiant — `<id>.scene`, `<id>.seq`. Le dossier fait foi : un fichier dont l’en-tête annonce un
type que son extension dément est refusé plutôt qu’ouvert dans le mauvais éditeur. L’écriture
passe par un fichier de transit puis un `rename`, atomique dans un même dossier, de sorte qu’une
coupure en cours d’écriture ne laisse jamais un document tronqué là où était le travail.

Le corps du fichier appartient à l’espace qui l’a écrit : le processus principal ne le lit pas, il
l’estampille et le rend tel quel. Un espace qui apprend à s’enregistrer n’a donc pas de canal à
lui. **Aujourd’hui la 3D et les Textures sont branchées** — cf. `docs/REPRISE.md`.

---

## Le design system

**Si un composant vit dans un dock, il est maison.** Barres d’outils, inspecteurs, timeline,
outliner, navigateur d’assets, barre de titre, onglets — tout cela dans
`src/renderer/src/design/`.

DaisyUI est réservé aux surfaces où l’application redevient une application : préférences,
dialogues, gestion des clés API, onboarding.

Les primitives, toutes dans `design/` :

| | |
|---|---|
| `Panel`, `PanelHeader` | la surface sombre arrondie et sa ligne de titre |
| `Row` | **la** ligne, partout — vignette ou icône, titre, sous-titre, actions, infobulle sur un nom tronqué |
| `Collection`, `CollectionBar` | la liste virtualisée à deux vues, et sa barre de recherche/facettes/tri |
| `MediaTile`, `Thumbnail` | la tuile carrée légendée, et la même image à taille fixe |
| `Toolbar`, `ToolButton`, `Button`, `UiIcon` | la barre partagée, ses boutons d’icône, ses boutons libellés, l’unique porte des icônes |
| `ProgressRow`, `ProgressBar` | « quelque chose se passe, voilà où ça en est » — partagés par le résumé des générations, sa liste dépliée et l’import de médias |
| `PropertySection` et les champs | `TextField`, `NumberField`, `SliderField`, `ColorField`, `Vector3Field`, `TextureField`, `PropertyRow` — ce dont l’inspecteur est fait |
| `DynamicForm` | le seul formulaire de génération qui existe |
| `Tree`, `Flyout`, `MenuButton`, `MenuRow`, `EmptyState`, `Timecode`, `Separator`, `TooltipHost` | |
| `styles.ts` | les chaînes de classes partagées par plus d’un composant : `FOCUS_RING`, `CONTROL`, `MEDIA_FRAME` |

Écrire à la main une ligne, une surface de panneau ou un cadre d’image est un bug de style, pas
un raccourci.

### Une collection annonce ce qu’elle est, et c’est une seule décision

`Collection` choisit **ensemble** le rôle du conteneur et celui de la cellule — `rolesFor` :
`listbox`/`option` quand les lignes se sélectionnent, `list`/`listitem` quand elles ne peuvent
qu’être ouvertes, aucun rôle quand elles ne répondent à rien. Les deux ne peuvent pas diverger,
et c’est le point : un `option` sans `listbox` autour est de l’ARIA invalide, que les moteurs
ignorent purement et simplement.

Trois conséquences pour l’appelant, et aucune n’est facultative :

- **`label` est requis.** Un `listbox` sans nom est une violation WCAG 2.0 A (4.1.2), et six
  panneaux qui n’en passent pas s’annoncent tous « listbox ». Chacun donne le titre qu’il porte
  déjà.
- **Le compte annoncé est celui des données, pas de la fenêtre virtualisée.** `aria-posinset` et
  `aria-setsize` sont posés depuis l’index réel : sans eux, un catalogue de 2000 modèles se dit
  « 1 sur 35 », et le nombre change au défilement.
- **`aria-multiselectable` est déclaré, jamais déduit.** `pickFrom` offre shift et ⌘ à tous les
  appelants, mais trois panneaux sur six n’en gardent qu’un : le déduire promettrait une plage
  qu’ils ne construisent pas.

`aria-selected` ne se pose que sur un `option`. L’Explorateur peint « ouvert » avec la même prop,
et l’annoncer « sélectionné » décrirait un état que ses lignes ne peuvent ni prendre ni rendre.

### Ce que le design system a repris à une bibliothèque

**Les bulles d’échec ne viennent plus de `react-toastify`**, qui a quitté les dépendances. Une
bulle est un panneau flottant de ce studio : une bibliothèque apportait sa propre surface, son
propre rayon et sa propre animation, à combattre contre les jetons — exactement la raison pour
laquelle un dock ne porte pas de contrôle DaisyUI. `ActivityToasts` réutilise `MENU_SURFACE`,
donc une bulle et un menu ont le même aspect parce qu’ils partagent la même chaîne de classes.

Trois bibliothèques ont fait le chemin inverse et sont entrées, chacune pour une chose qu’on
n’écrit pas soi-même :

| | |
|---|---|
| `recharts` | les courbes de la fenêtre de consommation — dépense par jour, par compte |
| `opentype.js` | la lecture des tables d’une police, pour le texte en volume et la légende d’une image |
| `@xyflow/react` | le canvas du node editor : viewport, arêtes bézier, poignées, sélection au lasso |

`opentype.js` est **chargé à la demande** : il ne pèse pas sur le premier écran, qui n’a aucune
police à disséquer.

`@xyflow/react` est **le canvas de Scenario lui-même** — la webapp le rend, DOM à l’appui — et
c’est ce qui rend l’aller-retour possible : le format natif du studio est l’`editorInfo` de
Scenario, écrit à la main dans `shared/domain/graph.ts` parce qu’un graphe traverse l’IPC et que
`shared/` ne porte aucune dépendance runtime. Le canvas **n’est monté nulle part aujourd’hui** :
le graphe deviendra un septième espace, et rien de cette pile n’est atteignable avant.

### Jetons et densité

Les couleurs vivent dans le bloc `@theme` de `src/renderer/src/index.css` ; les gauges `--sc-*`
vivent dans `:root`, redéclarées sous `:root[data-density='compact']`. **Aucune valeur
hexadécimale dans un composant**, et aucun pixel là où une gauge existe — cette unique
redéclaration est ce qui fait que le réglage de densité atteint tous les contrôles d’un coup.

Les surfaces sont **plus sombres** que le châssis, à l’inverse de l’habitude web. C’est cette
inversion qui donne la lecture « panneaux posés sur un cadre ».

Le fond reste opaque : dans un studio on juge des couleurs, et la translucidité fausse tout ce
qui est au-dessus. C’est une décision de métier, pas d’esthétique.

---

## Internationalisation

Un JSON par langue dans `src/shared/i18n/` — français et anglais, tenus en parité stricte. Ils
vivent dans `shared/` parce que le menu natif est bâti par le processus principal et l’UI par le
renderer, et que les deux doivent dire la même chose.

- **Tous les identifiants, commentaires, JSDoc, noms de fichiers, clés i18n, canaux IPC et
  descriptions de tests sont en anglais**, partout dans `src/`.
- Les seules exceptions sont `fr.json` lui-même, et les valeurs attendues dans les tests
  lorsqu’elles proviennent du bundle français.
- Aucune chaîne visible par l’utilisateur en dur dans un composant. Les clés dynamiques
  (`assetTypes.${type}`, `capabilities.${capability}`) se résolvent contre les mêmes bundles,
  avec le nom brut de l’API en repli, de sorte qu’une valeur inconnue affiche quelque chose de
  lisible plutôt qu’une clé manquante.

Les libellés utilisés dans une liste virtualisée sont résolus **une fois par le panneau**, jamais
par ligne : un défilement re-rend chaque ligne montée à chaque frame, et `useTranslation()` n’est
pas gratuit.

### Ce qui est traduit va plus loin que les phrases

Six choses passent par les bundles sans en avoir l’air, et chacune répond à un défaut constaté :

- **les noms de touches** — `Espace`, `Suppr`, `Début` ne sont pas des libellés anglais laissés en
  place : l’écran des raccourcis les résout comme le reste ;
- **les unités et les dates** — `formatBytes` calcule une taille mais **ne la nomme pas** : le
  nom de l’unité est fourni par l’appelant, parce que `Mio` et `MiB` sont la même taille dans deux
  langues et que les abréviations avaient fini par vivre en français dans un fichier de calcul ;
- **les nombres écrits DANS une phrase** — `{{count, number}}` plutôt que `{{count}}` : un millier
  s’écrit « 4 000 » d’un côté de la Manche et « 4,000 » de l’autre, et l’espace du français est une
  insécable étroite. Le formateur d’i18next est `Intl.NumberFormat`, rien à configurer. Vingt-sept
  clés le portent. **L’exception est un facteur, pas un dénombrement** :
  `texture.tilingPreviewTimes` écrit « 4× », et grouper une répétition serait faux précisément là
  où le groupement se verrait — `bundles.test.ts` tient la règle **et son exception**. Une **unité
  créative** ne passe pas non plus par `{{units, number}}` mais par `formatUnits`, qui ne se
  contente pas de grouper : elle garde deux décimales sous dix unités, parce qu’un appel bon
  marché arrondi à zéro se lirait **gratuit**. Dix-neuf appelants ; le dernier à l’avoir oubliée
  écrivait « 1 234 UC » avant la génération et « 1234 UC » après ;
- **les portées du journal** — une ligne d’activité affiche une phrase, jamais la clé qui la
  désigne ;
- **la langue du document lui-même** — `document.documentElement.lang` suit la langue choisie.
  `index.html` la portait en dur : un lecteur d’écran choisit sa voix dessus, et une interface
  anglaise sous `lang="fr"` était lue avec une phonétique française ;
- **le texte que le modèle écrit** — libellés, descriptions et options du formulaire de
  génération. Voir juste dessous : c’est le seul mécanisme du studio qui ne s’indexe pas sur une
  clé.

### Une largeur fixe est une décision d’internationalisation

**Le français dépasse l’anglais de moitié sur 126 clés du bundle.** Partout où une largeur est
figée, cet écart devient un libellé coupé **dans une langue seulement** — « Aperçu de la
répétition » se lisait « Aperçu de la ré… » dans une colonne d’inspecteur de 80 px où
« Repeat preview » tenait entier.

Le remède n’est pas de raccourcir le libellé fautif : cela traite ce cas-ci et laisse le suivant.
**Ce qui est tronqué se lit au survol** — `PropertyRow` pose le `title`, et le pose **aussi en
mode empilé**, là où la colonne ne contraint pourtant rien : un titre qui apparaît et disparaît
selon la disposition serait une seconde règle à retenir.

Les barres d’outils échappent à la question par construction — `ToolButton` ne montre aucun
libellé, il en fait une infobulle.

### Le seul dictionnaire indexé sur du texte, et pourquoi

**L’API Scenario ne connaît pas la langue** — ni `Accept-Language`, ni paramètre de locale sur
`models.retrieve`, rien dans le SDK. Le texte qu’un modèle publie pour ses propres entrées
(« Target size », « Max splat points », et les phrases d’explication sous elles) est donc traduit
ici ou nulle part.

`model-text.fr.json` s’indexe sur le **texte anglais**, pas sur la clé du champ, et c’est le seul
endroit du studio qui procède ainsi. La raison est que la moitié de ce que le panneau affiche est
une **phrase que le modèle a écrite**, pas un nom de champ : indexer sur la clé traduirait
« Max splat points » et laisserait sa description en anglais juste dessous.

Trois conséquences, dont une à accepter :

- **un libellé changé côté Scenario retombe en anglais** au lieu d’échouer. `normalizeModelText`
  absorbe ce qui ne coûte rien à absorber — casse, espaces, apostrophe et tiret typographiques,
  ponctuation finale — et le repli est **la phrase anglaise elle-même, jamais une clé**. Le pire
  cas est donc l’écran d’avant, pas un écran cassé ;
- **sept mots restent en anglais, et la règle qui les garde a été refaite deux fois** —
  `sampler`, `scheduler`, `LoRA`, `checkpoint`, `prompt`, `clip skip`, `denoising strength`.
  L’argument d’origine était « c’est le terme du métier, on le lit ainsi dans tous les autres
  outils » : il est **général et invérifiable**, et il a laissé passer `seed`, que
  `inspector.seed` et `skybox.seed` nommaient « Graine » depuis longtemps, puis `guidance scale`
  et `negative prompt`, que le glossaire du manuel nommait. Le formulaire était à chaque fois la
  **seule surface** à refuser le mot que le reste du studio emploie. La règle est donc devenue
  vérifiable : **on ne garde en anglais que ce qu’aucune surface ni le glossaire ne nomme en
  français.** Un test tient la liste, pour qu’en traduire un soit une décision prise contre un
  test rouge ;
- **la traduction s’applique au rendu, pas à la construction des descripteurs.** Changer de
  langue redit le formulaire ouvert au lieu d’attendre que le modèle soit rechargé — et les Apps
  en profitent sans une ligne de plus, leurs champs venant du même endroit. L’invariant 5 est
  intact : rien n’est écrit à la main pour un modèle donné.

**Tout texte distant n’appelle pas ce remède, et prendre le mauvais coûte la garde.** Le rapport
d’usage affichait « images-generation » et « video » dans une fenêtre française : même symptôme,
autre outil. Ces valeurs-là sont **trois unions fermées et documentées**, listées par `usages.list`
et recopiées dans `shared/domain/usage.ts` : **21 actions dépensières**, **8 genres d’assets**, et
**100 actions du journal brut** — ces dernières sont une union *différente* des premières, et le
mot qui les rapproche est un piège. `USAGE_ACTIONS` est ce qui est **facturé** ; `USAGE_EVENT_ACTIONS`
est ce qui **s’est passé**, y compris ce que rien ne facture (`subscription`, `asset-privacy`,
`assistant-message`). Les deux listes se recouvrent aux trois quarts, d’où **une seule table de
libellés que les deux consultent** — donc
**une clé de bundle par valeur**, tenue par `bundles.test.ts` comme le sont déjà les canaux PBR et
les portées du journal. Une action ajoutée par Scenario sans sa ligne fait rougir la garde.

La règle qui départage les deux :

| Le texte distant… | L’outil |
|---|---|
| appartient à une **liste fermée** que l’API documente | une clé de bundle par valeur, plus une garde exhaustive |
| est **écrit librement** et change avec chaque modèle publié | le dictionnaire indexé sur le texte source |
| est **lu par le code autant que par l’œil** | rien — il sort brut, et c’est délibéré |

Dans les deux premiers cas le repli est **le texte brut de l’API, jamais une clé** : un écran en
anglais reste lisible, un écran qui affiche `usage.action.images-generation` ne l’est pas.

**La troisième ligne est celle qu’on oublie, et elle casse en silence.** Un port de nœud de
workflow montre le nom que le workflow lui a donné — celui-là passe par le dictionnaire. Mais un
port **sans** nom affiche ce qu’il accepte, `image` ou `video`, et **cette chaîne est ce que la
vérification de connexion compare** : traduite d’un côté de l’arête et pas de l’autre, elle ne dit
plus si deux ports vont ensemble. `NodePorts.tsx` porte la règle en JSDoc, là où elle se paierait.

C’est le même partage que `name` et `message` dans les gardes de texte en dur : **une chaîne qui
est aussi une donnée n’est pas un libellé**, et la traduire la casse comme donnée.

### Quatre gardes, et ce que chacun tient

Ce ne sont pas les mêmes tests, et les confondre laisse croire qu’une seule chose est surveillée.
Ils se partagent l’arbre sans se recouvrir, et tournent tous dans `pnpm validate`.

| Garde | Ce qu’il refuse |
|---|---|
| `shared/i18n/bundles.test.ts` | une clé présente d’un côté et pas de l’autre, un ordre qui diverge, une valeur vide, une apostrophe ASCII en français, **une espace sécable devant `; : ! ?` ou dans les guillemets français**, un trou d’interpolation perdu — **et une phrase anglaise recopiée dans `fr.json`** |
| `renderer/src/no-hardcoded-text.test.ts` | dans un `.tsx` : du texte entre balises, un littéral entre accolades, derrière un ternaire ou un `&&`, et tout attribut qu’un humain lit |
| `main/no-hardcoded-text.test.ts`, § *the main process* | un mot écrit dans un dialogue natif ou dans un `label` de menu |
| `main/no-hardcoded-text.test.ts`, § *the registries* | dans un `.ts` de `renderer`, `shared` ou `preload` : un libellé écrit là où une clé est attendue |

**Une garde typographique n’est pas un luxe : elle tient ce qu’aucun éditeur ne montre.** Le
bundle français écrivait sa ponctuation double avec une espace ordinaire — quatre-vingt-quatre
valeurs, zéro insécable — et une espace ordinaire est un endroit où la ligne a le droit de se
couper. « Impossible d’importer « {{name}} » » vit dans le journal d’activité, une colonne étroite
où le nom interpolé fait ce qu’il veut de la longueur : le guillemet fermant se retrouvait seul en
début de ligne. Le choix est **U+00A0 et non la fine U+202F** — indiscernables à onze pixels, et
la large est celle que toutes les polices ont. La garde a mordu **dix minutes après sa livraison**,
sur trois clés d’un lot fusionné en parallèle : le motif étant invisible dans un éditeur, personne
ne l’aurait vu à la relecture.

**Le premier voit ce qu’aucun des trois autres ne peut voir.** Une phrase anglaise collée dans
`fr.json` passe *par* le bundle : elle est irréprochable pour les gardes qui traquent le texte en
dur, et elle s’affiche pourtant en anglais devant un utilisateur français. Le test la reconnaît à
ceci qu’elle est **identique dans les deux fichiers**. Il ne compare que les phrases, jamais les
mots seuls : `Position`, `Rotation`, `Saturation` s’écrivent pareil dans les deux langues —
quatre-vingt-quatorze clés — et les inventorier coûterait plus cher que ce que ça attraperait.
Sept phrases sont identiques à dessein, et elles sont nommées : la marque, deux noms de format,
deux chemins, une ligne de copyright, un exemple de saisie.

### La seule surface qui embarque ses mots

Aucun garde ne peut atteindre le raccourci de bureau Linux : le `.desktop` est **écrit à la
compilation** et lu par l’environnement de bureau bien avant qu’un bundle existe. Il se localise
de la seule façon qu’il connaisse — une clé par langue, `Comment` servant de repli — et c’est
`electron-builder.yml` qui les porte.

Ce qui reste sous cette ligne n’est traduisible nulle part : la **description du paquet `.deb`**
n’a qu’une langue, comme le `synopsis` dont elle est la longue forme. Les deux sont désormais
la même phrase anglaise, au lieu d’un anglais dans le raccourci et d’un français dans le
gestionnaire de paquets — c’est la convention des métadonnées de paquet, et c’est l’endroit
exact où « tout est traduit » cesse d’être une promesse tenable.

---

## La configuration

Trois couches, qui ne se mélangent jamais : ce que règle l’utilisateur, ce que règle un
développeur, et ce dont le build a besoin.

### Ce que règle l’utilisateur

`shared/domain/settings.ts` déclare la forme entière — apparence, génération, stockage, médias,
dictée.
C’est le contrat, et c’est délibérément le **seul** type de réglages que le renderer puisse
voir : **les identifiants d’API n’y figurent jamais**. Le renderer lit un `AuthState`, pas une
clé.

La persistance passe par un port `PersistenceAdapter`. La production branche `electron-store`
et `safeStorage` (`settings/adapter.ts`) ; les tests branchent un adaptateur en mémoire. Les
valeurs simples atterrissent dans `settings.json`, dans le dossier de configuration de
l’utilisateur ; les identifiants sont chiffrés d’abord, puis rangés en base64 — `safeStorage`
rend des octets, et un fichier JSON tient des chaînes.

Si `safeStorage.isEncryptionAvailable()` est faux, l’enregistrement des identifiants **lève**
plutôt que de retomber sur du texte clair. Ce refus *est* la fonctionnalité.

Tout ce qui est relu est validé (`settings/validation.ts`) : un fichier de configuration est
non typé par nature, et une valeur éditée à la main ou héritée d’une version antérieure doit
être écartée, pas crue.

### Ce que règle un développeur

`secrets/.env`, lu **à l’exécution** par le processus principal, **en développement seulement**
(`app.isPackaged === false`). Il n’est jamais passé au bundler : injecter un secret à la
compilation le graverait dans `out/`, et un `.asar` s’ouvre avec un éditeur de texte.

| Variable | Qui s’en sert |
|---|---|
| `SCENARIO_API_KEY`, `SCENARIO_API_SECRET` | le client API, en repli |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | le packaging uniquement — jamais à l’exécution |

Les identifiants enregistrés dans les réglages **priment** sur ceux du `.env`. Le fichier est une
commodité de développement, pas une seconde source de vérité.

`ELECTRON_RENDERER_URL` est posée par electron-vite en mode watch : c’est elle qui fait charger
la fenêtre depuis le serveur de développement plutôt que depuis le disque.

### Ce dont le build a besoin

`scripts/dist.sh` charge `secrets/.env` et appelle electron-builder. Laissées vides, les trois
variables Apple lui font sauter la signature et la notarisation — il le journalise, et
`pnpm dist` produit quand même une application. Elle n’est simplement pas signée, et Gatekeeper
le signalera à la première ouverture. Les renseigner active la chaîne complète, sans toucher au
code.

Le binaire ffmpeg se résout dans un ordre fixe — **embarqué**, puis **configuré**, puis le
**`PATH`** — et rend null plutôt que de lever quand aucun des trois ne répond. L’interface sait
alors quelle partie du pipeline est indisponible, et peut le dire au lieu d’échouer opaquement.

---

## Les tests

**1398 tests répartis sur 148 fichiers**, exécutés par Vitest. Les tests unitaires sont colocalisés
(`*.test.ts` à côté du code) et écrits dans le même mouvement que le code, jamais après.

`pnpm validate` — typecheck, lint, vérification de format, tests avec budgets de couverture —
doit être vert avant tout
commit.

Ce qui est couvert, en pratique : chaque helper, chaque module d’état et de commandes de chaque
moteur, la traduction de schéma, la file et le backoff du job manager, le catalogue, le contrat
IPC, et les panneaux via Testing Library.

---

## Ajouter quelque chose

| Ce que vous ajoutez | Par où commencer |
|---|---|
| Un panneau | une entrée dans `TOOL_PLACEMENTS`, puis `panels/<nom>/` avec un `index.ts` exportant `definition: { Content, Actions }` |
| Un espace de travail | `WORKSPACE_IDS`, puis son icône et sa famille dans `helpers/workspaces.ts` — le compilateur réclame les deux |
| Un canal IPC | `shared/ipc.ts` d’abord, le handler ensuite ; la signature en est dérivée, donc partez du contrat |
| Un type de maillage ou de lumière | `mesh-primitives.ts` / `light-types.ts` — la barre d’outils, les panneaux et le menu natif lisent ces tables |
| Un outil image | `spaces/image/image-tools.ts`, dans le bon groupe |
| Une forme visuelle partagée | `design/`, un composant par fichier, avec son test |

Deux règles qui font gagner le plus de temps : vérifier qu’un helper n’existe pas déjà avant d’en
écrire un, et lire le voisinage avant d’y toucher. Les registres font que la plupart des ajouts
tiennent en une entrée dans une table, et non en une modification dans cinq fichiers.

---

## Livrer une version

Le studio se distribue en **installeurs signés par plateforme**, produits par GitHub Actions et
publiés sur les GitHub Releases, que l’application consulte elle-même pour se mettre à jour.

### Deux branches, deux rôles

`develop` intègre les features au fil de l’eau ; `main` ne reçoit que des merges de release et
porte les tags. **Un tag `v*` poussé sur `main` est le seul déclencheur du pipeline.**

```
feat/<nom> ──▶ develop ──▶ main ──tag v*──▶ build 3 OS ──▶ release en draft ──▶ publiée
```

### Ce que le pipeline produit

| Fichier | Pour |
|---|---|
| `.dmg` arm64 et x64 | macOS Apple Silicon et Intel |
| `.zip` arm64 et x64 | ce que consomme `electron-updater` — pas distribué |
| `.exe` (NSIS) | Windows x64 |
| `.AppImage` et `.deb` | Linux x64 |
| `latest.yml`, `latest-mac.yml`, `latest-linux.yml` | les manifestes d’auto-update |
| `*.blockmap` | le téléchargement différentiel |

Les trois plateformes sont packagées en parallèle mais **ne publient rien** : un job final agrège
les artefacts, **vérifie qu’aucun manifeste ni blockmap ne manque**, et crée la release en
**draft**. Une release incomplète casserait l’auto-update de toute la base installée sans erreur
visible — d’où ce contrôle bloquant, et d’où le fait que la publication reste un geste humain.

### La version

Semver, et le tag fait foi : `package.json` doit porter le même numéro que le tag. Un
désalignement produit des manifestes qui annoncent une version inexistante.

### L’auto-update dans l’application

`src/main/updater.ts` traduit les événements d'`electron-updater` en un `UpdateState` unique
(`idle`, `checking`, `available`, `downloading`, `ready`, `failed`), poussé au renderer par
`EVENTS.updateState` et rendu par `UpdateStatus` dans la barre de statut. Trois traits comptent :

- **`electron-updater` n’est chargé qu’au premier contrôle**, jamais à l’import — sans quoi le
  démarrage paierait une trentaine de millisecondes avant même le splash, y compris en
  développement où le contrôle n’a pas lieu.
- **Rien ne s’installe sans un geste** : le téléchargement est automatique, l’installation se
  fait au prochain quit, ou immédiatement si l’utilisateur clique.
- **Un échec est silencieux** : ne pas savoir si une version plus récente existe n’est pas un
  problème que l’utilisateur doit lire.

### Où lire la suite

| | |
|---|---|
| [`docs/ci/RELEASE.md`](../ci/RELEASE.md) | la check-list de publication et le rollback |
| [`docs/ci/SECRETS.md`](../ci/SECRETS.md) | les secrets de signature, leur obtention, leur rotation |
| [`docs/ci/TROUBLESHOOTING.md`](../ci/TROUBLESHOOTING.md) | symptôme → cause → correction |
| [`docs/ci/adr/`](../ci/adr/) | les quinze décisions, avec ce qui a été écarté et pourquoi |
