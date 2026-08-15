# 11. Audio workspace

[← Video workspace](10-video-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Textures workspace →](12-textures-workspace.md)

The workspace where you shape a sound — shorten it, bring it up gently, even out its volume — and
then lay it beside the others.

---

## How this workspace is laid out

As in Video, the **bottom strip belongs to the edit** and the asset shelf takes the upper half of
the **right column**, so a take can be dragged from one to the other without switching panels. The
left column holds Models and Generate, as it does everywhere else.

In the middle, **two stacked monitors** — where Video puts its own side by side. They take the
full width, one under the other:

| Monitor | What it shows |
|---|---|
| **The edit**, on top | every track put together, from start to finish |
| **The take**, below | the sound you are editing, with its tools |

A **handle** separates them: drag it to give one or the other more room. Under each, a line says
which of the two you are looking at.

> **An audio tab holds two halves, and they are saved together.** Below, the **one-take editor**:
> the waveform and its tools. On top and in the bottom strip, the **edit**, where takes are laid
> side by side — described [further down](#the-edit). One tab, one `⌘S`, one file.

---

## Opening a sound

**Two gestures, in this order, and the order matters:**

1. **The `+` button on the left rail** — it opens an audio tab, empty for now.
2. **Double-click an audio asset** in the shelf — the take goes into the tab. You can also **drop
   it on the lower monitor**, or use the right-click row **Open in the audio editor**.

While no sound is loaded, the lower monitor shows: "No sound open. Drop a take here, or
double-click an audio asset."

> **Double-clicking without having opened a tab does nothing**, and nothing says so. Double-click
> always sends the asset into the tab in front; with no tab, it has nowhere to send it. This is
> explained in full in [Assets](07-assets.md).

**A take you open is laid on the edit straight away**, at the playhead, on a sound track the
studio picks — the double-click rule of the [Video workspace](10-video-workspace.md). This is what
ties the two halves together: the clip in the bottom strip **is** the take in the lower monitor,
and it follows what you do to it — a crop shortens it, a fade shows on its edges,
normalising changes its gain. Two things stay its own, because they belong to the edit rather than
to the take: **where it starts** and **how fast it runs**.

**Swapping takes works the same way**: double-click another sound and it replaces the previous
one. Beware — **everything you had set is lost**. Cuts and fades are measured against the take
that received them, and would mean nothing carried over to another. The previous take's clip
**leaves the edit** with it; the ones you laid down yourself stay.

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
| **Crop** | keeps only the selection, throws away the rest |
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

Your tools **do not write into the file**. They stack a list of instructions — "crop here",
"one-second fade", "normalise" — which is replayed over the original sound every time.

Two very practical consequences:

- **undoing costs nothing**, however many steps there are;
- **A/B is instant**, because the source is always there, intact.

Only when you explicitly ask is anything written:

| Button | What it does |
|---|---|
| **Apply** | **rewrites the asset** with your changes. The original is replaced — unless it is a [linked medium](07-assets.md), which then enters the project without your file being touched |
| **Save as new** | creates a **new asset** alongside, named "*(edited)*" |

**After "Apply", the chain is empty and `⌘Z` no longer walks back up it.** That is deliberate, and
it is the price of the button: the file now **holds** your settings, and replaying them over it
would lay them down a second time — a fade twice as long, a gain twice as strong. The waveform
that comes back is the one of the rewritten file.

> **When in doubt, take "Save as new".** You keep the original, and you can always delete the copy
> if it does not work out.

---

## The edit

The bottom strip holds the **same edit as the Video workspace**, with one difference: there is
**no picture track**. A fresh audio tab opens on **four empty sound tracks**, `A1` to `A4`.

This is what makes Audio a montage workspace rather than a plain take editor: music is built by
laying sounds side by side.

**The gestures are exactly those of the previous chapter** — dragging a take in from the shelf,
trimming a clip by its edges, the blade, the fades, the gain, the inspector, the track headers
with their mute, solo and lock. All of it is described in
[Video workspace](10-video-workspace.md), and none of it changes here.

The panel's bar carries one extra button, **Add an audio track** — one where Video has two: there
is no picture track to add.

One difference only with Video, and it comes from a sound edit having no picture: **the upper
monitor draws a waveform** — every track put together, as it will be exported. The whole edit fits
its width, from start to finish: this is a view you read at a glance, not one you scroll.

- **Click inside it to move the playhead.** That is not a change: nothing enters the history.
- **The transport sits under that monitor**: play/pause, rewind to the start, and the timecode.
  `Space` plays and pauses, as it does everywhere. The bottom strip's title bar carries the same
  buttons, and they drive the same playback.

> **Two players, never at once.** The lower monitor plays the **tool chain** applied to the open
> take; the upper one plays the **clips laid on the tracks**. Starting one stops the other: the
> studio has a single player.

---

## Undo and redo

`⌘Z` / `Ctrl+Z` undoes the last step of the chain. `⇧⌘Z` redoes it.

**One key for both halves, and it always takes the chain first.** As long as the tool chain has
anything to give back, `⌘Z` undoes it; only once the chain is back to the bare take does the key
address the edit. To undo an edit gesture you therefore have to have unwound the whole chain — or
never to have applied any.

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

The detail is in [What does not exist yet](18-limits.md).

> **Two different gestures, and they are worth telling apart.** `⌘S` saves the **document** —
> your cuts, your fades, your settings, **and the edit in the bottom strip** — into an `.aud` file
> in the project, which reopens just as it was. One key for both halves: an edit built over a take
> you never touched is work, and it is saved as such. **Apply** and **Save as new** write an **audio asset**, a sound usable elsewhere, with
> the settings baked in.
>
> In other words: `⌘S` keeps your work editable, Apply gets the result out. One thing does not
> come back from a reopened document: the A/B listening, which always restarts on the chain.

---

[← Video workspace](10-video-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Textures workspace →](12-textures-workspace.md)
