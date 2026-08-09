# 4. Projects

[← The window](03-the-window.md) · [Contents](../user-guide.md) · [Next chapter: Finding a model →](05-models.md)

---

## A project is a folder

Not a database. Not an online space. Not a single file that only this software can open.

**An ordinary folder, on your disk.** You can open it in your file browser, look inside, copy it
onto a USB stick, back it up with the rest of your documents, send it to someone. It carries the
`.scenario` extension, but it stays a folder.

That is a design decision, not an accident. A project that only the software that made it can open
is a project you lose the day that software stops opening.

---

## Creating, opening, switching projects

| Action | Shortcut | Menu |
|---|---|---|
| **New project** | `⌘N` / `Ctrl+N` | File ▸ New project… |
| **Open project** | `⌘O` / `Ctrl+O` | File ▸ Open project… |

**Only one project is open at a time.** Opening a second closes the first — losing nothing:
everything that was saved stayed saved.

The open project's name appears in the status line, bottom left.

> **A project is not "saved".** There is no "Save project" command. Each thing is written the
> moment it happens: a generated asset when it arrives, a document when you press `⌘S`, the panel
> layout when you change it.

---

## What is inside

```
my-project.scenario/
│
├── project.json          the identity card
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
│                           one file per saved tab
│
├── layouts/              the way you arrange your panels
│
└── .index/               SERVICE FILES — safe to delete
    ├── catalog.db          the index that makes search instant
    ├── proxies/            lightweight copies of videos, for smooth scrubbing
    ├── peaks/              the drawing of audio waveforms
    └── filmstrips/         video thumbnails
```

### What belongs to you

**`assets/` and `documents/`.** This is your work. They are real files, in real formats — a PNG is
a PNG, an MP4 is an MP4. You can open them with any other software.

### What is rebuildable

**Everything under `.index/`.** These are files the studio makes to go faster, and knows how to
remake.

If that folder grows too large, or if something seems corrupted, **you can delete it**. The studio
will rebuild it, which takes a while on a large project, and nothing will be lost.

> The `.index` folder starts with a dot: on macOS and Linux it is **hidden** by default in the file
> browser. That is normal.

### `project.json`

A small text file, readable in any editor:

```json
{
  "version": 1,
  "name": "My project",
  "createdAt": "2026-08-07T10:24:11.000Z",
  "updatedAt": "2026-08-07T18:03:52.000Z"
}
```

It is this file that makes a folder a project.

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
| graph | `.graph` | Graph |

The extension is there so the folder **reads at a glance**. `a3f1.scene` next to `b204.tex` says
what each one is; `a3f1.json` next to `b204.json` says nothing.

> **All seven kinds save**, and the **Explorer** panel lists what the folder holds — that is how a
> closed document is reopened. Closing a tab whose work is not written asks before losing it.

### Reopening a document — the Explorer panel

The layout remembers which tabs are open, but a document closed while no layout held it is no
longer reachable through tabs. That is what the **Explorer** panel is for: it lists **everything
the `documents/` folder holds**, open or not.

- a **double-click** on a row opens the document, switching workspace if it belongs to another —
  a sequence opened from the Image workspace switches to Video;
- rows already on screen are marked **Open**;
- the icon says which workspace the document belongs to, the same one the rail uses.

There is no "Open file" dialog, and none is planned: the studio only opens what is in the
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
| **Slim it before copying** | delete `.index/` — it will rebuild |
| **Move it elsewhere** | move the folder, then reopen it from the studio |
| **Rename it** | rename the folder. The displayed name comes from `project.json` |
| **Share it** | send the compressed folder. Whoever receives it will need their own API key |

Nothing breaks: the paths written inside the project are **relative**, which means they describe a
position inside the folder, not a location on your disk.

> **One exception: imported media.** When you import a video or a sound from your disk, the studio
> **does not copy it** — it creates a link to where it sits. If you move the project without taking
> those files along, the links break. The inspector then shows "File not found". See
> [Assets](07-assets.md).

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
