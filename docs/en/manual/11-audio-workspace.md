# 11. Audio workspace

[← Video workspace](10-video-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Textures workspace →](12-textures-workspace.md)

The workspace where you shape a sound: shorten it, bring it up gently, even out its volume.

---

## Opening a sound

**Double-click an audio asset** in the shelf.

While no sound is open, the workspace shows: "No sound open. Double-click an audio asset to edit
it."

If the file cannot be decoded, it says that too: "This file could not be decoded." That is usually
an unusual format, or a damaged file.

---

## The waveform

The sound is displayed as a **waveform**: a drawing that rises and falls with the volume.

It is the universal representation of sound. At a glance you can see:

- **where there is speech and where there is silence** — the flat troughs are silences;
- **where it clips** — when the drawing touches the top and bottom of the frame;
- **the rhythm** — the regular peaks of a piece of music.

### Selecting a portion

**Drag across the waveform** to draw a selection. That is the portion the tools work on.

Playback loops over the selection while it exists, which lets you judge a passage by hearing it
again.

Without a selection, the tools that need one work on default values — a one-second fade, for
example.

---

## The tools

| Tool | What it does |
|---|---|
| **Trim** | keeps only the selection, throws away the rest |
| **Fade in** | brings the sound up from silence, over the selection |
| **Fade out** | brings the sound down to silence, over the selection |
| **Normalise** | brings the overall level to −14 LUFS |
| **Trim silence** | removes silence at the start and the end |
| **A/B** | plays the original source, without undoing anything |

### What "normalise" means

Making the sound **neither too quiet nor too loud**, at a standard level.

**−14 LUFS** is the target adopted by most streaming platforms — YouTube, Spotify, and the rest. A
sound normalised to that value will play at roughly the same volume as whatever surrounds it,
instead of making people jump or reach for the volume knob.

"LUFS" measures **perceived** loudness, not measured level: it accounts for how the human ear
hears. That is why it beats simply hunting for the loudest peak.

### What the A/B button is for

**Hearing what you changed.**

One click, and the studio plays the original sound, as it was before your edits. A second click,
and it plays your version again. Nothing is undone: this is a comparison, not a step back.

It is the most useful gesture in the whole workspace. We often believe we have improved a sound,
and A/B tells the truth in three seconds.

---

## Nothing is written until you say so

This is the important point of this workspace.

Your tools **do not write into the file**. They stack a list of instructions — "trim here",
"one-second fade", "normalise" — which is replayed over the original sound every time.

Two very practical consequences:

- **undoing costs nothing**, however many steps there are;
- **A/B is instant**, because the source is always there, intact.

Only when you explicitly ask is anything written:

| Button | What it does |
|---|---|
| **Apply** | **rewrites the asset** with your changes. The original is replaced |
| **Save as new** | creates a **new asset** alongside, named "*(edited)*" |

> **When in doubt, take "Save as new".** You keep the original, and you can always delete the copy
> if it does not work out.

---

## Undo and redo

`⌘Z` / `Ctrl+Z` undoes the last step of the chain. `⇧⌘Z` redoes it.

As everywhere in the studio, the history belongs to the document: the tab you mean has to be in
front.

---

## What the Audio workspace does not do

Deliberately. These are not oversights:

- no **noise reduction**;
- no **de-esser**;
- no **spectral repair**;
- no **equaliser**, no **compressor**.

The reason is simple: those tools answer problems of **real recording** — a microphone that hisses,
a room that rings, a whistle on the "s". A **generated** sound does not have those defects: it is
clean by construction.

What stays useful on a generated sound is to shorten it, bring it to the right level, and make it
come in and go out cleanly. That is exactly what this workspace does.

> **An edited sound is not saved as a document.** The Audio workspace writes assets directly, via
> Apply or Save as new. There is no `.aud` file on disk for now — see
> [What does not exist yet](18-limits.md).

---

[← Video workspace](10-video-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Textures workspace →](12-textures-workspace.md)
