# 9. 3D workspace

[← Image workspace](08-image-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Video workspace →](10-video-workspace.md)

The workspace where you build a scene with volume: objects, lights, a camera that moves through it.

---

## Opening a scene

The **+** button on the left rail creates a fresh scene. A project must be open.

A new scene contains a chequered floor — the **grid** — and nothing else. It is black until a light
is placed: that is normal, and the Lights panel says so.

---

## Moving through the scene

Two navigation modes, which coexist.

### Orbiting the scene — the mouse alone

| Gesture | Effect |
|---|---|
| **Left-click + drag** in empty space | turns the view around the point being looked at |
| **Wheel** | moves forward and back |
| **Right-click + drag** *(see below)* | flies |

This is the default mode. You turn **around** the scene, as if walking round it.

### Flying through the scene — the right button

**Hold the right mouse button**, and the camera switches to free flight. Without letting go:

| Key | Movement |
|---|---|
| `W` `A` `S` `D` | forward, left, back, right |
| `E` | up |
| `Q` | down |
| `⇧ Shift` | boost |

This is video-game navigation: you move **through** the scene instead of around it. Release the
right button and the camera returns to its normal mode.

> **The keys are read at their physical position.** WASD on a QWERTY keyboard and ZQSD on an AZERTY
> one are **the same four keys**. There is nothing to reconfigure.

Three settings govern flying: **Settings ▸ Workspaces ▸ 3D**

| Setting | What it does | Default |
|---|---|---|
| **Fly speed** | metres per second | 4 |
| **Boost factor** | what Shift multiplies the speed by | 3 |
| **Field of view** | what the camera takes in, in degrees | 60 |

---

## The toolbar

| Tool | Shortcut | What it does |
|---|---|---|
| **Select** | `V` | picks an object without arming a handle |
| **Move** | `G` | drags the object along the coloured arrows |
| **Rotate** | `R` | turns the object with the coloured circles |
| **Scale** | `S` | grows or shrinks it with the handles |
| **Frame selection** | `F` | recentres the camera on the chosen object |
| **Add** | — | places a mesh or a light in the scene |
| **Delete** | `Del` | removes the chosen object |

Unlike the Image workspace, the three manipulation tools stay **three visible buttons** instead of
being grouped. That is deliberate: you switch between them several times a minute, and it is how
Blender, Maya, Unity and the three.js editor all do it.

### The coloured handles

When a manipulation tool is armed and an object is chosen, handles appear around it. The colour
code is universal:

| Colour | Axis | Direction |
|---|---|---|
| **Red** | X | left ↔ right |
| **Green** | Y | down ↔ up |
| **Blue** | Z | forward ↔ back |

Drag an arrow to move along that axis only.

> A complete drag — from press to release — counts as **one** action in the history. `⌘Z` undoes it
> in one go.

---

## Placing objects

Three paths lead to the same place:

- the toolbar's **Add** button;
- the **+** buttons of the **Meshes** and **Lights** panels;
- the menu **Objects ▸ Add**.

The object lands at the **scene origin** — the centre of the world, where the axes cross.

### The available meshes

A *mesh* is a geometric object.

| Shape | What it looks like |
|---|---|
| **Box** | a box |
| **Sphere** | a ball |
| **Capsule** | a cylinder with rounded ends, like a pill |
| **Circle** | a flat disc |
| **Cylinder** | a solid tube |
| **Plane** | a flat sheet |
| **Ring** | a disc with a hole |
| **Torus** | a doughnut |
| **Torus knot** | an interwoven doughnut |
| **Tube** | a bent pipe |
| **Lathe** | a shape made by spinning a profile |
| **Tetrahedron** | 4 triangular faces |
| **Octahedron** | 8 faces |
| **Dodecahedron** | 12 faces |
| **Icosahedron** | 20 faces |

> **Sprite** and **Text** appear greyed out in the menu. They are announced but not yet buildable.
> See [What does not exist yet](18-limits.md).

### The available lights

Without a light, the scene stays black.

| Light | What it does | When to use it |
|---|---|---|
| **Ambient** | lights everything, evenly, with no shadow | to lift the blacks |
| **Directional** | parallel rays, like the sun | the main light of an outdoor scene |
| **Hemisphere** | one colour from the sky, another from the ground | a soft, natural outdoor look |
| **Point** | radiates in every direction from a point | a bulb, a candle |
| **Spot** | a cone of light | a stage spot, a lighthouse |

**To start with**: a **directional** for the main light, plus a weak **ambient** so the shadows are
not completely black. That is the classic recipe.

---

## The Explorer — the scene tree

The **Explorer** panel, in the left column, shows everything the scene contains, as a tree.

- **Click** a line to select the object.
- **The arrow keys** walk the tree.
- **The eye** on the right of each line shows or hides the object.

Only visible lines are actually drawn: a heavy scene scrolls without effort.

---

## The Inspector — everything adjustable

The **Inspector** panel, in the right column. It shows **what is selected**, and everything that
defines it.

Its fields come from the **object's type**, not from a form written for each one. A sphere shows
its radius, a torus shows its tube, a spot shows its angle.

### For an object

| Section | What it holds |
|---|---|
| **Identity** | the name, editable |
| **Transform** | Position, Rotation, Scale — three numbers each (X, Y, Z) |
| **Geometry** | what defines the shape: radius, width, segments… |
| **Material** | Colour, Roughness, Metalness, and five texture slots |

#### Every geometry field

You will never see them all at once: each shape shows its own.

| Field | What it sets | On which shapes |
|---|---|---|
| **Width**, **Height**, **Depth** | the three sides of a box | Box, Plane |
| **Radius** | the size of a round shape | Sphere, Circle, Capsule, Torus, Knot, polyhedra |
| **Top radius**, **Bottom radius** | the two ends of a cylinder — make them unequal for a cone | Cylinder |
| **Inner radius**, **Outer radius** | the hole and the rim | Ring |
| **Tube** | the thickness of the ring | Torus, Torus knot, Tube |
| **Segments** | the number of facets | most round shapes |
| **Radial segments** | the facets all the way round | Cylinder, Capsule, Torus, Tube |
| **Tubular segments** | the facets along the ring | Torus, Torus knot |
| **Width segments**, **Height segments** | the fineness in each direction | Sphere, Plane |
| **Cap segments** | the fineness of the rounded ends | Capsule |
| **P windings**, **Q windings** | how many times the knot turns through itself | Torus knot |

**Segments** deserve a word: it is the number of facets that make up a round shape. Few segments =
angular and light; many = smooth and heavy. 32 is a good compromise for a sphere.

**P and Q windings** are the two numbers that define a knot. P is the number of turns around the
axis, Q the number of turns through the hole. `P=2, Q=3` gives the trefoil knot, the one you see
everywhere. Change either and you get a different knot — it is the one field in the studio whose
result you cannot predict without trying.

**Roughness and Metalness** are the two settings that make a material's whole appearance:

| Setting | At 0 | At 1 |
|---|---|---|
| **Roughness** | perfect mirror | fully matte |
| **Metalness** | plastic, wood, stone | metal |

The five texture slots — **Texture**, **Normals**, **Roughness map**, **Metalness map**, **Ambient
occlusion** — take images from the project. The **Choose a texture** button opens the list;
**Remove texture** empties it.

### For a light

| Field | What it does |
|---|---|
| **Colour** | the light's hue |
| **Intensity** | its power |
| **Range** | how far it reaches — point and spot |
| **Decay** | how fast it fades with distance |
| **Angle** | the cone's opening — spot only |
| **Penumbra** | the softness of the cone's edge — spot only |
| **Target** | what it points at |
| **Sky colour** / **Ground colour** | hemisphere only |

> The Inspector **is not a 3D panel**. The same inspector reads a clip, a track or an asset when
> that is what is selected. That is why it stays open in every workspace.

---

## The floor grid

The chequering is **not** an object in the scene: it is a reference, to know where things are and
at what height. It appears in no render.

**Settings ▸ Workspaces ▸ 3D**:

| Setting | What it does | Default |
|---|---|---|
| **Show grid** | shows or hides it | on |
| **Grid size** | its extent in metres — one square is always 1 m | 20 |

Hide it to judge an image with nothing around it.

---

## Saving

`⌘S` / `Ctrl+S` writes the scene into the project, under `documents/`.

**3D scenes can save** — it is one of only two document types that can today.

A tab whose work is not yet written carries **a dot** (`•`) beside its name. The dot disappears on
save and comes back on the next change.

Reopening the studio brings the tab back and rereads its scene. A tab never saved comes back empty:
nothing had been written for it.

<!-- SCREENSHOT: the 3D view with a mesh selected, the scene tree and the Meshes panel.
     Save to ../../images/scene-3d.png -->

---

## What is still missing

The 3D workspace is functional but young. Do not look yet for:

- **multiple selection** — one object at a time;
- **groups** and reparenting;
- **copy-paste** and duplication;
- **cast shadows**;
- **image-based lighting** (HDRI) in the viewport;
- **snapping** and local pivot.

The detail is in [What does not exist yet](18-limits.md).

---

[← Image workspace](08-image-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Video workspace →](10-video-workspace.md)
