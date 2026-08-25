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
> the Modelling workspace's Inspector, under **Environment**: the scene lights up, and the materials
> reflect it. That is a skybox's real use, beyond scenery — see
> [Modelling workspace](09-modelling-workspace.md).

---

## Three ways to get a sky

| Path | How | Where it lands |
|---|---|---|
| **Double-click** | on a **panorama** in the Explorer | in a sky tab **of its own**, opened for it |
| **Drag and drop** | from the Explorer onto the preview, anywhere on it | in the tab **in front of you** |
| **Generate** | pick a sky model and launch a generation | in the document it started from, **by itself** |

**Double-click is the only one of the three that opens a tab**; the other two fill the one you
already have, which the `+` button on the left rail creates empty. And it only holds for a
**panorama**: an ordinary picture, double-clicked, goes to the Image workspace, which is the one of
its kind — to set it as a sky, use drag and drop or right-click ▸ **Use as sky**.

While no image is placed, the preview shows: "No skybox yet. Generate one or drop an
equirectangular panorama."

> **Only things that can be looked at are accepted**: a picture, a material or another sky,
> provided it is on your disk. A sound or a video dropped there does not change the sky: it opens
> in its own workspace, as a double-click would — see [Assets](07-assets.md).
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

### Projection and helpers

The **Inspector**'s first two sections, right at the top: how you look is what the rest is judged
under.

**Projection**

| Control | What it does |
|---|---|
| **360°** | the immersive view — you are inside the sky |
| **Equirect** | the image laid flat, as it is stored — twice as wide as it is tall |
| **Cross** | the six faces unfolded as a cross, on a 4 × 3 grid |
| **6 faces** | the same six faces packed 3 × 2 — the cross spends half its cells on nothing, this one spends none, so a face is inspected at nearly twice the size |
| **Field of view** | from 50° to 110°, 75° by default — **only affects the 360° view** |

> **The three flat views are not pictures built on the side**: every pixel of the frame asks the
> question backwards — which direction of the sky is this, and where does it land in the source.
> So the sky they show is exactly the one of the immersive view, at the same rotation.
>
> They **letterbox their picture** rather than stretching it, and while one of them is in front the
> backdrop and the test objects go dark: they would sit behind the picture, and the immersive sky
> showing through the bars would read as part of what is being judged.

**Helpers**

| Control | What it does |
|---|---|
| **Test objects** | shows or hides witness spheres |

> **These settings live in a panel, not above the image.** The centre carries the toolbar and the
> rulers, nothing else: a menu laid over the preview would cover the one thing this workspace
> exists to show.

**Two keys skip the inspector**: `V` cycles through the four views, `P` shows or hides the test
objects. `⌘Z` and `⇧⌘Z` undo and redo here as anywhere else — see [Every shortcut](15-shortcuts.md).

**The test objects** are spheres set in the middle of the sky: one matte, one glossy, one metallic.
They are not part of the sky — they are there to **see what the sky lights**, and are visible by
default.

**The field of view** is the equivalent of a camera lens: a small angle is a telephoto, you see
little but closely; a wide angle shows a lot, but the edges distort.

---

## The sky inspector

The right column holds one panel, and it describes the open sky: there is nothing to select, and
everything it shows belongs to the document. Six sections — the two above, which say how you LOOK,
then the four that follow.

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

## Taking the sky out: the six faces

**File › Export › Sky**, then a size: 512, 1024 or 2048 pixels a side. The studio asks for a
folder, creates one named after the document inside it, and writes six PNGs:

| File | Face |
|---|---|
| `<title>_Rt.png` | right |
| `<title>_Lf.png` | left |
| `<title>_Up.png` | above |
| `<title>_Dn.png` | below |
| `<title>_Ft.png` | front |
| `<title>_Bk.png` | back |

Those two letters are the ones engines expect — Unity, Unreal and Roblox all read them, Roblox
with a `Skybox` prefix. The faces follow the OpenGL cube map convention, so they come in the
right way up without any of them needing to be flipped.

Three things worth knowing:

- **your settings leave with the pixels.** Exposure, contrast, saturation, temperature and
  horizon rotation are baked into the six files. What you judged is what comes out;
- **the export reads the source, not the preview.** The viewport works on a reduced copy to stay
  responsive; the export starts again from the original picture at its own size, whatever face
  size you asked for;
- **the file may look more contrasted than the screen.** The viewport applies a render curve to
  show a very bright picture on a screen that is not; the file carries the values, not that
  curve. This is deliberate: your engine will apply its own, and baking one here would apply it
  twice.

A sky with no picture does not export: the studio says so in the journal rather than opening a
folder chooser for six empty files.

---

## What is still missing

- **the Regenerate and Reset buttons** — the inspector does not place them;
- **HDRI export** — the six faces come out as PNG, so eight bits a channel: anything above white
  is clipped. For high dynamic range lighting there is no output yet;
- **importing a `.hdr`** — the studio only imports ordinary images. An imported `.exr` is catalogued
  as an image, not as a sky. It still works as a source, but you have to go and find it among the
  images.

The detail is in [What does not exist yet](18-limits.md).

---

[← Textures workspace](12-textures-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Every setting →](14-settings.md)
