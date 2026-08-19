# 11. Audio workspace

[← Video workspace](10-video-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Textures workspace →](12-textures-workspace.md)

The workspace where you shape a sound — shorten it, bring it up gently, even out its volume — and
then lay it beside the others.

---

## How this workspace is laid out

As in Video, the **bottom strip belongs to the edit**. The left column holds Models, Generate and
the **asset shelf**, as it does everywhere else: a take is therefore dragged from the shelf to the
edit without switching panels. The upper half of the right column is empty in this workspace; only
the Inspector holds it, below the separator.

In the middle, **two stacked monitors** — where Video puts its own side by side. They take the
full width, one under the other:

| Monitor | What it shows |
|---|---|
| **The edit**, on top | every track put together, from start to finish |
| **The take**, below | the sound you are editing, with its tools |

A **handle** separates them: drag it to give one or the other more room. Under each, a line says
which of the two you are looking at.

**All three surfaces carry graduations, at the same height** — the edit monitor, the take monitor
and the bottom strip. They do not count the same thing, and that is deliberate:

| Surface | What its ruler counts |
|---|---|
| The edit, on top | the **edit's time**, in frames — the very ruler of the bottom strip |
| The take, below | the **take's duration**, in minutes and seconds |

A take has no frame grid of its own: it is a sound, not a run of frames. That is why its ruler
counts duration where the other two count frames.

> **An audio tab holds two halves, and they are saved together.** Below, the **one-take editor**:
> the waveform and its tools. On top and in the bottom strip, the **edit**, where takes are laid
> side by side — described [further down](#the-edit). One tab, one `⌘S`, one file.

---

## Opening a sound

**Three gestures, and they do not lead to the same place:**

| Gesture | Where the take lands |
|---|---|
| **Double-click** an audio asset in the shelf | in **a tab of its own**, opened for it |
| **Drop** the take on the lower monitor | in the tab **you have in front of you** |
| **Right-click ▸ Open in the audio editor** | the same |

**Double-click never looks at the tab in front of you.** That is the studio-wide rule, described
in [Assets](07-assets.md): it opens the asset in the workspace of its type, whatever is on screen.
It therefore needs no tab beforehand — and **reopening the same take returns to its tab**, no
second one is born.

**The `+` button on the left rail** opens an empty audio tab. It is not a prerequisite for the
double-click: it is there for when you want the edit before you have a take to lay on it.

While no clip is selected, the lower monitor shows: "Select a clip from the edit to work on it
here, or drop a take."

> **This gesture is what decides whether your takes end up together.** Two double-clicks on two
> different sounds open **two tabs**, each with an edit of its own. To assemble them side by side
> they have to enter the **same** tab: drop on the lower monitor, or right-click.

### The edit leads, the editor follows

This is the rule that explains the rest of the chapter, and it fits in one sentence: **the editor
below shows the clip the edit has selected.** Exactly as the Source monitor of the
[Video workspace](10-video-workspace.md) shows the clip you picked.

**A take you open is therefore laid on the edit, then selected** — at the playhead, on a sound
track the studio picks. That is what brings it into the editor: it does not go there directly, it
arrives because it has just been selected.

**Click another clip in the bottom strip and that is what the editor shows.** No opening gesture
is needed; selecting is enough.

### Every clip keeps its own settings

**Takes accumulate, they do not replace one another.** Open a second one: it lands beside the
first, selected, and **the first stays on the edit with everything you did to it**. Crop, fades,
normalising — the tool chain belongs to the **clip**, not to the tab. Come back to it by selecting
it, and you find its state again.

This is what ties the two halves together: the clip in the bottom strip **is** the take in the
lower monitor, and it follows what you do to it — a crop shortens it, a fade shows on its edges,
normalising changes its gain. Two things stay its own, because they belong to the edit rather than
to the take: **where it starts** and **how fast it runs**.

**And the editor only ever works on the clip's own slice.** If you shortened a clip by dragging its
edge on the strip, the tools act on what is left, never on the whole file.

> **Reopening the take already under the editor does nothing**, and that is deliberate: a second
> clip on the same sound would leave the first one's chain with nothing to call it back.

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

**The editor's bar always says where you stand**: both bounds of the selection when there is one,
and "Drag across the waveform to select" when there is not. An area nobody knows how to draw is not
explained by a sentence that only appears once a pointer rests on a tool.

**Playback itself ignores the selection**: it plays the whole take from where the cursor stands,
and does not loop back over the area. To judge a passage, put the cursor before it.

Without a selection, the tools that need one work on default values — a one-second fade, for
example.

---

## The tools

| Tool | What it does |
|---|---|
| **Crop** | brings the clip down to the selection, on the edit |
| **Fade in** | brings the sound up from silence, over the selection |
| **Fade out** | brings the sound down to silence, over the selection |
| **Normalise** | brings the overall level to −14 LUFS |
| **Trim silence** | pulls the clip in to what is not silence, at both ends |
| **A/B** | plays the original source, without undoing anything |

### What "normalise" means

Making the sound **neither too quiet nor too loud**, at a standard level.

**−14 LUFS** is the target adopted by most streaming platforms — YouTube, Spotify, and the rest. A
sound normalised to that value will play at roughly the same volume as whatever surrounds it,
instead of making people jump or reach for the volume knob.

"LUFS" is the unit of **perceived** loudness, the one that accounts for how the human ear hears —
far more useful than simply hunting for the loudest peak.

> **The studio computes an approximation of it, and it is worth knowing.** The standard measure
> (ITU-R BS.1770) applies a weighting filter and gates silent passages out; the studio settles for
> a **root mean square** across the whole take. On a **generated** sound — one texture, no
> dialogue, no silence to gate out — the two land very close together. On a voice recording with
> gaps they drift apart: **do not compare this figure with a professional LUFS meter's.**

### What the A/B button is for

**Hearing what you changed.**

One click, and the studio plays the original sound, as it was before your edits. A second click,
and it plays your version again. Nothing is undone: this is a comparison, not a step back.

It is the most useful gesture in the whole workspace. We often believe we have improved a sound,
and A/B tells the truth in three seconds.

---

## Nothing is written until you say so

This is the important point of this workspace.

Your tools **do not write into the file**. They stack a list of instructions — "one-second fade",
"normalise" — which is replayed over the original sound every time.

Two very practical consequences:

- **undoing costs nothing**, however many steps there are;
- **A/B is instant**, because the source is always there, intact.

**Crop** and **Trim silence** are the exception, and for a good reason: they do not change the
sound, they change **the clip's bounds** on the edit — exactly as if you had dragged its edge
with the mouse. Nothing is written into the file there either.

> **`⌘Z` undoes them, but not necessarily first.** These are **edit** gestures, and the key always
> walks back up the **tools** first: after a fade and then a crop, the first press undoes the
> fade, not the crop. Nothing is lost, the order surprises — the full rule is
> [further down](#undo-and-redo).

Only when you explicitly ask is a file written:

| Button | What it does |
|---|---|
| **Apply** | creates a **new asset** holding the slice as you hear it, and **the clip on the edit now points at it**. The original is never touched |
| **Save as new** | creates the same asset, but **leaves the edit where it is**. Take this when you want the edited version on the shelf without changing what the edit plays |

Both name the new asset "*(edited)*".

**After "Apply", this clip's chain is empty and `⌘Z` no longer walks back up it.** That is
deliberate, and it is the price of the button: the new file now **holds** your settings, and
replaying them over it would lay them down a second time — a fade twice as long, a gain twice as
strong. The waveform that comes back is the one of that new file.

> **The whole editor's history goes, not just that clip's.** The other clips keep their chains —
> their fades and levels are untouched — but no step undoes with `⌘Z` any more, on any of them. The
> history is the document's, and it cannot rewind for one block alone.
>
> **What `⌘Z` still undoes is the edit itself**: the clip repointed at the new asset, a crop made
> earlier. The sound written to disk stays, and the chain that produced it does not come back. In
> other words, stepping back after "Apply" gives you the clip you had, not the settings you had.

> **One sound can serve several clips**, here and in other tabs. That is why "Apply" writes
> alongside rather than over: rewriting the original would move every one of those clips at
> once, without saying so.

---

## The edit

The bottom strip holds the **same edit as the Video workspace**, with one difference: there is
**no picture track**. A fresh audio tab opens on **four empty sound tracks**, `A1` to `A4`.

This is what makes Audio an editing workspace rather than a plain take editor: music is built by
laying sounds side by side.

**The gestures are exactly those of the previous chapter** — dragging a take in from the shelf,
trimming a clip by its edges, the blade, the fades, the gain, the inspector, the track headers
with their mute, solo and lock. All of it is described in
[Video workspace](10-video-workspace.md), and none of it changes here — bar one thing, and it
shows: **the little link never appears on any clip.** There is no picture track, so no pair to
form, so nothing to report.

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

**File › Export › Edit (OTIO)…** writes that edit into a file other editing applications open:
tracks, clips, in points, speeds and links to the sounds. It is the same edit the Video workspace
holds, so it is the same command.

> **The tool chain is not in it, and that is not a loss of the export.** The upper monitor does
> not hear it either: it belongs to the take open below, and it becomes real when you **Apply**.
> An exported edit is worth exactly what the Program plays.

---

## Undo and redo

`⌘Z` / `Ctrl+Z` undoes the last step of the chain. `⇧⌘Z` redoes it.

**One key for both halves, and it always takes the tools first.** As long as one tool step is left
to undo, `⌘Z` undoes it; only once none is left does the key address the edit. To undo an edit
gesture you therefore have to have unwound every tool step — or never to have applied any.

> **The history is the TAB's, not the displayed clip's.** Chains belong to each clip, but their
> steps are stacked together: `⌘Z` undoes the last one you laid down, **even if that was on a clip
> other than the one under the editor**. The selection does not follow — it is up to you to look
> at what moved.

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
> your cuts, your fades, your settings, **and the edit in the bottom strip** — into an `.otio` file
> in the project, which reopens just as it was. One key for both halves: an edit built over a take
> you never touched is work, and it is saved as such. **Apply** and **Save as new** write an **audio asset**, a sound usable elsewhere, with
> the settings baked in.
>
> In other words: `⌘S` keeps your work editable, Apply gets the result out. One thing does not
> come back from a reopened document: the A/B listening, which always restarts on the chain.

---

[← Video workspace](10-video-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Textures workspace →](12-textures-workspace.md)
