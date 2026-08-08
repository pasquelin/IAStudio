# 3. The window, explained

[← First steps](02-first-steps.md) · [Contents](../user-guide.md) · [Next chapter: Projects →](04-projects.md)

The studio's window looks like a development environment or an editing suite, not a web page. This
chapter takes it apart, piece by piece.

---

## The overall plan

```
┌──────────────────────────────────────────────────────────────┐
│  TITLE BAR — the six workspaces                              │
├──┬────────────────────────────────────────────────────────┬──┤
│  │                     top zone                           │  │
│ R├────────────────────────────────────────────────────────┤ R│
│ A│         │                                    │         │ A│
│ I│  left   │          DOCUMENT ZONE             │  right  │ I│
│ L│  zone   │        (tabs live here)            │  zone   │ L│
│  │         │                                    │         │  │
│ l├────────────────────────────────────────────────────────┤ r│
│  │                    bottom zone                         │  │
├──┴────────────────────────────────────────────────────────┴──┤
│  STATUS LINE — project — document                            │
└──────────────────────────────────────────────────────────────┘
```

Five elements, in the order you meet them:

1. the **title bar**, at the very top, carrying the workspaces;
2. the **rails**, stuck to the left and right edges: strips of icons;
3. the **zones**, where panels live;
4. the **document zone**, in the centre: this is where what you make sits;
5. the **status line**, at the very bottom.

**The colours mean something.** The general background — the *chassis* — is mid grey. The panels
laid on it are **darker**, with rounded corners. This is the opposite of web habit, and it is
deliberate: it gives the reading "panels laid on a table", as in an editing suite.

---

## The title bar

It does not carry the file name. It carries the **six workspaces**:

**Image** · **Video** · **3D** · **Audio** · **Textures** · **Skyboxes**

One click switches workspace. The active one is the button lighter than the others.

Switching workspace does three things at once:

- **the panels rearrange** — each workspace shows the tools it needs and hides the rest;
- **the tabs change** — each workspace has its own open documents;
- **the catalogue filters** — the Models panel now shows only the models capable of making that
  kind of content.

On macOS, the three red / orange / green buttons stay in their usual place, on the left.

### The account switcher

On the right of the title bar: a small coloured dot, a name, and a chevron.

| What you see | What it says |
|---|---|
| **Green** dot | the displayed account's key works |
| **Grey** dot | it does not, or there is no account |
| **The name** | the account currently in use |
| **"Not connected"** | no account is stored |

**One click opens the list** of your accounts, the current one ticked, plus a **Manage accounts…**
entry leading to settings.

If **no account is stored**, the button opens no menu: it goes straight to settings. A one-line menu
is not a menu.

> **Switching accounts changes the library, not your work.** Each API key carries its own Scenario
> project — its models, its assets, its credit. Your local project is on your disk and belongs to no
> account: it does not move a pixel.

It is a **switcher**, never a form: keys are typed in settings, and nowhere else.

---

## The rails

The two vertical strips of icons, stuck to the left and right edges.

**A rail never disappears.** That is the point of them: even when you have closed everything, every
panel stays one click away.

### How to read them

One click on an icon **opens** the panel. A second click on the same icon **closes** it.

A **separator line** across the rail marks a zone's split: the icons above the line open in the
first half of the zone, those below in the second. The rail is therefore the legend of the column
it commands.

### The left rail

From top to bottom:

| Element | What it does |
|---|---|
| **+** (blue button) | creates a **new document** in the active workspace |
| *separator* | |
| The **left column** icons | Models, then Generate — the same two in all six workspaces |
| At the bottom: the **bottom strip** icons | Assets or Timeline, depending on the workspace |

The **+** button is solid and blue, where all the others are grey glyphs. That is because it
**acts** — it creates something — while the others only show or hide.

> The **+** button is greyed out when no project is open: a document is a file in a project folder,
> and without a project there is nowhere to write it.

### The right rail

The **right column** icons: Skybox, Layers, Assets, Explorer, Scene, Lights, Meshes — whichever ones the
workspace declares, in that order — then, below the separator, Inspector.

### The rail only shows what the workspace can do

An icon appears only if the workspace you are in actually has that panel. Layers mean nothing in the
Audio workspace: their icon is not there.

**One special case: Generate.** Its icon disappears while no model is chosen. It is not a greyed-out
button, it is an absence — generating without a model is impossible, and the rail would rather show
what the workspace **can** do than what it cannot.

As soon as you choose a model in the **Models** panel, the icon appears. It stays if you have set a
default model for that family in settings.

---

## Zones and panels

There are four zones: **left**, **right**, **top**, **bottom**.

Each zone is **split into two halves**, and each half shows **one panel at a time**.

That means two things:

- two panels of the **same half** take turns: opening the second closes the first;
- two panels in **different halves** of the same zone are shown **together** — one above the other
  in a column, side by side in a strip.

> **The top zone hosts no panel for now.** It exists in the structure and stays reserved. Nothing
> will appear there until a panel is declared for it.

### Resizing

**Drag the space between two panels.** That space — the *gutter* — is itself the handle: there is
no tiny grip to aim at pixel-perfect.

The studio always keeps **at least 240 pixels** for the document zone in the centre, and at least
140 pixels for each side zone. So you cannot crush the centre by accident by dragging too far.

Starting sizes: left column 320 px, right column 260 px, bottom strip 240 px. The left one is the
wider of the two: it holds a model's form, and a 260 px column wraps every field onto two lines.

### Closing, reopening, putting everything back

A panel **closes**; it does not collapse. A collapsed panel would be a third state resembling
neither open nor closed — and the rail already reopens it in one click.

Three ways to find what you closed:

| Means | Effect |
|---|---|
| Click its icon in the rail | reopens that panel |
| **View ▸ Tool windows** | the same thing, from the menu |
| **View ▸ Reset layout** | puts **all** panels back where they started |

> **Resetting the layout does not touch your work.** It only moves panels.

### When a panel gets narrow

Shrink a panel and its title line gives ground gradually: its own controls — a filter, a view
button — go first. **The close button never goes.** A panel you could no longer get out of would be
worse than a panel deprived of its filter.

**One exception: the panel's name is not what goes first.** In a strip, the shelf puts its whole
bar on the title row; were room to run short, it is the name that would be trimmed to nothing. A
panel's name is not what a crowded row should spend first, so it keeps its size and the bar tightens
instead.

---

## The complete list of panels

| Panel | Zone | Half | Visible in | What it is |
|---|---|---|---|---|
| **Models** | left | 1st | everywhere | the Scenario catalogue, filtered on the active workspace |
| **Generate** | left | 1st | everywhere *(if a model is chosen)* | the chosen model's form |
| **Skybox** | right | 1st | Skyboxes | the open sky's settings |
| **Layers** | right | 1st | Image | the layer stack of the open image |
| **Assets** | right | 1st | Video, Audio | the project's shelf, as a column |
| **Explorer** | right | 1st | everywhere | the documents of the project, open or not |
| **Scene** | right | 1st | 3D | the tree of the open scene |
| **Lights** | right | 1st | 3D | the scene's light sources |
| **Meshes** | right | 1st | 3D | the scene's objects, and the button that adds one |
| **Inspector** | right | 2nd | everywhere | what is selected, adjustable live |
| **Assets** | bottom | 1st | Image, 3D, Textures, Skyboxes | the same shelf, as a strip |
| **Timeline** | bottom | 1st | Video, Audio | the sequence being edited |

**The left column is generation, and nothing else.** Only two panels may sit there — **Models**
and **Generate** — and neither appears anywhere else. Generating is the one thing all six
workspaces do, so it gets the same place in all six, right under the **+** button that makes a
document. They are two moments of the same work, choosing then filling in, so they take turns in
the same half.

**The right column belongs to the open document**: what it holds, what lights it, what is
selected. Its panels take turns in the upper half — no workspace declares all six at once — and
the **Inspector** holds the other half, always the lower one. You read what is selected **while**
a model is being chosen and a prompt written: in an editor, the inspector is never the panel you
have to switch away from to see something else.

**Why the asset shelf moves.** In most workspaces it sits at the bottom: it is a shelf, it reads
across, and the side column is reserved for what acts on the document. But in the **Video** and
**Audio** workspaces the bottom strip belongs to the edit, which needs the full width. The shelf
then moves to the **right column**, so that the edit and the shelf hold the screen **together**:
dragging a take onto a track is the gesture those two workspaces are built around.

### A half shows what the workspace puts there

You open the bottom strip in the Image workspace: it is the shelf. You switch to Video: the same
strip becomes the edit, with nothing for you to reopen.

**What you opened is a zone** — and it stays that zone. A half holding a panel this workspace puts
elsewhere, or does not have at all, shows what the workspace does put there. Closing the half still
empties it everywhere: that is the one thing the click actually said.

Two practical consequences:

- **nothing is overwritten**: go back to the original workspace and you find what you had there;
- **a Generate panel with no model gives way to Models** — the panel that lets you choose one.

### A half you have not chosen for opens on the workspace's first panel

Until you have clicked an icon of a half, it is attached to **no** panel: it shows the first one
the workspace declares there — the topmost in the table above, and so the first on the rail.

That is what you see on first launch, and what **View ▸ Reset layout** restores:

| Workspace | The upper right half opens on | The bottom strip on |
|---|---|---|
| **Image** | Layers | Assets |
| **Video** | Assets | Timeline |
| **3D** | Explorer | Assets |
| **Audio** | Assets | Timeline |
| **Textures** | Explorer | Assets |
| **Skyboxes** | Skybox | Assets |

**Why this is not a panel pinned once and for all.** Your layout is remembered once for all six
workspaces, while the panel that comes first differs in each. Writing one into the default layout
would impose one workspace's answer on the other five.

As soon as you click an icon, that half remembers **your** choice, and does not move again until
you click another — or reset the layout.

**Why the Explorer is visible everywhere.** It lists the documents of the project folder, open or
not, and that is the same question in all six workspaces: double-clicking a row opens the
document, switching workspace if it belongs to another. It long showed the 3D scene tree — that
now has its own panel, **Scene**.

---

## The document zone

The centre. This is where what you make sits.

**It only takes documents.** An open file and its toolbar, nothing else. No panel can enter it.

### The tabs

Each open document has its tab, at the top of the centre. One click moves between them.

They can be **moved**, **reordered**, and **placed side by side**: drag a tab towards an edge of the
centre, a drop zone appears, let go — and you get two documents visible at once.

### The dot beside the name

A tab whose work is not yet written to disk carries **a dot** (`•`) beside its name.

The dot disappears on save (`⌘S` / `Ctrl+S`), and comes back on the next change. If you undo back
to the exact point where you saved, it disappears too: what you see is then indeed what the file
holds.

> **All six document kinds save** — images, 3D scenes, materials, sequences, edited sounds and
> skies. What does not survive one save to the next is the undo history. See
> [What does not exist yet](18-limits.md).

### Closing a tab

The tab's cross closes the document. **If it carries the dot**, the studio first asks what to do
with what is not written:

- **Save** writes the document and then closes — that is what `⏎` picks;
- **Don't save** closes and loses the work done since the last `⌘S`;
- **Cancel** closes nothing — and it is also what `⎋` answers, so that a key struck without
  reading can never throw work away.

If the write fails, the tab stays open and the reason goes to the activity journal: closing
anyway would lose exactly what the question had just promised to keep.

### A tab's menu

**Right-clicking** a tab opens three gestures:

| Row | What it does |
|---|---|
| **Close tab** | like the cross, question included |
| **Close other tabs** | closes them one by one; a *Cancel* stops the run |
| **Delete document…** | **removes the file from the project folder** |

**Deleting cannot be undone**, and it is the only gesture in the studio that erases a file you
made. The studio asks for confirmation, and this time *Cancel* is the default button. A document
being deleted is never offered a save on the way out: writing it and erasing it in the same
breath would make no sense.

### Each workspace has its own tabs

Going from "Image" to "3D" closes nothing: it puts away the Image tabs and brings out the 3D ones.
Come back to Image and you find exactly what you left there.

---

## The status line

The thin strip at the very bottom.

On the left, it says **where you are**:

| What appears | Situation |
|---|---|
| *No project open* | nothing is open |
| `My project` | a project is open, no document in front |
| `My project — Cliff` | a project is open, and the document "Cliff" is in front |

### Generations, on the right of the status line

This is where your pending requests live. **There is no Jobs panel**: a generation is minutes of
waiting you spend elsewhere, so it has to be readable from any workspace — and a panel could only be
in one.

What you see while something is working:

```
3 generations  ▓▓▓▓▓░░░░░  45 %  ⌃
```

| Element | What it says |
|---|---|
| **"3 generations"** | how many are working right now |
| **The bar** | their average progress |
| **The percentage** | the same figure, spelled out |
| **The chevron** | one click opens the full list |

**When nothing is working, the area disappears.** It costs no space at rest.

**Unless something failed**: "2 failures" stays on screen after the jobs end. A failure that vanished
with the last running generation is a failure nobody would have read.

**Clicking opens the list**, in a small window above the status line: one line per job, its model,
its state, its bar, and the button that cancels it. It is the content of the former panel, one click
away instead of a permanent piece of surface.

### The journal, next to it

A second icon on the same line: the **activity journal**. It keeps what the studio has done and
what it has failed to do — a generation, an import, an upload to the library, a document save.

**It is always there**, unlike the generations, which vanish when nothing is running. A studio
showing nothing until something breaks leaves the user with nowhere to look **before** it does.

| What you see | Situation |
|---|---|
| a small grey clock | all is well, the journal can be read |
| an alert and "2 failures" in red | two things failed and have not been read yet |

**One click opens the list and marks everything read** — opening it is reading it. Two filters
wait there: the **level** (information, warning, failure) and the **topic** (generation, import,
library, document). A **Show everything** button releases them.

### The toasts that do not fade

A failure raises a **toast** in the bottom-right corner, above the status line.

Two decisions show through, both against the usual habit:

- **Only failures raise one.** An asset imported successfully gets its line in the journal, not a
  toast: a toast per happy event would train you to look away from the corner where the problems
  appear.
- **They do not go away on their own.** No four-second fade — a toast that faded is a toast
  somebody looking at their canvas never saw. It leaves when you close it, and closing it is what
  marks it read.

---

## The native menu

The system menu — at the top of the screen on macOS, at the top of the window elsewhere.

| Menu | What is in it |
|---|---|
| **File** | New project…, Open project…, Save, Settings… |
| **Edit** | Undo, Redo, and the system's text commands |
| **View** | Tool windows (reopen a panel), Reset layout, Full screen, and image zoom |
| **Objects** | Add ▸ Mesh, Add ▸ Light — in the 3D workspace |
| **Window** | the system's window commands |
| **Help** | About Scenario Studio, Usage…, Licences |

### The usage window

**Help ▸ Usage…** opens a window of its own, saying **what your keys have spent**.

Top right, the period: **7, 31 or 120 days**, 31 by default. Four sections down the left:

| Section | What it shows |
|---|---|
| **Overview** | the total spent over the period, discounts, how many generations, and the spend per day and per account |
| **Models** | which models cost what, how many generations each served, and the share that went through an API key |
| **Activities** | what was done, and the assets that came out of it |
| **Journal** | every billed event, newest first, by pages |

Three warnings are shown there, and none is decorative:

- **there is no balance.** The Scenario API only exposes what has been spent, never what is
  left. No figure in this window will tell you how much you can still generate;
- **the euro amount is indicative.** It is computed from the public prepaid pack grid, which is
  tiered and says nothing about a subscription's own rate. It is an order of magnitude, not an
  invoice;
- **the total mixes accounts billed separately.** With several keys, the sum shown matches no
  real invoice — the Overview section breaks it down per account.

**A key that does not answer does not skew the figures silently**: the window names the keys that
stayed quiet and says the totals are the others'.

With no key stored at all, the window says so and points to the preferences.

### The licences window

**Help ▸ Licences** opens the list of software Scenario Studio ships with: their name, their
version, and the short name of their licence (`MIT`, `Apache-2.0`…).

Click a row: the **full text** of the licence unfolds, and the link to its sources appears where the
licence requires it.

> **The text is inside the application, not behind a link.** A notice you have to be online to read
> is not a notice — and several of these licences require reproducing in full, not summarising.

Nothing to do there, nothing to set. It is a legal obligation, honoured properly.

**This window is about the others, not about the studio.** Three texts, three scopes, and they are
worth telling apart:

| What it covers | Under which terms | Where to read it |
|---|---|---|
| **The studio's source code** | PolyForm Noncommercial 1.0.0 — readable, modifiable, reusable for any **noncommercial** purpose | `LICENSE`, in the repository |
| **The application** you installed | its own terms of use | `EULA.md`, in the repository |
| **The third-party components** both of them carry | each keeps its own | this window, and `THIRD-PARTY-NOTICES.md` |

**ffmpeg is a case apart**, and its entry says so: it is not linked into the application, it is
launched **beside** it, as a separate program. Its licence therefore differs per platform — GPL on
macOS, LGPL elsewhere — and **its corresponding sources are attached to every published release**,
next to the installers.

The shortcuts shown in the menus are **the ones you have set**. Change a shortcut in settings and
the menu follows.

**View ▸ Tool windows only lists what the workspace can open.** Like the rail: no Layers in the Audio
workspace, and no Generate while no model is chosen. A menu offering to open a panel that would not
appear would be worse than a short menu.

---

## What the studio remembers on its own

You do not have to save any of this:

- **your panel layout**, per workspace and per project;
- **the size of each zone**;
- **the open tabs**, per workspace;
- **the last project opened**, reopened on the next launch — adjustable, see
  [Every setting](14-settings.md);
- **the chosen model**, per family.

---

[← First steps](02-first-steps.md) · [Contents](../user-guide.md) · [Next chapter: Projects →](04-projects.md)
