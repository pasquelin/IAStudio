# 4. Projects

[← The window](03-the-window.md) · [Contents](../user-guide.md) · [Next chapter: Finding a model →](05-models.md)

---

## A project is a folder

Not a database. Not an online space. Not a single file that only this software can open.

**An ordinary folder, on your disk.** You can open it in your file browser, look inside, copy it
onto a USB stick, back it up with the rest of your documents, send it to someone. **It carries the
name you gave it and nothing else**: no extension, no technical suffix.

That is a design decision, not an accident. A project that only the software that made it can open
is a project you lose the day that software stops opening.

---

## Creating, opening, switching projects

| Action | Shortcut | Menu |
|---|---|---|
| **New project** | `⌘N` / `Ctrl+N` | File ▸ New project… |
| **Open project** | `⌘O` / `Ctrl+O` | File ▸ Open project… |

**Both gestures are in the Explorer panel too**, whenever no project is open: it then shows
**Open project** and **New project**, in its usual place in the left column. It is there so that
you never have to go back to the home from a workspace.

**Only one project is open at a time.** Opening a second closes the first — losing nothing:
everything that was saved stayed saved.

The open project's name appears in the status line, bottom left.

### The home screen's project list

**Each row carries the project's name and, below it, the folder it sits in.** The folder is what
tells two projects with the same name apart — and a studio always ends up with two, one under
`Documents`, one on a scratch disk. **The last-opened date has not gone**: it is in the row's
tooltip, along with the whole path, which a narrow panel truncates.

**Each row has its own menu**, on right-click as on the button:

| Entry | What it does |
|---|---|
| **Show in folder** | opens the file manager on this project |
| **Remove from the list** | removes the project from this list, **leaving its folder and everything in it untouched** |

**Removing asks for no confirmation**: nothing is lost, and reopening the project puts its row
back. It is the gesture that cleans up a list where a moved folder lingers.

> **A project is not "saved".** There is no "Save project" command. Each thing is written the
> moment it happens: a generated asset when it arrives, a document when you press `⌘S`, the panel
> layout when you change it.

---

## What is inside

```
My project/
│
├── assets/               EVERYTHING YOU MAKE
│   ├── img/                images
│   ├── vid/                videos
│   ├── aud/                sounds
│   ├── 3d/                 3D objects
│   ├── tex/                textures
│   └── sky/                skies
│
├── documents/            YOUR WORKS IN PROGRESS
│                           one file per saved tab — a folder for an image
│
├── .project.json         the identity card — HIDDEN
│
└── .index/               THE CATALOGUE AND ITS CACHES — KEEP THIS, HIDDEN
    ├── catalog.db          the index that makes search instant
    ├── proxies/            lightweight copies of videos, for smooth scrubbing
    ├── peaks/              the drawing of audio waveforms
    └── filmstrips/         created ahead of time, still empty
```

**Two entries out of four are hidden, and the rule is simple**: what is yours shows, what is the
machine's is filed away. Your assets and your documents stay visible — you must be able to look at
them, copy them, repair them. The identity card and the index do not: they are the studio's tools,
not your work.

> **On Windows a dot hides nothing** — Explorer reads a file attribute, not the name. The studio
> sets it on both entries itself. If that fails, **the project opens anyway**: a service file left
> visible is a blemish; refusing to open the project over it would be a real fault.

### What belongs to you

**`assets/` and `documents/`.** This is your work. They are real files, in real formats — a PNG is
a PNG, an MP4 is an MP4. You can open them with any other software.

### `.index/` holds more than caches — do not delete it

**Two of its four entries really are caches**: `proxies/` and `peaks/` are remade when a medium is
imported, and throwing them away costs one reimport. `filmstrips/` is created ahead of time and
stays empty — nothing writes to it yet.

**`catalog.db` is not one.** It is what holds every asset's name, its tags, its dimensions, the
model and prompt that produced it, what it derives from — and, for an imported medium, **the path
to your original file**, which is written nowhere else. The activity journal lives in the same
database.

**The studio cannot rebuild it from the folder.** There is no rescan of `assets/` at startup: the
catalogue fills up as you generate and import, never after the fact. Deleting `.index/` therefore
leaves a project whose files are all still there and about which nothing says what they are.

> **If you need to slim a project down**, throw away `proxies/` and `peaks/` — that is where the
> weight is. Keep `catalog.db`, which weighs little and knows everything.

### `.project.json`

A small text file, readable in any editor:

```json
{
  "version": 1,
  "name": "My project",
  "createdAt": "2026-08-07T10:24:11.000Z",
  "updatedAt": "2026-08-07T18:03:52.000Z"
}
```

**It is this file that makes a folder a project**, never its name: the studio opens the folder you
point it at and looks for this file inside.

- **`updatedAt` moves on every document saved.** It is the last time this project did some work,
  not the last time it was opened.
- **Pointing at a folder that holds none** gets you "This folder is not a Scenario project", in the
  journal and in a toast at the bottom right — not a system message.
- **A file that was truncated or edited by hand** is reported as unreadable, and the studio refuses
  to open it rather than guessing at what it holds.
- **A project made by a NEWER build of the studio is refused.** It is not opened as best it can be:
  the studio does not know what that build added, and the first save would wipe it without a word.
  Update the studio to open the project again; the folder itself has not been touched.

> **A project made by an earlier version opens as it is.** Its folder was called "My project
> .scenario" and its identity card `project.json`, with no dot — the studio recognises both and
> writes the new shape beside them. **The old file is left where it is**: the folder is yours, you
> may be syncing it, and an earlier version of the studio can still read it. Renaming the folder to
> drop its extension is yours to do if you care to; the studio does not touch it.

---

## Documents

A document is a work in progress: an image with its layers, a 3D scene with its objects, an edit
with its tracks.

It is saved with `⌘S` / `Ctrl+S`, into `documents/`, under an extension that says what it is:

| Document type | Extension | Workspace |
|---|---|---|
| layered image | `.img` | Image |
| 3D scene | `.scene` | 3D |
| video sequence | `.seq` | Video |
| sound being edited | `.aud` | Audio |
| sky | `.sky` | Skyboxes |
| material | `.tex` | Textures |

The extension is there so the folder **reads at a glance**. `a3f1.scene` next to `b204.tex` says
what each one is; `a3f1.json` next to `b204.json` says nothing.

> **All seven kinds save**, and the **Explorer** panel lists what the folder holds — that is how a
> closed document is reopened. Closing a tab whose work is not written asks before losing it.

### Walking the project — the Explorer panel

The **Explorer** panel shows **the project folder**, as a tree: `assets/`, `documents/`, and
whatever you dropped in there yourself. Folders unfold, files are inside them, exactly as in your
system's own file browser.

**It shows what the studio cannot open, too.** A `.pdf`, a `.txt`, a folder of notes: it is your
folder, and that is what tells an explorer apart from a list of documents.

#### Two readings of the same folder

The head of the panel carries three buttons. The first two say how the folder is READ, and one of
the two is always lit:

| Reading | What it shows |
|---|---|
| **By folder** | the project as it is filed on disk, as a tree |
| **By domain** | every file in the project grouped by what it **is**, wherever it is filed |

**By domain** ignores folders. It lays down at most seven headings — the studio's six kinds, plus
**Other** for what belongs to none — each followed by how many files it counts. **A domain nothing
fills does not appear**: seven empty headings over a new project would say nothing at all.

A heading names, it does not open: it cannot be selected, it cannot be renamed, and nothing drops
onto it.

**It has almost nowhere to drop**, and that is mechanical: filing a file needs a folder to carry
it into, and there is no folder left on screen. A row can still be picked up, but the only target
remaining is the blank below the tree — the project root. **To file, go back to By folder.**

It is what answers "where did my videos go?" when they are spread across five folders you made
yourself.

#### Searching, and sorting

Under the buttons, a bar: a field and a sort. **A search speaks over either reading** — typing a
word is a question about the project, not about the way it is being shown.

It walks the **whole** folder, not only what is unfolded, and brings back each match **with the
chain of folders leading to it**: a file nine folds down appears where it lives, not adrift. It
waits for your typing to settle before it goes.

The sort files by **Name: A to Z** or **Name: Z to A**. It holds for both readings; it does not
touch the order of the domains, which is the one the studio uses everywhere else.

**The panel tells four silences apart**, and that is the whole of it: a folder that would not be
read, a walk still running, a project holding no file at all, and a word nothing answers to — so
it never says "empty" where it means "wait". **A search that matches nothing does not take the
field it was typed in off the screen**, or there would be no way back.

#### The gestures

| Gesture | Effect |
|---|---|
| **Double-click** a folder | opens or closes it |
| **Double-click** a studio document | opens it, switching workspace if it belongs to another |
| **Double-click** a file under `assets/` | **opens it in the studio**, in the workspace that edits its kind — it is an asset, not just any file |
| **Double-click** any other file | hands it to your system, which opens it with the right application |
| `→` `←` | unfolds, folds |
| `↑` `↓` | the previous row, the next one |
| `Enter` | opens the row |
| **⌘-click** / `Ctrl`-click | adds the row to the selection, or takes it out |
| **⇧-click** | takes everything from the last row picked to this one |
| **Drag** a row onto a folder | moves the file or folder into it, under the same name |
| **Drag** a row into the blank below the tree | takes it out of its folder, to the project root |

**Everything below holds for the whole selection**, not for the clicked row alone: a drag carries
several at once, and the right-click menu applies to all of them. **Three files carried into a
folder one of them holds do not light that folder up** — the refusal is asked of the batch, not
row by row.

**Dragging moves, right-clicking renames** — and the two do not overlap: "Rename" changes the
name **where the file already is**, and cannot take it out of its folder. A folder that would
not accept the drop never lights up, so you see before you let go rather than after. A name
already taken in the destination is refused rather than overwritten, and the journal says so.

#### Right-clicking: eleven gestures, in four groups

| Group | Gesture | What it does |
|---|---|---|
| open | **Open** | opens the file in its workspace, or unfolds the folder |
| | **Show in folder** | opens Finder or Windows Explorer, with the row selected |
| clipboard | **Cut** · **Copy** | hold the selection for the next paste |
| | **Paste** | drops what the clipboard holds into the folder shown |
| files | **New folder** | creates an empty folder in the folder shown |
| | **Duplicate** | lays a copy beside the original, under a free name |
| | **Rename** | changes the name on disk, where it is read |
| | **Move to trash** | sends it to your system's trash |
| going back | **Undo** · **Redo** | undo and redo the last batch of files |

**Every row shows the shortcut it answers to**, and it is the one *in force*: if you remapped it
in the settings, yours is what appears here.

**No gesture ever leaves the menu; the ones that do not apply are greyed.** A menu whose length
changes with the row you clicked is a menu one cannot learn.

**`⌘Z` only undoes files while the focus is inside this panel.** Elsewhere it belongs to the open
document: undoing on the canvas must not reach your disk.

> **Nothing is deleted here.** "Move to trash" is the system's own trash: the file can be got
> back from it.
>
> **It is the one gesture `⌘Z` does not take back.** Moving, duplicating, creating, renaming are
> one keystroke from being undone; the system trash has no portable way back, and the studio's
> history stops there. **That is also why a batch asks first**: past one file, the studio says how
> many are going and waits for your word. **A single file goes without a question** — it is named
> on the row you just clicked, and the system offers to put it back.
>
> **One door of the studio does delete for good**, and it says so: **Delete document…**, in a tab's
> menu, takes the file out of the folder without going through the trash. Its dialogue announces
> "This cannot be undone.", and it means it.

**One refusal, greyed rather than hidden.** What the studio files itself — `assets/`, its six
per-kind subfolders, `documents/` — cannot be renamed or trashed: the index files every asset by
its path under `assets/`, and renaming one of those folders would leave rows nothing can find
again. **The same refusal holds on both sides of a drag**: those folders cannot be picked up, and
nothing can be dropped into them either.

**And it holds for what they CONTAIN, as far as moving goes.** A file under `assets/img` cannot be
cut, copied, duplicated or dragged elsewhere: its path is still what says what it is, and taking
it out of there would cost it its kind. **The trash is the exception, because it does not move
it**: the index lets the row go with the file.

**And renaming, on one condition.** An asset and a document each have a gesture of their own, and
the Explorer leads to it: the name changes, and the file follows in the same move. A document
renamed here keeps its tab open, which takes the new name. An asset renamed here changes name
everywhere at once — the Explorer, the shelf, the Inspector, the tab editing it — because there
is only **one name**: its index row's name IS its file's name.

> **The studio only renames what it knows.** A picture you dropped into `assets/img` yourself,
> without going through the studio, has no index row: it is neither a document nor an asset, and
> **Rename** is greyed out on it. Rename it from your own file browser — the Explorer will read it
> again. **Outside the studio's folders, everything of yours renames without condition.**

> A name your file system would not accept is refused rather than silently corrected — a slash,
> for instance. So is a name the folder already holds, rather than overwriting somebody else's
> file. The field has closed by the time the answer comes: the activity journal is what says so.

- documents already on screen are marked **Open**;
- a document's icon says which workspace it belongs to, the same one the rail uses.

#### Hidden items

**Nothing whose name starts with a dot is shown by default** — so `.project.json` and `.index/`,
but also a folder of your own whose name you began with a dot.

**The third button at the head of the panel shows them**, under the eye every file browser draws
for this. What it reveals stays **read-only**: those rows refuse every gesture, on both sides —
no rename, no trash, no drag, and nothing dropped into them. It is what the studio holds for
itself, and seeing it is not touching it.

**A folder is only read once you open it.** `assets/img` can hold thousands of files in an ordinary
project, and reading them to count them would cost a wait on every project opening.

**The tree follows the disk.** Copy a file into the folder from your system: it appears, with
nothing to click. It is read again when you come back to the window as well — a project on a
network volume sometimes emits no event at all, and that second net catches it.

> **It is still where a closed document is found again.** The layout remembers which tabs are open,
> but a document closed while no layout held it is no longer reachable through tabs; it is in
> `documents/`, one fold down.

> **A document never saved does not come back on restart**, and neither does its tab: it is
> dropped from the layout rather than reopened onto "This document is no longer open." The layout
> is written to your disk, the contents of documents are not — the `documents/` folder stands for
> them, and what was never written there has nothing to reopen.

There is no "Open file" dialogue, and none is planned: the studio only opens what is in the
project.

### How a document is written

The studio writes to a transit file first, then renames it over the old one. That means that if the
computer shuts down **during** the write, you keep the previous version intact rather than a
half-written file.

> A power cut at the exact second of the write can still lose the last save. That is the accepted
> trade-off: the alternative would cost a wait on every `⌘S`.

---

## Moving, copying, backing up a project

| You want to… | Do this |
|---|---|
| **Back it up** | copy the folder. That is all |
| **Slim it before copying** | delete `.index/proxies` and `.index/peaks` — **keep `catalog.db`** |
| **Move it elsewhere** | move the folder, then reopen it from the studio |
| **Rename it** | rename the folder. The displayed name comes from `.project.json` |
| **Share it** | send the compressed folder. Whoever receives it will need their own API key |

Nothing breaks: the paths written inside the project are **relative**, which means they describe a
position inside the folder, not a location on your disk.

> **One exception: imported media.** When you import a file from your disk — **video, sound,
> picture or 3D object, all four can be imported** — the studio **does not copy it**: it creates a
> link to where it sits. If you move the project without taking those files along, the links break.
>
> **Nothing will tell you until you click.** The inspector does not show "File not found" of its
> own accord: it offers the **Show in folder** button, and it is the click, finding
> nothing, that brings the message up. See [Assets](07-assets.md).

---

## Reopening a project at startup

By default, the studio **reopens the last project** when you launch it. You find your tabs and
panels where you left them.

This behaviour is adjustable: **Settings ▸ General ▸ On startup**, with two choices — "Reopen the
last project" or "Open nothing".

You can also choose **where the studio offers to create your projects**:
**Settings ▸ Storage ▸ Projects folder**. This moves nothing; it only preselects a location in the
dialogue.

---

## With no project open

The studio works, but several things are unavailable, and say so:

| What you see | Why |
|---|---|
| "Open a project to generate." | a made image has to land somewhere |
| "Open a project to see its assets." | the shelf shows a project's contents |
| The rail's **+** button is greyed out | a document is a file in a project folder |

---

[← The window](03-the-window.md) · [Contents](../user-guide.md) · [Next chapter: Finding a model →](05-models.md)
