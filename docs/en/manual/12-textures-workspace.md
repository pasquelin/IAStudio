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

While no image is placed, the preview shows: "Drop an image from the project to use it as the
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
| **Box** | how it behaves on flat faces and sharp edges |
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
the Modelling workspace**: the question is the same, and the skies on offer are your project's own.

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
| **Cavity** | the hollows and edges of the surface | darkens the bottom of grooves, adjusted by the *Cavity* slider in the **Material** section |

> **The panel writes two of these names shorter**: the tile says **Normal** and **Occlusion**
> where this table and the [glossary](17-glossary.md) say *Normals* and *Ambient occlusion*. They
> are the same channels — the long names are the trade's, the short ones fit under a thumbnail.
> (In French a third differs: the tile says *Métal* for *Métallicité*.)

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

### Judging the repeat, and seeing the seams

A material cannot be judged on a single tile. Three controls, in **Inspector ▸ Tiling**, under the
values they look at:

| Control | What it does |
|---|---|
| **Repeat preview** — 1×, 2×, 4× | multiplies the repeat **for the eye only** |
| **Bring the seams to the middle** | shifts every channel by half a width **and half a height**: both edges that wrap land in the middle of the preview |
| **Seams** — the **Measure** button | compares the wrap with the grain of the picture, and answers in three words |

**The first two never touch the material.** They change how it is looked at, not what it is: the
repeat that goes out into a scene stays the one in the **Repeat** field, and the shift stays the one
in **Offset**. Looking at 4× does not make a texture repeated four times.

**The measurement is a ratio, not a difference.** A noisy stone tolerates a jump that would be a
scar across smooth plaster: what reads as a seam is the step at the wrap compared with the grain the
picture already has. Hence three answers — *no visible seam*, *faint seam*, *visible seam* — rather
than a percentage that would mean nothing on its own.

It is taken on the **base colour**: that is the channel a seam is seen in, and the eight are laid
out together. The button stays off until a base colour is in place, and the words go as soon as it
is replaced — they described pixels that are no longer there.

A measurement and a channel computation go through the same graphics card, **one pass at a time**:
asking for one while the other runs does not refuse it, it waits its turn.

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
here as in the Modelling workspace.

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

## Styles — keeping a setup for the next material

A well-tuned material is fifteen or so values. Dialling them in again by hand on the next one is
the kind of work nobody does twice gladly.

**The button at the top right of the inspector** saves the material's current state under a
generated name — "Style 1", "Style 2". The **Styles** panel, in the right column beside Channels,
lists them all.

**Double-click a style** — or press Enter on it — to apply it to the open material. It is a
single undo: `⌘Z` puts back exactly what was set before.

**Right-click ▸ Rename**, IDE-style. The name is edited where it is read. Right-click ▸ Delete
removes the style.

### What a style carries, and what it does not

**A style holds no map.** It says *how to read* the channels of the material in front of it, never
*which ones*. That is exactly what lets it apply to any material: a style that brought its own
channels would no longer apply — it would replace.

A consequence worth knowing, and not a fault: **a good half of the settings do nothing without the
matching map**. A "metal look" dropped on a material with no maps acts through its colour,
roughness and metalness; the remap ranges and the normal strength will wait for the channels to
arrive. They are kept as they are, and will take effect the day the material is completed.

**Styles follow the machine, not the project.** They are kept in your user folder, beside the
favourites, so they are there whichever project is open. This is deliberate: a map belongs to one
project's catalogue, a knack belongs to none.

---

## Saving

Everything is saved **automatically**, moments after your last gesture, into a `.mtlx` file in your
project's `documents/` folder.

**Nothing is baked into the pixels.** Reopen the document in six months: every setting is still
there, and still adjustable. What is written are your decisions, not their result.

**All document types now save**, but materials keep one peculiarity: they are the only ones
that write themselves. Everywhere else `⌘S` decides the moment, and the dot on the tab says what
is still waiting to be written.

---

## Exporting the material

Menu **File ▸ Export material**, then the row of the engine that will receive it. The menu only
appears in the Textures workspace, and it speaks to the **tab in front**: two open materials do
not both answer one click.

The studio asks for **a folder**, and creates a sub-folder inside it named after your document.
The files of an export mean nothing apart — a base colour without its ORM beside it is half a
material — so they travel together.

### The five destinations

| Row | What is written |
|---|---|
| **glTF / GLB** | **one file**, `.glb`, textures embedded, on the shape of the preview |
| **Unity (URP)** | `_BaseMap`, `_BumpMap`, `_MaskMap`, `_EmissionMap`, `_ParallaxMap` |
| **Unreal Engine** | `_BaseColor`, `_Normal`, `_ORM`, `_Emissive`, `_Height` |
| **Roblox** | `_ColorMap`, `_NormalMap`, `_RoughnessMap`, `_MetalnessMap` |
| **Raw channels** | the eight channels, one file each, cavity mask included |

The channels leave as **PNG**, lossless: a channel is data before it is a picture, and JPEG would
invent gradients exactly where relief is read. The first row writes a single `.glb` instead, which
carries its pictures inside it.

### What "packing" means

An engine does not read eight files when three components are enough for it. Three grey channels
fit into one picture, one per component — that is a *pack*, and each engine has its own:

- **Unreal's `_ORM`**: occlusion on **red**, roughness on **green**, metallic on **blue**. It is
  also what glTF reads, which takes the same picture for its occlusion and for its
  metallic-roughness pair;
- **Unity's `_MaskMap`**: metallic on **red**, occlusion on **green**, and **smoothness on
  alpha**. One picture, to be assigned to **both** slots — the metallic one and the occlusion one;
- **Roblox** packs nothing: its `SurfaceAppearance` takes exactly four separate maps.

The computing happens **on the GPU, in one pass** per picture. A 4K picture is sixteen million
pixels with three channels read per pixel: a JavaScript loop over them would freeze the window.

### Two conventions the export reconciles for you

**The green of a normal.** OpenGL and DirectX disagree on which way it points. The studio writes
OpenGL; Unreal expects DirectX. So the export flips the green for Unreal, and for nobody else. And
if you had ticked **Invert green** because your normal had arrived as DirectX, the export knows:
it does not flip twice.

**Roughness stored the other way round.** Scenario's converter sometimes answers with a
*smoothness* map — the same picture read the other way. The studio keeps it as it arrived and
remembers that it is inverted. So a `_Roughness` file does hold roughness, and Unity's `_MaskMap`
does hold smoothness: the file name says what is inside it.

### Four things worth knowing

**Your range settings leave with it.** The double handle of the Material panel — the one that
narrows roughness or metalness — exists in none of the four formats. So it is **written into the
pixels**: a roughness narrowed to between 0.3 and 0.7 on screen leaves narrowed. One exception,
and it is the whole reason that row exists: **the raw channels leave with no remap** — that is the
row you pick precisely to get your pixels back as you dropped them. One thing is still applied to
them: a roughness stored the other way round (a smoothness map) is put back the right way, because
the file is called `_Roughness` and has to hold what it says.

**Full resolution, not the preview's.** The export reads each channel at the size it is stored at.
One exception, and it is not ours: **Roblox refuses a map above 1024 px**, so its four files are
brought under that ceiling, keeping their proportions.

**A picture no channel feeds is not written.** A material with neither occlusion nor metalness
does not ship a flat grey `_ORM`: the whole point of that slot is that what is in it was measured.
The missing components of a picture that *is* written take a neutral value — no occlusion, no
metal.

**Re-exporting overwrites file by file, and tidies nothing.** The same document exported twice to
the same place rewrites the files of the same name, but **does not empty the folder**: exporting to
Unreal and then to Roblox leaves both sets side by side, and a channel deleted in between leaves
its stale file there. Empty the folder yourself if you want it to hold only the latest export.

### What the `.glb` carries in addition

It alone is an object rather than a set of files: it leaves with **the shape of the preview**, and
with the settings of the Material panel that the format can hold: the tint, the roughness, the
metalness, the strength of the normal, the occlusion intensity, the emission and its strength, and
the tiling with its offset and rotation. Opened elsewhere, it looks like what you were judging on
screen.

Two things do not go in, for want of existing in the format: the **relief** — glTF has no
displacement slot, so height leaves neither as a map nor as a strength — and the **centre of the
rotation**. `KHR_texture_transform` has no pivot: a material exported with a rotation turns around
the corner of the picture where the preview turns around the middle.

The tiling **preview** (×1, ×2, ×4) is not part of it, and that is deliberate: judging a repeat and
choosing one are two gestures, and only the one you chose belongs in a file.

---

## What is still missing

- **importing a file from disk** straight into a channel. Go through the project's import
  (chapter 7), then drop the picture onto the thumbnail.

The detail is in [What does not exist yet](18-limits.md).

---

[← Audio workspace](11-audio-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Skyboxes workspace →](13-skyboxes-workspace.md)
