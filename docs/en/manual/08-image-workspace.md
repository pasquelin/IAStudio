# 8. Image workspace

[← Assets](07-assets.md) · [Contents](../user-guide.md) · [Next chapter: 3D workspace →](09-3d-workspace.md)

The workspace where you paint, erase, crop and stack layers.

---

## Opening an image document

**One way only, and it is worth knowing: the `+` button on the left rail.** It creates a **fresh,
empty** document: a **1024 × 1024 pixel** canvas holding a single white layer named
**Background**, already selected.

> That white is a **real layer**, not a background colour. You can hide it, fade it or delete it
> like any other — the transparency checker then shows through underneath.

> ### ⚠️ You cannot open an existing image here yet
>
> This is the studio's most disconcerting limit, and it deserves saying up front rather than
> being discovered after twenty minutes of trying.
>
> **An image from your shelf — generated or imported — cannot be brought into an image
> document.** Double-clicking does not open it. Dropping it on the canvas does nothing. There is
> no "Open" menu.
>
> The Image workspace can therefore **paint from nothing**, not **retouch something**. It is
> written down in [What does not exist yet](18-limits.md), along with the rest.
>
> **In the meantime:** to see an image large, select it in the shelf and look at it in the
> **Inspector**. To retouch it, you need another application — or a fresh generation, for
> instance with an *image to image* model, which takes your picture as input and returns a new
> one (see [Generating](06-generating.md)).

What the `+` button does need is simple: a project must be open. Without one it is greyed out —
there would be nowhere to write the document.

---

## Navigating the image

Before the tools, the gestures. They work whatever tool is armed.

| Gesture | Effect |
|---|---|
| **Wheel** | scrolls the image, as in Figma |
| **⌘ + wheel** / **Ctrl + wheel** | zooms towards the pointer |
| **Pinch** on a trackpad | zooms |
| **Hold Space + drag** | pans the view, whatever the tool |
| **Middle-click + drag** | pans the view too |

> Holding Space turns the cursor into a hand. The gesture is the one every image editor uses: you
> do not have to change tool to move around.

### The zoom bar

Bottom right of the image, a small floating bar.

| Button | Effect | Shortcut |
|---|---|---|
| **−** | zoom out one step | `⌘−` / `Ctrl+−` |
| **The percentage** | back to actual size — one click on it | `⌘1` / `Ctrl+1` |
| **+** | zoom in one step | `⌘+` / `Ctrl+=` |
| **Fit** | the whole image fits in the panel | `⌘0` / `Ctrl+0` |

Zoom runs from **2 %** to **6400 %**. Below 100 %, the percentage shows one decimal: 3 % and 3.7 %
do not frame the same thing.

**Actual size** (`⌘1`) is the only scale where you judge sharpness: one image pixel to one screen
pixel.

### Rulers and guides

| Element | Shortcut | What it is |
|---|---|---|
| **Rulers** | `⌘R` / `Ctrl+R` | two graduated strips, top and left |
| **Guides** | `⌘;` / `Ctrl+;` | alignment lines you place |
| **Clear guides** | — | removes every guide |
| **Snapping** | `⇧⌘;` / `Ctrl+Shift+;` | what you drag sticks to the guides |

**To place a guide**: drag from a ruler onto the image. Drag it off the image to remove it.

Hiding guides does not erase them — they come back at the next `⌘;`.

Snapping makes what you drag stick to the guides, to the **image edges** and to its **centre**,
within a few pixels. The tolerance is in screen pixels, so it does not change with the zoom.

---

## The toolbar

It sits at the top of the document. The tools are **grouped**, as in Figma:

- **hover a group** to see the rest of its tools;
- **click the button itself** to arm the tool it already shows.

In other words: an armed tool never needs the menu to be taken up again.

### Cursor group

| Tool | Shortcut | What it does |
|---|---|---|
| **Move** | `V` | drags the active layer's content |
| **Hand** | `H` | pans the view |
| **Scale** | `K` | shows eight grips and a rotation handle around the armed layer |

### Frame group

| Tool | Shortcut | What it does |
|---|---|---|
| **Crop** | `F` | *not available yet* |
| **Slice** | `⇧S` | *not available yet* |
| **Cut** | `S` | *not available yet* |

### Selection group

| Tool | Shortcut | What it does |
|---|---|---|
| **Rectangle select** | `M` | draws a rectangular area |
| **Ellipse select** | — | draws an oval area |
| **Lasso** | `L` | draws a freehand area |

> These three tools **draw** the area but do not yet constrain anything: no tool restricts its
> action to the selection for now. See [What does not exist yet](18-limits.md).

### Shapes group

| Tool | Shortcut | What it does |
|---|---|---|
| **Rectangle** | `R` | Shift for a square |
| **Line** | `L` | Shift constrains it to 45° |
| **Arrow** | `⇧L` | Shift constrains it to 45° |
| **Ellipse** | `O` | Shift for a circle |
| **Polygon** | — | drawn from its centre |
| **Star** | — | drawn from its centre |
| **Image…** | `⇧⌘K` | opens the shelf, to lay a picture down as a layer |

### Drawing group

| Tool | Shortcut | What it does |
|---|---|---|
| **Brush** | `P` | paints, soft edge |
| **Pencil** | `⇧P` | paints, hard edge |
| **Pen** | — | *not available yet* |

### Text group

| Tool | Shortcut | What it does |
|---|---|---|
| **Text** | `T` | places text on the active layer |
| **Text on path** | — | *not available yet* |

### Eraser group

| Tool | Shortcut | What it does |
|---|---|---|
| **Spot eraser** | `E` | erases as the pointer passes |
| **Selective eraser** | — | erases the inside of the selection in one gesture |

The eraser erases **to transparency**; it does not paint white.

### Standalone tools

| Tool | Shortcut | What it does |
|---|---|---|
| **Comment** | `C` | places a note on the image |
| **Fill layer** | `G` | fills the **whole** active layer with the current colour |
| **Eyedropper** | `I` | picks up the colour under the pointer |
| **Colour** | — | the colour of the brush, the shapes and the fill |

> **Fill is not a paint bucket.** It fills the entire layer, edge to edge. That is what gives a
> plain background in one gesture, but it is not the region fill you may know from elsewhere.

### The greyed-out tools

Some tools are visible but inactive. **That is deliberate**: the bar announces what is coming
rather than hiding what is missing. A tool that appeared one day without warning would be more
disconcerting than a grey button.

The chapter [What does not exist yet](18-limits.md) gives the complete list.

---

## Layers

The **Layers** panel, in the left column.

A layer is a transparent sheet stacked on the others. The top layer covers those below. You paint
on the one that is **active** — click its name to choose it.

| Action | How |
|---|---|
| **Add a layer** | the panel's **+** button — it lands on top of the stack |
| **Delete the layer** | the delete button — the last layer cannot be deleted |
| **Hide / show** | the eye, to the left of the name |
| **Reorder** | the stack buttons, or drag and drop |

A hidden layer is **dimmed and struck through**: you can see at a glance what is hidden.

---

## Undo and redo

| Action | Shortcut |
|---|---|
| **Undo** | `⌘Z` / `Ctrl+Z` |
| **Redo** | `⇧⌘Z` / `Ctrl+Shift+Z` |

**The history belongs to the document**, not to the application. Each tab has its own stack. If
`⌘Z` seems to do nothing, it is most likely that the action you have in mind belongs to another
tab: click that one first.

Continuous gestures — a brush stroke, a layer drag — count as **one** history entry. You do not
undo a stroke pixel by pixel.

> The history keeps the **last 100** actions. Beyond that, the oldest disappear.

<!-- SCREENSHOT: an image document, the Shapes group flyout open, the layer stack visible.
     Save to ../../images/image-tools.png -->

---

## What to know before closing a tab

> **An image does not save to disk yet.** Closing its tab loses the layers and the history. The
> original asset stays in the project — it is the retouching work that is lost.
>
> See [What does not exist yet](18-limits.md).

---

[← Assets](07-assets.md) · [Contents](../user-guide.md) · [Next chapter: 3D workspace →](09-3d-workspace.md)
