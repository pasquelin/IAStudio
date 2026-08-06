# CLAUDE.md — Scenaria Studio

Guide pour Claude Code (claude.ai/code) sur ce dépôt.

## Nature du projet

**Scenaria Studio** — logiciel de création desktop **Electron + React 19 + TypeScript**, bâti
sur l'**API Scenario** (`docs.scenario.com`). Génération et édition d'images, vidéos, modèles
3D, audio, textures et skyboxes, dans un shell à docks façon VSCode/DaVinci.

Le code, les commentaires et la documentation sont **en français**, accents corrects, jamais
d'ASCII dégradé. Les noms d'API, identifiants et clés techniques restent en anglais.

Gestionnaire de paquets : **pnpm**.

Conception de référence : [`docs/specs/2026-08-06-scenaria-studio-design.md`](docs/specs/2026-08-06-scenaria-studio-design.md).
La lire avant toute décision d'architecture.

---

## Avant de coder — la checklist

Toute création, modification ou refactor déclenche ceci **avant** la première ligne :

1. `git status && git log --oneline -5`
2. `find src -type f \( -name '*.ts' -o -name '*.tsx' \) | sort | wc -l`
3. `find src -type d | sort`
4. Lire le voisinage direct de la zone touchée
5. Vérifier qu'un helper équivalent n'existe pas déjà (`grep` sur le nom et ses synonymes)

« Vas vite » ou « sans questions » ne dispense pas de la checklist : dix secondes contre des
allers-retours.

Si la demande touche l'API Scenario, **lire `docs/scenario-api/` avant d'aller sur le web**.
C'est la copie locale au 6 août 2026, 209 pages, et c'est la version sur laquelle ce code a
été écrit.

---

## Les invariants d'architecture

Ces cinq règles gouvernent tout. Les enfreindre casse le projet dans ce qu'il a de défendable.

### 1. Le renderer ne voit jamais de secret

La clé et le secret API vivent dans le **main**, chiffrés par `safeStorage` de l'OS. Le
renderer n'a ni `fs`, ni `child_process`, ni `nodeIntegration`. `contextIsolation` et
`sandbox` sont activés et le restent.

Le renderer demande « suis-je authentifié ? », **jamais** « quelle est ma clé ? ».

### 2. Toute frontière passe par `shared/ipc.ts`

Typé des deux côtés. Aucun `ipcRenderer.invoke('un-truc')` avec une chaîne littérale dans un
composant. `shared/` n'a **aucune dépendance runtime** — types et constantes uniquement.

### 3. Un moteur est recréable depuis son état, jamais depuis son DOM

`CanvasEngine`, `SceneEngine`, `TimelineEngine`, `AudioEngine` : chacun se reconstruit
intégralement à partir de son état sérialisé.

La raison est concrète : un contexte WebGL ne survit pas au déplacement entre documents, et
détacher un panneau dans une autre fenêtre l'exige. Bénéfice collatéral : le save/load et
l'undo deviennent fiables gratuitement.

### 4. Les moteurs ignorent React ; React les pilote

Comme `MapEngine` dans `map3D`. `engines/` ne contient aucun import React. Les composants
lisent l'état et appellent des méthodes ; ils ne détiennent pas la scène.

### 5. Aucun formulaire de génération écrit à la main

Les entrées de `POST /generate/custom/{modelId}` sont **propres à chaque modèle** et se
découvrent via `GET /models/{modelId}`. Le `ModelRegistry` les traduit en `FieldDescriptor[]`,
`<DynamicForm/>` les rend.

Coder un formulaire en dur pour un modèle donné est un bug, pas un raccourci. Un `kind`
inconnu se rend en saisie brute — jamais de formulaire qui disparaît.

---

## TypeScript

- **Zéro `any`** : `unknown` + type guards, génériques, ou types précis.
- **Pas de `as const`** : union explicite ou inférence.
- **`type` plutôt qu'`interface`**, partout.
- **Pas de `as`** sauf cas justifié, avec le pourquoi en commentaire d'une ligne.
- **Pas de `@ts-ignore` ni `@ts-expect-error`** : corriger à la source.
- `strict`, `noUnusedLocals`, `noUnusedParameters` sont actifs.

## Commentaires

Par défaut : **aucun**. Les noms doivent suffire.

Uniquement pour un *pourquoi* non évident — contrainte cachée, contournement, invariant
subtil. **Une ligne**, courte. Pas de JSDoc décoratif, pas de séparateurs `// === ===`, pas de
paraphrase du code (`// récupère les assets`), pas de TODO sans contexte.

Exception : `src/shared/` et les API publiques des moteurs, où une JSDoc brève sur les types
exportés est utile — c'est le contrat que lisent les deux côtés.

## Style

- Prettier : 2 espaces, guillemets simples, **pas de point-virgule**, trailing commas,
  `printWidth` 100, `arrowParens: avoid`.
- Alias **`@/`** → `src/renderer/src/` ; **`@shared/`** → `src/shared/`.
- Textes utilisateur, libellés, erreurs, toasts : **en français**.
- **Pas de `console.log`** → le `Logger` (`@/utils/logger`), qui route vers le main.
- **`cn()`** pour fusionner les classes Tailwind.

---

## Interface

### La frontière design system / DaisyUI

**Si le composant vit dans un dock, il est maison.** Barres d'outils, inspecteurs, timeline,
outliner, asset browser, barre de titre, onglets : `src/renderer/src/design/`.

DaisyUI est réservé aux surfaces où l'application redevient une application : préférences,
dialogues, gestion des clés API, onboarding.

### Densité et jetons

Contrôles à 24 px en compact, 28 px en confort. Les jetons de couleur et d'espacement vivent
dans `design/tokens.ts` et sont exposés en variables CSS. **Ne pas écrire de valeur
hexadécimale dans un composant.**

| Jeton | Valeur |
|---|---|
| `bg-base` | `#121212` |
| `bg-surface` | `#1d1f27` |
| `bg-elevated` | `#252833` |
| `accent` | `#3c5ccf` |
| `danger` | `#ff715b` |
| `text` / `text-muted` | `#f8efe6` / `#8b8d98` |

### Le fond reste opaque

Pas de vibrancy, pas de transparence de fenêtre. Dans un studio on juge des couleurs : un fond
translucide fausse la perception de tout ce qui est affiché au-dessus. C'est une décision de
métier. Ne pas la « améliorer ».

### Icônes

`@mdi/js` + `@mdi/react`, via `UiIcon`. Pas de SVG inline dans un composant.

---

## L'API Scenario

- **Auth** : Basic, `base64(apiKey:apiSecret)`. Uniquement dans le main.
- **SDK** : `@scenario-labs/sdk`. Utiliser `job.wait()` plutôt que de réécrire un polling,
  et l'auto-pagination (`for await`) plutôt que de boucler à la main.
- **Tout est asynchrone** : la réponse est un `Job` (`queued` → `in-progress` → `success`),
  `progress` de 0 à 1, `metadata.assetIds` en sortie.
- **429 et 5xx** : backoff exponentiel. Aucun seuil de débit n'est publié — ne pas en supposer.
- **Concurrence des jobs** : bornée par le `JobManager`, réglable dans les préférences.
  Ne jamais lancer une rafale non bornée.

---

## Commandes

```bash
pnpm dev                # electron-vite dev, HMR sur main + preload + renderer
pnpm build              # typecheck + build + electron-builder
pnpm typecheck          # tsc --noEmit sur les trois cibles
pnpm test               # vitest run
pnpm lint               # eslint src
pnpm format             # prettier --write
pnpm validate           # typecheck + lint + format:check + test
pnpm rebuild            # electron-rebuild (obligatoire après touche à better-sqlite3)
pnpm docs:scenario      # régénère docs/scenario-api/ depuis docs.scenario.com
```

`pnpm validate` doit être vert avant tout commit.

---

## Git

Une feature = une branche = **un worktree**. L'index git est partagé entre sessions du même
clone : deux agents dans le même dossier se marchent dessus.

```bash
git worktree add ../scenario-feat-x -b feat/x develop
```

`git add` **par chemin explicite**, jamais `git add -A` : l'index partagé ferait avaler ce
qu'une autre session a mis en attente.

---

## Fichiers à ne pas modifier à la main

- `docs/scenario-api/**` → régénéré par `pnpm docs:scenario`.
- `resources/ffmpeg/**` → binaires.

---

## Pièges connus

| Symptôme | Cause |
|---|---|
| Le canvas est noir après détachement d'un panneau | Contexte WebGL perdu : le moteur doit être reconstruit, pas déplacé |
| `better-sqlite3` refuse de se charger | `pnpm rebuild` oublié après une mise à jour d'Electron |
| Un formulaire de génération est vide | Un `kind` inconnu a fait échouer le descripteur au lieu de retomber en saisie brute |
| 429 en rafale | Concurrence du `JobManager` contournée par un appel direct au SDK |
| Deux historiques undo divergents | Deux fenêtres détiennent le focus d'édition du même document |
