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
14. [Shipping a version](#shipping-a-version)

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

Sixty channels are declared, in four families:

| Family | What it carries |
|---|---|
| `window:*` | window state, full screen |
| `settings:*` | read, write, credentials, authentication state |
| `scenario:*` | model search, model description, generation, job control |
| `project:*` / `assets:*` | project lifecycle, catalogue queries, ingestion |

Ten of them travel the other way — main pushing to the renderer: job and media progress, log
lines, project and settings changes, window state, and the native menu asking the UI to open a
tool or a settings section, run a command, or drop a node into the scene.

Local files are served to the renderer over a custom `scenario://` protocol. The URL is derived
from the asset identifier, so a grid of thumbnails costs no IPC at all — and the renderer still
never handles a file path.

---

## The main process

```
src/main/
├── scenario/
│   ├── client.ts            the @scenario-labs/sdk client, built from stored credentials
│   ├── credentials.ts       reading, validating, and reporting auth state
│   ├── model-registry.ts    GET /models/{id} → FieldDescriptor[]
│   ├── model-catalog.ts     paginated model listing, cached
│   ├── job-manager.ts       the queue, the concurrency, the polling
│   ├── runner.ts            what actually calls generate
│   ├── schema.ts            schema translation and model family inference
│   ├── retry.ts             exponential backoff, taken out of the JobManager and shared
│   ├── asset-catalog.ts     the remote library, read and paginated
│   ├── asset-normalizer.ts  an API asset brought back to the studio's shape
│   ├── owner-scope.ts       which project the active key opens onto
│   ├── filter-expression.ts the search translated for the API
│   ├── limits.ts            the batch sizes the API imposes
│   ├── prompt-assist.ts     variants, translation, style reading
│   ├── assist-queue.ts      the bounded queue of background assistance
│   ├── uploader.ts          sending a file up to the library
│   └── handlers.ts          the scenario:* channels
├── project/
│   ├── store.ts             create and open a project folder, read/write the manifest
│   ├── catalog.ts           the SQLite asset index
│   ├── catalog-thread.ts    the worker carrying it, and its protocol
│   ├── activity-log.ts      what the studio did and failed to do
│   ├── documents.ts         the atomic write of a document
│   ├── sqlite.ts            the SqliteDriver port
│   ├── sqlite-native.ts     better-sqlite3 — production
│   └── sqlite-memory.ts     node:sqlite — tests
├── assets/
│   ├── local-backend.ts     the project's assets, on disk
│   ├── cloud-backend.ts     the same ones, on the library's side
│   ├── sync-plan.ts         what two sides would have to do about each other
│   ├── collector.ts         what a generation drops into the project
│   ├── auto-caption.ts      naming a picture from what the API sees in it
│   └── protocol.ts          the scenario:// protocol
├── settings/                the encrypted store, its adapter, its handlers
├── diagnostics/             the channel the renderer reports a failure through
├── media/                   ingesting a file: probe, hash, proxy, waveform
├── fonts/                   the shipped typefaces and the system's
├── menu/                    the native menu, built from the shared registries
├── update/                  the update check
└── window/                  lifecycle and navigation lockdown
```

### The JobManager is the only thing that polls

The SDK's `job.wait()` reports no progress and caps at 120 seconds — unusable for a progress bar
and unusable for video generation. So the `JobManager` polls `jobs.retrieve` itself, every two
seconds, and pushes progress to the renderer over `evt:job-progress`.

**Polling anywhere else is a bug.** The manager also owns the concurrency (three by default,
settable) and the exponential backoff on 429 and 5xx — no published rate limit exists, so none
is assumed. Bypassing the queue with a direct SDK call is how you get a burst of 429s.

### Two asset backends, one planner

The project and the account's library are two stores, served by two backends of the same shape:
`local-backend.ts` for the folder on disk, `cloud-backend.ts` for the API. What decides what
should move between them lives elsewhere, and is **pure**: `sync-plan.ts`.

That separation carries two promises:

- **a plan can be shown before it costs a single request** — "12 to push, 3 to fetch" is computed
  without transferring anything;
- **two-way syncing stays a policy, not a rewrite.** `planSync` already handles `two-way`, tested,
  even though the studio only ever asks for `push` or `pull` from an explicit selection. It is the
  comparison the three stamps were recorded for; writing it later means bolting it on.

Three stamps, read against one another: `remoteSyncedAt` is the baseline, `localChangedAt` and
`remoteUpdatedAt` say which side moved since. They are **parsed, not compared as text** — an
offset instead of a `Z` would quietly give the wrong answer. An unreadable date counts as "did not
move": refusing to act on a date nobody can read beats overwriting a file on the strength of it.

On the renderer's side, a thumbnail's badge is **derived** by `assetBadgeOf` and never stored: it
depends on the active account, and an API key opens onto exactly one project. Storing it would
mean rewriting every row on every key change — and showing a stale answer in between.

### The activity journal

`project/activity-log.ts` keeps account of what the studio did and failed to do. Three decisions
are frozen into it, each answering a precise defect:

- **`record` returns immediately.** It is called from failure paths: a journal that made its
  callers await would put the disk on the critical path of every error.
- **Lines are written in batches** (`ACTIVITY_FLUSH_MS`, 200 ms), short enough that a failure
  still feels immediate.
- **The catalogue is read per flush, never held.** A project can be closed and another opened
  while lines are still queued.

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

### The first screen

**Everything a static import reaches from `main.tsx` is in the chunk the splash screen waits
for.** That is the only rule, and it decides what opening an empty window costs. The splash has an
entry of its own, precisely so it never pulls this bundle in.

Six things are kept out, each because an ordinary session does not open them all:

| Loaded on demand | Why |
|---|---|
| The **four editors** | a session opens one or two; all four weigh five megabytes |
| The **generation form**, and zod, `react-hook-form`, `@hookform/resolvers` with it | you open a generator, you do not land on one |
| The **Settings** window — its registry, its sections, its draft | fifty kilobytes of another window |
| The **Licences** window | every shipped licence in full, which nobody reads in a usual session |
| The **Usage** window | for a harder reason than its size: the charting library |
| The **font parser** (`opentype.js`) | only text in volume and captions need it |

**A failed `lazy()` cannot be mended by retrying**: React caches the rejection, so the error
boundary's "Retry" button cannot win on those routes. The boundary sits above the routes — the
per-panel ones cover the docks, not the shell holding them — and it catches renders only: not
event handlers, not rejected promises, and not `main.tsx`'s own evaluation, where a throw predates
the boundary and leaves an empty window no React can see.

**A test holds the list**, `eager-graph.test.ts`: it walks the static import graph from `main.tsx`
and fails if any of them reappears. Without it, an `import` added without a thought undoes the
gain while breaking nothing visible — the worst kind of regression, the one only a stopwatch sees.

**It aims at folders, not files.** A guard set on four files of the settings folder lets the fifth
back in; that was fixed at the same time as the settings themselves.

The four editors are loaded when a document of their kind is opened, never before: the one a
session opens costs a few hundred milliseconds it was going to spend anyway.

### The shell

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
`{ id, zone, slot, workspaces }` in order to offer only what the section can open, and duplicating
it would degrade `ToolId` to `string`.

A tool may declare **more than one placement**, for disjoint sets of workspaces — the shelf sits in
the bottom strip nearly everywhere, and in the right column in Video and Audio, where the montage
owns the strip. `tool.test.ts` locks the two invariants that keep this legible: the workspaces of two
placements never overlap, and the placements of one tool share a slot — a tool that changed half as
well as zone would land in a different row of the rail depending on where you came from.

**The order of `TOOL_PLACEMENTS` is the rail's order**, and it also names the default panel below
— a test pins it workspace by workspace.

**Two rules escape the registry**, and only two, because they depend on state or on the workspace,
where `shared/` holds no runtime dependency. Hence a layer above it, in
`helpers/tool-registry.ts`, rather than inside:

- the generator is offered only where a model is chosen or preferred;
- a half nobody has chosen for shows the **first panel the workspace declares there**. It holds
  `null` in the store — an absent key means the half is closed, an id means the user chose. The
  layout is remembered once for all six workspaces while that first panel differs in each: writing
  an id there would impose one workspace's answer on the other five. `shownTool` tells the three
  cases apart, and migrating to version 8 puts every earlier layout back to its default, half by
  half.

---

## Engines

Four of them, no React inside any one.

| Engine | Backed by | Owns |
|---|---|---|
| `CanvasEngine` | PixiJS 8.19 | the image document: layers, shapes, strokes |
| `SceneRenderer` | three.js 0.185 | the 3D scene: meshes, lights, gizmos, camera |
| `TimelineEngine` | mediabunny + Canvas | the sequence: clips, playback, waveforms, filmstrips |
| `engines/audio` | plain sample arrays | the sound edit: crop, fades, gain, normalise, trim silence |
| `SkyboxRenderer` | `ViewportEngine` | the sky from the inside: sun, grading, probes |
| `TextureRenderer` | `ViewportEngine` | the material on a shape: PBR channels, environment, tiling |

The three that show 3D share `engines/viewport/` — canvas, camera, orbit, resizing, on-demand
loop, image-based lighting. Each writing its own was three chances to disagree about a resize
or a disposal.

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
5b. the price shows up           scenario:estimate-cost → POST ?dryRun=true → 402
6. user submits                  scenario:generate
7. JobManager queues it          bounded concurrency
8. it polls                      jobs.retrieve, every 2 s
9. progress flows back           evt:job-progress → status line
10. success                      metadata.assetIds → downloaded into the project
11. the catalogue records it     SQLite → the asset appears in the shelf
```

Steps 3 and 4 are the reason invariant 5 exists. A model's inputs are its own; a form written by
hand is right for exactly one model on exactly one day.

An unknown field kind renders as raw input rather than failing the descriptor — a generation
form that silently loses a field is worse than an ugly one.

**Step 5b is the one call in the studio where a 4xx is the success path.** A `?dryRun=true`
creates no job and spends nothing; the API answers **402**, carrying `estimatedCost` in its body.
`main/scenario/cost.ts` swallows that status and nothing else — a 500 or a dead network is thrown
on, so it reaches the log like every other failure. The port is a function rather than a method,
because the dry run is documented on `workflows.run` as much as on generation.

On the renderer side, `useCostEstimate` debounces at 600 ms **and** keeps a floor between two
requests, derived from `INTERACTIVE_REQUESTS_PER_MINUTE`: a trailing debounce alone has no
ceiling, only a cliff — type slower than its delay and every keystroke becomes a request. The
same estimate is never bought twice, and it does not retry.

**`DynamicForm` is lazy-loaded**, and the three functions that call zod live in
`helpers/dynamic-form-schema`, apart from `helpers/dynamic-form`. The two halves go together:
without the second, `referencePictures` kept zod in the eager graph. zod, `react-hook-form` and
`@hookform/resolvers` are at **zero** in the initial chunk, which drops from 2,030.50 to
1,810.88 kB — measured by VLQ-decoding the sourcemaps, and locked by tests that read the source.
It is one case of the [first screen](#the-first-screen) rule.

---

## Projects and the catalogue

A project is a folder. `project.json` is its manifest (version, name, timestamps); the rest is
structure the studio creates on open — see the [manual](manual/04-projects.md) for the tree.

The **catalogue** is `.index/catalog.db`, a SQLite index of every asset: id, name, type,
location, tags, timestamps, and the path when the asset is local. It exists so the asset shelf
can search thousands of items without touching the filesystem, and so a project remains portable
— delete `.index/` and it rebuilds.

Assets are either `local` (a file in the project) or `cloud` (still only on Scenario). A local
image is served to the renderer as `scenario://<id>`.

**Documents** are JSON files under `documents/`, one per document, named after its id —
`<id>.scene`, `<id>.seq`. The folder has the last word: a file whose header claims a kind its
extension denies is refused rather than opened in the wrong editor. Writing goes through a
staging file and a `rename`, which is atomic within one folder, so a crash mid-write can never
leave a truncated document where the work was.

The body belongs to the space that wrote it: the main process never reads into it, it stamps an
envelope and hands it back untouched. A space that learns to save therefore needs no channel of
its own. **3D and Textures are wired today** — see `docs/REPRISE.md`.

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
| `ProgressRow`, `ProgressBar` | "something is happening, here is how far" — shared by the generations summary, its expanded list and media import |
| `PropertySection` and the fields | `TextField`, `NumberField`, `SliderField`, `ColorField`, `Vector3Field`, `TextureField`, `PropertyRow` — what the inspector is built from |
| `DynamicForm` | the only generation form there is |
| `Tree`, `Flyout`, `MenuButton`, `MenuRow`, `EmptyState`, `Timecode`, `Separator`, `TooltipHost` | |
| `styles.ts` | class strings shared by more than one component: `FOCUS_RING`, `CONTROL`, `MEDIA_FRAME` |

Writing a row, a panel surface or a picture frame by hand is a style bug, not a shortcut.

### What the design system took back from a library

**Failure toasts no longer come from `react-toastify`**, which has left the dependencies. A toast
is a floating panel of this studio: a library brought its own surface, its own radius and its own
animation to fight the tokens with — exactly why a dock carries no DaisyUI control.
`ActivityToasts` reuses `MENU_SURFACE`, so a toast and a menu look alike because they share the
same class string.

Two libraries went the other way and came in, each for something one does not write oneself:

| | |
|---|---|
| `recharts` | the curves in the usage window — spend per day, per account |
| `opentype.js` | reading a typeface's tables, for 3D text and an image's caption |

`opentype.js` is **loaded on demand**: it does not weigh on the first screen, which has no
typeface to dissect.

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

### What gets translated goes beyond sentences

Four things go through the bundles without looking like it, and each answers an observed defect:

- **key names** — `Space`, `Delete`, `Home` are not English labels left in place: the shortcuts
  screen resolves them like everything else;
- **units and dates** — `formatBytes` computes a size but **does not name it**: the unit's name
  comes from the caller, because `Mio` and `MiB` are the same size in two languages and the
  abbreviations had ended up living in French inside a computation file;
- **the journal's scopes** — an activity line shows a sentence, never the key naming it;
- **the document's own language** — `document.documentElement.lang` follows the chosen language.
  `index.html` carried it hardcoded: a screen reader picks its voice from it, and an English
  interface under `lang="fr"` was read with French phonetics.

Parity between the two bundles is **checked by a test**, key by key, and the same test refuses a
user-visible string hardcoded in a component. That is what stops one language drifting from the
other as things are added.

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

`pnpm validate` — typecheck, lint, format check, tests with coverage budgets — must be green
before any commit.

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

---

## Shipping a version

The studio is distributed as **per-platform installers**, built by GitHub Actions and published
to GitHub Releases, which the application itself reads to update.

### Two branches, two roles

`develop` integrates features as they land; `main` only ever receives release merges, and carries
the tags. **A `v*` tag pushed on `main` is the only trigger of the pipeline.**

```
feat/<name> ──▶ develop ──▶ main ──tag v*──▶ build 3 OS ──▶ draft release ──▶ published
```

### What the pipeline produces

| File | For |
|---|---|
| `.dmg` arm64 and x64 | macOS Apple Silicon and Intel |
| `.zip` arm64 and x64 | what `electron-updater` consumes — not distributed |
| `.exe` (NSIS) | Windows x64 |
| `.AppImage` and `.deb` | Linux x64 |
| `latest.yml`, `latest-mac.yml`, `latest-linux.yml` | the auto-update manifests |
| `*.blockmap` | differential download |

The three platforms are packaged in parallel but **publish nothing**: a final job gathers the
artefacts, **checks that no manifest and no blockmap is missing**, and creates the release as a
**draft**. An incomplete release would break auto-update for the whole installed base with no
visible error — hence the blocking check, and hence publishing staying a human act.

### Versioning

Semver, and the tag is the source of truth: `package.json` must carry the same number as the tag.
A mismatch produces manifests announcing a version that does not exist.

### Auto-update inside the application

`src/main/updater.ts` turns `electron-updater`'s events into a single `UpdateState` (`idle`,
`checking`, `available`, `downloading`, `ready`, `failed`), pushed to the renderer over
`EVENTS.updateState` and rendered by `UpdateStatus` in the status line. Three traits matter:

- **`electron-updater` is loaded on the first check**, never at import — otherwise start-up would
  pay some thirty milliseconds before the splash even appears, including in development where no
  check happens.
- **Nothing installs unattended**: the download is automatic, the install happens on the next
  quit, or right away if the user asks.
- **A failure is silent**: not knowing whether a newer version exists is not a problem the user
  has to read about.

### Where to read on

| | |
|---|---|
| [`docs/ci/RELEASE.md`](../ci/RELEASE.md) | the publishing checklist, and the rollback |
| [`docs/ci/SECRETS.md`](../ci/SECRETS.md) | signing secrets: obtaining them, rotating them |
| [`docs/ci/TROUBLESHOOTING.md`](../ci/TROUBLESHOOTING.md) | symptom → cause → fix |
| [`docs/ci/adr/`](../ci/adr/) | the fifteen decisions, with what was ruled out and why |
