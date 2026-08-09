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

A blue frame appears around the preview when you hover with an image: that is the sign the drop
will be accepted.

---

## The preview's settings

**They are in the Inspector**, right-hand column, **Preview** section. The preview itself carries no
buttons: a studio is where finishes are judged, and a control laid over the material is a control in
front of it.

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

### The four other controls

| Control | What it does |
|---|---|
| **Lighting** | the intensity of the ambient light, from 0 to 3 |
| **Sky rotation** | turns the lighting around the object, in degrees |
| **Show background** | shows the environment behind the object, or uses it only to light |
| **Auto-rotate** | turns the object slowly, to read the relief |

**Auto-rotate is more useful than it looks.** Relief cannot be seen on a still image: it is the
movement of light across the surface that reveals it. Sky rotation does the same thing the other way
round — the object stays still and the light moves.

---

## The lighting

The **Environment** section of the Inspector, below the preview one. It is **exactly the one from
the 3D workspace**: the question is the same, and the skies on offer are your project's own.

By default, a **neutral studio** — a soft light, with no dominant colour, as in a photographic
studio. Nothing to download, and a readable material from the very first document. It is
deliberately neutral: a coloured light would make a material look good when it is not.

As soon as your project holds a skybox, it appears in the list and serves as light in turn — which
lets you judge a material under the real lighting of the scene it will end up in. "Studio" is always
offered, to come back to.

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
| **Derived** | computed by the studio from another channel, on demand |
| **Imported** | an image you placed yourself |

### The Channels panel

Right-hand column, the workspace's first panel — it is what Textures is. One thumbnail per channel,
all eight, **empty ones included**: what a material lacks counts as much as what it has.

| Gesture | What it does |
|---|---|
| **Drag an image onto a thumbnail** | puts that image in **that** channel |
| **A thumbnail's menu** | computes the channel from its source, picks from the project's pictures, or empties the channel |
| **Click a thumbnail** | shows that channel **on its own**, flat |
| **Click the same one again** | back to the lit material |

The badge at the top left of a thumbnail says its **origin** — generated, derived or imported.

**The flat view is not a preview, it is a reading.** It shows the pixels unsmoothed: a normal or a
height map is inspected precisely for the noise and the banding a browser's smoothing would hide. It
is not saved with the document, and `⌘Z` does not give it back — it is a way of looking, not a
decision.

An empty thumbnail cannot be clicked: there is nothing to look at.

> **An image dropped on the preview still goes to the base colour.** It is the channel without which
> a material cannot be judged, and the one the preview cannot become: to aim at another channel, drop
> onto its thumbnail.

### Computing a channel from another

Four channels are computed from another, on your graphics card — no API call, so **no credit is
spent**.

| Channel | Computed from | What the computation does |
|---|---|---|
| **Height** | Base colour | the brightness of the picture becomes relief |
| **Normal** | Height | a Sobel filter reads the slope under each pixel |
| **Ambient occlusion** | Height | whatever sits lower than its surroundings darkens |
| **Roughness** | Base colour | dark areas turn matte, bright ones glossy |

The computation is the **first row of the thumbnail's menu**. When the source channel is empty, the
row says so and cannot be clicked: that is the one to fill first.

The result is a **picture of the project** like any other — it shows up in the shelf, it can be read
flat, it travels with the project — and the channel carries it with the "derived" badge. Each
computation makes a new one: running it three times leaves three pictures, only one of them in place.

**No strength is baked into the pixels.** It is set afterwards, in the Inspector: *Normal*
(**Relief** section) for the strength of the relief, *Occlusion* (**Material** section) for the
shading of the hollows, the *roughness range* for the contrast from matte to glossy. That is what
makes a derivation reversible without redoing it.

**A computed channel does not update itself.** Replace the height and the normal that came from it
still describes the old one: run its computation again.

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
0.9 = roughness 0.1. **The studio always says roughness**, everywhere — one word for one quantity,
here as in the 3D workspace.

This is not only vocabulary: some Scenario models answer in *glossiness*. The studio then keeps the
pixels exactly as they arrived and flips the reading at display time. You have nothing to do, and you
will never see a material lit inside out.

**Metalness** — is it metal, yes or no.

This setting is almost always **0 or 1**, rarely in between. Metal returns light in a completely
different way from non-metal; there is not much in between, except on painted or rusted metal,
where the value varies **area by area** thanks to a map.

---

## Setting the material

Inspector, **Material** section. Four sections in all, and they answer four different questions.

### Material

| Setting | What it does |
|---|---|
| **Base tint** | a colour multiplied over the base colour — to tint without repainting |
| **Roughness** | matte or glossy, for the whole surface |
| **Remap** (under roughness) | **two handles on one rail**: the range the map is read into |
| **Metalness** | metal or not, for the whole surface |
| **Remap** (under metalness) | the same thing, for the metalness map |
| **Occlusion** | how much the occlusion map darkens the hollows |
| **Cavity** | how much the edge map darkens the borders |

**The remap is the most useful setting in this section, and the least obvious.** A generated map is
often **flat** — everything in it sits around 0.5, and the material looks uniformly average. The
remap narrows or widens the range: setting roughness "from 0.2 to 0.9" spreads out what the map held
and brings out the contrast between matte and glossy areas.

The two handles **may meet, never cross**. A reversed range would remap the whole map onto nothing,
and the material would go flat with nothing on screen to say why.

**With no map placed, the remap does nothing**: it describes how to read a map, not a value.

### Relief

| Setting | What it does |
|---|---|
| **Normal** | the strength of the micro-relief, from −2 to 2 |
| **Flip green** | for a normal map baked in the other convention |
| **Displacement** | the real relief, which deforms the surface — 0 by default |

**A negative normal flips the relief**: bumps become hollows. That is not a bug, it is the answer to
a map baked the other way round — the other answer being "Flip green". OpenGL and DirectX disagree
on which way the green channel points, and a map from one engine lights from the wrong side until one
of the two is corrected.

**Displacement is 0 on purpose.** It really deforms the geometry, which costs more than the scene
being previewed: it is something you ask for, not something you get.

### Emission

A colour and an intensity, for what glows by itself.

### Tiling

This section is **folded** on opening: a tiling is set once and then left alone.

| Setting | What it does |
|---|---|
| **Repeat** | how many times the material repeats, in X and Y |
| **Offset** | where it starts |
| **Rotation** | from 0 to 360°, around the centre |

**All three apply to the eight channels at once.** Applied to one alone, the channels would drift
apart and the relief would stop matching the picture it lifts.

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

- **importing a file from disk** straight into a channel. Go through the project's import
  (chapter 7), then drop the picture onto the thumbnail;
- the **tiling preview** at 1×, 2×, 4×, and seam detection;
- **export** to glTF, Unity, Unreal, Roblox.

The detail is in [What does not exist yet](18-limits.md).

---

[← Audio workspace](11-audio-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Skyboxes workspace →](13-skyboxes-workspace.md)
