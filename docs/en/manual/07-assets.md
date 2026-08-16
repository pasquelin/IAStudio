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
| Image, Textures, Skyboxes | in the **bottom strip** |
| Video, Audio, 3D | in the **right column**, upper half |

This is not a whim: in the Video, Audio and 3D workspaces the bottom strip belongs to the timeline,
which needs the full width. Yet the shelf and the timeline have to hold the screen **together** so
you can drag a take or a model from one to the other — so the shelf takes the upper half of the
right column, the one holding the panels that serve the open document.

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
| **Right column** (Video, Audio and 3D workspaces) | on their **own line**, below the title |

In a strip the row is wide and mostly empty: putting the bar there saves a whole row, and the
shelf is there to show assets, not buttons. In a narrow column, the same bar would push the close
button out of the frame — so it drops back below the title.

| Control | What it does |
|---|---|
| **Search…** | filters on the asset's **name**, as you type |
| **Type** | keeps only **one** kind of asset — picking one replaces the previous |
| **Location** | keeps only assets in a given state with respect to the library |
| **Icons** / **List** | grid of thumbnails, or dense list |
| **Smaller thumbnails** / **Larger thumbnails** | their size |

Filtering is **instant**, even on a large project: the whole catalogue is already loaded in memory,
unlike the Models panel which queries the Scenario catalogue remotely.

> **Search does not ask you for accents.** Typing `foret` finds "Forêt d'hiver", and `ete` finds
> "Été". That holds here and in the settings search: you search by typing, not by spelling. The
> **Models** panel says nothing about it, because it does not search itself — it hands the word to
> the API and shows what comes back.
>
> It applies to files coming from the Finder too. macOS writes names in a form where the accent is
> a character of its own — invisible to the eye, different to the machine — so an imported asset
> did not always answer to its own name retyped here. Both forms are now treated as one.

Both views are **virtualised**: only what is actually on screen is drawn. A project with several
thousand assets therefore scrolls without stutter.

**A sound shows itself as its waveform** on a tile, rather than as a speaker glyph: two takes of
the same length looked identical until one of them had been played. The waveform is the one the
timeline draws, derived at import — so it appears a fraction of a second after the tile, once it
has arrived.

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
| **⌘-click** *(Ctrl elsewhere)* | adds this asset to the selection, or takes it out |
| **Shift-click** | selects the whole range between the last one picked and this one |
| **Double-click** | **opens the asset in a tab of its own**, in the workspace that edits its kind |
| **Right-click** | lists **every** destination it has |
| **Drag and drop** | drops the asset wherever you release it |

### Picking several assets

Two of the shelf's actions work on **several** assets at once: **Send** and **Name**. Multiple
selection exists for them.

**Shift-click extends, ⌘-click picks.** The first takes everything between the last asset chosen
and the one you click; the second only adds — or removes — that one. A plain click starts over.

**The starting point follows your choices.** After a ⌘-click, that last asset is the anchor for
the next shift-click: you pick three thumbnails here, then extend from the third, not from the
first.

**The shelf is reachable from the keyboard too**, like every other list in the studio — see
[Walking a list with the keyboard](15-shortcuts.md#walking-a-list-with-the-keyboard).

### Right-click sends the asset somewhere double-click does not

**The two gestures do not serve the same need, and that is the split to remember**: double-click
serves **the asset** — it opens it at home; right-click serves **the document already open** — it
sends the asset there. The first makes a tab, the second makes none.

Right-click lists every destination, always in the same order:

| Row | Where it sends the asset | For which types |
|---|---|---|
| **Use as sky** | the open sky, Skyboxes workspace | pictures |
| **Add to the scene** | the open 3D scene | meshes |
| **Open in the audio editor** | the open edit, Audio workspace | sounds |
| **Place as a layer** | the open image, Image workspace | pictures |
| **Add to the edit** | the open sequence, Video workspace | all |
| **Use as base colour** | the open material, Textures workspace | pictures |
| **Rename** | opens the name on the thumbnail itself | all |
| **Show in folder** | opens the file manager on the file | all |

**Renaming changes the name in this project only** — the one on the Scenario account stays as it
is. One asset is pulled into several projects and named for what each one does with it. The name
can also be changed in the Inspector, by double-clicking the **Name** row.

Each row carries its workspace's icon, the same one as in the title bar. The menu only shows
destinations able to take **that type**: right-clicking a sound does not offer to lay it out as a
sky.

**A destination whose workspace has no open document does stay listed, but greyed out.** That is
deliberate: a menu whose length changes with what is open is a menu you cannot learn. A greyed row
tells you what to do — open a document in that workspace — where a missing row tells you nothing.

It is also what to look at when a send leads nowhere: right-click
shows in one go what this asset can do, and what is missing for it to do it.

### Double-click opens the asset, it sends it nowhere

**An asset opened by double-click gets a tab of its own**, in the workspace that edits its kind:
a picture in Image, a mesh in 3D, a sound in Audio. There is nothing to open first.

**It never looks at the tab in front of you**: the double-click opens the asset in the workspace
for its kind, whatever is on screen.

**Reopening the same asset returns to its tab**, no second one is born: two tabs onto one
document are two histories of it, and the second save would write over the first.

**A refusal is said out loud**, rather than leaving an empty tab in its place: an asset no editor
takes, or one that has not come down to your disk yet, tells you so.

The asset's kind picks its editor, and nothing else weighs in:

| What you double-click | Where it opens |
|---|---|
| a **picture** | the Image workspace |
| a **texture** | the Textures workspace |
| a **sky** | the Skyboxes workspace |
| a **mesh** | the 3D workspace |
| a **sound** | the Audio workspace |
| a **video** | the Video workspace |

**A double-click that leads nowhere says so**: "This asset could not be opened". That is a kind no
editor takes, or an asset not yet down on your disk — not a broken one.

> **The `+` button on the left rail makes an EMPTY document**, in the workspace you want.
> Double-click opens a document **on an asset**. Those are the two ways to start, and right-click
> is then how you feed material into what is open.

### What drag and drop can do today

| You drag… | Onto… | Result |
|---|---|---|
| any asset | the **timeline** | a clip on the track you aimed at |
| an image | the Image workspace **canvas** | it becomes one more layer, armed |
| an image | a **material** preview | it becomes the base colour |
| an image | a specific **channel**'s thumbnail | it becomes that channel |
| a panoramic image | a **sky** preview | it becomes the sky |
| a mesh | the **3D view** | it enters the scene, at the origin |
| a sound | the **audio editor** | it joins the edit as a clip, and that clip is what you edit |
| an asset | an **asset field** of a generation form | it becomes that field's input |

**The timeline does not sort.** It takes what it is given: an asset with no duration of its own
gets a default one rather than a refusal. In the 3D view the drop is accepted **anywhere on the
view**, toolbar included: a release landing beside it would be a miss you cannot see coming.

---

## An asset's inspector

Select an asset and look at the **Inspector**, in the right column. It shows, according to what it
knows:

| Section | What it holds |
|---|---|
| **Identity** | the name, the type, the duration, dimensions, size, creation date |
| **Generation** | the model, the seed, the prompt — and two buttons, **Pin this recipe** and **Regenerate** |
| **File** | the **Location** on disk, and nothing else — the group only appears for an asset held locally |

The **Show in folder** button steps out of the studio: it opens Finder, Explorer or your file
manager, with the file already selected.

> "**File not found**" means a linked medium has been moved or deleted from its original location.
> See the next section.

---

## Your account's library

Your project is a folder on your disk. Your Scenario account has a library of its own, online.
The two exist separately, and **nothing travels between them unless you ask**.

> **"Asking" does not mean "asking from this shelf".** Two gestures made elsewhere send a picture
> without going through the buttons below: **running a generation** that carries a reference
> picture, and clicking **Describe the style of the references** in the generator (chapter 6). In
> both cases the API has to see the picture to answer, so the studio sends it once, and its badge
> turns to **In sync**. Nothing is sent while you type.

### What a thumbnail's badge tells you

A small mark says where an asset stands with respect to the library:

| Badge | What it means |
|---|---|
| **Local only** | the file is on your machine, the library knows nothing about it |
| **In sync with the library** | both sides hold the same version |
| **Changed here — to send** | your copy has moved since the last upload |
| **Changed in the library — to fetch** | the other side is the one that moved |
| **Changed on both sides** | the two versions have diverged |
| **The last upload failed** | the previous attempt did not go through |
| **Belongs to another project** | the online twin answers to a different API key than the active one |

**The first two only ever draw in list view.** On a thumbnail, "local only" and "in sync" stay
silent: those are the two ordinary states, and marking them would cover the grid in dots that say
nothing. A thumbnail with no badge is therefore a thumbnail that is fine: what the eye goes
looking for is whatever does show.

The badge is not stored, it is **recomputed**: it depends on the active account, and an API key
opens onto one project and one only. Switch accounts in the title bar and the badges are read
again — same file, different library on the other end.

> **Two of those seven badges are out of reach today**, and consistently so: as long as transfers
> are triggered by hand, nothing can change the online version behind your back. "To fetch" and
> "changed on both sides" will only appear with automatic syncing, once it exists.
>
> **"Belongs to another project", though, needs no waiting**: fetch an asset with one key, switch
> to another in the title bar, and it wears the badge. That is the paragraph above at work, not a
> syncing case.
>
> The **Location** filter still offers only four states — *local only*, *in sync*, *to send* and
> *failed*. "Another project" can therefore show on a thumbnail without being available to filter
> on.

### Sending a selection

The **Send** button, on the shelf's title line, uploads the **selected** assets to your account's
library — see [Picking several assets](#picking-several-assets) for designating more than one.

Three things describe it better than an introduction would:

- **it never leaves on its own** — it takes a selection, and a click;
- **it refuses to run twice**: during a transfer the button is inactive, so a second click cannot
  push over the first;
- **it reports asset by asset.** What went through went through; what failed takes the *failed*
  badge and a line in the journal — an upload is not all-or-nothing.

An unselected asset, or a closed project, leaves the button greyed out.

> **The shelf has no Fetch button; the home screen does.** Its **Your library** band lists what
> your account holds, and clicking a thumbnail brings it down into the open project. So the
> transfer runs both ways — but each way has its own door, and they are not the same one:
> sending starts from the shelf, fetching from the home screen.
>
> **The click only fetches once.** If the asset is already on your disk, that same thumbnail
> **opens** it instead of downloading it again. And with no project open, or while a transfer is
> running, it does not react at all.

### Naming from what the API sees

The **Name** button, next to it, asks the API to look at the selected pictures and give them a
name drawn from their content. The names land in the project's catalogue.

**It only sees pictures the library already knows.** The API describes what it hosts: a picture
that has never been sent is dropped from the request, silently. Send it first, name it after.

> **This button is not the only door, and that is the one thing to take away here.** The
> **Name fetched assets** setting, under **Generation**, is **on by default**: a picture that
> arrives without a useful name is sent to the API with nobody clicking, and that **spends creative
> units**. The chapter [All the settings](14-settings.md) covers it — it is the one place where the
> studio spends of its own accord, and unticking it is enough to stop it.

---

## Importing your own media

The **Import media** button, on the shelf's title line.

### What can be imported

| Type | Accepted extensions |
|---|---|
| **Video** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |
| **3D** | `glb` |

> **3D models import as `.glb`.** A separate `.gltf` — the one with its `.bin` and textures
> beside it — does not: the studio serves each asset on its own, so the linked files would be
> nowhere to be found. `.obj`, `.fbx` and HDRIs (`.hdr`) cannot be imported yet, and an imported
> `.exr` is catalogued as an image, not as a sky. See [What does not exist yet](18-limits.md).

### The file is not copied — on import

**Important.** On import, the studio does not copy your file into the project: it creates a
**link** to where it sits.

Two consequences:

- **Upside** — a 12 GB video rush is not duplicated. Your project stays light.
- **Downside** — if you move, rename or delete the original file, the link breaks **silently**:
  nothing reports it until you click **Show in folder**, and it is that click, finding
  nothing, that brings "File not found" up in the inspector.

If you have to take a project elsewhere, take the media it points at too — or copy them into the
project folder yourself before importing them.

**But EDITING one brings it into the project.** A linked medium you retouch and then save — `⌘S`
on an image, **Apply** on a sound take — is written into the project folder, and it is that copy
the studio shows everywhere afterwards: the shelf, the scene, the inspector. The link is replaced
by a real file, and **Show in folder** now leads there.

**The file you pointed at is not touched.** It stays where it is, in the state you left it in:
writing into a folder you merely showed the studio is a different act from editing an asset. If
you meant to change the original, do it in the tool that made it.

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

It keeps the **first that exists**, and stops there: it does not walk back down the list. The
binary it keeps is launched afterwards, but to say whether video preparation is available — not
to choose.

**Two consequences, and the second one surprises.** The settings path only ever matters when the
shipped binary is **absent** — which happens when you run the studio from its source code without
having run `pnpm ffmpeg:fetch`. And if the chosen binary is present but does not run, pointing at
another path in the settings **will not rescue it**: the studio reports the feature unavailable,
and that binary is the one to repair or replace. See
[When something goes wrong](16-troubleshooting.md#the-puzzling-case-ffmpeg-is-there-and-the-studio-says-it-is-not).

When the chosen candidate does not run — or when there is none — an **amber warning triangle**
appears on the asset shelf's title
bar, left of the counter. Hover it, or reach it with the keyboard, and it says: "Video preparation
unavailable: no lighter copy, no waveform." `Esc` closes the tooltip.

**The import still works.** You only lose comfort: scrubbing through videos will be less smooth,
and audio tracks will not show their drawing.

**This case has become rare.** It now concerns mostly whoever ran the studio from its source code
without having run `pnpm ffmpeg:fetch`.

---

## Where your files really are

Everything is in the project folder, in a precise and readable place:

```
My project/
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
