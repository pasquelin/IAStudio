# 15. Every shortcut

[← Every setting](14-settings.md) · [Contents](../user-guide.md) · [Next chapter: When something goes wrong →](16-troubleshooting.md)

The complete list of keys, by context, and how to change them.

---

## Reading a shortcut

Keys are written with symbols, the same ones throughout the studio.

| Symbol | Key | Where |
|---|---|---|
| `⌘` | Command | macOS. It is `Ctrl` on Windows and Linux |
| `⇧` | Shift | everywhere |
| `⌥` | Option / Alt | everywhere |
| `⌃` | Control | macOS |

So `⌘Z` reads "Command + Z" on a Mac, and "Ctrl + Z" elsewhere. The symbols are written together:
`⇧⌘Z` means all three keys at once.

> **On Windows and Linux, `⌘` is taken literally.** The tooltip and the shortcuts screen draw the
> Mac symbol everywhere; and while the shortcuts the system menu carries do answer to `Ctrl`, the
> ones a surface listens for itself expect the Windows key. Both defects are listed in
> [What does not exist yet](18-limits.md).

---

## One idea to grasp: context

**The same shortcut does not do the same thing everywhere.**

`S` splits a clip in the edit, and scales an object in the 3D view. `Delete` removes a clip here, an
object there. This is not a collision: it is **by design**.

The studio files each action under a **context** — the surface where it makes sense. Only one
surface listens at a time, the one you are looking at. A key shared between two contexts can
therefore never be ambiguous.

Five contexts:

| Context | Where it applies |
|---|---|
| **Anywhere in the application** | any window, any workspace |
| **In the 3D view** | the viewport of the 3D workspace |
| **In the edit** | the timeline of the Video and Audio workspaces |
| **In the picture** | the canvas of the Image workspace |
| **In the sky** | the view of the Skyboxes workspace |

One context is special: **Anywhere in the application**. Its keys go through the operating system's
menu, which catches them before anybody else. They are therefore the only ones that can never be
"covered" by another context — and the only ones whose conflict is always a real conflict.

---

## Anywhere in the application

| Action | Key | What it does |
|---|---|---|
| **New project** | `⌘N` | creates an empty project and opens it |
| **Open project** | `⌘O` | opens an existing project in place of the current one |
| **Save document** | `⌘S` | writes the document in front into the project |
| **Settings** | `⌘,` | opens the settings window |
| **Full screen** | `⌃⌘F` | makes the window take the whole screen |
| **Reset layout** | *none* | puts the panels back where they started |

**Reset layout** deliberately has **no** default key: it is an action you reach for once every six
months, and giving it a shortcut would mean occupying a key for nothing. It is in the **View** menu,
and you can assign one to it (see below).

> **The open project saves as it goes.** `⌘S` concerns only the **document** in front — a 3D scene,
> for instance — not the project itself. The tab carries a dot (`•`) as long as what is on screen is
> not what is on disk.

### Walking a list with the keyboard

Every list in the studio is crossed the same way: the shelf, the Explorer, the layers, the models,
the Apps, the scene tree.

| Key | Effect |
|---|---|
| `Tab` | steps into the list, or out of it |
| `←` `→` | the previous cell, the next one |
| `↑` `↓` | the same column, one row up or down |
| `Enter` | opens |
| `Space` | picks |

**A row that only opens leaves `Space` to scrolling.** That is the Explorer's case: opening a
document may take you to another workspace, and `Space` promises that nowhere else in the studio.

`Tab` brings you back where you were: a list keeps a single way in — your selection if there is
one, the first visible cell otherwise.

---

## In the 3D view

### The tools

| Action | Key | What it does |
|---|---|---|
| **Select** | `V` | the basic tool: click an object to choose it, without doing anything to it |
| **Move** | `G` | drag the coloured arrows to slide it |
| **Rotate** | `R` | drag the coloured circles to turn it |
| **Scale** | `S` | drag the handles. `⇧` keeps its proportions |
| **Magnet** | `M` | steps the handles by regular amounts, set in the preferences |
| **Local frame** | `L` | aligns the handles with the object's orientation rather than the world's |
| **Projection** | `O` | switches between perspective and orthographic projection |
| **Display** | `Z` | cycles shaded, wireframe, shaded and wireframe |
| **Frame selection** | `F` | brings the camera in so the object fills the view |
| **Delete** | `Delete` | removes the chosen object. `⌘Z` brings it back |

### Assemble and duplicate

| Action | Key | What it does |
|---|---|---|
| **Group** | `⌘G` | files the selected objects under one group |
| **Duplicate** | `⌘D` | puts a copy of the selection at the same place, and selects it |
| **Copy** | `⌘C` | holds the selection, without touching the scene |
| **Cut** | `⌘X` | holds it and takes it out of the scene |
| **Paste** | `⌘V` | puts what was held into the current scene |

> This clipboard is the studio's: it does not touch the system one, and `⌘C` stands aside as soon
> as text is selected on screen.

### Undo and redo

| Action | Key |
|---|---|
| **Undo** | `⌘Z` |
| **Redo** | `⇧⌘Z` |

### Flying through the scene

These keys are **held** rather than pressed: while you hold, the camera moves.

| Direction | Key (QWERTY keyboard) | Key (AZERTY keyboard) |
|---|---|---|
| **Forward** | `W` | `Z` |
| **Back** | `S` | `S` |
| **Left** | `A` | `Q` |
| **Right** | `D` | `D` |
| **Up** | `E` | `E` |
| **Down** | `Q` | `A` |
| **Boost** | left `⇧` | left `⇧` |

> **Why two columns.** The studio listens to the **position** of the key on the keyboard, not the
> letter printed on it. The four direction keys are therefore always the same square, top left:
> `WASD` if your keyboard is American, `ZQSD` if it is French. There is nothing to set.

Speed and boost are set in [settings](14-settings.md#workspaces).

> **`S` does two things at once in the 3D view**: it picks the **Scale** tool *and* moves the camera
> backwards while held. This is a known overlap — see [What does not exist yet](18-limits.md). In
> practice you barely notice: pressing `S` to take the tool backs the camera up by a hair.

### What the mouse does, with no shortcut

| Gesture | Effect |
|---|---|
| **Left click** | chooses the object under the cursor |
| **Right click held + move** | turns your head, on the spot |
| **Wheel** | moves forward or back |
| **Click a handle + drag** | applies the current tool |

---

## In the edit

### Playback

| Action | Key | What it does |
|---|---|---|
| **Play / Pause** | `Space` | starts playback, or stops it where it is |
| **Go to start** | `Home` | brings the playhead to the very beginning |
| **Go to end** | `End` | sends the playhead past the last clip |

> **`Space` does not repeat.** A held key repeats thirty times a second; playback starting and
> stopping thirty times a second is a strobe, not a shortcut. The studio ignores repeats.

### Editing

| Action | Key | What it does |
|---|---|---|
| **Split clip** | `S` | cuts in two at the playhead |
| **Delete clip** | `Delete` | removes the clip from the edit. The original file stays in the assets |

### Zoom

| Action | Key | What it does |
|---|---|---|
| **Zoom in** | `⌘=` | spreads the edit out to see the detail |
| **Zoom out** | `⌘−` | tightens it to see more at once |
| **Fit to view** | `⇧Z` | fits the whole edit on screen |

### Undo and redo

| Action | Key |
|---|---|
| **Undo** | `⌘Z` |
| **Redo** | `⇧⌘Z` |

---

## In the image

### Arming a tool

Every tool in the bar is a command: its key arms it, and remaps like the rest.

| Key | Tool | | Key | Tool |
|---|---|---|---|---|
| `V` | Move | | `R` | Rectangle |
| `H` | Hand | | `⇧R` | Line |
| `K` | Scale | | `A` | Arrow |
| `F` | Crop | | `O` | Ellipse |
| `M` | Rectangular selection | | `P` | Brush |
| `L` | Lasso | | `⇧P` | Pencil |
| `T` | Text | | `E` | Eraser |
| `G` | Fill the layer | | `I` | Eyedropper |

**Four tools have no default key** — elliptical selection, polygon, star, selection eraser — and you can
give them one in the settings.

> **Line changed key.** It answered to `L`, which the Lasso already used in the same context; it
> moved to `⇧R`, next to Rectangle, and the Arrow to `A`.

### The size of the stroke

| Action | Key | What it does |
|---|---|---|
| **Smaller brush** | `[` | narrows the diameter by one notch |
| **Larger brush** | `]` | widens it by one notch |

One diameter for three tools: the brush, the eraser and the shape stroke. The notch is a ratio,
about ×1.4, never a fixed count of pixels.

> **These two keys are found by position, not by symbol.** On a French keyboard the same two
> places carry `)` and `^` — you press where an American keyboard would, whatever letter is
> printed on the key.

### Cropping

These two keys act **only** while a crop frame is placed on the picture, and only in the tab in
front. Everywhere else they keep their usual meaning.

| Action | Key | What it does |
|---|---|---|
| **Apply the crop** | `⏎` | trims the document to the frame. `⌘Z` gives the frame back, not the pixels |
| **Abandon the crop** | `⎋` | takes the frame away without trimming anything |

### Zoom and framing

| Action | Key | What it does |
|---|---|---|
| **Zoom in** | `⌘=` | enlarges the view one step, around the centre |
| **Zoom out** | `⌘−` | reduces the view one step |
| **Fit to window** | `⌘0` | frames the whole image, with a margin, never enlarging it |
| **Actual size** | `⌘1` | one image pixel to one screen pixel |

> **`⌘1` is the only scale where you judge sharpness.** At any other zoom, what you see is a
> calculation, not the image.

### Guides

| Action | Key | What it does |
|---|---|---|
| **Rulers** | `⌘R` | shows or hides the two graduated strips |
| **Guides** | `⌘;` | shows or hides the guides placed on the image |
| **Snap** | `⇧⌘;` | makes what you drag stick to guides, edges and centre |
| **Clear guides** | *none* | removes every guide. Undoable |

**Hiding guides does not erase them**: those are two different actions, and that is why the second
has no shortcut — you do not want to reach it by accident.

### Selection

| Action | Key | What it does |
|---|---|---|
| **Deselect** | `⌘D` | drops the selected region: the brush reaches the whole layer again |
| **Make a mask of the selection** | *none* | hides the armed layer outside the selected region |

### Asking the model

Five commands that send the image to the service. None has a default key: they cost credit, and a
key pressed by mistake has no business spending any.

| Action | What it does |
|---|---|
| **Regenerate the region** | has the masked region of the armed layer repainted |
| **Extend** | has the model paint beyond the edges of the image |
| **Cut out** | removes the background of the flattened image |
| **Enlarge** | raises the definition of the flattened image |
| **Vectorize** | turns the flattened image into paths |

**None of them leaves on its own.** Each flattens the document, sends it, then **fills in the
Generate panel's form** and shows it to you. You are the one who presses Generate, having seen
what is going and with which settings.

**They live in the Image menu**, and nowhere else: with no default shortcut, that is the only
door. Cut out, Enlarge and Vectorize each ask for a model of a family that has no workspace of its
own; it is set in **Settings ▸ Generation**. Until one is set, the edit does not leave and opens
the screen where you choose it.

### Exporting

| Action | Key | What it does |
|---|---|---|
| **Export the image** | `⇧⌘E` | writes the flattened document to disk, as a PNG |
| **Merge down** | `⌘E` | joins the active layer and the one just below it, at the same level |

The five other **Image** menu entries — Flatten, both mirrors, both rotations — ship with no key.
You can give them one in [settings](14-settings.md).

### Undo and redo

| Action | Key |
|---|---|
| **Undo** | `⌘Z` |
| **Redo** | `⇧⌘Z` |

---

## In the sky

The Skyboxes workspace answers the keyboard like the others.

| Action | Key | What it does |
|---|---|---|
| **Change the view** | `V` | cycles through the four ways of looking at the sky: immersive, panoramic, cross, faces |
| **Light probes** | `P` | shows or hides the witness spheres |
| **Undo** | `⌘Z` | |
| **Redo** | `⇧⌘Z` | |

> **The probes are not a gadget.** A sky is judged by what it lights, not by its own picture: the
> witness spheres show what your panorama does to a matte surface and to a mirror one.

> **`V` does cycle through all four views, but three of them draw nothing yet.** Only the
> immersive view is wired; Equirect, Cross and 6 faces change which button is active and nothing
> else. See [The Skyboxes workspace](13-skyboxes-workspace.md).

---

## One important thing about ⌘Z

**Each document has its own undo stack.**

`⌘Z` undoes the last action **of the current tab**, not the last action you took in the studio. If
you retouch an image, move to a 3D scene, then press `⌘Z`, it is the scene that steps back — the
image has not moved.

> **"⌘Z seems to do nothing."** It is almost always this: the action you have in mind belongs to
> another tab. Activate the tab, then undo.

**While you are typing, `⌘Z` undoes your text.** Rename a layer or a track, make a typo, press
`⌘Z`: the word you have just typed steps back, not the last brush stroke. The studio stands aside
as long as the caret is in a text field, and takes over again the moment you leave it.

The same holds for `⌘X`, `⌘C` and `⌘V`: in a field they work on the text; anywhere else, on what
the workspace has selected.

---

## Changing a shortcut

Settings (`⌘,`) → **Shortcuts**.

Each action is a row: its name, a sentence explaining what it does, and a button carrying its
current key.

**To change it:**

1. **click the key button**. It turns blue and reads "Press…";
2. **press the combination** you want. It is recorded immediately.

Nothing to type, nothing to spell. That is deliberate: nobody knows what `⌘[` is called, and
everybody knows how to press it.

| Situation | What happens |
|---|---|
| You press `Esc` | the capture stops, the key does not change |
| You press a modifier alone (`⇧`, `⌘`…) | nothing: a modifier on its own is not a shortcut, it is what you hold while pressing one |
| The action has no key | the button reads "None" |

**To go back to the original key**: the small circular arrow to the right of the button. It is off
until you change something.

> **A changed shortcut is not saved right away.** Like every setting, it waits for **Apply** or
> **OK**. **Cancel** returns it to what it was.

### Conflicts

If two actions in the **same context** — or one action and one from the **Anywhere in the
application** context — end up on the same key, both rows turn red, with a warning triangle and the
message:

> *Two actions are fighting over this key: only one will answer.*

The studio **does not stop you** from doing it. It shows you, and you either leave it or fix it.

**Two different contexts sharing a key are not in conflict** and never show red: `S` in the edit and
`S` in the 3D view is the intended behaviour, not a mistake.

### Finding what a key does

At the top of the shortcuts screen, a **Find by key** button.

Click it, press the combination that puzzles you, and the list keeps only the actions that answer to
it. If none appear, the studio says so:

> *No action uses this key: it is free.*

That is the question people actually ask — "what does `⌘K` do again?" — rather than the reverse. The
**Show all** button restores the full list.

### What cannot be changed yet

**The flying keys** (`W A S D Q E` and boost) are not on this screen. They are fixed for now. See
[What does not exist yet](18-limits.md).

---

## Crib sheet, all on one page

| Key | Anywhere | 3D view | Edit | Image | Sky |
|---|---|---|---|---|---|
| `⌘N` | New project | | | | |
| `⌘O` | Open project | | | | |
| `⌘S` | Save | | | | |
| `⌘,` | Settings | | | | |
| `⌃⌘F` | Full screen | | | | |
| `⌘Z` | | Undo | Undo | Undo | Undo |
| `⇧⌘Z` | | Redo | Redo | Redo | Redo |
| `⌘G` | | Group | | | |
| `⌘D` | | Duplicate | | Deselect | |
| `⌘C` / `⌘X` / `⌘V` | | Copy / Cut / Paste | | | |
| `O` | | Projection | | | |
| `Z` | | Display | | | |
| `V` | | Select | | | Change the view |
| `P` | | | | | Light probes |
| `G` | | Move | | | |
| `R` | | Rotate | | | |
| `S` | | Scale *(and back up)* | Split clip | | |
| `M` | | Snapping | | | |
| `L` | | Local frame | | | |
| `F` | | Frame selection | | | |
| `Delete` | | Delete object | Delete clip | | |
| `W A S D` | | Fly | | | |
| `Q` / `E` | | Down / Up | | | |
| left `⇧` | | Boost | | | |
| `Space` | | | Play / Pause | | |
| `Home` / `End` | | | Start / End of edit | | |
| `⌘=` | | | Zoom in | Zoom in | |
| `⌘−` | | | Zoom out | Zoom out | |
| `⇧Z` | | | Fit to view | | |
| `⌘0` | | | | Fit to window | |
| `⌘1` | | | | Actual size | |
| `⌘R` | | | | Rulers | |
| `⌘;` | | | | Guides | |
| `⇧⌘;` | | | | Snap | |
| `⇧⌘E` | | | | Export the image | |

---

[← Every setting](14-settings.md) · [Contents](../user-guide.md) · [Next chapter: When something goes wrong →](16-troubleshooting.md)
