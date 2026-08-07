# Scenario Studio — architecture

Comment le studio est bâti, et pourquoi il l'est ainsi. Écrit pour qui reprend le code. Vous
cherchez plutôt comment *s'en servir* ? Voir [guide-utilisateur.md](guide-utilisateur.md).

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
11. [Les tests](#les-tests)
12. [Ajouter quelque chose](#ajouter-quelque-chose)

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
        │  · moteurs : canvas, scène, timeline        │
        │  · stores zustand, TanStack Query           │
        └─────────────────────────────────────────────┘
```

`contextIsolation` et `sandbox` sont actifs et le restent. Le renderer n'a ni `fs`, ni
`child_process`, ni `nodeIntegration`. La navigation est verrouillée au niveau `app`, et
`openExternal` ne laisse passer que `https:`.

---

## Six invariants

Ils gouvernent tout. En enfreindre un casse le projet dans ce qu'il a de défendable.

### 1. Le renderer ne voit jamais de secret

La clé et le secret vivent dans le processus principal, chiffrés par l'OS via le `safeStorage`
d'Electron. Le renderer demande « suis-je authentifié ? » — **jamais** « quelle est ma clé ? ».

### 2. Toute frontière passe par `shared/ipc.ts`

Typé des deux côtés. Aucun `ipcRenderer.invoke('un-truc')` dans un composant. `shared/` n'a
**aucune dépendance runtime** — types et constantes uniquement, ce qui permet aux deux processus
de l'importer.

`main/ipc/handle.ts` dérive la signature de chaque handler du canal lui-même : un handler qui ne
respecte pas son contrat déclaré ne compile pas.

### 3. Un moteur est recréable depuis son état, jamais depuis son DOM

`CanvasEngine`, `SceneRenderer`, `TimelineEngine` se reconstruisent intégralement depuis leur
état sérialisé.

La raison est concrète : un contexte WebGL ne survit pas au déplacement entre documents, et
détacher un panneau dans une autre fenêtre l'exige. Le save/load et l'undo deviennent fiables
gratuitement.

### 4. Les moteurs ignorent React ; React les pilote

`engines/` ne contient **aucun import React**. Les composants lisent l'état et appellent des
méthodes ; ils ne détiennent pas la scène.

### 5. Aucun formulaire de génération écrit à la main

Les entrées de `POST /generate/custom/{modelId}` sont **propres à chaque modèle** et se
découvrent via `GET /models/{modelId}`. Le `ModelRegistry` les traduit en `FieldDescriptor[]`,
et `<DynamicForm/>` les rend.

Coder un formulaire en dur pour un modèle donné est un bug, pas un raccourci. Un `kind` inconnu
retombe en saisie brute — jamais un formulaire qui disparaît.

### 6. Le thread UI ne fait que de l'UI

Toute opération susceptible de dépasser 16 ms part ailleurs, dans cet ordre de réflexe :

1. **GPU** — filtres, blend, normal map, AO, redimensionnement.
2. **Web Worker** — vignettes, formes d'onde, BVH, parsing de gros GLB.
3. **OffscreenCanvas + Worker** — rendus hors écran.
4. **`utilityProcess`** — ffmpeg, indexation, hachage, transferts.

Toute tâche longue est **annulable**, **rapporte sa progression**, et tourne dans un pool borné à
`hardwareConcurrency − 2`.

`better-sqlite3` est synchrone : une requête lourde dans le processus principal bloque toutes les
fenêtres, donc les requêtes de catalogue non triviales passent par `worker_threads`.

---

## Traverser la frontière des processus

`src/shared/ipc.ts` déclare les canaux en types littéraux et la forme du `StudioBridge`. Les deux
côtés l'importent ; aucun ne peut dériver.

```
renderer                    preload                  main
────────                    ───────                  ────
getBridge()          →  window.studio         →  ipcMain.handle(CHANNELS.x)
  .scenario                 exposeInMainWorld       handler dérivé du canal
  .searchModels(q)          contextBridge           renvoie des données typées
```

Quarante-cinq canaux sont déclarés, en quatre familles :

| Famille | Ce qu'elle porte |
|---|---|
| `window:*` | état de fenêtre, plein écran |
| `settings:*` | lecture, écriture, identifiants, état d'authentification |
| `scenario:*` | recherche de modèles, description, génération, contrôle des jobs |
| `project:*` / `assets:*` | cycle de vie du projet, requêtes de catalogue, ingestion |

Six d'entre eux vont dans l'autre sens — le main poussant vers le renderer : progression des
jobs, lignes de journal, changements de projet, et le menu natif qui demande à l'UI d'ouvrir un
outil, d'exécuter une commande ou de déposer un nœud dans la scène.

Les fichiers locaux sont servis au renderer par un protocole `scenario://`. L'URL est dérivée de
l'identifiant de l'asset : une grille de vignettes ne coûte donc aucun IPC — et le renderer ne
manipule toujours aucun chemin de fichier.

---

## Le processus principal

```
src/main/
├── scenario/
│   ├── client.ts          le client @scenario-labs/sdk, bâti sur les identifiants stockés
│   ├── credentials.ts     lecture, validation, état d'authentification
│   ├── model-registry.ts  GET /models/{id} → FieldDescriptor[]
│   ├── model-catalog.ts   listing paginé des modèles, mis en cache
│   ├── job-manager.ts     la file, la concurrence, le polling
│   ├── runner.ts          ce qui appelle réellement generate
│   ├── schema.ts          traduction de schéma et déduction de famille
│   └── handlers.ts        les canaux scenario:*
├── project/
│   ├── store.ts           créer et ouvrir un dossier de projet, lire/écrire le manifeste
│   ├── catalog.ts         l'index SQLite des assets
│   ├── sqlite.ts          le port SqliteDriver
│   ├── sqlite-native.ts   better-sqlite3 — production
│   └── sqlite-memory.ts   node:sqlite — tests
├── settings/              le store chiffré, son adaptateur, ses handlers
├── assets/                l'ingestion et le protocole scenario://
├── media/                 le travail adossé à ffmpeg
├── menu/                  le menu natif, bâti depuis les registres partagés
└── window/                cycle de vie et verrouillage de la navigation
```

### Le JobManager est le seul à poller

Le `job.wait()` du SDK ne rapporte aucune progression et plafonne à 120 secondes — inutilisable
pour une barre de progression, inutilisable pour une génération vidéo. Le `JobManager` poll donc
`jobs.retrieve` lui-même, toutes les deux secondes, et pousse la progression au renderer par
`evt:job-progress`.

**Poller ailleurs est un bug.** Le manager détient aussi la concurrence (trois par défaut,
réglable) et le backoff exponentiel sur 429 et 5xx — aucun seuil de débit n'est publié, donc
aucun n'est supposé. Contourner la file par un appel direct au SDK, c'est ainsi qu'on récolte une
rafale de 429.

### SQLite derrière un port

`catalog.ts` parle à une interface `SqliteDriver`, pas à une bibliothèque. La production branche
`better-sqlite3` ; les tests branchent le `node:sqlite` intégré. Un test qui importe
`better-sqlite3` directement est un test qui échouera bizarrement — branchez le port.

`pnpm rebuild:native` est obligatoire après toute montée d'Electron, sinon le module natif refuse
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
├── engines/      canvas, scène, timeline, et l'historique partagé
├── spaces/       un éditeur par type de document
│   ├── image/      le canvas Pixi et ses outils
│   ├── three/      la vue three.js et ses outils
│   └── video/      la timeline, le moniteur, ses outils
├── panels/       les outils ancrables
├── stores/       zustand : documents, tools, layouts, models, assets, jobs, settings, keymap
├── hooks/        raccourcis, menu natif, densité, état de fenêtre, debounce…
├── helpers/      fonctions pures, toutes testées
└── services/     l'accès au pont et la traduction des échecs
```

### Le shell

Dockview tient le centre et **uniquement** le centre : les documents et leurs onglets. Les
fenêtres d'outil sont posées sur la gouttière du châssis par le shell lui-même, parce que leur
comportement — un rail qui bascule entre elles, des moitiés qui coupent une zone — n'est pas ce
qu'une bibliothèque de docking modélise.

Les fenêtres d'outil sont mémoïsées : un glissement de zone écrit une nouvelle taille à chaque
`pointermove`, et sans cela chaque frame re-rend les deux moitiés et tout ce qu'elles
contiennent, y compris une grille d'assets virtualisée. Leurs callbacks sont maintenus stables
pour que cette mémoïsation morde.

### Des registres, pas des listes

`shared/domain/tool.ts` déclare où vit chaque outil et quels espaces il sert.
`shared/domain/workspace.ts` déclare les espaces. Le renderer les enrichit d'icônes et de
composants ; le **menu natif lit les mêmes tables**. Déclarer un septième espace tient en une
entrée, et le compilateur réclame ensuite son icône et sa famille.

C'est pourquoi le registre d'outils vit dans `shared/` et non dans le renderer : le processus
principal a besoin de `{ id, zone }` pour restaurer un outil fermé, et le dupliquer dégraderait
`ToolId` en `string`.

---

## Les moteurs

Trois moteurs, aucun React à l'intérieur.

| Moteur | Adossé à | Détient |
|---|---|---|
| `CanvasEngine` | PixiJS 8.19 | le document image : calques, formes, tracés |
| `SceneRenderer` | three.js 0.185 | la scène 3D : maillages, lumières, gizmos, caméra |
| `TimelineEngine` | mediabunny + Canvas | la séquence : clips, lecture, formes d'onde, vignettes |

Chacun va de pair avec un module d'état pur (`canvas-state.ts`, `scene-state.ts`,
`timeline-state.ts`) et un module de commandes. Les commandes sont la seule voie par laquelle
l'état change, ce qui fait de l'undo un mécanisme générique dans `engines/core/history.ts` plutôt
que trois mécaniques sur mesure.

`node-factory.ts`, `mesh-primitives.ts`, `light-types.ts` et `three-factory.ts` gardent la
*description* d'un nœud séparée de son instanciation three.js — une scène se sérialise donc sans
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
6. soumission                        scenario:generate
7. le JobManager met en file         concurrence bornée
8. il poll                           jobs.retrieve, toutes les 2 s
9. la progression remonte            evt:job-progress → panneau Jobs
10. succès                           metadata.assetIds → téléchargés dans le projet
11. le catalogue l'enregistre        SQLite → l'asset paraît dans l'étagère
```

Les étapes 3 et 4 sont la raison d'être de l'invariant 5. Les entrées d'un modèle lui
appartiennent ; un formulaire écrit à la main est juste pour exactement un modèle, exactement un
jour.

Un `kind` de champ inconnu se rend en saisie brute plutôt que de faire échouer le descripteur —
un formulaire de génération qui perd un champ en silence est pire qu'un formulaire laid.

---

## Projets et catalogue

Un projet est un dossier. `project.json` en est le manifeste (version, nom, dates) ; le reste est
la structure que le studio crée à l'ouverture — l'arborescence est dans le
[guide utilisateur](guide-utilisateur.md#les-projets).

Le **catalogue** est `.index/catalog.db`, un index SQLite de chaque asset : identifiant, nom,
type, emplacement, étiquettes, dates, et le chemin quand l'asset est local. Il existe pour que
l'étagère puisse chercher parmi des milliers d'éléments sans toucher au système de fichiers, et
pour qu'un projet reste transportable — supprimez `.index/` et il se reconstruit.

Un asset est soit `local` (un fichier du projet), soit `cloud` (encore uniquement chez Scenario).
Une image locale est servie au renderer sous la forme `scenario://<id>`.

---

## Le design system

**Si un composant vit dans un dock, il est maison.** Barres d'outils, inspecteurs, timeline,
outliner, navigateur d'assets, barre de titre, onglets — tout cela dans
`src/renderer/src/design/`.

DaisyUI est réservé aux surfaces où l'application redevient une application : préférences,
dialogues, gestion des clés API, onboarding.

Les primitives, toutes dans `design/` :

| | |
|---|---|
| `Panel`, `PanelHeader` | la surface sombre arrondie et sa ligne de titre |
| `Row` | **la** ligne, partout — vignette ou icône, titre, sous-titre, actions, infobulle sur un nom tronqué |
| `Collection`, `CollectionBar` | la liste virtualisée à deux vues, et sa barre de recherche/facettes/tri |
| `MediaTile`, `Thumbnail` | la tuile carrée légendée, et la même image à taille fixe |
| `Toolbar`, `ToolButton`, `UiIcon` | la barre partagée, ses boutons, l'unique porte des icônes |
| `DynamicForm` | le seul formulaire de génération qui existe |
| `Tree`, `Flyout`, `MenuButton`, `MenuRow`, `EmptyState`, `Timecode`, `Separator`, `TooltipHost` | |
| `styles.ts` | les chaînes de classes partagées par plus d'un composant : `FOCUS_RING`, `CONTROL`, `MEDIA_FRAME` |

Écrire à la main une ligne, une surface de panneau ou un cadre d'image est un bug de style, pas
un raccourci.

### Jetons et densité

Les couleurs vivent dans le bloc `@theme` de `src/renderer/src/index.css` ; les gauges `--sc-*`
vivent dans `:root`, redéclarées sous `:root[data-density='compact']`. **Aucune valeur
hexadécimale dans un composant**, et aucun pixel là où une gauge existe — cette unique
redéclaration est ce qui fait que le réglage de densité atteint tous les contrôles d'un coup.

Les surfaces sont **plus sombres** que le châssis, à l'inverse de l'habitude web. C'est cette
inversion qui donne la lecture « panneaux posés sur un cadre ».

Le fond reste opaque : dans un studio on juge des couleurs, et la translucidité fausse tout ce
qui est au-dessus. C'est une décision de métier, pas d'esthétique.

---

## Internationalisation

Un JSON par langue dans `src/shared/i18n/` — français et anglais, tenus en parité stricte. Ils
vivent dans `shared/` parce que le menu natif est bâti par le processus principal et l'UI par le
renderer, et que les deux doivent dire la même chose.

- **Tous les identifiants, commentaires, JSDoc, noms de fichiers, clés i18n, canaux IPC et
  descriptions de tests sont en anglais**, partout dans `src/`.
- Les seules exceptions sont `fr.json` lui-même, et les valeurs attendues dans les tests
  lorsqu'elles proviennent du bundle français.
- Aucune chaîne visible par l'utilisateur en dur dans un composant. Les clés dynamiques
  (`assetTypes.${type}`, `capabilities.${capability}`) se résolvent contre les mêmes bundles,
  avec le nom brut de l'API en repli, de sorte qu'une valeur inconnue affiche quelque chose de
  lisible plutôt qu'une clé manquante.

Les libellés utilisés dans une liste virtualisée sont résolus **une fois par le panneau**, jamais
par ligne : un défilement re-rend chaque ligne montée à chaque frame, et `useTranslation()` n'est
pas gratuit.

---

## Les tests

**838 tests répartis sur 103 fichiers**, exécutés par Vitest. Les tests unitaires sont colocalisés
(`*.test.ts` à côté du code) et écrits dans le même mouvement que le code, jamais après.

`pnpm validate` — typecheck, lint, vérification de format, tests — doit être vert avant tout
commit.

Ce qui est couvert, en pratique : chaque helper, chaque module d'état et de commandes de chaque
moteur, la traduction de schéma, la file et le backoff du job manager, le catalogue, le contrat
IPC, et les panneaux via Testing Library.

---

## Ajouter quelque chose

| Ce que vous ajoutez | Par où commencer |
|---|---|
| Un panneau | une entrée dans `TOOL_PLACEMENTS`, puis `panels/<nom>/` avec un `index.ts` exportant `definition: { Content, Actions }` |
| Un espace de travail | `WORKSPACE_IDS`, puis son icône et sa famille dans `helpers/workspaces.ts` — le compilateur réclame les deux |
| Un canal IPC | `shared/ipc.ts` d'abord, le handler ensuite ; la signature en est dérivée, donc partez du contrat |
| Un type de maillage ou de lumière | `mesh-primitives.ts` / `light-types.ts` — la barre d'outils, les panneaux et le menu natif lisent ces tables |
| Un outil image | `spaces/image/image-tools.ts`, dans le bon groupe |
| Une forme visuelle partagée | `design/`, un composant par fichier, avec son test |

Deux règles qui font gagner le plus de temps : vérifier qu'un helper n'existe pas déjà avant d'en
écrire un, et lire le voisinage avant d'y toucher. Les registres font que la plupart des ajouts
tiennent en une entrée dans une table, et non en une modification dans cinq fichiers.
