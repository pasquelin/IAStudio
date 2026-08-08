# 13. Skyboxes workspace

[← Textures workspace](12-textures-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Every setting →](14-settings.md)

The workspace where you make and adjust a **360° sky**.

---

## What a skybox is

What you see **all around you** in a 3D scene when you turn your head: the sky, the horizon line,
the distant scenery.

Technically it is an **equirectangular** image — a very wide image, twice as wide as it is tall,
holding the whole sphere flattened out, the way a world map holds the Earth. The studio folds it
back around you.

A skybox does two things:

1. **you see it** — it is the backdrop behind everything else;
2. **it lights** — every part of the sky throws its light and its colour onto the objects in the
   scene. That is called *image-based lighting*, or IBL.

The second point is what matters most. A sunset sky does not merely fill the background: it lays a
raking orange light over everything in front of it.

> **A sky made here lights your 3D scenes.** Once it is saved in the project, it can be chosen in
> the 3D workspace's Inspector, under **Environment**: the scene lights up, and the materials
> reflect it. That is a skybox's real use, beyond scenery — see
> [3D workspace](09-3d-workspace.md).

---

## Three ways to get a sky

**First, open a sky document** with the `+` button on the left rail. The three paths below fill an
open tab; none of them creates one.

| Path | How |
|---|---|
| **Double-click** | on a picture in the shelf, with the sky tab in front |
| **Drag and drop** | from the shelf onto the preview, anywhere on it |
| **Generate** | pick a sky model and launch a generation: it lands **by itself** in the document it started from |

While no image is placed, the preview shows: "No skybox yet. Generate one or drop an
equirectangular panorama."

> **Only things that can be looked at are accepted**: a picture, a material or another sky,
> provided it is on your disk. A sound or a video dropped there is ignored in silence — nothing
> breaks, nothing changes.
>
> On the other hand, **any picture goes through**, not only a true panorama. An ordinary photo
> placed as a sky will look strangely stretched: that is normal, the workspace expects an
> *equirectangular* image, twice as wide as it is tall.

> **Sky models are recognised by a tag.** They answer like ordinary image models, and nothing in
> their capabilities says they make panoramas: it is the `sc:skybox` tag that distinguishes them.
> That is why the Models panel shows only three of them in this workspace, and not six hundred.

---

## Looking at the sky

**Click and drag** in the preview: you turn your head, on the spot.

This is **not** a camera orbiting something — you are at the centre of the sphere, looking around
you. The drag follows your hand: pulling to the right turns the view to the left, as if you were
grabbing the world.

### The preview bar

Top left.

| Control | What it does |
|---|---|
| **360°** | the immersive view — you are inside the sky |
| **Equirect** | the image laid flat *(not wired up yet)* |
| **Cross** | the six faces unfolded as a cross *(not wired up yet)* |
| **6 faces** | the six faces side by side *(not wired up yet)* |
| **Test objects** | shows or hides witness spheres |
| **Field of view** | from 50° to 110°, 75° by default |

**Two keys skip the bar**: `V` cycles through the four views, `P` shows or hides the test objects.
`⌘Z` and `⇧⌘Z` undo and redo here as anywhere else — see [Every shortcut](15-shortcuts.md).

**The test objects** are spheres set in the middle of the sky: one matte, one glossy, one metallic.
They are not part of the sky — they are there to **see what the sky lights**. A sky is judged by
what it does to objects, not only by its own image. That is why they are visible by default.

**The field of view** is the equivalent of a camera lens: a small angle is a telephoto, you see
little but closely; a wide angle shows a lot, but the edges distort.

---

## The Skybox panel

In the right column. Four sections.

> **None of these settings rewrites your image.** They are instructions applied to the display. The
> original file stays intact, and your settings can be replayed indefinitely.

### Sun

| Setting | What it does | Range |
|---|---|---|
| **Elevation** | the sun's height above the horizon | from low horizon to zenith |
| **Azimuth** | its direction, all the way round | a full turn |
| **Intensity** | its power | 0 to 10 |
| **Colour** | its hue | — |

> **The sun is grabbed directly in the preview.** Click it in the sky and drag: elevation and
> azimuth follow. It is faster than two sliders, and you see the shadow move while you do it.

### Adjustments — the grade

This is where you rescue an image that is too dark, too flat or too cold.

| Setting | What it does | Neutral |
|---|---|---|
| **Exposure** | brightens or darkens, in stops | 0 |
| **Contrast** | below flattens, above hardens | 1 |
| **Saturation** | 0 = black and white | 1 |
| **Temperature** | towards cold (blue) or warm (orange) | 0 |
| **Tint** | towards green or towards magenta | 0 |
| **Horizon rotation** | turns the whole sky around you | 0 |
| **Blur** | softens the sky | 0 |

**Horizon rotation** is the most useful setting: it lets you place the sun on whichever side suits
you without regenerating anything.

**Blur** is not only cosmetic: a blurred sky lights more softly, with no hard reflections on shiny
surfaces.

### Environment

| Setting | What it does | Range |
|---|---|---|
| **IBL intensity** | the strength of the lighting the sky casts | 0 to 4 |
| **Show background** | shows the sky, or uses it **only** to light | — |

**Unchecking "Show background"** is a common move: you keep the sky's light but display something
else behind — a flat colour, transparency.

### Generation

**Entirely read-only**, and collapsed by default. It recalls **what produced this sky**: the model,
the prompt, the seed.

It is there for traceability: six months later you still know how this sky came about, and you can
copy those values into the **Generate** panel to start again from there.

> **There is no button in this section.** No "Regenerate", no "Reset": the copying is done by hand.
> See [What does not exist yet](18-limits.md).

---

## The seed's role, particularly here

A sky has to be hunted for. You generate, the mood is almost right but the sun is in the wrong
place. Two ways to carry on:

- **horizon rotation** — instant, free, and often enough;
- **regenerating with the same seed** and a slightly different prompt — you stay in the same family
  of images instead of starting over.

---

## What is still missing

- **three views out of four** — Equirect, Cross and 6 faces are buttons that draw nothing yet;
- **the Regenerate and Reset buttons** — announced in the translations, never placed in the panel;
- **export** — you cannot yet write the six faces of a cube, nor an HDRI usable elsewhere;
- **saving** — a sky is not yet written into a `.sky` file. Closing the tab loses the settings;
- **importing a `.hdr`** — the studio only imports ordinary images. An imported `.exr` is catalogued
  as an image, not as a sky. It still works as a source, but you have to go and find it among the
  images.

The detail is in [What does not exist yet](18-limits.md).

---

[← Textures workspace](12-textures-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Every setting →](14-settings.md)
