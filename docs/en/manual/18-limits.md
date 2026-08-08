# 18. What does not exist yet

[← Glossary](17-glossary.md) · [Contents](../user-guide.md)

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

### Tools announced but inactive

They are visible in the toolbar, greyed out.

| Tool | Group |
|---|---|
| **Scale** (`K`) | Cursor |
| **Slice** (`⇧S`) | Frame |
| **Cut** (`S`) | Frame |
| **Image…** (`⇧⌘K`) | Shapes |
| **Pen** | Drawing |
| **Text on path** | Text |

### Selection constrains nothing

The three selection tools — **rectangle**, **ellipse**, **lasso** — do draw an area. But no other
tool restricts its action to that area yet.

Painting with an active selection paints everywhere. It is the most disconcerting limit of this
workspace, because the gesture appears to work.

### Fill is not a paint bucket

**Fill layer** (`G`) fills the **entire** layer, edge to edge. It is not the region fill you may know
from elsewhere — the one that stops at outlines.

That is not a defect: it is a different tool, and its name says so.

### History stops at 100

The *undo stack* keeps the **last 100** actions. Beyond that, the oldest disappear for good.

### No export

You cannot yet write a flattened `.png` or `.jpg` from an image document.

---

## 3D workspace

### What is missing

- **multiple selection** — one object at a time;
- **groups** and reparenting — you cannot assemble objects into a subset;
- **copy-paste** and duplication;
- **model import** for `.glb`, `.gltf`, `.obj` — you can only place what the studio can build or
  generate;
- **cast shadows** — objects are lit, but throw no shadow;
- **image-based lighting** (*IBL*) in the viewport — a *skybox* does not yet light a 3D scene, even
  though it does light the Skyboxes workspace preview;
- **snapping** and local pivot.

### Two objects announced but not buildable

**Sprite** and **Text** appear greyed out in the **Add** menu.

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

## Import

### What can be imported

| Type | Extensions |
|---|---|
| **Video** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |

### What cannot

- **3D files** — `.glb`, `.gltf`, `.obj`, `.fbx`;
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

### On Windows and Linux, the display shows `⌘`

The shortcuts **work** with `Ctrl` — the system menu is correct. But the tooltips and the shortcuts
screen draw the Mac `⌘` symbol instead of `Ctrl`.

It is a display defect, not a functional one.

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

If you only remember five things from this chapter:

1. **images, sequences, sounds and skies do not save** — closing the tab loses the work;
2. **there is no video export** — the studio cannot yet deliver a final file;
3. **selection in the Image workspace constrains no tool**;
4. **you cannot import a 3D model** or an HDRI;
5. **a skybox does not yet light a 3D scene**.

Everything else is comfort.

---

[← Glossary](17-glossary.md) · [Contents](../user-guide.md)
