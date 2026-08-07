# Scenario Studio — user guide

Everything you need to run the studio, from your first launch to a finished sequence.
Looking for how it is built instead? See [architecture.md](architecture.md).

> 🇫🇷 Ce guide existe aussi [en français](../fr/guide-utilisateur.md).

---

## Contents

1. [First launch](#first-launch)
2. [The window, explained](#the-window-explained)
3. [Workspaces](#workspaces)
4. [Projects](#projects)
5. [Finding a model](#finding-a-model)
6. [Generating](#generating)
7. [The asset shelf](#the-asset-shelf)
8. [Editing images](#editing-images)
9. [Working in 3D](#working-in-3d)
10. [Editing video](#editing-video)
11. [Editing audio](#editing-audio)
12. [Settings](#settings)
13. [Keyboard reference](#keyboard-reference)
14. [When something goes wrong](#when-something-goes-wrong)

---

## First launch

You need a Scenario API **key** and **secret**, created from your account on
[app.scenario.com](https://app.scenario.com).

1. Open **Settings** — `⌘,` on macOS, `Ctrl+,` elsewhere.
2. Go to the **Account** section and paste your key and secret.
3. The studio checks them immediately and tells you whether it is authenticated.

Your credentials are encrypted by your operating system's keychain and held only by the
application's main process. The interface never receives them: it asks *"am I authenticated?"*,
never *"what is my key?"*.

Until you are authenticated, the model and generation panels stay empty and say why.

<!-- SCREENSHOT: the Settings window, Account section, with the authenticated state visible.
     Save to ../images/settings-account.png -->

---

## The window, explained

The studio is laid out like an IDE rather than a web page: a mid-grey **chassis** with darker
rounded **panels** resting on it.

```
┌──────────────────────────────────────────────────────────────┐
│  title bar — workspace switcher, project name                │
├──┬────────────────────────────────────────────────────────┬──┤
│  │                    top zone                            │  │
│  ├────────────────────────────────────────────────────────┤  │
│ r│         │                                    │         │r │
│ a│  left   │          document area             │  right  │a │
│ i│  zone   │       (tabs live here only)        │  zone   │i │
│ l│         │                                    │         │l │
│  ├────────────────────────────────────────────────────────┤  │
│  │                  bottom zone                           │  │
├──┴────────────────────────────────────────────────────────┴──┤
│  status line                                                 │
└──────────────────────────────────────────────────────────────┘
```

**Rails** — the icon strips stuck to the left and right edges. Click an icon to open its tool;
click it again to close. A separator across the rail marks where a zone is cut: icons above it
open in the zone's first half, icons below in the second.

**Zones** — four of them (left, right, top, bottom). Each is cut in two halves, and each half
shows one tool at a time. Two tools in *different* halves of the same zone show together —
stacked in a side column, side by side in a strip.

**The document area** — the centre. It takes **only documents**: an open file and its toolbar.
Tabs live here and nowhere else, because a document has a name. Tool windows never enter it.

**Resizing** — drag the gap between two surfaces. The gap *is* the handle; there is no separate
grip to hunt for.

Panels close, they do not collapse. A collapsed panel is a third state that looks like neither
open nor closed, and the rail reopens a tool in one click.

### The tools

| Tool | Where | Shows in | What it is |
|---|---|---|---|
| **Layers** | left, first half | Image | the layer stack of the open image |
| **Meshes** | left, first half | 3D | the meshes in the scene, and the button that adds one |
| **Lights** | left, first half | 3D | the lights in the scene |
| **Explorer** | left, second half | all | the scene outliner in 3D. The project file tree is not written yet, and the panel says so in other workspaces |
| **Models** | right, first half | all | the Scenario model catalogue, filtered to the active workspace |
| **Generator** | right, first half | all | the form of the selected model |
| **Assets** | right, first half | all | everything the project holds |
| **Inspector** | right, second half | all | whatever is selected — a 3D node, a clip, a track, an asset — adjustable live |
| **Timeline** | bottom | Video | the sequence being edited |
| **Jobs** | bottom | all | what is generating right now |

The asset shelf sits in the side column rather than the bottom strip, so that it and the montage
are on screen together: dragging a take onto a track is the gesture the Video workspace is built
around, and two panels taking turns cannot be dragged between.

Use **View → Tools** in the menu bar to reopen anything you closed, and **View → Reset layout**
to put every panel back where it started.

---

## Workspaces

Six workspaces, switched from the title bar. Each one rearranges the panels and the toolbar
around one kind of work, and filters the model catalogue to the matching family.

| Workspace | Model family | Panels it brings |
|---|---|---|
| **Image** | image | Layers |
| **Video** | video | Timeline |
| **3D** | 3d | Meshes, Lights, Inspector, and the scene outliner in Explorer |
| **Audio** | audio | — (its editor is the waveform itself) |
| **Textures** | image | — |
| **Skyboxes** | image | — |

A layout you arrange in one workspace stays there. What is open is remembered per zone, and a
workspace simply drops the tools it has no use for.

---

## Projects

A project is **a folder on your disk** — not a database, not a cloud workspace. Create one with
`⌘N` / `Ctrl+N`, open one with `⌘O` / `Ctrl+O`.

The studio creates this structure inside it:

```
your-project/
├── project.json          the manifest: name, version, timestamps
├── assets/
│   ├── img/  vid/  aud/  3d/  tex/  sky/
├── documents/            your images, scenes and sequences
├── layouts/              saved panel arrangements
└── .index/               rebuildable cache — safe to delete
    ├── catalog.db          the asset index
    ├── proxies/            lighter media for scrubbing
    ├── peaks/              audio waveforms
    └── filmstrips/         video thumbnails
```

Everything under `.index/` is derived and can be regenerated. Everything else is yours.

Without an open project there is nowhere for a generated asset to land, so the generator waits
and says so.

---

## Finding a model

The **Models** panel lists the Scenario catalogue for the active workspace's family — the Image
workspace shows image models, 3D shows 3D models. There are no type tabs, because the title bar
already says which workspace is active.

- **Search** narrows as you type, with a short pause so it does not fire on every keystroke.
- **Filters** cut by capability (text-to-image, inpaint, controlnet, image-to-3D…) and by period.
- **Sort** by relevance, newest or oldest.
- **Two views** — a grid of thumbnails, or a dense list. Switch from the bar; drag the slider to
  resize the thumbnails.

Click a model to select it. The selection is kept per family, and shown at the top of the panel:
it is what the generator below will run.

Most public models carry no thumbnail of their own and are pictured by one of their example
assets instead. Those pictures are fetched only for the cards that actually reach the screen,
gathered into one request per scroll pause.

<!-- SCREENSHOT: the Models panel in grid view, filters open. Save to ../images/models-grid.png -->

---

## Generating

Select a model, then open **Generator**. The form you see is **built from that model's own
schema**, fetched from the API — it is not a hand-written form, which is why it is right for
every model, including ones released after this build.

Fill it in and press **Generate**. The request returns immediately with a job.

### The Jobs panel

Every generation appears there with its status — queued, running, succeeded, failed, cancelled —
and a progress bar while it runs. **Cancel** stops one that has not finished.

Jobs are run through a bounded queue: three at a time by default, adjustable in Settings. When
the API answers 429 or 5xx, the queue backs off exponentially and retries, rather than hammering.

A finished job writes its result into the project and the new asset appears in the shelf.

<!-- SCREENSHOT: the Generator panel with a model's form, and the Jobs strip below with one
     running job. Save to ../images/generate.png -->

---

## The asset shelf

The **Assets** panel is the project's content browser. Its controls sit on the panel's title row
rather than under it — the shelf is there to show assets, not chrome.

- **Search** and a **type filter** (image, video, audio, mesh, texture, skybox).
- **Grid or list**, both virtualised: a project with thousands of assets scrolls without
  stuttering, because only what is on screen is ever rendered.
- **Drag an asset** out of the shelf and drop it — onto the timeline to make a clip, for instance.

Filtering happens locally, because the whole project catalogue is already indexed in memory.

### Importing your own media

The **import** button on the shelf's title row brings files in from your disk. Each one goes
through a short pipeline, and a notice above the browser says where it is: **analysing**
(reading what the file actually is), **fingerprinting**, **proxy** (a lighter copy, so scrubbing
stays smooth), **waveform** (so audio can be drawn). Interrupt any of them — a proxy of a
twenty-minute rush does not have to be waited out.

If ffmpeg cannot be found, the notice says so: importing still works, you simply get no proxy
and no waveform. Point the settings at your ffmpeg to get them back.

---

## Editing images

Open an image document and the toolbar changes to the image tools. They are grouped the way
Figma groups its own: **hover a group to open the rest of it**; clicking the button itself arms
the mode it shows.

| Group | Tools |
|---|---|
| **Pointer** | pointer, move, hand, scale |
| **Frame** | frame, crop, section, slice |
| **Select** | rectangle, ellipse, lasso |
| **Shape** | rectangle, line, arrow, ellipse, polygon, star, image |
| **Paint** | brush, pencil |
| **Erase** | eraser, point eraser, selection eraser |
| **Others** | pen, text, text on path, fill, colour picker, comment, region |

The **Layers** panel on the left holds the stack: reorder, hide with the eye, and see at a glance
what is hidden — a hidden layer is dimmed and struck through.

Undo and redo are in the toolbar and on `⌘Z` / `⇧⌘Z`. History belongs to the document: the tab
must be the active one for its undo to apply.

<!-- SCREENSHOT: an image document with the shape group flyout open and the layer stack visible.
     Save to ../images/image-tools.png -->

---

## Working in 3D

The 3D workspace opens a real three.js viewport.

**Navigate** — hold and fly:

| Key | Motion |
|---|---|
| `W` `A` `S` `D` | forward, left, back, right |
| `E` / `Q` | up / down |
| `Shift` | boost |

Keys are read by **physical position**, so WASD on QWERTY and ZQSD on AZERTY are the same four
keys. Nothing to reconfigure.

**Manipulate** — one key per tool:

| Key | Tool |
|---|---|
| `V` | select |
| `G` | translate |
| `R` | rotate |
| `S` | scale |
| `F` | frame the selection |
| `Delete` | delete |

**Add** — from the toolbar, from the Meshes and Lights panels, or from the native menu under
**Objects → Add**. Meshes: box, sphere, capsule, circle, cylinder, dodecahedron, icosahedron,
octahedron, tetrahedron, plane, ring, torus, torus knot, tube, lathe, sprite, text.
Lights: ambient, directional, hemisphere, point, spot.

**Explorer** shows the scene as a tree. Only the visible rows are rendered, so a heavy scene
still scrolls smoothly, and the arrow keys walk it.

**Inspector**, on the right, holds everything that defines the selected node and lets you change
it: its transform, the parameters of its geometry, its material and its texture slots, or — for a
light — its colour and intensity. What it shows follows what is selected; the fields come from
the node's own kind rather than a form written for each one.

It is not a 3D panel: the same inspector reads a clip, a track or an asset when one of those is
what you selected, which is why it stays open across every workspace.

<!-- SCREENSHOT: the 3D viewport with a selected mesh, the outliner and the meshes panel.
     Save to ../images/scene-3d.png -->

---

## Editing video

The Video workspace puts the **Timeline** across the bottom strip — a sequence is read across the
whole width, so the timeline and the asset shelf take turns there rather than sharing it.

| Tool | What it does |
|---|---|
| **Select** | move and trim clips |
| **Blade** | cut a clip where you click |
| **Hand** | pan the timeline |

Transport controls play, pause and rewind — `Space` toggles between the first two without
leaving the keyboard. Only one player is ever active at a time, so scrubbing stays smooth
instead of fighting a second decoder.

Drop an asset from the shelf onto the timeline to make it a clip.

Each track can be renamed, and carries three states: **mute**, **solo** and **lock**. Select a
clip or a track and the inspector on the right holds what defines it — in and out points, fades,
speed, gain.

<!-- SCREENSHOT: the video workspace, timeline with several clips and the monitor above.
     Save to ../images/timeline.png -->

---

## Editing audio

Double-click an audio asset in the shelf to open it. The Audio workspace shows its waveform and
works on the selection you drag across it.

| Tool | What it does |
|---|---|
| **Crop** | keep only the selection |
| **Fade in** / **Fade out** | rise from, or fall to, silence across the selection |
| **Normalize** | bring the level to −14 LUFS |
| **Trim silence** | remove the silence at the head and the tail |
| **A/B** | listen to the source, undoing nothing |

Nothing is written until you say so: **Apply** rewrites the asset, **Save as new** creates one
beside it. A/B exists so you can hear what you changed before choosing between the two.

---

## Settings

`⌘,` / `Ctrl+,` opens the settings window.

### Account

Your Scenario API **key** and **secret**. They are checked as soon as you save them, and the
window tells you whether they work.

They are encrypted through your operating system's keychain and stored by the main process
alone. If your OS offers no encryption, the studio **refuses to store them** rather than writing
them in clear.

### Appearance

| Setting | Values | Default |
|---|---|---|
| **Theme** | dark, light | dark |
| **Density** | comfortable (28 px controls), compact (24 px) | comfortable |

Density reaches every control at once — rails, headers, rows, gutters — because they are all
sized from the same gauges rather than from their own pixel values.

The background stays opaque, deliberately, and there is no setting to change that: in a studio
you judge colours, and a translucent background falsifies everything shown on top of it.

### Generation

| Setting | What it does | Default |
|---|---|---|
| **Concurrent jobs** | how many generations run at once | 3 |
| **Max retries** | how many times a rate-limited or failed request is retried, with exponential backoff | 4 |

Raising the concurrency does not make the API faster; it makes rate limiting more likely. The
queue exists so a burst is spread rather than rejected.

### Model families

The model the generator preselects for each family — image, video, 3D, audio. Leave one unset to
be asked every time.

### Storage

| Setting | What it does |
|---|---|
| **Projects folder** | where the new-project dialog starts |
| **Backend** | whether a generated asset is downloaded into the project (**local**) or left on Scenario (**cloud**) |

The studio also remembers the last project you opened, and reopens it on launch.

### Media

**ffmpeg path** — an ffmpeg binary to use instead of the one found automatically. Leaving it
empty is the normal case.

The studio looks in this order: **the bundled binary**, then **your configured path**, then
**whatever is on your `PATH`**. If none resolves, importing still works — you lose the proxy and
the waveform, and the asset shelf says exactly that instead of failing silently.

### Where all this is stored

A `settings.json` file in your user config directory, written by `electron-store`:

| System | Path |
|---|---|
| macOS | `~/Library/Application Support/scenario-studio/settings.json` |
| Windows | `%APPDATA%\scenario-studio\settings.json` |
| Linux | `~/.config/scenario-studio/settings.json` |

Everything in it is readable except the credentials, which are encrypted. Deleting the file
resets the studio to its defaults; your projects are untouched, since they live in their own
folders.

---

## Keyboard reference

### Everywhere

| Shortcut | Action |
|---|---|
| `⌘N` / `Ctrl+N` | new project |
| `⌘O` / `Ctrl+O` | open project |
| `⌘,` / `Ctrl+,` | settings |
| `⌃⌘F` / `F11` | full screen |
| `⌘Z` / `⇧⌘Z` | undo / redo, in the active document |

### 3D viewport

| Shortcut | Action |
|---|---|
| `V` `G` `R` `S` | select, translate, rotate, scale |
| `F` | frame the selection |
| `Delete` | delete the selection |
| `W` `A` `S` `D` `Q` `E` | fly |
| `Shift` | boost while flying |

### Video

| Shortcut | Action |
|---|---|
| `Space` | play / pause the sequence |

Shortcuts are stored as physical key positions and can be rebound.

---

## When something goes wrong

| What you see | What it means |
|---|---|
| The model panel says you have no credentials | Settings → Account. The key or the secret is missing or rejected |
| The generator says to open a project | A generated asset needs somewhere to land — create or open one |
| A job fails and stays failed | The message names the cause. Rate limiting backs off and retries on its own; an invalid input does not |
| The asset shelf is empty in an open project | Nothing has been generated or imported yet — the panel tells these two cases apart |
| `⌘Z` seems to do nothing | Undo belongs to the active tab. Activate the document you meant to undo |
| A panel disappeared | View → Tools reopens it; View → Reset layout puts everything back |

Nothing about your work leaves your machine except the generation requests themselves.
