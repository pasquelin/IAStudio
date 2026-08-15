# 18. What does not exist yet

[← Glossary](17-glossary.md) · [Contents](../user-guide.md) · [Next chapter: How do I… →](19-recipes.md)

The greyed-out buttons, the work in progress, and what not to expect. The complete list, current,
and honest.

---

## Why this chapter exists

Software that hides what it cannot do makes you lose an hour looking for a button that does not
exist.

The studio chose the opposite: **it shows what is coming**. Tools that do not work yet are visible
and greyed out, views to come are in the panels, and this chapter says exactly where the edges are.

Three categories, not to be confused:

|  |  |
|---|---|
| **Not done yet** | it is planned, it will be there one day |
| **Deliberately absent** | it will not be done, and there is a reason |
| **Known defect** | it works badly, and it is identified |

---

## Saving: every type is there

All six types write into the project folder and open back exactly as they were.

| Document | Extension | Saves? |
|---|---|---|
| 3D scene | `.scene` | **yes** |
| Material | `.tex` | **yes** |
| Layered image | `.img` | **yes** |
| Video sequence | `.seq` | **yes** |
| Edited sound | `.aud` | **yes** |
| Sky | `.sky` | **yes** |

**What does not save:**

- **the undo history** — reopening a document means starting again without `⌘Z`;
- **how you were looking at it** — zoom, framing, a sky's view, a selection: that is session
  state, not what the document *is*;
- **in Audio, the A/B monitoring**: a reopened document listens to the chain, never the source.

**Closing a tab now asks.** If the document holds unsaved work, the studio puts the question —
Save, Don’t save, Cancel — and *Cancel* is what an `⎋` struck without reading answers.

**So does quitting.** The window no longer leaves carrying unsaved work: it refuses to go and
puts the same question, once per document that holds any. *Cancel* at any of them calls off the
whole departure, and **no document is closed or written** — the studio is exactly where it was
left. Answering all of them closes those tabs without quitting: the studio leaves on the next
gesture, once it has nothing left to save.

One gap remains: **switching projects** closes the open documents without asking.

---

## Image workspace

### There is no "Open" menu, and none is needed

A picture from the shelf comes **in** — dragged onto the canvas, double-clicked, or chosen with
the **Image…** tool: it becomes a layer. See [Image workspace](08-image-workspace.md).

Reopening a document composed earlier goes through the **Explorer** panel, which lists the
documents of the project: double-clicking a row opens it, switching workspace if it belongs to
another. That is the door, and there is no file dialog — the studio only opens what is in the
project.

`⇧⌘E` still writes a flattened `.png`; reimported, that PNG comes back as a picture and not as
its layers — that is an export, not a save.

### Tools announced but inactive

They are visible in the toolbar, greyed out.

| Tool | Group |
|---|---|
| **Slice** (`⇧S`) | Frame |
| **Cut** (`S`) | Frame |
| **Pen** | Drawing |
| **Text on path** | Text |
| **Comment** (`C`) | alone in its group |

**They all say their state by their grey**, which is the only thing asked of them until they
exist. Comment was the last to fall into line: it armed like the others, changed the cursor, and
left the engine dropping every click — a button that looked alive without being so.

### In Video, tool keys are not listened for

The edit's toolbar shows `V`, `C` and `H` beside its three tools. **None of them is active**:
they appear in the tooltips, and nothing resolves them — a tool there is picked with the mouse.

**The Image workspace has settled the question**: its twenty tools became commands in their own
right, so their keys really arm, remap, and show up in the shortcuts screen. That is the model the
edit has yet to follow.

The general rule is unchanged: what goes through the command registry answers; what does not is a
stated intention.

### Cropping does not give its pixels back on undo

**All five are offered** — Merge down, Flatten, mirroring, the quarter turn, and now the **crop**
(`F`). What blocked them was a layer's surface not following its document; it follows it now.

The crop does come with a limit worth knowing before you use it: **shrinking the document throws
away for good whatever falls outside the frame**. `⌘Z` restores the original size, but the removed
area comes back empty, and the brush strokes it held do not come back either. This is Photoshop's
behaviour with "Delete cropped pixels" ticked — except that its history can give them back.

**The reason.** Pixels do not live in the document but in GPU textures, and the history only keeps
512 px tiles of them, capped at 256 MB. A hard crop would remove more tiles than that cap allows.
Keeping the whole picture from before would mean full-size snapshots in the undo stack, which the
studio rules out precisely so `⌘Z` stays instant on heavy documents.

**What to do:** press `⇧⌘E` before a wide crop, if you may want to come back.

### Fill is not a paint bucket

**Fill layer** (`G`) fills the **entire** layer, edge to edge. It is not the region fill you may know
from elsewhere — the one that stops at outlines.

That is not a defect: it is a different tool, and its name says so.

### History stops at 100

The *undo stack* keeps the **last 100** actions. Beyond that, the oldest disappear for good.

### Export flattens, saving does not

`⇧⌘E` writes the **flattened** document as a `.png` wherever you point: one picture, the layers
melted together. It is not a save — it is an output.

To keep the layer stack, use `⌘S`: an image document **does save** now, as an `.img` folder. The
two gestures do different jobs and neither replaces the other.

---

## 3D workspace

### Animation runs straight, and a clip plays on its own

The 3D timeline — see [the 3D workspace](09-3d-workspace.md) — interpolates **linearly** between
two keys: no easing curves, so a move starts and stops abruptly. Laying down more keys is the only
way to soften a path for now.

**A model's clip plays on its own.** You pick one, start it, stop it — but nothing blends `walk`
into `run`: going from one to the other is a cut.

**A render writes one size**, 1920 × 1080, of what a scene camera sees. There is no resolution
setting yet, and no choice between several cameras: the first one in the scene renders.

### The 3D text offers one weight per family

**Add ▸ Object ▸ Text** works — see [the 3D workspace](09-3d-workspace.md). Two reservations.

**One cut per family.** The list offers the roman of each font and nothing else: no bold, no
italic. A family that installs nine weights therefore takes one row, which is the right trade
until the studio has a weight picker.

**A system font does not travel.** It stays written in the document, but a machine that has not
got it draws the letters in the default embedded font, marking the missing name in the list. The
three fonts the studio ships, on the other hand, open identically everywhere.

**And a few older fonts will not open at all**: the font-reading library the studio uses does not
know every table format faces inherited from before the 2000s use. On an Apple machine this
affects about one font in ten. The text then falls back to the default font, and the log says
which one failed.

### The `S` shortcut does two things at once

In the 3D view, `S` picks the **Scale** tool *and* moves the camera backwards while held. The two key
tables — the tools and the flying — are read on the same press.

In practice you barely notice: taking the tool backs the camera up by a hair. But it is an overlap,
not an intention.

### The flying keys cannot be remapped

`W A S D Q E` and the boost key are fixed. They do not appear in the shortcuts screen, and the **Find
by key** button does not find them.

---

## Video workspace

### No export

A sequence is now written into a `.seq` file and reopens exactly as it was.

**There is still no export**: you cannot yet produce a final video file. This is the studio's
heaviest limit to date, because it stops you delivering.

### A sequence's settings are fixed

A new sequence always starts at 1920 × 1080, 25 frames per second, 48,000 Hz. Those values cannot be
changed yet.

### What playback does not make you hear yet

The Program monitor plays sound tracks. Two bounds remain, all deliberate:

| What is not heard | Why |
|---|---|
| **A video's own sound**, laid on a picture track | only tracks of the sound kind are scheduled |
| **Scrubbing** — dragging the playhead by hand | sound is planned by the playback loop alone |

**And one drift, unmeasured**: on a long edit the picture can pull away from the sound. The output
clock takes over as soon as it runs, which avoids this in the common case — but the very first
playback after the application opens may start before the output answers, and run on the system
clock instead.

---

## Audio workspace

### What is deliberately absent

These are **not** oversights:

- no **noise reduction**;
- no **de-esser**;
- no **spectral repair**;
- no **equaliser**, no **compressor**.

**The reason.** Those tools answer problems of **real recording**: a microphone that hisses, a room
that rings, a whistle on the "s". A **generated** sound does not have those defects — it is clean by
construction.

What stays useful on a generated sound is to shorten it, bring it to the right level, and make it
come in and go out cleanly. That is exactly what this workspace does, and no more.

### The audio document does not keep the A/B listen

The `.aud` file exists and reopens — the table at the top of this chapter is what counts. What it
holds is **the edit chain**, not the sound: the cuts, the fades, the gain, replayed over the
source asset — **and the multitrack edit in the bottom strip**. What it does not keep is the
**A/B listen**: a reopened document listens to the chain, never to the source.

The workspace can also write an *asset* directly, through **Apply** or **Save as new**: that is
what you do when the result has to serve elsewhere rather than carry on being edited.

---

## Textures workspace

### What is missing

- **chained derivations** — computing height from the base colour does not recompute the normal
  that came from it: each channel is recomputed on demand, one at a time;
- **importing a file from disk** straight into a channel. The detour exists: import the picture into
  the project, then drop it onto the channel's thumbnail.

**Export now exists** — glTF/GLB, Unity, Unreal, Roblox and the raw channels, through File →
Export the texture. Two bounds worth knowing: **Roblox refuses a map above 1024 px**, so its four
files are brought under that ceiling; and the `.glb` leaves with the shape of the preview, an
object format having no way to carry a material on its own.

What works today: generating a material, placing a picture in each of its eight channels, computing
four of them from another, judging how it repeats and measuring its seams, setting
everything it is made of — roughness and metalness with their remap, relief, emission, tiling —
looking at it on five shapes under the lighting of your choice, inspecting each channel flat,
saving it, and handing it to five destinations.

### A channel's opacity cannot be set

A channel is placed or it is not. There is no partial blend between two pictures in the same channel,
and no fade between the overall value and the map: the remap sets the **range** the map is read into,
which is a different question.

---

## Skyboxes workspace

### The Generation section has no buttons

It does show the model, the prompt and the seed that produced the sky, read-only. But the two
buttons you would expect — **Regenerate** and **Reset** — are placed nowhere in the panel.

Until then, you copy the prompt and the seed by hand into the **Generate** panel, which comes to the
same thing in three more gestures.

### The export comes out as PNG, so without the highlights

A sky is now written into a `.sky` file — the exposure, the horizon rotation and the sun's position
reopen exactly as they were. What the document does not keep: the view and the field of view, which
say how you were looking at it rather than what it is.

The six faces of a cube export from **File › Export the sky**, at 512, 1024 or 2048. What is
still missing is the *HDRI*: the faces come out as PNG, so eight bits a channel, and anything
above white is clipped.

---

## Import

### What can be imported

| Type | Extensions |
|---|---|
| **Video** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |
| **3D** | `glb` |

### What cannot

- **3D files other than `.glb`** — separate `.gltf`, `.obj`, `.fbx`;
- **HDRIs** — `.hdr`.

An `.exr` does import, but it is catalogued as an **image**, not as a sky. It still works as a source
for a *skybox*: you simply have to go and find it among the images.

**Three formats import without ever showing in a Video monitor** — `.exr`, `.tif` and `.tiff`.
The clip drops onto a track and keeps its duration, but the monitor says "This clip could not be
shown" in place of the picture. The studio does not convert them: see
[The Video workspace](10-video-workspace.md#when-a-clip-cannot-be-shown).

### The file is not copied — on import

On import, the studio creates a **link** to your file, where it sits. Moving or deleting the
original breaks the link.

That is not a defect but a choice: copying multi-gigabyte rushes into every project would fill your
disk for nothing.

**Editing one, however, brings it into the project** — and your original file is not touched. See
[Assets](07-assets.md).

---

## Settings and shortcuts

### Two families have no default model

**Settings ▸ Generation** offers seven sub-sections: Image, Video, 3D, Audio, Upscaling, Background
removal, Vectorisation. **Texture** and **Skybox** are missing, even though both are now model
families in their own right.

The consequence: in the Textures and Skyboxes workspaces the **Generate** panel only appears once a
model has been chosen by hand, and it has to be chosen again every session — the other workspaces
can remember theirs.

### A project always stays on your disk

The settings file provides for a choice between "on your disk" and "in the cloud" for where a
project lives. **The second is not implemented**, and the choice is therefore offered nowhere in
the interface. Offering a button that leads nowhere would be a promise the software cannot keep.

> **Not to be confused with your account's library**, which does exist: you can **send** assets to
> it from the shelf. These are two different things — one is where the project itself is kept, the
> other is a stock of assets online, beside the project. See [Assets](07-assets.md).

### Fetching has no button

Sending to the library exists; the way back does not. The studio knows how to fetch and how to
compare both sides — it is written and tested — but no button triggers it, and no screen shows
what the library holds.

A direct consequence, and not a failure: of the seven badges an asset can wear, **three cannot
appear** — "to fetch", "changed on both sides" and "belongs to another project". As long as
nothing moves without you asking, the other side cannot get ahead of yours.

### On Windows and Linux, `⌘` is taken literally

Two separate defects, one of display, one of function.

**Display**: the tooltips and the shortcuts screen draw the Mac `⌘` symbol instead of `Ctrl`,
everywhere.

**Function**: the shortcuts the system menu carries — `⌘Z`, `⌘S`, `⌘N` — do answer to `Ctrl`, since
it is the menu that fires them. But the ones a surface listens for itself, such as `⌘D` in the 3D
view, expect the **Windows** key rather than `Ctrl`: for now they are out of reach anywhere but on
a Mac.

---

## What the studio will not do

These are not gaps: they are accepted boundaries.

### It does not work offline to generate

The making happens on Scenario's servers. Without a connection you can open, retouch, edit and save —
but not create new content.

### It is not free to use

Every generation consumes credit on your Scenario account. The studio bills you nothing: it forwards.
But your account does count.

**And it cannot tell you what is left.** The **Help ▸ Usage…** window shows what has been spent
over 7, 31 or 120 days — never a balance, because the Scenario API exposes none. The euro amount
beside it is computed from the public prepaid pack grid: an order of magnitude, not your invoice.

What it can tell you is what a generation is about to cost: the **Generate** button carries an
estimate before you press it. How much is left to pay for it is something your Scenario account
knows and the studio does not.

### It does not replace Photoshop, Blender or Premiere

It does a useful part of each, in the same place, **around generation**. It is a tool for assisted
creation, not a complete production suite.

### The window will never be translucent

No vibrancy, no blurred background behind the window.

In a studio, you judge colours. A translucent background falsifies the perception of everything shown
on top of it. That is a professional decision, and it will not change.

### Your credentials will never be displayed

There is no "show my API key" button, and there will not be one. Once stored, the key is encrypted by
your system's *keychain*, and the part of the software that draws the screen has **structurally** no
access to it.

This is not an inconvenience to work around: it is what guarantees that a screenshot of your settings
cannot leak your account.

---

## Summary: in order of importance

If you only remember five things from this chapter:

1. **all six documents save now**, and closing a tab asks before losing anything; what does not
   come back is the undo history;
2. **a crop only half undoes** — `⌘Z` gives the frame back, never the cropped pixels; export
   before cropping hard;
3. **there is no video export** — the studio cannot yet deliver a final file;
4. **the Texture and Skybox families have no default model** — both workspaces make you pick one
   again every session;
5. **you cannot import an HDRI**, or a 3D model in anything but `.glb`.

Everything else is comfort.

---

[← Glossary](17-glossary.md) · [Contents](../user-guide.md) · [Next chapter: How do I… →](19-recipes.md)
