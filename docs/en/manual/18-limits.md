# 18. What does not exist yet

[← Glossary](17-glossary.md) · [Contents](../user-guide.md) · [Next chapter: How do I… →](19-recipes.md)

The greyed-out buttons, the work in progress, and what not to expect. The complete list, current,
and honest.

---

## Why this chapter exists

Software that hides what it cannot do makes you lose an hour looking for a button that does not
exist.

The studio chose the opposite: **it shows what is coming**. Tools that do not work yet are visible
and greyed out, views to come are in the bars, and this chapter says exactly where the edges are.

Three categories, not to be confused:

| | |
|---|---|
| **Not done yet** | it is planned, it will be there one day |
| **Deliberately absent** | it will not be done, and there is a reason |
| **Known defect** | it works badly, and it is identified |

---

## The limit that matters most: saving

**Four document types out of six do not save yet.**

| Document | Extension | Saves? |
|---|---|---|
| 3D scene | `.scene` | **yes** |
| Material | `.tex` | **yes** |
| Layered image | `.img` | no |
| Video sequence | `.seq` | no |
| Edited sound | `.aud` | no |
| Sky | `.sky` | no |

**What that means in practice.** You retouch an image: you paint, you add layers, you crop. You close
the tab. **All that work is lost.** The original *asset* is still in the project — it is your
retouching that disappears.

The same goes for a video edit, and for a sky's settings.

**What is never lost:**

- the **assets** — everything generated or imported stays in the project, whatever happens;
- the **3D scenes** and the **materials**, which do write to disk;
- in Audio, what you commit with **Apply** or **Save as new**: that workspace writes assets directly,
  without going through a document.

**In the meantime:** do not close the tab while the work matters, and note elsewhere what deserves to
be redone — the *prompt*, the *seed*, the model.

---

## Image workspace

### An image document does not open *onto* a file

A picture from the shelf does come **in** — dragged onto the canvas, double-clicked, or chosen
with the **Image…** tool (`⇧⌘K`): it becomes a layer. See
[Image workspace](08-image-workspace.md).

What does not exist is the reverse gesture: **reopening later the document you composed**. There
is no "Open" menu because there is nothing to reopen — the layer stack saves nowhere. `⇧⌘E`
writes a flattened `.png`; reimported, that PNG comes back as a picture, not as its layers.

### Tools announced but inactive

They are visible in the toolbar, greyed out.

| Tool | Group |
|---|---|
| **Crop** (`F`) | Frame |
| **Slice** (`⇧S`) | Frame |
| **Cut** (`S`) | Frame |
| **Pen** | Drawing |
| **Text on path** | Text |
| **Comment** (`C`) | Comment |

### Cropping, mirroring and rotating are not offered

The gesture is written and cropping works, but **resizing the frame moves the layers without moving
their pixels**: after a crop the brush would paint beside the cursor. The same goes for a mirror or a
quarter turn, which would lay the layers outside the frame.

It is the same missing piece that keeps **Merge down** and **Flatten** off the menu. A button that
damages the document is worse than a button that is not there.

### Fill is not a paint bucket

**Fill layer** (`G`) fills the **entire** layer, edge to edge. It is not the region fill you may know
from elsewhere — the one that stops at outlines.

That is not a defect: it is a different tool, and its name says so.

### History stops at 100

The *undo stack* keeps the **last 100** actions. Beyond that, the oldest disappear for good.

### Export exists, saving does not

`⇧⌘E` writes the flattened document as a `.png` wherever you point. But **an image document does not
save**: closing the tab loses the layer stack and everything painted on it. See "What this means in
practice", above.

---

## 3D workspace

### What is missing

- **exporting** a scene to a `.glb` or `.usdz` file — you can import a model and stage it, not get
  the staged scene back out.

### The 3D text is announced but not buildable

**Text** appears greyed out in the **Add** menu.

three.js builds a text in volume from a converted **font file**. The studio ships none, and a
project's catalogue knows no asset of that kind: not an image, a video, a sound or a 3D model.
Until one of the two exists, the entry stays greyed rather than promising what no path can keep.

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

### No saving, no export

**A sequence is not written to disk**: closing the tab loses the edit.

**There is no export**: you cannot yet produce a final video file. This is the studio's heaviest limit
to date, because it stops you delivering.

The *assets* that made up the edit do stay in the project.

### A sequence's settings are fixed

A new sequence always starts at 1920 × 1080, 25 frames per second, 48,000 Hz. Those values cannot be
changed yet.

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

### No audio document

There is no `.aud` file on disk. The Audio workspace writes *assets* directly, via **Apply** or **Save
as new**. That is not a loss: it is a different working model, and it is complete.

---

## Textures workspace

### What is missing

- **the material panel** — roughness, metalness, relief, tiling, emission, adjustable live;
- **the strip of eight channels**, with their thumbnails and individual import;
- **the automatic derivations** — making *normals* from *height*, for example;
- **the tiling preview** at 1×, 2×, 4×, and visible-seam detection;
- **export** to glTF, Unity, Unreal, Roblox.

What works today: generating a material, looking at it on five different shapes under a neutral light,
and saving it. That is already the central gesture — judging a material on a lit object rather than on
a flat square.

---

## Skyboxes workspace

### Three views out of four draw nothing

The preview bar offers four views. Only one works.

| View | State |
|---|---|
| **360°** | works |
| **Equirect** | button inactive |
| **Cross** | button inactive |
| **6 faces** | button inactive |

### The Generation section has no buttons

It does show the model, the prompt and the seed that produced the sky, read-only. But the two
buttons the translations announce — **Regenerate** and **Reset** — are placed nowhere in the panel.

Until then, you copy the prompt and the seed by hand into the **Generate** panel, which comes to the
same thing in three more gestures.

### No saving, no export

A sky is not written into a `.sky` file: **closing the tab loses the settings** — the exposure, the
horizon rotation, the sun's position.

And you cannot export the six faces of a cube, nor an *HDRI* usable in another application.

### A sky does not yet light a 3D scene

*IBL* works in the Skyboxes workspace preview — that is what lights the witness spheres. But you
cannot yet put that sky around a scene in the 3D workspace so that it lights it.

That is the missing bridge between the two workspaces.

---

## Generating

### There is no "upscale", "remove background" or "vectorise" button

The studio files models into **families**, and each workspace shows exactly one family: Image in
the Image workspace, Video in the Video workspace, and so on for all six.

Four further families are provided for in the code — **upscale**, **background removal**,
**vectorisation** and **other** — and none has a workspace to hold it.

There is something more surprising: **no model is ever filed under those families.** The studio
works a model's family out from what the model takes in and gives back. An upscaler takes an image
and returns an image: it is therefore filed — correctly — under **Image**.

> **The good news: upscalers are usable.** They are simply in the Image workspace, mixed in with
> the rest. Search for `upscale` in the **Models** panel, or filter on the `image-upscale` tag.

So what is missing is not the model, it is **the shortcut**: an "upscale this image" button that
would take the image under your cursor and send it to the right model without you having to find
it again and drop it into a form yourself.

### The "Upscaling" settings sub-section is always empty

That follows directly from the above. **Settings ▸ Generation ▸ Upscaling** exists, opens, and
holds **a single entry: "Ask every time"**. Its list fills with the models of the upscale family —
and there are none.

It is not a fault, and an empty list does not mean you are disconnected: it is a setting written
ahead of the workspace that will use it.

---

## Import

### What can be imported

| Type | Extensions |
|---|---|
| **Video** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |

### What cannot

- **3D files other than `.glb`** — separate `.gltf`, `.obj`, `.fbx`;
- **HDRIs** — `.hdr`.

An `.exr` does import, but it is catalogued as an **image**, not as a sky. It still works as a source
for a *skybox*: you simply have to go and find it among the images.

### The file is not copied

The studio creates a **link** to your file, where it sits. Moving or deleting the original breaks the
link.

That is not a defect but a choice: copying multi-gigabyte rushes into every project would fill your
disk for nothing.

---

## Settings and shortcuts

### The Texture family has no default model

**Settings ▸ Generation** offers five sub-sections: Image, Video, 3D, Audio, Upscaling. **Texture**
is missing, even though it is now a model family in its own right.

The consequence: in the Textures workspace the **Generate** panel only appears once a model has been
chosen by hand, and it has to be chosen again every session — the other workspaces can remember
theirs.

### Cloud storage does not exist

The settings file provides for a choice between "on your disk" and "in the cloud". **The second is
not implemented**, and the choice is therefore offered nowhere in the interface.

Offering a button that leads nowhere would be a promise the software cannot keep.

### On Windows and Linux, `⌘` is taken literally

Two separate defects, one of display, one of function.

**Display**: the tooltips and the shortcuts screen draw the Mac `⌘` symbol instead of `Ctrl`,
everywhere.

**Function**: the shortcuts the system menu carries — `⌘Z`, `⌘S`, `⌘N` — do answer to `Ctrl`, since
it is the menu that fires them. But the ones a surface listens for itself, such as `⌘D` in the 3D
view, expect the **Windows** key rather than `Ctrl`: for now they are out of reach anywhere but on
a Mac.

### One context heading is missing from the shortcuts screen

The four shortcut groups carry a title: "Anywhere in the application", "In the 3D view", "In the
edit"… and the fourth, the image's, shows a technical code instead of its name.

The group's shortcuts work normally.

---

## What the studio will not do

These are not gaps: they are accepted boundaries.

### It does not work offline to generate

The making happens on Scenario's servers. Without a connection you can open, retouch, edit and save —
but not create new content.

### It is not free to use

Every generation consumes credit on your Scenario account. The studio bills you nothing: it forwards.
But your account does count.

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

If you only remember six things from this chapter:

1. **images, sequences, sounds and skies do not save** — closing the tab loses the work; in the
   Image workspace, `⇧⌘E` at least gets a PNG out before you close;
2. **cropping, flipping and rotating a picture are not offered** — the pixels would not follow
   the frame;
3. **there is no video export** — the studio cannot yet deliver a final file;
4. **there is no "enlarge", "cut out" or "vectorize" button**;
5. **you cannot import an HDRI**, or a 3D model in anything but `.glb`;
6. **a skybox does not yet light a 3D scene**.

Everything else is comfort.

---

[← Glossary](17-glossary.md) · [Contents](../user-guide.md) · [Next chapter: How do I… →](19-recipes.md)
