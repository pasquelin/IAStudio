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
        │  · six engines, no React inside any         │
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

Every engine reconstructs entirely from its serialised state — `CanvasEngine` and `SceneRenderer`
as much as the sound, which is a pair of modules rather than a class and holds to the same rule:
the edit is the state, never the buffer in memory.

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

Three threads exist for exactly that reason. `main/project/catalog-worker.ts` owns the database
and answers a message loop, so a search across thousands of assets never freezes a window.
`renderer/src/engines/audio/audio.worker.ts` runs the sound chain off the window's thread, with
sample buffers **transferred** rather than copied. And `renderer/src/engines/scene/bvh.worker.ts`
builds a mesh's collision trees — **one worker, not a pool**: loading a scene asks for one BVH per
mesh in a burst, and bounding that burst to a single thread keeps the rest of the window
responsive. All three are wiring only: the catalogue, the dispatch, the audio arithmetic and the
BVH build are tested on their own, without a worker in sight.

**What waits for an answer is a module, not a private map.** `bvh-inflight.ts` holds the requests
sent to the worker and the promises waiting on them, and it reports how many are out. The reason
is not elegance: while that map lived inside the builder's closure, the line sweeping it after a
refused send was an assurance no test could reach — emptied, the gate stayed green. **A register
nothing can read is a register nothing measures**, which is the remedy `framingPlacement` already
got when it left `frameSelection`.

**And two processes, for what must not share a heap.** `main/media/peaks-worker.ts` reduces a
waveform in a `utilityProcess`: an hour of PCM measured 129 ms on the main thread, and every
window of the studio waited it out. `main/dictation/stt-worker.ts` holds Parakeet — six
hundred million parameters, 640 MB of weights — in a `utilityProcess` of its own. A thread would
not have done: it shares its process's heap and lifetime, so the 700 MB would stay in the main
process's footprint and a crash in the native addon would take the studio with it. Everything
that decides anything — the buffer, the queue, the state machine — sits beside it and is tested
without it. See [`docs/stt/`](../stt/00-architecture.md) and
[`ADR-17`](../ci/adr/ADR-17-moteur-de-dictee-hors-processus.md).

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

**83 channels in `CHANNELS`, plus 18 events in `EVENTS`** — counted on the evening of 9 August
2026, and the figure moves with every batch: **it moved twice on the day this sentence was
written.** Counting it (`CHANNELS`, two spaces of indentation) costs less than believing it.
Twenty-one prefixes, the busiest being:

| Family | Count | What it carries |
|---|---|---|
| `scenario:*` | 13 | model search, model description, generation, job control |
| `assets:*` / `cloud:*` | 9 + 6 | project catalogue, ingestion, and the account's library |
| `dictation:*` | 8 | microphone permissions, model, recognition session |
| `settings:*` / `accounts:*` | 6 + 5 | read, write, credentials, authentication state |
| `document:*` | 6 | opening, writing and listing the project's documents |
| `styles:*` | 4 | material settings, saved and replayed |
| `favorites:*`, `workflows:*`, `project:*`, `media:*`, `window:*` | 3 each | — |
| `dialog:*`, `fonts:*`, `update:*` | 2 each | — |
| `activity:*`, `diagnostics:*`, `scene:*`, `texture:*`, `skybox:*` | 1 each | — |

**`EVENTS` is the other direction** — main pushing to the renderer, eighteen entries: job and
media progress, log lines, project and settings changes, window state, dictation previews, and the
native menu asking the UI to open a tool or a settings section, run a command, or drop a node into
the scene.

The split is not cosmetic: **every `on…` on the bridge subscribes to exactly one entry of
`EVENTS`**, and every call method maps to exactly one of `CHANNELS`.

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
│   ├── cost.ts              what a generation would cost, without running it
│   ├── usage.ts             the units spent, and the price list
│   ├── workflow-registry.ts an API workflow translated into a graph
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
├── dictation/               speech recognition: permissions, model, segmenting, handlers
├── settings/                the encrypted store, its adapter, its handlers
├── favorites/               the pinned recipes, kept outside every project
├── styles/                  the material settings replayed from one texture to the next
├── scene/                   exporting a scene, and validating it
├── export/                  writing several files into a folder: a material, six sky faces
├── diagnostics/             the channel the renderer reports a failure through
├── media/                   ingesting a file: probe, hash, proxy, waveform
├── fonts/                   the shipped typefaces and the system's
├── menu/                    the native menu, built from the shared registries
├── ipc/                     `handle`, `register`, `broadcast` — the machinery of invariant 2
├── persistence.ts           the atomic write of the small files kept for the user
├── update/                  the update check
└── window/                  lifecycle and navigation lockdown
```

> **`persistence.ts` was written at the third copy**, and that is the rule it carries: the job
> notes, the pinned recipes and the saved styles each had the same twenty lines, each annotated
> "written the way the job notes are, and for the same reason". The document keeps its own in
> `project/documents.ts` — not by oversight: it holds a register of in-flight names and creates the
> user's folder, neither of which belongs to anyone else. **The temporary file's name is a
> parameter, not a constant**: the three stores serialise their writes, but several windows write
> into the same project folder.

### The JobManager is the only thing that polls

The SDK's `job.wait()` reports no progress and caps at 120 seconds — unusable for a progress bar
and unusable for video generation. So the `JobManager` polls `jobs.retrieve` itself — every two
seconds being the **floor**, not the rate, see below — and pushes progress to the renderer over
`evt:job-progress`.

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
├── engines/      canvas, scene, timeline, audio, viewport, skybox, texture, graph, gpu, and `core/` — the shared history
├── spaces/       one editor per document kind — SEVEN, as many as there are workspaces
│   ├── image/      Pixi-backed canvas and its tools
│   ├── three/      the three.js viewport and its tools
│   ├── video/      the timeline canvas, the monitor, its tools
│   ├── audio/      the waveform, its tools, the decoder
│   ├── textures/   a material's channels, and their tiled preview
│   ├── skyboxes/   the immersive sky and its three flat projections
│   └── graph/      the node editor — it places, saves and runs
├── panels/       the fifteen dockable tools
├── home/         the home screen and its fourteen bands — a page, not a layout
├── settings/     the settings window, loaded on demand
├── usage/        the consumption window, likewise
├── licences/     the licences window, likewise
├── dictation/    what the renderer sees of dictation: button, preview, level
├── stores/       zustand: documents, tools, layouts, models, assets, jobs, settings, keymap
├── hooks/        shortcuts, native menu, density, window state, debounce…
├── helpers/      pure functions, all unit-tested
├── services/     the bridge accessor and failure-message mapping
├── i18n/         the window-side i18next setup
├── types/        `window.studio`, declared global — the renderer's only types file
├── main.tsx      the entry — everything it reaches statically is in the first screen
└── splash.ts     the splash entry, kept separate so it never pulls that bundle
```

### The first screen

**Everything a static import reaches from `main.tsx` is in the chunk the splash screen waits
for.** That is the only rule, and it decides what opening an empty window costs. The splash has an
entry of its own, precisely so it never pulls this bundle in.

Seven things are kept out, each because an ordinary session does not open them all:

| Loaded on demand | Why |
|---|---|
| The **seven editors** | a session opens one or two; all seven weigh five megabytes |
| The **fifteen panels** | a workspace shows three or four, never fifteen |
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

**A test holds all seven rows**, `eager-graph.test.ts`: it walks the static import graph from
`main.tsx` and fails if any of them reappears. Without it, an `import` added without a thought
undoes the gain while breaking nothing visible — the worst kind of regression, the one only a
stopwatch sees.

**The panels went out in their turn**, and that is what shrank the neighbours list.
`app/tool-components.ts` used to import them all outright; it now declares, per panel, **the
module to load and what its header does** — that second half is needed, because the title row lays
itself out on the first paint and a separator arriving a frame later would shift a row already on
screen. Measured at the same commit on both sides, preloads counted, no sourcemaps:
**2,331,395 → 2,081,385 bytes, −250,010, that is −10.7%.**

> **A glob on the folder would remove the copy of each panel's name, and it was written then taken
> back out.** `eager-graph.test.ts` walks **static** imports: a glob is invisible to it, and the
> very guard that watches this property would have stayed green whatever the glob did to the entry
> chunk. The copy stays, and `tool-components.test.ts` holds it — a `layers` naming the meshes
> module would swap the two in silence.

**Two neighbours remain**, and neither is an editor: they are helpers something on the first
screen reaches for next to one. There were six; **four left with the panels**, since they came in
through a panel rather than through the shell. The test makes it a **budget**: the list may
shrink, never grow. A third entry means the first screen reached further than it needed to.

**The graph is the one workspace whose reader is not behind its editor**: `document-io.ts` parses
a graph as it parses every other kind, so `engines/graph/serialize.ts` comes in. The mutation
engine and the canvas stay out — `@xyflow/react` is never in the entry chunk. It was two modules
wider until the reserved node id moved down into `shared/domain/graph.ts`: a predicate reached
from the reader pulled `mutations.ts`, which pulled `connect.ts` and `handles.ts` — half the
engine, for a string comparison.

**It aims at folders, not files.** A guard set on four files of the settings folder lets the fifth
back in; that was fixed at the same time as the settings themselves.

The six editors are loaded when a document of their kind is opened, never before: the one a
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
the bottom strip nearly everywhere, and in the right column in Video, Audio and 3D, where a
timeline owns the strip. `tool.test.ts` locks the two invariants that keep this legible: the workspaces of two
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
  layout is remembered once for all seven workspaces while that first panel differs in each:
  writing an id there would impose one workspace's answer on the other six. `shownTool` tells the
  three cases apart, and migrating to version 8 puts every earlier layout back to its default,
  half by half.

---

## Engines

Six of them, no React inside any one.

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

**Six engines, ten folders under `engines/`: the other four are not engines.** `core/` carries the
shared history, `viewport/` the base of the three 3D views, `gpu/` the shader passes and the frame
counter, and `graph/` — **the one that could mislead** — is functions only: commands, mutations,
serialisation, edge validation, and since `f17de270` the run plan and its executor. The node editor
still has no engine, because it has nothing of its own to draw: `@xyflow/react` renders, the domain
decides, and running is an order of passage computed and then walked.

The audio one is a pair of modules rather than a class — `audio-data.ts` does the sample work,
`edits.ts` holds an `AudioEditState` replayable from the source file. Same invariant as the other
three: the edit is the state, never the buffer currently in memory.

Each pairs with a plain state module (`canvas-state.ts`, `scene-state.ts`, `timeline-state.ts`)
and a command module. Commands are the only way state changes, which is what makes undo a
generic mechanism in `engines/core/history.ts` rather than three bespoke ones.

**A command's provenance is declared; it is not guessed.** An open gesture — a slider held, a drag
under way — merges the commands arriving while it lasts, which is the whole point of it. But **a
command from elsewhere** — a generation landing, a double-click, a drop — does not belong to the
cursor a panel may be holding, and merged into it, it makes an undo entry disappear. So it goes
through `runOutsideGesture` rather than `runCommand`. **The store cannot infer that difference**:
no rule on `command.id` says where a write came from, and guessing from a gesture's first command
moves the race window instead of closing it — a field opens its gesture **on focus**, with no
command at all. One caller is concerned today, `setSkyboxSource`, which serves all three ways a
picture enters a sky.

`node-factory.ts`, `mesh-primitives.ts`, `light-types.ts` and `three-factory.ts` keep the
*description* of a node separate from its three.js instantiation — so a scene serialises without
dragging the renderer along, and rebuilds from that serialisation alone.

Playback goes through a **single token**, `playbackToken` — a module value in
`engines/timeline/playback.ts`, not a manager: whoever wants to play acquires it and hands over
the means to stop, and the next acquisition cuts the previous one off. Two active players is how
scrubbing starts stuttering for no visible reason. The timeline and the Audio workspace's waveform
both take it from the same place.

---

## Generation, end to end

```
1. user picks a model            Models panel → stores/models
2. renderer asks for its schema  scenario:describe-model
3. main fetches it               GET /models/{id}
4. ModelRegistry translates      JSON schema → FieldDescriptor[]
5. DynamicForm renders it        react-hook-form + a zod schema built from the descriptors
5b. the price shows up           scenario:estimate-cost → POST ?dryRun=true → 200 (402 as fallback)
6. user submits                  scenario:generate
7. JobManager queues it          bounded concurrency
8. it polls                      jobs.retrieve — 2 s is the FLOOR, not the rate
9. progress flows back           evt:job-progress → status line
10. success                      metadata.assetIds → downloaded into the project
11. the catalogue records it     SQLite → the asset appears in the shelf
```

Steps 3 and 4 are the reason invariant 5 exists. A model's inputs are its own; a form written by
hand is right for exactly one model on exactly one day.

An unknown field kind renders as raw input rather than failing the descriptor — a generation
form that silently loses a field is worse than an ugly one.

**Step 8 slows down as the load rises, and that is what makes it safe.** The interval is
`max(floor, ceil(running × 60,000 ÷ POLL_REQUESTS_PER_MINUTE))`: two seconds is what one or two
generations get, not a fixed rate. At a fixed rate, four concurrent generations ask for 120
requests a minute against the hundred the API grants — the limiter then holds every poll, the SDK
retries, and **a generation that is running and being paid for is reported as a rate-limit failure
fifteen seconds in**. The budget itself is *derived* from the constants of `rate-limiter.ts` rather
than written out, precisely so it cannot go quietly false the day one of them is tuned.

**Step 5b reads a price out of two shapes of answer, because the reference and the server do not
agree.** A `?dryRun=true` creates no job and spends nothing. The reference documents a **402**
carrying `estimatedCost`; the server, observed on both endpoints, answers **200** with
`creativeUnitsCost` beside an empty `job`. `main/scenario/cost.ts` reads both, the 200 first and
the 402 as a fallback — a 500 or a dead network is thrown on, so it reaches the log like every
other failure.

> **Reading only the documented 402 is how no badge ever showed a price.** The defect was
> invisible by construction: a button with no figure reads as a model the API declines to price,
> exactly like the three other cases that yield `null`. It took running a real App to see it.
> **In front of an API, the reference says what was intended, not what answers.**

The port is a function rather than a method because `generate.runModel` and `workflows.run` price
a dry run the same way: which of the two is targeted is the target's business, not the port's.

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
its own. **All seven kinds can write themselves today** — image, scene, sequence, audio, skybox,
texture and graph, declared in one place, `IO_BY_KIND` in `app/document-io.ts`. A kind absent from
that table has a Save that does nothing, rather than one that writes an empty body.

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
| `PropertySection` and the fields | `TextField`, `NumberField`, `SliderField`, `RangeField`, `ColorField`, `VectorField`, `ToggleField`, `TextureField`, `AssetDropField`, `PropertyRow` — what the inspector is built from |
| `DynamicForm` | the only generation form there is |
| `FormHeader` | the line naming what the form is for — the model in Generate, the App in its runner |
| `Tree`, `Flyout`, `MenuButton`, `MenuRow`, `EmptyState`, `Timecode`, `Separator`, `TooltipHost` | |
| `styles.ts` | class strings shared by more than one component: `FOCUS_RING`, `CONTROL`, `MEDIA_FRAME` |

Writing a row, a panel surface or a picture frame by hand is a style bug, not a shortcut.

### A collection announces what it is, and that is a single decision

`Collection` picks the container role and the cell role **together** — `rolesFor`:
`listbox`/`option` when rows can be selected, `list`/`listitem` when they can only be opened, no
role at all when they answer to nothing. The two cannot diverge, and that is the point: an
`option` with no `listbox` around it is invalid ARIA, which engines ignore outright.

Three consequences for the caller, none of them optional:

- **`label` is required.** A `listbox` with no name is a WCAG 2.0 A violation (4.1.2), and panels
  that pass none all announce themselves as "listbox", indistinguishable from one another. Each
  passes the title it already carries.
- **The announced count is the data's, not the virtualised window's.** `aria-posinset` and
  `aria-setsize` come from the real index: without them a 2000-model catalogue says "1 of 35",
  and the number changes as you scroll.
- **`aria-multiselectable` is declared, never inferred.** `pickFrom` offers shift and ⌘ to every
  caller, but most keep a single selection — only two pass `multiple`, the asset shelf and the
  node list. Inferring it would promise a range the others do not build.

`aria-selected` is only ever set on an `option`, and **a list that merely opens is not one**:
`onOpen` declares it `list`/`listitem` where `onSelect` would declare it a `listbox`. The Explorer
paid for that confusion — it painted "open" by borrowing `selectedIds`, which tinted rows nobody
had chosen **and** left the two panels that do have a selection showing none. It now carries its
own dot, and the subtitle says the same thing in words — hence the `aria-hidden` on it: a screen
reader must not announce it twice.

**The same rule governs `Flyout`**, whose `role` is a parameter rather than an assumption:
`role="menu"` promises rows a screen reader steps through with the arrow keys, and a panel holding
a form or a list of filters does not keep that promise. The component cannot guess which of the
two it carries; its caller can.

### What the design system took back from a library

**Failure toasts no longer come from `react-toastify`**, which has left the dependencies. A toast
is a floating panel of this studio: a library brought its own surface, its own radius and its own
animation to fight the tokens with — exactly why a dock carries no DaisyUI control.
`ActivityToasts` reuses `MENU_SURFACE`, so a toast and a menu look alike because they share the
same class string.

Three libraries went the other way and came in, each for something one does not write oneself:

| | |
|---|---|
| `recharts` | the curves in the usage window — spend per day, per account |
| `opentype.js` | reading a typeface's tables, for 3D text and an image's caption |
| `@xyflow/react` | the node editor canvas: viewport, bézier edges, handles, lasso selection |

`opentype.js` is **loaded on demand**: it does not weigh on the first screen, which has no
typeface to dissect.

`@xyflow/react` is **Scenario's own canvas** — the webapp renders it, DOM in evidence — and that
is what makes the round trip possible: the studio's native format is Scenario's `editorInfo`,
written by hand in `shared/domain/graph.ts` because a graph crosses the IPC and `shared/` carries
no runtime dependency. The canvas is **mounted nowhere today**: the graph will become a seventh
workspace, and none of that stack is reachable before it is.

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

Six things go through the bundles without looking like it, and each answers an observed defect:

- **key names** — `Space`, `Delete`, `Home` are not English labels left in place: the shortcuts
  screen resolves them like everything else;
- **units and dates** — `formatBytes` computes a size but **does not name it**: the unit's name
  comes from the caller, because `Mio` and `MiB` are the same size in two languages and the
  abbreviations had ended up living in French inside a computation file;
- **numbers written INSIDE a sentence** — `{{count, number}}` rather than `{{count}}`: a thousand
  reads "4,000" on one side of the Channel and "4 000" on the other, and French's separator is a
  narrow no-break space. i18next's formatter is `Intl.NumberFormat`, nothing to configure.
  The count of keys carrying it climbs with every batch; `bundles.test.ts` is what holds, not a
  figure written here. **The exception is a factor, not a count**:
  `texture.tilingPreviewTimes` writes "4×", and grouping a repetition would be wrong exactly where
  the grouping would show — `bundles.test.ts` holds the rule **and its exception**. A **creative
  unit** does not go through `{{units, number}}` either but through `formatUnits`, which does more
  than group: it keeps two decimals under ten units, because a cheap call rounded to zero would
  read as **free**. The last caller to forget it wrote "1,234 CU" before the generation and
  "1234 CU" after;
- **the journal's scopes** — an activity line shows a sentence, never the key naming it;
- **the document's own language** — `document.documentElement.lang` follows the chosen language.
  `index.html` carried it hardcoded: a screen reader picks its voice from it, and an English
  interface under `lang="fr"` was read with French phonetics;
- **the text the model writes** — the generation form's labels, descriptions and options. See just
  below: it is the only mechanism in the studio that is not indexed on a key.

### A fixed width is an internationalisation decision

**French runs half as long again as English on one bundle key in six.** Wherever a width is
frozen, that gap becomes a label cut off **in one language only** — "Aperçu de la répétition" read
as "Aperçu de la ré…" in an 80 px inspector column where "Repeat preview" fitted whole.

The remedy is not to shorten the offending label: that fixes this case and leaves the next one.
**What is truncated is readable on hover** — `PropertyRow` sets the `title`, and sets it **in
stacked mode too**, where the column constrains nothing: a title that comes and goes with the
layout would be a second rule to remember.

Toolbars escape the question by construction — `ToolButton` shows no label at all, it makes one
into a tooltip.

### The one dictionary indexed on text, and why

**The Scenario API has no notion of language** — no `Accept-Language`, no locale parameter on
`models.retrieve`, nothing in the SDK. The text a model publishes for its own inputs ("Target
size", "Max splat points", and the explanatory sentences under them) is therefore translated here
or nowhere.

`model-text.fr.json` is indexed on the **English text**, not on the field's key, and it is the only
place in the studio that works this way. The reason is that half of what the panel shows is a
**sentence the model wrote**, not a field name: indexing on the key would translate "Max splat
points" and leave its description in English right underneath.

Three consequences, one of them to be accepted:

- **a label changed on Scenario's side falls back to English** rather than failing.
  `normalizeModelText` absorbs what costs nothing to absorb — case, whitespace, typographic
  apostrophes and dashes, trailing punctuation — and the fallback is **the English sentence
  itself, never a key**. The worst case is the screen as it was, not a broken one;
- **seven words stay in English, and the rule guarding them has been remade twice** — `sampler`,
  `scheduler`, `LoRA`, `checkpoint`, `prompt`, `clip skip`, `denoising strength`. The original
  argument was "it is the trade's term, it reads that way in every other tool": **general, and
  impossible to check**, and it let `seed` through — which `inspector.seed` and `skybox.seed` had
  called "Graine" for a long time — then `guidance scale` and `negative prompt`, which the manual's
  glossary named. Each time, the form was the **only surface** refusing the word the rest of the
  studio uses. So the rule became checkable: **a word stays in English only where no surface and
  no glossary entry gives it a French name.** A test holds the list, so translating one is a
  decision taken against a red test;
- **translation applies at render, not when descriptors are built.** Switching language restates
  the open form instead of waiting for the model to be reloaded — and the Apps benefit without a
  line more, their fields coming from the same place. Invariant 5 is intact: nothing is written by
  hand for a given model.

**Not all remote text calls for that remedy, and picking the wrong one costs you the guard.** The
usage report was showing "images-generation" and "video" in a French window: same symptom,
different tool. Those values are **three closed, documented unions**, listed by `usages.list` and
mirrored in `shared/domain/usage.ts`: **21 spending actions**, **8 asset kinds**, and **100 raw
journal actions** — that last one a *different* union from the first, and the word that brings them
together is a trap. `USAGE_ACTIONS` is what gets **billed**; `USAGE_EVENT_ACTIONS` is what
**happened**, including what nothing charges for (`subscription`, `asset-privacy`,
`assistant-message`). The two overlap by three quarters, hence **a single label table both read
from** — so **one bundle key per
value**, held by `bundles.test.ts` the way the PBR channels and the journal's scopes already are.
An action Scenario adds without its line turns the guard red.

The rule that tells them apart:

| When the remote text… | The tool |
|---|---|
| belongs to a **closed list** the API documents | one bundle key per value, plus an exhaustive guard |
| is **written freely** and changes with every published model | the dictionary indexed on the source text |
| is **read by the code as much as by the eye** | nothing — it comes out raw, deliberately |

In the first two cases the fallback is **the API's raw text, never a key**: an English screen stays
readable, a screen showing `usage.action.images-generation` does not.

**The third row is the one that gets forgotten, and it breaks silently.** A workflow node's port
shows the name the workflow gave it — that one goes through the dictionary. But a port **without**
a name shows what it accepts, `image` or `video`, and **that string is what the connection check
compares**: translated on one side of an edge and not the other, it no longer says whether two
ports go together. `NodePorts.tsx` carries the rule in JSDoc, where it would be paid for.

It is the same split as `name` and `message` in the hardcoded-text guards: **a string that is also
data is not a label**, and translating it breaks it as data.

### Four guards, and what each one holds

They are not the same test, and treating them as one suggests a single thing is being watched.
They share the tree without overlapping, and all of them run in `pnpm validate`.

| Guard | What it refuses |
|---|---|
| `shared/i18n/bundles.test.ts` | a key on one side and not the other, a diverging order, a blank value, an ASCII apostrophe in French, **a breaking space before `; : ! ?` or inside French quotation marks**, a lost interpolation hole — **and an English sentence copied into `fr.json`** |
| `renderer/src/no-hardcoded-text.test.ts` | in a `.tsx`: text between tags, a literal in braces, one behind a ternary or an `&&`, and any attribute a human reads |
| `main/no-hardcoded-text.test.ts`, § *the main process* | a word written into a native dialog or a menu `label` |
| `main/no-hardcoded-text.test.ts`, § *the registries* | in a `.ts` of `renderer`, `shared` or `preload`: a label written where a key belongs |

**A guard that reads data can go blind without turning red**, which is what the *what the guards
would catch* block of `bundles.test.ts` is for. Its eight checks run through four local helpers: a
helper returning an empty array would make **all of them pass while checking nothing at all**. Five
probes now hold what the guards must see — an interpolation hole renamed from one language to the
other, a number formatter dropped on one side, two bundles that stopped lining up, a nested key the
flattening must reach. Verified **by breaking**: with `holes()` neutralised, two probes turn red
where the interpolation guard itself stayed green. The two `no-hardcoded-text` files have carried
twenty such probes between them all along; this one had none.

**A typographic guard is not a luxury: it holds what no editor shows.** The French bundle wrote
its double punctuation with an ordinary space — eighty-four values, not one non-breaking — and an
ordinary space is a place where the line is allowed to break. « Impossible d’importer « {{name}} » »
lives in the activity journal, a narrow column where the interpolated name does as it pleases with
the length: the closing quotation mark ended up alone at the start of a line. The choice is
**U+00A0 rather than the narrow U+202F** — indistinguishable at eleven pixels, and the wide one is
what every font has. The guard bit **ten minutes after it shipped**, on three keys from a batch
merged in parallel: the pattern being invisible in an editor, nobody would have caught it by
reading.

**The first sees what none of the other three can.** An English sentence pasted into `fr.json`
goes *through* the bundle: it is spotless to the guards hunting hardcoded text, and it still
shows in English to a French reader. The test knows it by one sign — it is **identical in both
files**. It compares sentences only, never single words: `Position`, `Rotation`, `Saturation`
are spelled the same in both languages — ninety-four keys — and listing those would cost far
more than it would catch. Seven sentences are identical on purpose, and they are named: the
brand, two format names, two paths, a copyright line, an example to type over.

### The one surface that ships its wording

No guard can reach the Linux desktop entry: a `.desktop` file is **written at build time** and
read by the desktop shell long before any bundle exists. It localises the only way it knows —
one key per locale, with `Comment` as the fallback — and `electron-builder.yml` carries them.

What sits below that line is translatable nowhere: the **`.deb` package description** has one
language only, as does the `synopsis` it is the long form of. Both are now the same English
sentence, instead of English in the shortcut and French in the package manager — that is the
convention for package metadata, and it is the exact point where "everything is translated"
stops being a promise that can be kept.

---

## Configuration

Three layers, and they never mix: what the user sets, what a developer sets, and what the build
needs.

### What the user sets

`shared/domain/settings.ts` declares the whole shape, group by group — from appearance to
dictation, by way of 3D, shortcuts and the home screen.
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

**Over 5,600 tests across more than 440 files**, run by Vitest — the exact figure moves with every
merge, and `pnpm test` states it. Unit tests are colocated (`*.test.ts` next to the code) and
written in the same movement as the code, never after.

`pnpm validate` — typecheck, lint, format check, tests with coverage budgets — must be green
before any commit.

**Budgets are declared per glob in `vitest.config.ts`, and their sign is their whole meaning.** A
threshold that is **zero or above** is a **minimum percentage**; a **negative** one is a **maximum
count** of uncovered lines or branches. A budget of zero therefore cannot be written: `0` reads as
"at least 0 %", which is nothing at all, and a glob covered whole is written `100`. Three guards
were decorative for exactly that reason, and `src/main/coverage-thresholds.test.ts` now reads them
back from the config file — comments stripped first, since they quote thresholds.

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
| [`docs/ci/adr/`](../ci/adr/) | the pipeline's decisions, with what was ruled out and why |
