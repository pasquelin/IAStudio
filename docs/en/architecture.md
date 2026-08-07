# Scenario Studio — architecture

How the studio is built, and why it is built that way. Written for someone picking the codebase
up. Looking for how to *use* it? See [user-guide.md](user-guide.md).

> 🇫🇷 Ce document existe aussi [en français](../fr/architecture.md).

---

## Contents

1. [The shape of it](#the-shape-of-it)
2. [Six invariants](#six-invariants)
3. [Crossing the process boundary](#crossing-the-process-boundary)
4. [The main process](#the-main-process)
5. [The renderer](#the-renderer)
6. [Engines](#engines)
7. [Generation, end to end](#generation-end-to-end)
8. [Projects and the catalogue](#projects-and-the-catalogue)
9. [The design system](#the-design-system)
10. [Internationalisation](#internationalisation)
11. [Configuration](#configuration)
12. [Testing](#testing)
13. [Adding things](#adding-things)

---

## The shape of it

Electron, three targets, one repository.

```
        ┌─────────────────────────────────────────────┐
        │  main process         Node, full privilege  │
        │                                             │
        │  · API credentials, encrypted by the OS     │
        │  · Scenario SDK client                      │
        │  · JobManager — the only thing that polls   │
        │  · ModelRegistry — schemas → descriptors    │
        │  · SQLite catalogue, project folders        │
        │  · native menu, windows, protocols          │
        └───────────────────┬─────────────────────────┘
                            │  ipcMain.handle / webContents.send
        ┌───────────────────┴─────────────────────────┐
        │  preload              the bridge, and only  │
        │  contextBridge.exposeInMainWorld            │
        └───────────────────┬─────────────────────────┘
                            │  window.studio, typed
        ┌───────────────────┴─────────────────────────┐
        │  renderer      sandboxed, no Node, no fs    │
        │                                             │
        │  · React 19 shell — rails, zones, docks     │
        │  · engines: canvas, scene, timeline, audio  │
        │  · zustand stores, TanStack Query           │
        └─────────────────────────────────────────────┘
```

`contextIsolation` and `sandbox` are on and stay on. The renderer has no `fs`, no
`child_process`, no `nodeIntegration`. Navigation is locked down at the `app` level, and
`openExternal` only lets `https:` through.

---

## Six invariants

These govern everything. Breaking one breaks what the project is worth defending for.

### 1. The renderer never sees a secret

The API key and secret live in the main process, encrypted by the OS through Electron's
`safeStorage`. The renderer asks *"am I authenticated?"* — **never** *"what is my key?"*.

### 2. Every boundary goes through `shared/ipc.ts`

Typed on both sides. No `ipcRenderer.invoke('some-string')` in a component. `shared/` has **no
runtime dependency** — types and constants only, which is what lets both processes import it.

`main/ipc/handle.ts` derives each handler's signature from the channel itself, so a handler that
does not match its declared contract does not compile.

### 3. An engine is rebuildable from its state, never from its DOM

`CanvasEngine`, `SceneRenderer`, `TimelineEngine` each reconstruct entirely from their
serialised state.

The reason is concrete: a WebGL context does not survive being moved between documents, and
detaching a panel into another window requires exactly that. Save/load and undo become reliable
for free.

### 4. Engines ignore React; React drives them

`engines/` contains **no React import**. Components read state and call methods; they never own
the scene.

### 5. No hand-written generation form

The inputs of `POST /generate/custom/{modelId}` are **specific to each model** and discovered
through `GET /models/{modelId}`. The `ModelRegistry` translates them into `FieldDescriptor[]`,
and `<DynamicForm/>` renders them.

Hard-coding a form for a given model is a bug, not a shortcut. An unknown field kind falls back
to raw input — never a form that vanishes.

### 6. The UI thread does UI only

Anything that might exceed 16 ms goes elsewhere, in this order of reflex:

1. **GPU** — filters, blending, normal maps, AO, resizing.
2. **Web Worker** — thumbnails, waveforms, BVH, large GLB parsing.
3. **OffscreenCanvas + Worker** — offscreen renders.
4. **`utilityProcess`** — ffmpeg, indexing, hashing, transfers.

Every long task is **cancellable**, **reports progress**, and runs in a pool bounded to
`hardwareConcurrency − 2`.

`better-sqlite3` is synchronous: a heavy query on the main process blocks every window, so
non-trivial catalogue queries go through `worker_threads`.

Two threads exist for exactly that reason. `main/project/catalog-worker.ts` owns the database
and answers a message loop, so a search across thousands of assets never freezes a window.
`renderer/src/engines/audio/audio.worker.ts` runs the sound chain off the window's thread, with
sample buffers **transferred** rather than copied. Both are wiring only: the catalogue, the
dispatch and the audio arithmetic are tested on their own, without a worker in sight.

---

## Crossing the process boundary

`src/shared/ipc.ts` declares the channels as literal types and the `StudioBridge` shape. Both
sides import it; neither can drift.

```
renderer                    preload                  main
────────                    ───────                  ────
getBridge()          →  window.studio         →  ipcMain.handle(CHANNELS.x)
  .scenario                 exposeInMainWorld       handlers derived from the channel
  .searchModels(q)          contextBridge           returns typed data
```

Forty-five channels are declared, in four families:

| Family | What it carries |
|---|---|
| `window:*` | window state, full screen |
| `settings:*` | read, write, credentials, authentication state |
| `scenario:*` | model search, model description, generation, job control |
| `project:*` / `assets:*` | project lifecycle, catalogue queries, ingestion |

Six of them travel the other way — main pushing to the renderer: job progress, log lines,
project changes, and the native menu asking the UI to open a tool, run a command, or drop a node
into the scene.

Local files are served to the renderer over a custom `scenario://` protocol. The URL is derived
from the asset identifier, so a grid of thumbnails costs no IPC at all — and the renderer still
never handles a file path.

---

## The main process

```
src/main/
├── scenario/
│   ├── client.ts          the @scenario-labs/sdk client, built from stored credentials
│   ├── credentials.ts     reading, validating, and reporting auth state
│   ├── model-registry.ts  GET /models/{id} → FieldDescriptor[]
│   ├── model-catalog.ts   paginated model listing, cached
│   ├── job-manager.ts     the queue, the concurrency, the polling
│   ├── runner.ts          what actually calls generate
│   ├── schema.ts          schema translation and model family inference
│   └── handlers.ts        the scenario:* channels
├── project/
│   ├── store.ts           create and open a project folder, read/write the manifest
│   ├── catalog.ts         the SQLite asset index
│   ├── sqlite.ts          the SqliteDriver port
│   ├── sqlite-native.ts   better-sqlite3 — production
│   └── sqlite-memory.ts   node:sqlite — tests
├── settings/              the encrypted store, its adapter, its handlers
├── assets/                asset records and the scenario:// protocol
├── media/                 ingesting a file: probe, hash, proxy, waveform
├── menu/                  the native menu, built from the shared registries
└── window/                lifecycle and navigation lockdown
```

### The JobManager is the only thing that polls

The SDK's `job.wait()` reports no progress and caps at 120 seconds — unusable for a progress bar
and unusable for video generation. So the `JobManager` polls `jobs.retrieve` itself, every two
seconds, and pushes progress to the renderer over `evt:job-progress`.

**Polling anywhere else is a bug.** The manager also owns the concurrency (three by default,
settable) and the exponential backoff on 429 and 5xx — no published rate limit exists, so none
is assumed. Bypassing the queue with a direct SDK call is how you get a burst of 429s.

### Ingesting media

Importing a file is a pipeline with named stages — `probe`, `hash`, `proxy`, `peaks` — each
reporting a ratio across the *whole* ingest, not within itself, so a progress bar means the same
thing at every stage. It is cancellable at any point: a proxy of a twenty-minute rush must stop
on demand.

`ffprobe` reads what the file actually is; the codec decides the rest. What WebCodecs decodes
natively is played directly, and anything else gets a proxy — both spellings of each codec are
matched (`h264` and `avc1`, `av1` and `av01`), because a probe read through the wrong one asks
for a proxy nobody needs.

ffmpeg is resolved at runtime and may be absent. When it is, importing still works — you lose
the proxy and the waveform, and the interface is told exactly which part is unavailable rather
than failing opaquely.

### SQLite through a port

`catalog.ts` talks to a `SqliteDriver` interface, not to a library. Production binds
`better-sqlite3`; tests bind Node's built-in `node:sqlite`. A test that imports `better-sqlite3`
directly is a test that will fail strangely — bind the port instead.

`pnpm rebuild:native` is mandatory after any Electron upgrade, or the native module refuses to
load.

---

## The renderer

```
src/renderer/src/
├── app/          the shell
│   ├── Shell.tsx        rails, zones, resize handles, the document area
│   ├── Rail.tsx         the icon strips
│   ├── ToolWindow.tsx   one docked tool, memoised
│   ├── DocumentArea.tsx Dockview, documents only
│   ├── TitleBar.tsx     workspace switcher, native traffic lights
│   └── documents.tsx    which editor renders which document kind
├── design/       the in-house design system — see below
├── engines/      canvas, scene, timeline, audio, and shared history
├── spaces/       one editor per document kind
│   ├── image/      Pixi-backed canvas and its tools
│   ├── three/      the three.js viewport and its tools
│   ├── video/      the timeline canvas, the monitor, its tools
│   └── audio/     the waveform, its tools, the decoder
├── panels/       the dockable tools
├── stores/       zustand: documents, tools, layouts, models, assets, jobs, settings, keymap
├── hooks/        shortcuts, native menu, density, window state, debounce…
├── helpers/      pure functions, all unit-tested
└── services/     the bridge accessor and failure-message mapping
```

### The shell

The four editors are loaded when a document of their kind is opened, never before. Statically
imported, all four would land in the chunk the splash screen waits for — five megabytes to open
a window showing an empty centre. A session uses one or two of them, and the one it opens costs a
few hundred milliseconds it was going to spend anyway.

Dockview holds the centre and **only** the centre: documents and their tabs. Tool windows are
laid over the chassis gutter by the shell itself, because their behaviour — a rail that switches
between them, halves that split a zone — is not what a docking library models.

Tool windows are memoised: a zone drag writes a new size on every `pointermove`, and without it
each frame re-renders both halves and everything inside, including a virtualised asset grid.
Their callbacks are kept stable for that memo to bite.

### Registries, not lists

`shared/domain/tool.ts` declares where each tool lives and which workspaces it serves.
`shared/domain/workspace.ts` declares the workspaces. The renderer enriches them with icons and
components; the **native menu reads the same tables**. Adding a seventh workspace is one entry,
and the compiler then demands its icon and its family.

That is why the tool registry lives in `shared/` and not in the renderer: the main process needs
`{ id, zone }` to restore a closed tool, and duplicating it would degrade `ToolId` to `string`.

---

## Engines

Four of them, no React inside any one.

| Engine | Backed by | Owns |
|---|---|---|
| `CanvasEngine` | PixiJS 8.19 | the image document: layers, shapes, strokes |
| `SceneRenderer` | three.js 0.185 | the 3D scene: meshes, lights, gizmos, camera |
| `TimelineEngine` | mediabunny + Canvas | the sequence: clips, playback, waveforms, filmstrips |
| `engines/audio` | plain sample arrays | the sound edit: crop, fades, gain, normalise, trim silence |

The audio one is a pair of modules rather than a class — `audio-data.ts` does the sample work,
`edits.ts` holds an `AudioEditState` replayable from the source file. Same invariant as the other
three: the edit is the state, never the buffer currently in memory.

Each pairs with a plain state module (`canvas-state.ts`, `scene-state.ts`, `timeline-state.ts`)
and a command module. Commands are the only way state changes, which is what makes undo a
generic mechanism in `engines/core/history.ts` rather than three bespoke ones.

`node-factory.ts`, `mesh-primitives.ts`, `light-types.ts` and `three-factory.ts` keep the
*description* of a node separate from its three.js instantiation — so a scene serialises without
dragging the renderer along, and rebuilds from that serialisation alone.

Playback goes through a single token held by the `PlaybackManager`: two active players is how
scrubbing starts stuttering for no visible reason.

---

## Generation, end to end

```
1. user picks a model            Models panel → stores/models
2. renderer asks for its schema  scenario:describe-model
3. main fetches it               GET /models/{id}
4. ModelRegistry translates      JSON schema → FieldDescriptor[]
5. DynamicForm renders it        react-hook-form + a zod schema built from the descriptors
6. user submits                  scenario:generate
7. JobManager queues it          bounded concurrency
8. it polls                      jobs.retrieve, every 2 s
9. progress flows back           evt:job-progress → Jobs panel
10. success                      metadata.assetIds → downloaded into the project
11. the catalogue records it     SQLite → the asset appears in the shelf
```

Steps 3 and 4 are the reason invariant 5 exists. A model's inputs are its own; a form written by
hand is right for exactly one model on exactly one day.

An unknown field kind renders as raw input rather than failing the descriptor — a generation
form that silently loses a field is worse than an ugly one.

---

## Projects and the catalogue

A project is a folder. `project.json` is its manifest (version, name, timestamps); the rest is
structure the studio creates on open — see the [user guide](user-guide.md#projects) for the tree.

The **catalogue** is `.index/catalog.db`, a SQLite index of every asset: id, name, type,
location, tags, timestamps, and the path when the asset is local. It exists so the asset shelf
can search thousands of items without touching the filesystem, and so a project remains portable
— delete `.index/` and it rebuilds.

Assets are either `local` (a file in the project) or `cloud` (still only on Scenario). A local
image is served to the renderer as `scenario://<id>`.

---

## The design system

**If a component lives in a dock, it is in-house.** Toolbars, inspectors, timelines, outliners,
the asset browser, the title bar, tabs — all of it in `src/renderer/src/design/`.

DaisyUI is reserved for the surfaces where the application becomes an application again:
preferences, dialogs, API key management, onboarding.

Key primitives, all in `design/`:

| | |
|---|---|
| `Panel`, `PanelHeader` | the dark rounded surface and its title row |
| `Row` | **the** line, everywhere — thumbnail or icon, title, subtitle, actions, tooltip on a truncated name |
| `Collection`, `CollectionBar` | the virtualised two-view list, and its search/facet/sort bar |
| `MediaTile`, `Thumbnail` | the captioned square tile, and the same picture at a fixed size |
| `Toolbar`, `ToolButton`, `Button`, `UiIcon` | the shared bar, its icon buttons, its labelled ones, the only door icons come through |
| `ProgressRow`, `ProgressBar` | "something is happening, here is how far" — shared by the jobs bar and media import |
| `PropertySection` and the fields | `TextField`, `NumberField`, `SliderField`, `ColorField`, `Vector3Field`, `TextureField` — what the inspector is built from |
| `DynamicForm` | the only generation form there is |
| `Tree`, `Flyout`, `MenuButton`, `MenuRow`, `EmptyState`, `Timecode`, `Separator`, `TooltipHost` | |
| `styles.ts` | class strings shared by more than one component: `FOCUS_RING`, `CONTROL`, `MEDIA_FRAME` |

Writing a row, a panel surface or a picture frame by hand is a style bug, not a shortcut.

### Tokens and density

Colours live in the `@theme` block of `src/renderer/src/index.css`; the `--sc-*` gauges live in
`:root`, redeclared under `:root[data-density='compact']`. **No hexadecimal value in a
component**, and no pixel where a gauge exists — that single redeclaration is what makes the
density setting reach every control at once.

Surfaces are **darker** than the chassis, the opposite of the web habit. That inversion is what
reads as "panels resting on a frame".

The background stays opaque: in a studio you judge colours, and translucency falsifies
everything above it. It is a domain decision, not a style one.

---

## Internationalisation

One JSON per language in `src/shared/i18n/` — French and English, kept at strict parity. They
live in `shared/` because the native menu is built by the main process and the UI by the
renderer, and the two must say the same thing.

- **All identifiers, comments, JSDoc, file names, i18n keys, IPC channels and test descriptions
  are in English**, everywhere in `src/`.
- The only exceptions are `fr.json` itself, and the expected values in tests when they come from
  the French bundle.
- No hard-coded user-facing string in a component. Dynamic keys (`assetTypes.${type}`,
  `capabilities.${capability}`) resolve against the same bundles, with the raw API name as a
  fallback so an unknown value shows something readable rather than a missing key.

Labels used inside a virtualised list are resolved **once by the panel**, never per row: a scroll
re-renders every mounted row on each frame, and `useTranslation()` is not free.

---

## Configuration

Three layers, and they never mix: what the user sets, what a developer sets, and what the build
needs.

### What the user sets

`shared/domain/settings.ts` declares the whole shape — appearance, generation, storage, media.
It is the contract, and it is deliberately the **only** settings type the renderer can see:
**API credentials never appear in it**. The renderer reads `AuthState`, not a key.

Persistence goes through a `PersistenceAdapter` port. Production binds `electron-store` plus
`safeStorage` (`settings/adapter.ts`); tests bind an in-memory adapter. Plain values land in
`settings.json` in the user's config directory; credentials are encrypted first, then stored
base64-encoded — `safeStorage` yields bytes, and a JSON file holds strings.

If `safeStorage.isEncryptionAvailable()` is false, storing credentials **throws** rather than
falling back to clear text. That refusal is the feature.

Everything read back is validated (`settings/validation.ts`): a config file is untyped by
nature, and a value edited by hand or left over from an older build must be dropped, not
trusted.

### What a developer sets

`secrets/.env`, read **at runtime** by the main process, **in development only**
(`app.isPackaged === false`). It is never handed to the bundler: injecting a secret at build time
would carve it into `out/`, and an `.asar` opens in a text editor.

| Variable | Used by |
|---|---|
| `SCENARIO_API_KEY`, `SCENARIO_API_SECRET` | the API client, as a fallback |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | packaging only — never at runtime |

Credentials saved in the settings **win** over the ones in `.env`. The file is a convenience for
development, not a second source of truth.

`ELECTRON_RENDERER_URL` is set by electron-vite in watch mode and is what makes the window load
from the dev server rather than from disk.

### What the build needs

`scripts/dist.sh` loads `secrets/.env` and calls electron-builder. Left empty, the three Apple
variables make it skip signing and notarisation — it logs that it did, and `pnpm dist` still
produces an application. It is simply unsigned, and Gatekeeper will say so on first open.
Filling them in enables the full chain with no code change.

The ffmpeg binary resolves in a fixed order — **bundled**, then **configured**, then the
**`PATH`** — and returns null rather than throwing when none of the three answers. The interface
is then told which part of the pipeline is unavailable, so it can say so instead of failing
opaquely.

---

## Testing

**1398 tests across 148 files**, run by Vitest. Unit tests are colocated (`*.test.ts` next to the
code) and written in the same movement as the code, never after.

`pnpm validate` — typecheck, lint, format check, tests — must be green before any commit.

What gets tested, in practice: every helper, every state and command module of every engine,
the schema translation, the job manager's queue and backoff, the catalogue, the IPC contract,
and the panels through Testing Library.

---

## Adding things

| You want to add | Where to start |
|---|---|
| A tool panel | an entry in `TOOL_PLACEMENTS`, then `panels/<name>/` with an `index.ts` exporting `definition: { Content, Actions }` |
| A workspace | `WORKSPACE_IDS`, then its icon and family in `helpers/workspaces.ts` — the compiler asks for both |
| An IPC channel | `shared/ipc.ts` first, then the handler; the signature is derived, so start from the contract |
| A mesh or light kind | `mesh-primitives.ts` / `light-types.ts` — the toolbar, the panels and the native menu all read those tables |
| An image tool | `spaces/image/image-tools.ts`, in the right group |
| A shared visual shape | `design/`, one component per file, plus its test |

Two rules that save the most time: check that a helper does not already exist before writing one,
and read the neighbourhood before touching it. The registries mean most additions are one entry
in one table, not a change in five files.
