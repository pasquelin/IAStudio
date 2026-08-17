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
9. [Version control](#version-control)
10. [The design system](#the-design-system)
11. [Internationalisation](#internationalisation)
12. [Configuration](#configuration)
13. [Testing](#testing)
14. [Adding things](#adding-things)
15. [Shipping a version](#shipping-a-version)

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

Three threads exist for exactly that reason. `main/project/catalogWorker.ts` owns the database
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

**And two processes, for what must not share a heap.** `main/media/peaksWorker.ts` reduces a
waveform in a `utilityProcess`: an hour of PCM measured 129 ms on the main thread, and every
window of the studio waited it out. `main/dictation/sttWorker.ts` holds Parakeet — six
hundred million parameters, 640 MB of weights — in a `utilityProcess` of its own. A thread would
not have done: it shares its process's heap and lifetime, so the 700 MB would stay in the main
process's footprint and a crash in the native addon would take the studio with it. Everything
that decides anything — the buffer, the queue, the state machine — sits beside it and is tested
without it. See [`ADR-17`](../ci/adr/ADR-17-moteur-de-dictee-hors-processus.md).

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
| `favorites:*`, `project:*`, `media:*`, `window:*` | 3 each | — |
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
│   ├── modelRegistry.ts     GET /models/{id} → FieldDescriptor[]
│   ├── modelCatalog.ts      paginated model listing, cached
│   ├── jobManager.ts        the queue, the concurrency, the polling
│   ├── runner.ts            what actually calls generate
│   ├── schema.ts            schema translation and model family inference
│   ├── retry.ts             exponential backoff, taken out of the JobManager and shared
│   ├── assetCatalog.ts      the remote library, read and paginated
│   ├── assetNormalizer.ts   an API asset brought back to the studio's shape
│   ├── ownerScope.ts        which project the active key opens onto
│   ├── filterExpression.ts  the search translated for the API
│   ├── limits.ts            the batch sizes the API imposes
│   ├── promptAssist.ts      variants, translation, style reading
│   ├── assistQueue.ts       the bounded queue of background assistance
│   ├── uploader.ts          sending a file up to the library
│   ├── cost.ts              what a generation would cost, without running it
│   ├── usage.ts             the units spent, and the price list
│   └── handlers.ts          the scenario:* channels
├── project/
│   ├── store.ts             create and open a project folder, read/write the manifest
│   ├── catalog.ts           the SQLite asset index
│   ├── catalogThread.ts     the worker carrying it, and its protocol
│   ├── activityLog.ts       what the studio did and failed to do
│   ├── documents.ts         the atomic write of a document
│   ├── sqlite.ts            the SqliteDriver port
│   ├── sqliteNative.ts      better-sqlite3 — production
│   └── sqliteMemory.ts      node:sqlite — tests
├── assets/
│   ├── localBackend.ts      the project's assets, on disk
│   ├── cloudBackend.ts      the same ones, on the library's side
│   ├── syncPlan.ts          what two sides would have to do about each other
│   ├── collector.ts         what a generation drops into the project
│   ├── autoCaption.ts       naming a picture from what the API sees in it
│   └── protocol.ts          the scenario:// protocol
├── dictation/               speech recognition: permissions, model, segmenting, handlers
├── assistant/               the assistant's thinking, behind a port, and how its reply is read
├── mcp/                     the same catalogue of actions, offered to a client outside
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
└── window/                  lifecycle, navigation lockdown, the video return window
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
`localBackend.ts` for the folder on disk, `cloudBackend.ts` for the API. What decides what
should move between them lives elsewhere, and is **pure**: `syncPlan.ts`.

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

`project/activityLog.ts` keeps account of what the studio did and failed to do. Three decisions
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

### One action registry, two readers

`ACTION_REGISTRY` (`shared/domain/assistant.ts`) declares what the studio can be asked to do —
**a hundred and forty-six actions in thirteen families**, one family per `*Actions.ts` module, their fields, **what
each one commits** (`none`, `files`, `asset`, `remote`, `credits`) and **which door offers it** (`reach`). It
has two readers, and **neither of them decides**:

- **the assistant**, inside the window, which lists the `both` share to its model — eleven actions;
- **`main/mcp/tools.ts`**, which republishes **all** of it as MCP tools for a client outside.

**The asymmetry is forced, not tasteful.** The assistant's catalogue goes out in a prompt capped by
`INSTRUCTION_MAX` at ten thousand characters, of which four thousand are left for the person's own
sentence — `brain.test.ts` holds that floor. Publishing the families a program drives (files, layers,
scene, git) there would eat that margin, and the sentence is what the truncation would take off.
`tools/list` has no cap.

**`validatesInput` (`assistantAction.ts`) is the whole of the input validation**, derived from the
fields and sitting on `runConfirmedAction`. Nothing upstream does it: the IPC boundary checks the
envelope, the reply parser checks the NAME, and the MCP server passes `params.arguments` through
untouched — its `additionalProperties: false` is a promise to the client, not an enforcement. It
refuses **before** the confirmation question, or a bad input would have the person asked to approve
a spend that was never going to happen.

The name changes dialect on the way — `command.run` becomes `command_run`, because the tool-name
grammar takes no dot — and `actionOfTool` walks it back. **One substitution, never a second column
in the registry**: that column would drift from the first.

**Running it, though, happens in the same place for both**: the window in front. That is what makes
the confirmation of a costly action appear on screen whichever side asked for it — and what makes a
request arriving with no window **refused** (`noWindow`) rather than queued. `main/mcp/asking.ts`
composes the round trip the IPC does not have in that direction: `invoke` goes up, `broadcast` comes
back, a `callId` sews the halves together, and **every way of failing answers**, because at the
other end there is a client that would otherwise sit there.

`commitmentOfCommand` is **the one level derived rather than declared**, and the one guarded command
by command: five canvas commands flatten and upload the picture, which creates a permanent asset. A
miss there would go through with nothing downstream to catch it.

**`files` is deliberately narrow** — destroying, moving, renaming, rewriting the working tree,
closing a tab that holds unsaved work — and never "anything that writes": a new folder and a
duplicate take nothing away from anyone, and a studio that asked about those would teach its user to
click Allow without reading.

### The MCP door, and its four locks

The server (`main/mcp/server.ts`) is **off by default** and follows `settings.mcp.enabled`. On, it
listens on the IPv4 loopback — `127.0.0.1` written out, since the name `localhost` resolves to IPv6
first on some machines — on a port the operating system picks, behind a token minted per launch, and
refuses any request carrying an `Origin` that is not loopback. `access.ts` decides from headers
alone, which makes both refusals demonstrable without opening a socket.

Port and token are written to `mcp.json` beside the settings, at `0600`: **that file IS the door**,
since a caller with no `Origin` is admitted by design. `control.ts` removes it on stop **and on
start** — a file left by a crash names a port the next process will inherit.

**The MCP SDK is only loaded when the door opens**, through an `import()` in `control.ts`: it pulls
some two hundred modules, and this setting is off by default. A static import would put them on the
launch of every studio that never opens that door.

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
├── engines/      canvas, scene, timeline, audio, viewport, skybox, texture, gpu, and `core/` — what every engine shares
├── spaces/       one editor per document kind — SIX, as many as there are workspaces
│   ├── image/      Pixi-backed canvas and its tools
│   ├── three/      the three.js viewport and its tools
│   ├── video/      the timeline canvas, the monitor, its tools
│   ├── audio/      the waveform, its tools, the decoder
│   ├── textures/   a material's channels, and their tiled preview
│   └── skyboxes/   the immersive sky and its three flat projections
├── panels/       the twenty-seven dockable tools
├── home/         the home screen and its three bands — a page, not a layout
├── settings/     the settings window, loaded on demand
├── usage/        the consumption window, likewise
├── licences/     the licences window, likewise
├── dictation/    what the renderer sees of dictation: button, preview, level
├── stores/       zustand: documents, tools, layouts, models, assets, jobs, settings, keymap
├── hooks/        shortcuts, native menu, density, window state, debounce…
├── helpers/      pure functions, all unit-tested
├── services/     the bridge accessor and failure message mapping
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
| The **six editors** | a session opens one or two; all six weigh several megabytes |
| The **fifteen panels** | a workspace shows three or four, never fifteen |
| The **generation form**, and zod, `react-hook-form`, `@hookform/resolvers` with it | you open a generator, you do not land on one |
| The **Settings** window — its registry, its sections, its draft | fifty kilobytes of another window |
| The **Licences** window | every shipped licence in full, which nobody reads in a usual session |
| The **Usage** window | for a harder reason than its size: the charting library |
| The **font parser** (`opentype.js`) | only text in volume and captions need it |

**A failed `lazy()` cannot be mended by retrying**: React caches the rejection, so the error
boundary's "Try again" button cannot win on those routes. The boundary sits above the routes — the
per-panel ones cover the docks, not the shell holding them — and it catches renders only: not
event handlers, not rejected promises, and not `main.tsx`'s own evaluation, where a throw predates
the boundary and leaves an empty window no React can see.

**A test holds all seven rows**, `eager-graph.test.ts`: it walks the static import graph from
`main.tsx` and fails if any of them reappears. Without it, an `import` added without a thought
undoes the gain while breaking nothing visible — the worst kind of regression, the one only a
stopwatch sees.

**The panels went out in their turn**, and that is what shrank the neighbours list.
`app/toolComponents.ts` used to import them all outright; it now declares, per panel, **the
module to load and what its header does** — that second half is needed, because the title row lays
itself out on the first paint and a separator arriving a frame later would shift a row already on
screen. Measured at the same commit on both sides, preloads counted, no sourcemaps:
**2,331,395 → 2,081,385 bytes, −250,010, that is −10.7%.**

> **A glob on the folder would remove the copy of each panel's name, and it was written then taken
> back out.** `eager-graph.test.ts` walks **static** imports: a glob is invisible to it, and the
> very guard that watches this property would have stayed green whatever the glob did to the entry
> chunk. The copy stays, and `toolComponents.test.ts` holds it — a `layers` naming the meshes
> module would swap the two in silence.

**Two neighbours remain**, and neither is an editor: they are helpers something on the first
screen reaches for next to one. There were six; **four left with the panels**, since they came in
through a panel rather than through the shell. The test makes it a **budget**: the list may
shrink, never grow. A third entry means the first screen reached further than it needed to.

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

### The return window does not go through the bridge, and that is no breach

`sequence.mirror` opens a second window mirroring the Program monitor, for a second screen. **The
IPC bridge carries one thing only: opening that window** (`main/window/mirror.ts`). Everything else
— the edit, the playhead, playback — travels over a `BroadcastChannel`
(`spaces/video/mirrorChannel.ts`).

**This is no way around invariant 2**, which guards the boundary between PROCESSES. Both windows
load the same renderer bundle: they already share `SequenceState` as a type, and routing it through
the main process would mean restating that shape in `shared/`, where it does not belong — a sequence
is the video workspace's own, and the main process has no use for one.

Three choices show through, all of them measured:

- **Two kinds of message rather than one.** `edit` carries the whole sequence and goes out only on a
  real change; `time` carries a number. A scrub emits a few hundred of those a second, and
  re-posting every track with each would be the one thing making this return cost anything.
- **Playback is not streamed frame by frame.** `playing` tells the return to run ITS own transport
  from the time it already has. A message per frame would put it one hop behind the picture it is
  meant to mirror, and drift on top of that.
- **The return ASKS for the state when it opens** (`ask`). A channel replays nothing and the window
  opens long after the studio published: without that handshake, the return sat on its waiting
  screen until the next edit.

The engine is **rebuilt** on that side rather than moved — invariant 3, for the reason that founds
it: a WebGL context does not cross the boundary between documents. And it is **mute**, because the
studio is already playing that sound; two outputs would sound like an echo.

Finally, only **the tab in front publishes**. Two open sequences would otherwise fight over one
window, and the return would show whichever re-rendered last rather than the one being worked on.

### Registries, not lists

`shared/domain/tool.ts` declares where each tool lives and which workspaces it serves.
`shared/domain/workspace.ts` declares the workspaces. The renderer enriches them with icons and
components; the **native menu reads the same tables**. Adding a seventh workspace is one entry,
and the compiler then demands its icon and its family.

That is why the tool registry lives in `shared/` and not in the renderer: the main process needs
`{ id, zone, slot, workspaces }` in order to offer only what the section can open, and duplicating
it would degrade `ToolId` to `string`.

A tool may declare **more than one placement**, for disjoint sets of workspaces — the Explorer
holds the same half in every workspace and on the home, but only the home's asks for an open
project. **No tool declares two workspace halves since 17 August**, the shelf having given up its
second one when it moved into the left column.
`tool.test.ts` locks the two invariants that keep this legible: the workspaces of two
placements never overlap, and the placements of one tool share a slot — a tool that changed half as
well as zone would land in a different row of the rail depending on where you came from.

**The order of `TOOL_PLACEMENTS` is the rail's order**, and it also names the default panel below
— a test pins it workspace by workspace.

**Two rules escape the registry**, and only two, because they depend on state or on the workspace,
where `shared/` holds no runtime dependency. Hence a layer above it, in
`helpers/toolRegistry.ts`, rather than inside:

- the generator is offered only where a model is chosen or preferred;
- a half nobody has chosen for shows the **first panel the workspace declares there**. It holds
  `null` in the store — an absent key means the half is closed, an id means the user chose. The
  layout is remembered once for all six workspaces while that first panel differs in each:
  writing an id there would impose one workspace's answer on the other five. `shownTool` tells the
  three cases apart, and migrating to version 8 puts every earlier layout back to its default,
  half by half.

---

## Engines

Six of them, no React inside any one.

| Engine | Backed by | Owns |
|---|---|---|
| `CanvasEngine` | PixiJS 8.19 | the image document: layers, shapes, strokes |
| `SceneRenderer` | three.js 0.185 | the 3D scene: meshes, lights, gizmos, camera |
| `TimelineEngine` | mediabunny + Canvas + Web Audio | the sequence: clips, playback of picture AND sound, waveforms, filmstrips |
| `engines/audio` | plain sample arrays | the sound edit: crop, fades, gain, normalise, trim silence |
| `SkyboxRenderer` | `ViewportEngine` | the sky from the inside: sun, grading, probes |
| `TextureRenderer` | `ViewportEngine` | the material on a shape: PBR channels, environment, tiling |

The three that show 3D share `engines/viewport/` — canvas, camera, orbit, resizing, on-demand
loop, image-based lighting. Each writing its own was three chances to disagree about a resize
or a disposal.

**Six engines, nine folders under `engines/`: the other three are not engines.** `core/` carries
the shared history, `viewport/` the base of the three 3D views, and `gpu/` the shader passes and
the frame counter.

The audio one is a pair of modules rather than a class — `audio-data.ts` does the sample work,
`edits.ts` holds an `AudioEditState` replayable from the source file. Same invariant as the other
three: the edit is the state, never the buffer currently in memory.

**That is sound EDITING. PLAYBACK is a second pair, elsewhere** — `sound-schedule.ts` and
`sound-port.ts`, under `engines/timeline/`, because it reads a sequence of clips rather than one
file. The split is the same: the arithmetic on one side, what only a browser can do on the other.

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

And once the three object exists, **it is mutated, never replaced**: `.set` rather than a `new`.
Those writes arrive on every frame of an inspector drag, and the cost is not theoretical —
replacing a material risks recompiling its shader program, replacing a colour throws away the
instance three is holding. Ten colour writes follow the rule, and `three-sync.ts`,
`TextureRenderer.ts` and `SkyboxRenderer.ts` each carry it as a comment, next to what it guards.

**One exception, and it is deliberate**: `ViewportEngine` does replace the scene background object,
because that field accepts `null` — a `.set` could not clear it, and the background is only
repainted on mount, on a theme change or when a sky is removed — never per frame.

Playback goes through a **single token**, `playbackToken` — a module value in
`engines/timeline/playback.ts`, not a manager: whoever wants to play acquires it and hands over
the means to stop, and the next acquisition cuts the previous one off. Two active players is how
scrubbing starts stuttering for no visible reason. The timeline and the Audio workspace's waveform
both take it from the same place.

**What a monitor makes you HEAR goes through a second port, and its arithmetic is pure.**
`engines/timeline/sound-schedule.ts` knows nothing but numbers: where a slice lands on the output
clock, what a load that arrived late must skip rather than play late, how much source a sped-up
clip spends, and **where the fade envelope goes** — the `ClipFade` an `AudioChunk` carries gives
the CLIP's edges as instants rather than lengths, because a slice may begin INSIDE a fade, and
`cueFor` turns them into the corners of `SoundCue.ramps`. `sound-port.ts` holds what only a browser
can do — one `AudioContext` per window, opened on the first sound and never closed, the browser's
own decoder, one `AudioBufferSourceNode` per clip, and the envelope laid on its `GainNode`:
`setValueAtTime` at the cue instant **before** any ramp, without which a ramp would start from the
instant the graph was built.

A clip is planned **whole** as it enters the one-second horizon, never window by window: a source
restarted at every joint is heard as a click. The samples themselves are shared per asset and
reference counted (`engines/core/ref-cache.ts`) — `decodeAudioData` decodes the **file**, not the
share of it one clip takes.

**The output clock is the master whenever it runs.** `TimelineEngine.play` wakes the sound
**before** starting its clock, because the clock asks only once whether there is an audio clock to
follow; asked too early it would answer no for the whole playback, and the picture would drift from
the sound in under a minute. The port answers `null` while the output is not running — a suspended
output freezes its time, and hanging onto it would stop the sequence rather than play it.

**What a monitor shows comes from a sink, and the engine picks which one.**
`engines/timeline/sink-port.ts` opens a mediabunny `VideoSampleSink` where the asset carries a
video track, and a still-picture sink everywhere else — that one answers the same frame at every
position, a picture having no time of its own. `TimelineEngine.seek` never sees the difference: it
asks for a frame and gets one.

**What it does not overlook is a missing frame.** A position with no sample and an asset that
never opened both answer `null`; `DecoderPool.undecodable(assetId)` tells them apart, and that is
where the monitor's "This clip could not be shown" comes from, carried to React by `onUnreadable`.
The engine only reports it when **no** track painted: covering a good picture to flag the one
above it would be a worse silence.

Open sinks are bounded by the `DecoderPool`, one LRU per engine, and it holds **two ceilings
rather than one** — because the two kinds are scarce for different reasons. A video sink takes a
hardware decoder, of which a consumer GPU offers only two to four; a still sink takes none, it
holds a bitmap, and so answers to a memory ceiling instead. Conflating the two evicted a rush for
a logo laid over it.

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
fifteen seconds in**. The budget itself is *derived* from the constants of `rateLimiter.ts` rather
than written out, precisely so it cannot go quietly false the day one of them is tuned.

**Step 5b reads a price out of two shapes of answer, because the reference and the server do not
agree.** A `?dryRun=true` creates no job and spends nothing. The reference documents a **402**
carrying `estimatedCost`; the server, observed on both endpoints, answers **200** with
`creativeUnitsCost` beside an empty `job`. `main/scenario/cost.ts` reads both, the 200 first and
the 402 as a fallback — a 500 or a dead network is thrown on, so it reaches the log like every
other failure.

> **Reading only the documented 402 is how no badge ever showed a price.** The defect was
> invisible by construction: a button with no figure reads as a model the API declines to price,
> exactly like the three other cases that yield `null`. It took running a real generation to see
> it.
> **In front of an API, the reference says what was intended, not what answers.**

The port is a function rather than a method: which endpoint prices a dry run is the target's
business, not the port's.

On the renderer side, `useCostEstimate` debounces at 600 ms **and** keeps a floor between two
requests, derived from `INTERACTIVE_REQUESTS_PER_MINUTE`: a trailing debounce alone has no
ceiling, only a cliff — type slower than its delay and every keystroke becomes a request. The
same estimate is never bought twice, and it does not retry.

**`DynamicForm` is lazy-loaded**, and the three functions that call zod live in
`helpers/dynamicFormSchema`, apart from `helpers/dynamicForm`. The two halves go together:
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
can search thousands of items without touching the filesystem, and so a project remains portable.

**It does not rebuild.** Nothing guesses again what a file IS: the catalogue fills up as you
generate and import. Deleting it loses the names, the tags, the dimensions, the generation recipe,
`derivedFrom`, the `sourcePath` of linked media and the activity journal — the files remain, and
nothing says what they are any more. `.scenario/items.json` is what is left to read that day: a
backup keyed by content fingerprint, written after every reconciliation pass that changed
something, which the studio never reads of its own accord.

**A pass puts it back in agreement with the disk**, which is not rebuilding it. `catalogRescan.ts`
runs in the catalogue's thread when a project opens and when a window comes back to the front
(5 s floor, one pass at a time): it finds a file moved outside the studio by its content
fingerprint and refiles its row (`repath`), and it DATES an absence — `missing_at` — without ever
dropping a row. Two passes give the same state. On an ambiguous fingerprint it does nothing:
rewriting the path of a row nobody asked to move is the one failure a reconciliation must not
have. `search` and `countByType` hide what is dated, so the trash — which dates rather than
deletes — gives a whole row back if the file comes out of it.

Assets are either `local` (a file in the project) or `cloud` (still only on Scenario). A local
image is served to the renderer as `scenario://<id>`.

**Documents** are JSON files filed wherever the user wants them — `documents/` is only where a
first save lands, and `documents.list()` walks the whole project to find them. One per document,
**named after the document** —
`Niveau.scene`, `Bande annonce.seq`. Its id lives in the envelope (format version 3) rather than
in the file name: that is what lets a document be renamed, open or not, without becoming a
different document — the layout, the recent list and every tab are keyed by that id. A file
written before that version wears its id as its name (`<id>.scene`) and is read exactly as
before; nothing is rewritten on opening, the stamp comes with the next save. The folder has the last word: a file whose header claims a kind its
extension denies is refused rather than opened in the wrong editor. Writing goes through a
staging file and a `rename`, which is atomic within one folder, so a crash mid-write can never
leave a truncated document where the work was.

The body belongs to the space that wrote it: the main process never reads into it, it stamps an
envelope and hands it back untouched. A space that learns to save therefore needs no channel of
its own. **All six kinds can write themselves today** — image, scene, sequence, audio, skybox and
texture, declared in one place, `IO_BY_KIND` in `app/documentIo.ts`. A kind absent from
that table has a Save that does nothing, rather than one that writes an empty body.

---

## Version control

The Git panel works on the open project's folder. Everything below lives in the main process
(`main/git/`); the renderer only asks and displays.

**git is a program you spawn, not a library you call.** The consequence fits in one question: the
machine may not have it. macOS answers by offering to install the command line tools, a bare
Windows install has no git whatsoever. So the question is asked when the project opens, never at
the first commit — a panel that discovered it then would have let somebody prepare a commit that
cannot happen. What the panel looks at is **a single union** of five states (`GitRepository`, in
`shared/domain/git.ts`): no project · no binary · repository not initialised · ready · an error
carrying git's own line, credentials stripped. A status plus three booleans would allow "no
project open AND files changed", a shape somebody eventually renders.

**Whatever CONFIGURES git is dropped from the environment before every command.** Everything
starting with `GIT_`, plus the three settings git reads without a prefix — `PAGER`, `EDITOR`,
`SSH_ASKPASS`. The rest is kept, `HTTPS_PROXY` and `SSH_AUTH_SOCK` first among them. The reason is
not theoretical: an inherited `GIT_DIR` points somewhere else, an inherited `GIT_EDITOR` opens a
window nobody can see, and simple-git refuses most of them outright — the command then fails
before it even spawns. **Put plainly, from a user's side**: exporting these in your shell changes
nothing in the studio, and that is deliberate.

**No prompt, ever.** `GIT_TERMINAL_PROMPT=0`, an empty `GIT_ASKPASS`, and `BatchMode=yes` for ssh.
A studio window has no terminal to answer in: git left free to ask would wait for ever, on a
command the user has no way to cancel. **The cost is worth stating**: a key protected by a
passphrase, with no agent loaded, fails rather than asking for it.

**One git at a time, per project.** Git takes `.git/index.lock` for the duration of any command
that writes, and a second one arriving meanwhile **dies rather than waits** — two windows
refreshing together is enough to produce it. simple-git's own scheduler queues in order, which is
why the studio carries no second queue of its own.

**A token belongs to a HOST, never to a project or a remote.** One personal token opens every
repository somebody has on GitHub; asking for it per project would be asking for the same string
over and over. A company server keeps its own. The renderer can ask **whether** a host has one,
and can set one; it can never read one back. That is invariant 1 word for word, and it is the
shape the API key already has.

**Everything coming from the renderer is validated before it reaches git** — paths, refs, messages,
hashes, remote URLs (`main/git/validation.ts`).

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
| `FormHeader` | the line naming what the form is for — the model, in Generate |
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

**One case escapes it, and has a tool of its own: code that needs the gauge as a NUMBER.** A
virtualized list's estimator is the only example — it takes a number, while the row it estimates
is sized by a class. Writing that number down is being right at one density only: `useGauge`
(`hooks/useGauge.ts`) reads the gauge back and follows the setting, over the same signal the
engines use — `onPaletteChange`. **This is not a way out of writing pixels in JavaScript**:
outside that case, the class remains the only route.

**Two virtualizers do it, over three gauges** — `Tree` and `Collection`, the latter reading
`--sc-control` and `--sc-row-stacked` **unconditionally**, since a row stacking a name over a
subtitle does not fit the height of a control. A hook cannot sit behind a branch, so both are
read and the row's shape picks afterwards. The `LIST_ROW_HEIGHT` and `STACKED_ROW_HEIGHT`
constants are **only** the fallback for a gauge that cannot be read: no call site passes them any
more, and three did — each right at a single density.

Surfaces are **darker** than the chassis, the opposite of the web habit. That inversion is what
reads as "panels resting on a frame".

The background stays opaque: in a studio you judge colours, and translucency falsifies
everything above it. It is a domain decision, not a style one.

---

## Internationalisation

One directory per language in `src/shared/i18n/` — `fr/` and `en/`, twelve JSON sections each
(`inspector`, `commands`, `settings`, `usage`, `activity`, `shell`, `image`, `texture`, `scene`,
`assets`, `models`, `common`), merged back into a single object by the directory's index. Both
languages are kept at strict parity. They live in `shared/` because the native menu is built by
the main process and the UI by the renderer, and the two must say the same thing.

The split is a **storage** choice, not a contract one: the namespace stays single, and
`main/i18n-sections.test.ts` refuses a flat file reappearing at the root of the directory.

**The two resolvers disagree about that case, which is what makes it dangerous**: `tsc` reads
`./fr` as the directory, so **the typecheck stays green**; Vite reads the JSON, the named export
is gone, and `TRANSLATIONS.fr` is undefined at run time — the whole language. So it is not the
compiler that guards this case but that suite, and it alone. It also holds the line between the
two kinds of import: in `en/index.ts`, twelve **type** imports point at `../fr/` — that is how an
English section's expected shape is derived from its twin rather than copied out — and twelve
**value** imports point at `./`. A value import straying into `fr/` compiles green and renders a
whole section in French.

### A branch older than the split conflicts: what to do

A branch started before 15/08 edits `fr.json` and `en.json`, which the split deleted. Git offers
a **modify/delete** conflict on both, plus a content conflict on `shared/i18n/index.ts` if the
branch touched it too.

**Both reflex resolutions are wrong, and neither goes red.** Keeping the flat file — what git
leaves in the tree by default — hijacks the import and leaves `TRANSLATIONS.fr` undefined; that
is the only one of the two `main/i18n-sections.test.ts` catches. Removing it with `git rm`
**silently loses every key the branch had added**: parity stays clean, the typecheck passes, the
bundle guards pass.

The right move, in this order:

1. list the keys the branch was adding, before resolving anything —
   `git diff <base>...<branch> -- src/shared/i18n/fr.json`;
2. write them into the section of their surface, on both sides (`fr/<section>.json` and
   `en/<section>.json`); a new root belonging to none of the twelve calls for a decision between
   an existing section and a thirteenth file, which has to be declared in **both** `index.ts`;
3. `git rm` the two flat files only then;
4. replay `main/i18n-sections.test.ts` and the typecheck, then check the key count grew by the
   number listed in step 1.

- **All identifiers, comments, JSDoc, file names, i18n keys, IPC channels and test descriptions
  are in English**, everywhere in `src/`.
- The only exceptions are the sections of `fr/` themselves, and the expected values in tests
  when they come from the French bundle.
- No hard-coded user-facing string in a component. Dynamic keys (`assetTypes.${type}`,
  `capabilities.${capability}`) resolve against the same bundles, with the raw API name as a
  fallback so an unknown value shows something readable rather than a missing key.

Labels used inside a virtualised list are resolved **once by the panel**, never per row: a scroll
re-renders every mounted row on each frame, and `useTranslation()` is not free.

### What gets translated goes beyond sentences

Seven things go through the bundles without looking like it, and each answers an observed defect:

- **key names** — `Space`, `Delete`, `Home` are not English labels left in place: the shortcuts
  screen resolves them like everything else;
- **units and dates** — `formatBytes` computes a size but **does not name it**: the unit's name
  comes from the caller, because `Mio` and `MiB` are the same size in two languages and the
  abbreviations had ended up living in French inside a computation file;
- **the percent sign** — `formatPercent`, in the same file: French puts a no-break space before
  the sign and a comma inside the number, English neither. Three sites wrote it by hand, two of
  them the French way, and that space shipped as-is to an English reader. **No i18n guard could
  see it** — a sign is not a word, so no bundle carries it. `no-composed-percent.test.ts` refuses
  both ways of building one, the template and the concatenation, and **exempts CSS lengths by
  name** — `width`, `left`, `top`… : a length is read by the layout engine, which has no language.
  **What it does not see**: a percentage written whole, `'42%'`, which no interpolation betrays;
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
- **seven words stay in English** — `sampler`, `scheduler`, `LoRA`, `checkpoint`, `prompt`,
  `clip skip`, `denoising strength` — under a **checkable** rule: a word stays in English only
  where no surface and no glossary entry gives it a French name. "It is the trade's term" is not
  checkable, and let `seed` through while two panels already said "Graine". A test holds the list,
  so translating one is a decision taken against a red test;
- **translation applies at render, not when descriptors are built.** Switching language restates
  the open form instead of waiting for the model to be reloaded. Invariant 5 is intact: nothing is
  written by hand for a given model.

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

In both cases the fallback is **the API's raw text, never a key**: an English screen stays
readable, a screen showing `usage.action.images-generation` does not.

**And a third category waits for its next case**: remote text the CODE reads as much as the eye
is not translated at all. Translated on one side of a comparison and not the other, it silently
stops saying what it said.

It is the same split as `name` and `message` in the hardcoded-text guards: **a string that is also
data is not a label**, and translating it breaks it as data.

### The guards, and what each one holds

They are not the same test, and treating them as one suggests a single thing is being watched.
They share the tree without overlapping, and all of them run in `pnpm validate`.

| Guard | What it refuses |
|---|---|
| `shared/i18n/bundles.test.ts` | a key on one side and not the other, a diverging order, a blank value, an ASCII apostrophe in French, **a breaking space before `; : ! ?` or inside French quotation marks**, a lost interpolation hole — **and an English sentence copied into the French bundle** |
| `renderer/src/no-hardcoded-text.test.ts` | in a `.tsx`: text between tags, a literal in braces, one behind a ternary or an `&&`, and any attribute a human reads |
| `main/no-hardcoded-text.test.ts`, § *the main process* | a word written into a native dialog or a menu `label` |
| `main/no-hardcoded-text.test.ts`, § *the registries* | in `renderer`, `shared` or `preload`: a label written where a key is expected |
| `main/no-hardcoded-text.test.ts`, § *the words nobody puts in a tag* | in all **four** trees, `main` included: a sentence bound to a name — `const message = 'This project could not be opened'` — that neither the tags nor the registry fields ever show |
| `shared/licences.i18n.test.ts` | prose in a **displayed** field of `src/shared/licences.json`, which `pnpm licences:collect` generates and the Licences window renders verbatim. The `text` field is exempt: a licence is reproduced in the language its authors wrote it in |

**The last one arrived on 11 August, and it closes a way none of the other four could see**: they
all read the TypeScript tree, and that text is written in no `.ts` — `scripts/collect-licences.mjs`
writes it into a JSON. Two English sentences reached French readers that way. **A generated file
rendered verbatim is a way to the screen**, and the rule that follows holds for all of them: the
script carries the fact (`unmodified: true`), the render carries the sentence, and the sentence
comes from a bundle.

**Fixtures are out of EVERY sweep — `*-fixtures.ts` and `*-fixtures.tsx`, in both guards.** A fixture builds the data a suite asserts on and reaches no screen: measured, no fixture file in `src/` is imported by production code. The label it carries is the one the API returns, not a word this studio writes. It is a **decision**, taken on 11/08: forcing a fixture through a bundle key makes nothing truer and reads worse.

**What the exclusion would cost if it drifted, and the guard that stops it**: a file named `*-fixtures.ts` imported by a panel would be invisible to both guards — two blind spots on one file, neither of which would say a word. `main/import-cycles.test.ts`, § *what a shipped file may reach*, refuses that import. It judges the RESOLVED path, so an alias, a `.js` spelt for a `.ts` and Vite's `?worker` suffix all land in the same place. **What it cannot see**, and says so: a worker named through `new URL(…, import.meta.url)` is a URL, not an import.

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

**The first sees what none of the other three can.** An English sentence pasted into a section of
`fr/` goes *through* the bundle: it is spotless to the guards hunting hardcoded text, and it still
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

### What the environment provides without being configured

Three variables are set nowhere: they come from the operating system, from CI, or from the test
runner. Each has a **working fallback** — none is required, and that is precisely why they are
read rather than demanded.

| Variable | Set by | What it changes | When absent |
|---|---|---|---|
| `LOCALAPPDATA` | Windows | adds per-user installed fonts to the folders scanned | only machine-wide fonts are seen |
| `NODE_ENV` | the test runner, as `test` | silences the main process log | the log writes, and a noisy suite drowns its own output |
| `GITHUB_SHA` | GitHub Actions | stamps the commit hash into the build without calling git | the hash is asked of git; outside a repository it is `dev` |

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

**Over 9,000 tests across nearly 700 files**, run by Vitest — the exact figure moves with every
merge, and `pnpm test` states it (9,315 across 686 on 2026-08-17). Unit tests are colocated (`*.test.ts` next to the code) and
written in the same movement as the code, never after.

`pnpm validate` must be green before any commit. It chains the links `package.json` declares, and
that is where they are read: spelling them out here would make a second list, and a second list
drifts the day a link is added — which is what happened to the CI job, now calling the command
itself.

**No coverage measurement**, removed on 2026-08-13: it was paid on every loop for a benefit that
did not repay the time it took from features ([ADR-14](../ci/adr/ADR-14-portee-de-la-validation-continue.md)).

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
| An image tool | `spaces/image/imageTools.ts`, in the right group |
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
