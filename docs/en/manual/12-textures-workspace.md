# 12. Textures workspace

[← Audio workspace](11-audio-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Skyboxes workspace →](13-skyboxes-workspace.md)

The workspace where you judge a **material**: wood, rusted metal, fabric, stone.

---

## A texture is not an image

That is the starting point, and it changes everything.

An image is looked at flat. A **material** cannot be judged flat: it has relief, it returns light in
a certain way, it shines or it is matte. Laid on a plane under a neutral light, a fine material and
a failed one look alike.

That is why this workspace does not show your image in a frame. It **puts it on an object with
volume, under a real light**, and turns it.

---

## Creating a texture

1. Switch to the **Textures** workspace.
2. Click the **+** button on the left rail. A fresh document opens.
3. **Drag an image from the project onto the preview.** It becomes the **base colour**.

While no image is placed, the preview shows: "Drop a picture from the project to use it as the
base colour".

While no image is placed, the preview shows: "Drag an image from the project to set it as the base
colour".

A blue frame appears around the preview when you hover with an image: that is the sign the drop
will be accepted.

---

## The preview's settings

Top left of the preview, a small bar.

### The shape

Five shapes, and each one shows something different:

| Shape | What it reveals |
|---|---|
| **Sphere** | how the material takes light — the best for judging shine |
| **Cube** | how it behaves on flat faces and sharp edges |
| **Cylinder** | repetition on a curved surface |
| **Plane** | **repetition** — this is where you see the seams that show |
| **Knot** | what happens where the surface folds back on itself |

**In practice**: start with the **sphere** to judge the material, then move to the **plane** to
check that it repeats without a visible seam.

### The three other controls

| Control | What it does |
|---|---|
| **Show background** | shows the environment behind the object, or uses it only to light |
| **Auto-rotate** | turns the object slowly, to read the relief |
| **Lighting** | the intensity of the ambient light, from 0 to 3 |

**Auto-rotate is more useful than it looks.** Relief cannot be seen on a still image: it is the
movement of light across the surface that reveals it.

Bottom right of the preview, a small thumbnail reminds you **which image** is serving as base
colour.

---

## The default lighting

A **neutral studio** — a soft light, with no dominant colour, as in a photographic studio.

Nothing to download, and a readable material from the very first document. It is deliberately
neutral: a coloured light would make a material look good when it is not.

> The day your project contains skyboxes, they will be able to serve as light in turn — which will
> let you judge a material under the real lighting of the scene it will end up in.

---

## The eight channels of a material

A complete material is not one image but **up to eight**, each describing a different aspect of the
surface.

| Channel | What it describes | What it gives |
|---|---|---|
| **Base colour** | the colour, with no shadow or reflection | the "paint" aspect of the surface |
| **Normals** | the micro-relief | bumps and hollows that catch the light, without adding geometry |
| **Roughness** | matte or glossy, area by area | a shiny puddle on matte asphalt |
| **Metalness** | metal or non-metal, area by area | metal rivets on wood |
| **Ambient occlusion** | the corners light struggles to reach | depth in the hollows |
| **Height** | the real relief | an actual displacement of the surface, stronger than normals |
| **Emission** | what glows by itself | a neon sign, embers |
| **Edges** | where the borders are | feeds other calculations |

Each channel has an **origin**:

| Origin | What it means |
|---|---|
| **Generated** | produced by a Scenario model — it is fixed |
| **Derived** | computed by the studio from another channel — it recomputes if its source changes |
| **Imported** | an image you placed yourself |

> **Today, only the base colour can be placed.** The strip of eight channels, the automatic
> derivations and the material settings panel are in progress. See
> [What does not exist yet](18-limits.md).

---

## Roughness and metalness, explained

These are the two words you need to understand in order to read a material.

**Roughness** — how matte the surface is.

| Value | Look |
|---|---|
| 0 | perfect mirror |
| 0.3 | polished metal, glossy plastic |
| 0.6 | varnished wood, leather |
| 1 | chalk, velvet, raw concrete |

Some applications call this "glossiness" or "smoothness", which is exactly the inverse: glossiness
0.9 = roughness 0.1.

**Metalness** — is it metal, yes or no.

This setting is almost always **0 or 1**, rarely in between. Metal returns light in a completely
different way from non-metal; there is not much in between, except on painted or rusted metal,
where the value varies **area by area** thanks to a map.

---

## Saving

Everything is saved **automatically**, moments after your last gesture, into a `.tex` file in your
project's `documents/` folder.

**Nothing is baked into the pixels.** Reopen the document in six months: every setting is still
there, and still adjustable. What is written are your decisions, not their result.

**All six document types now save**, but materials keep one peculiarity: they are the only ones
that write themselves. Everywhere else `⌘S` decides the moment, and the dot on the tab says what
is still waiting to be written.

---

## What is still missing

- the **material panel** — roughness, metalness, relief, tiling, emission, adjustable live;
- the **strip of eight channels**, with their thumbnails and their import;
- the **automatic derivations** — making normals from height, for example;
- the **tiling preview** at 1×, 2×, 4×, and seam detection;
- **export** to glTF, Unity, Unreal, Roblox.

The detail is in [What does not exist yet](18-limits.md).

---

[← Audio workspace](11-audio-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Skyboxes workspace →](13-skyboxes-workspace.md)
