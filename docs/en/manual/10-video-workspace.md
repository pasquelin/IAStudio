# 10. Video workspace

[← 3D workspace](09-3d-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Audio workspace →](11-audio-workspace.md)

The workspace where you assemble shots one after another into a sequence.

---

## How this workspace is laid out

Like the Audio workspace, this is one where the **bottom strip belongs to the edit**. A sequence
reads across the full width of the screen: the **Timeline** therefore takes all of it, and the
asset shelf moves into the upper half of the right column, so it stays visible at the same time.

In the centre, two monitors side by side — the Premiere and DaVinci convention:

| Monitor | What it shows |
|---|---|
| **Source**, on the left | the selected clip, on its own |
| **Program**, on the right | the edit as it will be |

When no clip is selected, the Source monitor shows "Select a clip to see it here."

---

## The vocabulary of editing

| Word | What it is |
|---|---|
| **Sequence** | the whole edit, with its tracks |
| **Track** | a horizontal line that holds clips. There are picture tracks and sound tracks |
| **Clip** | a piece of media placed on a track |
| **Playhead** | the vertical line showing where you are |
| **Trim** | to shorten a clip from one of its ends |
| **In point** | the place in the original file where the clip starts |

---

## Placing a first clip

Two gestures, and **they do not put the clip in the same place**:

| Gesture | On which track | At what time |
|---|---|---|
| **Drag and drop** from the shelf | the one you are hovering, **exactly** | where you release |
| **Double-click** the asset | the studio chooses | at the **playhead** |

**Drag and drop obeys you to the pixel.** You aim at the track, so you decide — including
deciding on a track where the clip will not be heard. Releasing on the **time ruler** at the top,
or outside any track, **does nothing**: there is no track under the pointer.

**Double-click chooses for you**, and it chooses well: a sound goes on a sound track, everything
else on a picture track, and **locked** or **muted** tracks are avoided — a clip landing there
would look like it did nothing.

Either way, the studio settles two things:

- **the duration** — that of the media. A still image, or a medium whose duration is unknown,
  lasts **5 seconds** by default;
- **the alignment** — on a whole frame, never between two. You can aim to the pixel; the clip
  files itself onto the nearest frame.

---

## The tools

| Tool | Shortcut | What it does |
|---|---|---|
| **Select** | `V` | selects, moves and trims clips |
| **Blade** | `C` | cuts a clip where you click |
| **Hand** | `H` | scrolls the timeline — wheel to zoom |

### With the Select tool

| Gesture | Effect |
|---|---|
| **Click** a clip | selects it — the inspector shows it |
| **Drag** the clip's body | moves it, including from one track to another |
| **Drag** a clip's edge | trims it on that side |

**Snapping is automatic.** A moved clip sticks:

- to the **frame grid** — never between two frames;
- to the **edges of neighbouring clips**, so there is no thousandth-of-a-second gap invisible to the
  eye.

> A trimmed clip cannot exceed the length of the original media. The studio stops the trim itself
> rather than showing black.

---

## Transport — playing and pausing

Below each monitor:

| Button | Shortcut | Effect |
|---|---|---|
| **Play** / **Pause** | `Space` | starts or stops playback |
| **Back to start** | `Home` | brings the playhead to the very beginning |

| Shortcut | Effect |
|---|---|
| `Space` | play / pause |
| `Home` | go to the start |
| `End` | go to the end |
| `⌘=` / `Ctrl+=` | zoom into the timeline |
| `⌘−` / `Ctrl+−` | zoom out |
| `⇧Z` | fit — the whole edit fits on screen |
| `S` | **cut the clip at the playhead** |
| `Del` | delete the selected clip |
| `⌘Z` / `⇧⌘Z` | undo / redo |

> **`C` and `S` do not do the same thing.** `C` **arms the Blade tool** — you then cut wherever you
> click. `S` **cuts straight away**, at the playhead, without switching tool.

**Only one player is active at a time.** If you open two sequences, only the one in front answers
the space bar. That is what keeps playback smooth: two video decoders running at once fight over
the machine.

---

## Tracks

The left column of the timeline, facing each line.

| Control | Effect |
|---|---|
| **Double-click the name** | renames the track |
| **Mute** | the track is no longer heard |
| **Solo** | **only** soloed tracks are heard |
| **Lock** | the track refuses any change |
| **Drag the bottom of the header** | changes the line's height |

**Solo beats mute.** As soon as one track goes solo, every track that is not falls silent, muted or
not. That is the convention in every editing application.

---

## A clip's inspector

Select a clip and look at the **Inspector**, in the right column.

| Field | What it does |
|---|---|
| **Source** | which asset the clip comes from |
| **Start** | where the clip starts in the sequence |
| **End** | where it finishes |
| **Duration** | its length |
| **In point** | where in the original file it starts |
| **Fade in** | a rise from black or silence, at the start |
| **Fade out** | a fall to black or silence, at the end |
| **Speed** | 1 = normal, 0.5 = half speed, 2 = double speed |
| **Gain** | the volume, in decibels. 0 leaves the sound as recorded |

### A track's inspector

| Field | What it does |
|---|---|
| **Name** | the displayed name |
| **Type** | picture or sound |
| **Clips** | how many it holds |
| **State** | Muted, Solo, Locked |
| **Height** | the line's height |

<!-- SCREENSHOT: the Video workspace, timeline with several clips and the two monitors above.
     Save to ../../images/timeline.png -->

---

## A sequence's settings

A new sequence starts on:

| Setting | Value |
|---|---|
| **Dimensions** | 1920 × 1080 |
| **Frames per second** | 25 |
| **Audio sample rate** | 48,000 Hz |

Time is counted in **microseconds** internally, never in decimal seconds: on a long edit, rounding
would end up drifting the picture away from the sound.

---

## Why playback is smooth

When you import a video, the studio makes a **lightweight copy** of it — a *proxy*. That is what is
played while you edit, which is what lets you scrub through a heavy rush without stuttering.

If ffmpeg is missing there is no proxy, and moving through large files becomes laborious. See
[Assets](07-assets.md#if-video-preparation-is-unavailable).

**At rest, the monitor draws nothing.** A still frame repainted sixty times a second costs as much
as playback — for nothing. The monitor stops as soon as playback stops, which shows most on a
laptop: the fan goes quiet, the battery lasts.

---

## What is still missing

> **A sequence does not save to disk yet.** Closing its tab loses the edit. The assets themselves
> stay in the project.
>
> There is no **export** either: you cannot yet write a final video file. See
> [What does not exist yet](18-limits.md).

---

[← 3D workspace](09-3d-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Audio workspace →](11-audio-workspace.md)
