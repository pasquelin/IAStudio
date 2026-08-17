# 8. Image workspace

[← Assets](07-assets.md) · [Contents](../user-guide.md) · [Next chapter: Modelling workspace →](09-modelling-workspace.md)

The workspace where you paint, erase, crop and stack layers.

---

## Opening an image document

**The `+` button on the left rail** creates a **fresh, empty** document: a **1024 × 1024 pixel**
canvas holding a single white layer named **Background**, already selected.

> That white is a **real layer**, not a background colour. You can hide it, fade it or delete it
> like any other — the transparency checker then shows through underneath.

The `+` button needs one thing only: a project must be open. Without one it is greyed out — there
would be nowhere to write the document.

### Bringing an existing picture in

**An image document is not condemned to start from white.** Three gestures lay a picture from
your shelf onto it, and all three do the same thing: **one more layer**, on top of the stack,
named after the asset and **already active**: it is the one the next stroke will land on.

| Gesture | What it needs |
|---|---|
| **Drag and drop** the picture onto the canvas | the image tab open in front of you |
| **Double-click** the picture in the shelf | an image tab in front — it is the one that receives it |
| The **Image…** tool, Shapes group | nothing: it opens the shelf, you pick there |

> Only **pictures of the project** come in — the ones showing in the shelf, generated or
> imported. A picture not yet downloaded into the project cannot be dropped.

There is **no "Open" menu**: an image document does not open *onto* a file, it receives pictures
as layers. The distinction matters when you close the tab — see the end of this chapter.

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

Zoom runs from **2%** to **6400%**. Below 100%, the percentage shows one decimal: 3% and 3.7%
do not frame the same thing.

**Actual size** (`⌘1`) is the only scale where you judge sharpness: one image pixel to one screen
pixel.

### Rulers and guides

| Element | Shortcut | What it is |
|---|---|---|
| **Rulers** | `⌘R` / `Ctrl+R` | two graduated strips, top and left |
| **Guides** | `⌘;` / `Ctrl+;` | alignment lines you place |
| **Clear guides** | — | removes every guide |
| **Snap** | `⇧⌘;` / `Ctrl+Shift+;` | what you drag sticks to the guides |

**To place a guide**: drag from a ruler onto the image. Drag it off the image to remove it.

Hiding guides does not erase them — they come back at the next `⌘;`.

Snapping makes what you drag stick to the guides, to the **image edges** and to its **centre**,
within a few pixels. The tolerance is in screen pixels, so it does not change with the zoom.

---

## The toolbar

It sits at the top of the document. The tools are **grouped**, as in Figma:

- **hover a group** to see the rest of its tools, or press `⌥↓` if you are on the keyboard;
- **click the button itself** to arm the tool it already shows — `Enter` does the same.

In other words: an armed tool never needs the menu to be taken up again.

> **The keys below arm the tool**, and they remap like every other one: each tool is a command in
> its own right, listed under **Settings ▸ Shortcuts**. See [Every shortcut](15-shortcuts.md).

### Cursor group

| Tool | Shortcut | What it does |
|---|---|---|
| **Move** | `V` | drags the active layer's content |
| **Hand** | `H` | pans the view |
| **Scale** | `K` | shows eight grips and a rotation handle around the armed layer |

> **This is the group armed on opening.** A document opens on **Move**, never on the brush: the
> first click on a picture you have just opened must not be able to leave a mark on it. The
> brush is one key away — `P`.

### The **Image** menu

Six entries. The last four act on the **whole document**, layers included — not on the active layer:

| Entry | What it does |
|---|---|
| **Merge down** (`⌘E`) | joins the active layer and the one **just below it, at the same level** — never through the wall of its group. The result keeps the lower layer's name, as everywhere else |
| **Flatten image** | reduces the whole stack to a single layer named "Background" |
| **Flip horizontal** | mirrors the document left to right |
| **Flip vertical** | mirrors the document top to bottom |
| **Rotate clockwise** | a quarter turn to the right; **the frame turns with it** — a portrait becomes a landscape |
| **Rotate counter-clockwise** | a quarter turn to the left, same thing |

None ships with a shortcut: the menu is their only way in. You can give them one in
[settings](14-settings.md), as with any other command.

> **A mirror followed by the same mirror gives back exactly the picture you started from.** That is
> not a given: the studio turns the layer rather than rewriting its pixels, which is what keeps a
> round trip from leaving a rounding trace.

> **Flatten drops hidden layers**, it does not merge them — which is what Photoshop does too. What
> you see is what you keep.

**Merge down and Flatten really do write pixels**, unlike the rest of the menu: the layer that stays
receives the picture composed from what disappears. `⌘Z` gives the stack back — and the picture with
it, as long as the document has not changed size in between.

### Frame group

| Tool | Shortcut | What it does |
|---|---|---|
| **Crop** | `F` | drag a frame over the picture, adjust it, then `⏎` to trim |
| **Slice** | — | *not available yet* |
| **Cut** | — | *not available yet* |

> **These two have no key, and will only get one when they arrive.** The command registry only
> carries tools that answer: a shortcut written in advance would be a stated intention, not a
> gesture — that is [chapter 18](18-limits.md)'s rule.

The gesture comes in three steps:

1. **Drag** a frame over the picture. Whatever falls outside it is **dimmed** — that is exactly
   what the crop is about to remove. Hold `⇧` to constrain the frame to a square.
2. **Adjust it.** The frame stays on screen when you let go, with its eight grips: pull a corner
   or an edge to correct it. Dragging anywhere else starts a fresh frame.
3. **`⏎` applies**, `⎋` abandons.

Nothing changes before `⏎`: you can zoom, pan with the middle mouse button, and come back to the
frame. Arming another tool abandons it, and so does resizing or rotating the picture — the frame
would no longer point at the same thing.

The frame never leaves the picture — a crop trims, it does not grow.

> ⚠️ **`⌘Z` gives the frame back, not the cropped pixels.** Shrinking the document throws away
> what fell outside for good: undo restores the original size, but the removed area comes back
> empty. This is Photoshop's behaviour with "Delete cropped pixels" ticked — except that
> Photoshop can give them back. **Export before cropping hard** if you may want to return to it.

### Selection group

| Tool | Shortcut | What it does |
|---|---|---|
| **Rectangular selection** | `M` | draws a rectangular area — **Shift for a square** |
| **Elliptical selection** | — | draws an oval area — **Shift for a circle** |
| **Lasso** | `L` | draws a freehand area |

**`Shift` constrains the area while you drag**, as it constrains the shapes of the next group. The
**Lasso** ignores it: an area traced point by point has no sides to even out.

> As long as an area is drawn, **the brush, the eraser, the fill and the shapes only act inside
> it**. A click without a drag drops the area, just like `⌘D`.

### Shapes group

| Tool | Shortcut | What it does |
|---|---|---|
| **Rectangle** | `R` | Shift for a square |
| **Line** | `⇧R` | Shift constrains it to 45° |
| **Arrow** | `A` | Shift constrains it to 45° |
| **Ellipse** | `O` | Shift for a circle |
| **Polygon** | — | drawn from its centre |
| **Star** | — | drawn from its centre |
| **Image…** | — | opens the shelf, to lay a picture down as a layer |

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

A text layer stays text: you can fix a typo in it, and it stays sharp at any zoom. The inspector
sets its **content**, its **size** and its **font**.

**The font list is the Modelling workspace's list**: the three fonts the studio ships first, then your
machine's. What [the Modelling workspace](09-modelling-workspace.md#the-fonts-on-offer) says about missing fonts
holds word for word here.

### Eraser group

| Tool | Shortcut | What it does |
|---|---|---|
| **Point eraser** | `E` | erases as the pointer passes |
| **Selective eraser** | — | erases the inside of the selection in one gesture |

The eraser erases **to transparency**; it does not paint white.

### Standalone tools

| Tool | Shortcut | What it does |
|---|---|---|
| **Comment** | `C` | *not available yet* |
| **Fill layer** | `G` | fills the active layer — or the **selected area**, if there is one |
| **Eyedropper** | `I` | picks up the colour under the pointer |
| **Colour** | — | the colour of the brush, the pencil, the shapes and the fill |
| **Brush settings** | `[` and `]` | the size, the hardness and the opacity |

> **These two follow the armed tool, and leave when it does not read them.** The eyedropper, the
> pointer, the crop frame and the caption tool paint no pixel: the bar then shows neither colour
> nor sliders. The eraser offers no colour — its stroke is the white the erase blend reads, and
> the swatch chose nothing there. The bucket offers the colour alone. A control with no effect is
> **not greyed, it is gone**: the rule the inspector already applies to a sprite, which gets no
> shadow section rather than a dead one.

> **Fill is not a paint bucket.** It does not hunt for the patch of colour under the pointer: it
> fills **the whole layer**, edge to edge — or, **if an area is selected, that area alone**. That
> is what gives a plain background in one gesture, and a region its flat colour; it is not the
> colour-proximity fill you may know from elsewhere.

### The brush settings

The last button in the bar opens the sliders the armed tool reads — three under the brush, two
everywhere else.

| Setting | Range | What it does |
|---|---|---|
| **Size** | 1 to 512 px | the diameter of the stroke |
| **Hardness** | 0 to 1 | 1 gives a hard edge, 0 a fully feathered one |
| **Opacity** | 0 to 1 | how transparent what you lay down is |

**Size and opacity apply to four tools at once**: the brush, the pencil, the eraser and the shape
stroke. A 40 px brush with a 4 px eraser is not possible — it is the same setting.

**Hardness reaches only one of them: the brush — and it only shows there.** The pencil, the eraser
and the shape stroke have a hard edge; they read the size and the opacity like the others.

**Below a certain point, softening stops showing.** A feather that would not reach half a pixel
moves nothing an eye can tell: on a 4 px brush, hardness has to come down to 0.5 before the
feather begins. And the feather never eats more than half the radius — it softens an edge, it does
not dissolve the mark.

**`[` shrinks, `]` widens**, without opening anything: that is what the hand uses mid-stroke. The
step is a ratio rather than a count of pixels — one notch is about ×1.4 — because a fixed step
would crawl at 400 px and leap at 4. At the bottom of the scale it stays at least one pixel.

> **The circle following the pointer shows what the next stroke will cover**, at its real
> diameter. It grows and shrinks with the zoom, exactly as the stroke would: a 24 px brush covers
> half the screen at 1600%, and a dot at 5%.

> **The cursor turns to a no-entry sign when the tool can do nothing here** — a group is armed,
> the active layer is an adjustment layer, its pixels or its position are locked. The refusal
> reads **before** the gesture rather than after it in a message: an image that will not take
> paint otherwise looks exactly like an image whose stroke went somewhere else.

### The greyed-out tools

Some tools are visible but inactive. **That is deliberate**: the bar announces what is coming
rather than hiding what is missing. A tool that appeared one day without warning would be more
disconcerting than a grey button.

The chapter [What does not exist yet](18-limits.md) gives the complete list.

---

## Layers

The **Layers** panel, in the right column.

A layer is a transparent sheet stacked on the others. The top layer covers those below. You paint
on the one that is **active** — click its name to choose it.

| Action | How |
|---|---|
| **Add a layer** | the panel's **+** button — it lands on top of the stack |
| **Delete layer** | the delete button — the last layer cannot be deleted |
| **Show or hide** | the eye, to the left of the name |
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

## Getting the picture out of the studio

**`⇧⌘E` writes the flattened document as a `.png`**, anywhere on disk. The layers are composited
on the way out; rulers, guides and marching ants are not in it.

> **`⌘S` saves the document itself**, layers and all, into the project — and it opens back the
> same. That is not what `⇧⌘E` does: the export flattens and leaves the studio, while saving keeps
> the stack intact so you can carry on.
>
> **And if that document was opened from an asset, `⌘S` rewrites that asset TOO** — so the shelf's
> thumbnail follows what you are editing, instead of showing the original generation. The two
> writes happen in that order, and the order matters: the document carries the layers and the
> history, the asset a flat picture. If the second one fails, your work is already on disk and it
> is the thumbnail that lags — never the other way round.
>
> **`⌘S` writes the asset at the DOCUMENT's size.** Cropping or resizing and then saving therefore
> shrinks the original asset — and if that asset lives in the project, its previous picture is
> replaced. That is deliberate: a crop is an edit like any other, and an editor that refused to
> save a resized document would not be one. **A [linked medium](07-assets.md) is never touched**:
> the edit enters the project, and your file stays where it is.
>
> **The studio says so when it finds the document no longer measures its asset**, at two moments
> that are not equal. Reopening the asset from the shelf while its tab is already there is a
> warning: nothing has been written yet, and you can still choose. On save it is a statement —
> **nothing is refused and the write happens**. And it stays quiet when it cannot measure: an
> asset that will not decode, or a tab that has not finished opening. To keep the original intact,
> `⇧⌘S` writes a copy.
>
> **`⇧⌘S` — Save as — writes a copy beside it and carries on with that one.** No dialogue asks
> for a name: the copy is called *"(the name) copy"*, and the asset you had open stays as your
> last `⌘S` left it.
>
> An image is written as a **folder**, `documents/<id>.img/`: one `document.json` for the stack,
> and one `.png` per layer — plus a second for its mask, where there is one. That is deliberately
> inspectable: you can open the folder and look at the layers one by one.
>
> **What does not save:** the undo history. Reopening a document starts from a clean stack — the
> pixels are there, the last fifty gestures are not.

---

[← Assets](07-assets.md) · [Contents](../user-guide.md) · [Next chapter: Modelling workspace →](09-modelling-workspace.md)
