# 7. Assets

[← Generating](06-generating.md) · [Contents](../user-guide.md) · [Next chapter: Image workspace →](08-image-workspace.md)

---

## The project's shelf

The **Assets** panel shows everything your project holds: what you have generated, and what you
have imported.

It is the equivalent of a content browser — the library of raw material you draw from.

**Where it sits** depends on the workspace you are in:

| Workspace | Where the shelf is |
|---|---|
| Image, 3D, Audio, Textures, Skyboxes | in the **bottom strip** |
| Video | in the **left column**, upper half |

This is not a whim: in the Video workspace the bottom strip belongs to the edit, which needs the
full width. Yet the shelf and the edit have to hold the screen **together** so you can drag a take
from one to the other — so the shelf takes the upper half of the left column, which is free in that
workspace.

---

## What you find there

Six asset types:

| Type | What it is | Where it is filed |
|---|---|---|
| **Image** | a still image | `assets/img/` |
| **Video** | a moving shot | `assets/vid/` |
| **Audio** | a sound, a piece of music | `assets/aud/` |
| **Mesh** | a 3D object | `assets/3d/` |
| **Texture** | a material | `assets/tex/` |
| **Skybox** | a 360° sky | `assets/sky/` |

---

## Searching and filtering

**Where the controls sit depends on the room available.**

| Zone | Where they are |
|---|---|
| **Bottom strip** | on the **title line**, beside the panel's name |
| **Left column** (Video workspace) | on their **own line**, below the title |

In a strip the row is wide and mostly empty: putting the bar there saves a whole row, and the
shelf is there to show assets, not buttons. In a 320-pixel column, the same bar would push the
close button out of the frame — so it drops back below the title.

| Control | What it does |
|---|---|
| **Search…** | filters on the asset's **name**, as you type |
| **Type** | keeps only one or more kinds of asset |
| **Icons** / **List** | grid of thumbnails, or dense list |
| **Smaller** / **Larger** | the thumbnail size |

Filtering is **instant**, even on a large project: the whole catalogue is already loaded in memory,
unlike the Models panel which queries the Scenario catalogue remotely.

Both views are **virtualised**: only what is actually on screen is drawn. A project with several
thousand assets therefore scrolls without stutter.

### When the shelf is empty

The message says which of the three cases you are in, because they call for different answers:

| Message | Situation |
|---|---|
| "Open a project to see its assets." | no project is open |
| "No asset yet. Generate something to get started." | the project is empty |
| "No results for this filter." | your filters are too narrow |

---

## Using an asset

| Gesture | Effect |
|---|---|
| **Click** | selects — the Inspector, on the right, shows its information |
| **Double-click** | opens the asset in a tab, in the workspace that can handle it |
| **Drag and drop** | drops the asset wherever you release it |

What drag and drop can do today:

| You drag… | Onto… | Result |
|---|---|---|
| a video or a sound | the **timeline** | a clip on a track |
| an image | a **texture** preview | it becomes the base colour |
| a panoramic image | the **Skyboxes** workspace | it becomes the sky |

---

## An asset's inspector

Select an asset and look at the **Inspector**, in the right column. It shows, according to what it
knows:

| Section | What it holds |
|---|---|
| **Identity** | the name, the type |
| **File** | the duration, dimensions, size, creation date, location on disk |
| **Generation** | the model, the prompt, the seed — and the **Regenerate** button |

The **Reveal in file browser** button opens the folder containing the file, in Finder, Explorer or
your file manager.

> "**File not found**" means a linked medium has been moved or deleted from its original location.
> See the next section.

---

## Importing your own media

The **Import media** button, on the shelf's title line.

### What can be imported

| Type | Accepted extensions |
|---|---|
| **Video** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |

> **3D files (`.glb`, `.obj`, `.fbx`) and HDRIs (`.hdr`) cannot be imported yet.** An imported
> `.exr` is catalogued as an image, not as a sky. See [What does not exist yet](18-limits.md).

### The file is not copied

**Important.** The studio does not copy your file into the project: it creates a **link** to where
it sits.

Two consequences:

- **Upside** — a 12 GB video rush is not duplicated. Your project stays light.
- **Downside** — if you move, rename or delete the original file, the link breaks, and the inspector
  shows "File not found".

If you have to take a project elsewhere, take the media it points at too — or copy them into the
project folder yourself before importing them.

### What happens during an import

A banner appears above the shelf and follows each file, step by step:

| Step | What is happening | Why |
|---|---|---|
| **Queued…** | the file is waiting its turn | |
| **Probing…** | the studio reads what the file actually is | duration, codec, dimensions, frame rate |
| **Hashing…** | it computes a signature of the content | to spot duplicates |
| **Proxy…** | it makes a lightweight copy of the video | to scrub through it smoothly |
| **Waveform…** | it draws the sound's waveform | to see it on the audio track |
| **Ready** | done | |

**Every step is interruptible.** The **Stop preparation** button halts it: you do not have to wait
for the proxy of a twenty-minute rush before starting work. The file stays imported, simply without
its proxy.

Two particular messages:

| Message | What it means |
|---|---|
| **Already in the project** | this exact file is already there — the fingerprint saw it |
| **Unreadable file** | the file is corrupt, or in a format the studio cannot decode |

### If video preparation is unavailable

The proxy and the waveform are made by **ffmpeg**, a video-processing utility.

**The studio ships its own**, on macOS, Windows and Linux. There is nothing to install: that is a
deliberate decision, because an import that needs a proxy is not the moment to teach someone what a
codec is.

The studio tries three candidates, in this order:

1. the binary **shipped with the application**;
2. the path you set in **Settings ▸ Media ▸ Path to ffmpeg**;
3. whatever is on your system's `PATH`.

And it keeps the first that **runs**, not the first that exists: it launches it to check. A binary
that is present but broken is treated as missing — see
[When something goes wrong](16-troubleshooting.md#the-puzzling-case-ffmpeg-is-there-and-the-studio-says-it-is-not).

If none of the three answers, the banner says so: "Video preparation unavailable: no lighter copy,
no waveform."

**The import still works.** You only lose comfort: scrubbing through videos will be less smooth,
and audio tracks will not show their drawing.

**This case has become rare.** It now concerns mostly whoever ran the studio from its source code
without having run `pnpm ffmpeg:fetch`.

---

## Where your files really are

Everything is in the project folder, in a precise and readable place:

```
my-project.scenario/
└── assets/
    ├── img/     images
    ├── vid/     videos
    ├── aud/     sounds
    ├── 3d/      3D objects
    ├── tex/     textures
    └── sky/     skies
```

These are real files, in real formats. You can open them with any other software, copy them, send
them.

**Except imported media**, which stay where they were — that is the whole point of the link.

---

[← Generating](06-generating.md) · [Contents](../user-guide.md) · [Next chapter: Image workspace →](08-image-workspace.md)
