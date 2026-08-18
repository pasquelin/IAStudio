# 10. Video workspace

[← Modelling workspace](09-modelling-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Audio workspace →](11-audio-workspace.md)

The workspace where you assemble shots one after another into a sequence.

---

## How this workspace is laid out

Like the Audio workspace, this is one where the **bottom strip belongs to the edit**. A sequence
reads across the full width of the screen: the **Timeline** therefore takes all of it. The asset
shelf stays where it is everywhere else — upper half of the **left column** — and so holds the
screen at the same time as the edit, which is what dragging a take onto a track needs.

The upper half of the right column is **empty** in this workspace: Video declares no panel there.
Only the **Inspector**, below the separator, holds it.

In the centre, two monitors side by side — the Premiere and DaVinci convention:

| Monitor | What it shows |
|---|---|
| **Source**, on the left | the selected clip, on its own |
| **Program**, on the right | the edit as it will be |

When no clip is selected, the Source monitor shows "Select a clip to see it here." When the **picture**
clip under the playhead cannot be decoded, [the other message](#when-a-clip-cannot-be-shown) takes
its place; a sound clip whose media is missing stays black and silent, announcing nothing.

---

## The vocabulary of editing

| Word | What it is |
|---|---|
| **Sequence** | the whole edit, with its tracks |
| **Track** | a horizontal line that holds clips. There are picture tracks and sound tracks |
| **Clip** | a piece of media placed on a track |
| **Playhead** | the vertical line showing where you are |
| **Trim** | to shorten **or lengthen** a clip from one of its ends |
| **Handle** | the vertical bar at each end of a clip, the one you grab to trim it |
| **In point** | the place in the original file where the clip starts |

---

## Placing a first clip

Three gestures, and **they do not put the clip in the same place**:

| Gesture | On which track | At what time |
|---|---|---|
| **Drag and drop** from the shelf | the one you are hovering, **if it can take it** | where you release |
| **Drag and drop** into the empty space below the last track | a **new** track, opened for it | where you release |
| **Double-click** the asset | the studio chooses | at the **playhead** |

**Drag and drop obeys you to the pixel for the TIME; for the track, it corrects you.** You release
exactly where you mean to in time. But **aiming at a track that cannot take the clip does not put
it there**: a picture track for a sound, a locked track, a muted one, or one silenced by another
track's solo. The studio then chooses for you, as double-click does, and the clip lands **somewhere
other than under the pointer**.

That is one rule rather than two: a muted track accepted under the pointer and avoided everywhere
else would answer the same question twice. But **nothing on screen says so**, and it is the one
place in the edit where the gesture does not do what it shows.

**Releasing below the last track opens the tracks it needs** rather than doing nothing: a picture
track, and the sound track beside it for a take that carries sound. Both arrive in one gesture,
and **⌘Z takes them back in one** — the clips and the tracks.

Two places still take nothing: the **time ruler** at the top, and an edit with no picture track
at all — the one in the Audio workspace — where releasing a rush only opens the asset, since
there is no monitor there to show it.

**Double-click chooses for you**, and it chooses well: a sound goes on a sound track, everything
else on a picture track, and **any track that does not reach the output is avoided** — a clip
landing there would look like it did nothing. That covers **locked** and **muted** tracks, and also
those silenced by **another track's solo**: a track nothing sets apart to the eye, and on which
double-click will nonetheless lay nothing.

Whichever way, the studio settles two things:

- **the duration** — that of the media. A still image, or a medium whose duration is unknown,
  lasts **5 seconds** by default. That is only a starting point: how long an image stays on
  screen is decided by pulling either of its ends, see below;
- **the alignment** — on a whole frame, never between two. You can aim to the pixel; the clip
  files itself onto the nearest frame.

---

## The tools

| Tool | Shortcut | What it does |
|---|---|---|
| **Selection** | `V` | selects, moves, trims and lengthens clips |
| **Blade** | `C` | cuts a clip where you click |
| **Hand** | `H` | scrolls the timeline — wheel to zoom |

> **These three keys are not active yet**: they appear in the tooltips, but nothing listens for
> them. A tool is picked with the mouse. The keys in service in the edit — `Space`, `S`,
> `Delete`, the zooms — are in [Every shortcut](15-shortcuts.md).

### With the Selection tool

| Gesture | Effect |
|---|---|
| **Click** a clip | selects it — the inspector shows it |
| **Drag** the clip's body | moves it, including from one track to another |
| **Drag** a clip's edge | trims or lengthens it on that side |

**Each end of a clip carries a handle**, a vertical bar, and the cursor there becomes a double
arrow: that is the sign the edge can be grabbed. On a clip too narrow to hold them the handles
disappear and the middle stays with the drag — otherwise a thin clip could not be moved at all.
**Only the Selection tool shows that double arrow**: the **Hand** takes the whole surface to
scroll and the **Blade** cuts where you click — neither trims, so neither promises it.

**A lengthened clip grows over its neighbour** rather than stopping at it, the way DaVinci and
Premiere do it: lengthening a shot means asking the next one to give way. `⌘Z` puts the whole
track back as it was.

**Snapping is automatic.** A moved clip sticks:

- to the **frame grid** — never between two frames;
- to the **edges of neighbouring clips**, so there is no thousandth-of-a-second gap invisible to the
  eye.

> **A video or a sound** cannot exceed the length of the original media. The studio stops the trim
> itself rather than showing black.
>
> **A still image has no media to exceed**: both of its ends lengthen it as far as you like, and
> the only bound is the start of the sequence. That is how you decide how long a title card stays
> on screen.

### Linked clips, and the little link that says so

**A video carrying sound arrives as TWO clips**: the picture on a picture track, the sound on a
sound track facing it. They are **linked**.

**A small link, at the right end of each clip, tells you which case you are in:**

| What you see | What it means |
|---|---|
| a **chain** | this clip is linked to another |
| a **broken chain** | this clip stands alone |

The link **disappears on a clip too narrow** to hold it — that is room running out, not the link
changing. And **it is not a button**: clicking it unlinks nothing, it only informs you.

**While two clips are linked, what you do to one happens to the other** — moving it, cutting it
with the blade, deleting it.

> **And it is all or nothing.** If either half cannot follow — its track is locked, the cut falls
> outside it — **the other does not move either**. Lock `A1`, drag the picture on `V1`: nothing
> happens. That is deliberate — a half-moved pair is exactly what a link exists to prevent.

**`⌘L` separates them.** Each becomes an ordinary clip again, and its link turns to the broken
chain.

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
| `F` | open the **return window**, for a second screen |
| `Del` | delete the selected clip |
| `⌘Z` / `⇧⌘Z` | undo / redo |

> **The Blade tool and `S` do not do the same thing.** The **Blade** is picked with the mouse —
> its key is not listened for, see above — and you then cut wherever you click. `S` **cuts
> straight away**, at the playhead, without switching tool.

**Only one player is active at a time.** If you open two sequences, only the one in front answers
the space bar. That is what keeps playback smooth: two video decoders running at once fight over
the machine.

---

## The return window — watching on a second screen

**`F`**, or the **Return window** button under the **Program** monitor. A window opens holding
nothing but the picture of the edit: no timeline, no tools, no bar. Put it on a second screen, and
you watch your edit while you cut it.

It is the gesture one makes while **watching** rather than editing, which is why the key is bare —
no `⌘`, no `⇧`.

### What it shows, and what it does not

**The Program, always.** The whole edit, as it will be exported. Never the **Source**: the key
belongs to the monitor that holds playback, and that is the edit's own.

**It is MUTE, and that is not an oversight.** The studio is already playing the sound of this very
edit. Two outputs on one machine drift a few milliseconds apart and **sound like an echo** — what
you watch on the second screen is the picture; what you listen to stays where the work is.

### It follows, playback included

Everything you do to the edit shows there: a cut, a clip moved, a fade. When you move the playhead,
it moves with you, **frame by frame**.

**And when you play, it plays.** It is not handed the frames one by one — it runs its own playback,
from the point you are at. That is what stops it trailing a step behind the picture it is meant to
mirror.

### One window, never two

**A second press of `F` does not open a second window.** There is only one, and it shows **the edit
in front of you**. Switch to another sequence tab and ask for the return again, and **the same
window turns towards it** — not a third one stacking up on the desk.

### On opening, and on closing

**You have nothing to do to fill it.** It asks for the edit's state as soon as it opens, even when
the edit was opened long before it.

While no edit is in front, it shows:

> *Waiting for the studio. Open an edit to see it here.*

**And it goes back to that if you close the edit's tab**, rather than freezing on the last frame of
work that is no longer open.

It closes like any other window. Nothing under way stops when it goes.

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

### Adding one

**Two buttons, on the Timeline panel's bar** — at the top, beside the tools: **Add a video track**
and **Add an audio track**. The track arrives empty, **at the foot of the column**.

They are at the top rather than under the column for a practical reason: the foot of the column
travels down with the edit, and a button sitting there ends up behind whatever you are looking at.

**A third gesture makes tracks too**: releasing an asset in the empty space below the last track
opens the tracks it needs and lays the clip on them — [described above](#placing-a-first-clip).
The buttons are for when you want the track **before** you have anything to put on it.

> **The Audio workspace has only one**, for sound tracks: there is no picture to show there. See
> [Audio workspace](11-audio-workspace.md).

### Moving them through the stack

**The order of the tracks decides what you see.** Several picture tracks may carry a clip at the
same instant; the one **highest in the column** is the one shown, and it covers the others — V1
comes in front of V2, as in every editing suite. Moving a track therefore changes the picture in
the monitor, the moment you release it.

**The order matters for double-click too**: the studio then lays the asset on the **first track of
the right kind that reaches the output**, counting from the top. Moving a track up therefore makes
it the default destination. Every header carries a **grip** on its left edge.

- **Drag it** up or down. The row you are holding **dims** for the length of the gesture: it is
  the only thing that says a move is under way, the stack renumbering a rank at a time. A drag
  across three ranks stays **one gesture** — `⌘Z` undoes it in one, not rank by rank.
- **From the keyboard**: the grip is a button. Give it the focus, then `↑` and `↓`.

**Nothing moves at either end.** The first track does not rise, the last does not fall, and trying
leaves no step to undo.

### Removing one

**Right-click the header**, or the row's **Track actions** button — a right-click not being a
keyboard gesture, that button is what makes these three rows reachable without a mouse. The menu
holds three:

| Row | Effect |
|---|---|
| **Move track up** | swaps it with the one above. Greyed out on the first |
| **Move track down** | swaps it with the one below. Greyed out on the last |
| **Remove track** | takes it away **with every clip it carries** |

> **A locked track cannot be removed, and the menu does not say so**: the row stays clickable, and
> the click does nothing. The lock covers the track itself, not only its clips — unlock it first.

As with everything else, removal is undone with `⌘Z`, and the track comes back **at its rank**,
with everything it carried.

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
| **Fade in** | a rise from black, at the start — heard on a sound clip, only drawn on a picture one |
| **Fade out** | a fall to black, at the end — the same split |
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

## The sound of the edit

**The Program monitor plays the audio tracks during playback.** Press play: every clip laid on a
sound track is heard in its place, at its gain, with its fades and at its speed, and a track muted
or left out of a solo goes quiet at once — without waiting for the clip in progress to end.

Four things worth knowing, because they show:

- **Sound only comes out during playback.** Dragging the playhead by hand plays nothing: it is the
  picture that follows the cursor, not the sound.
- **The Source monitor plays the selected clip**, sound included when it is one — but it then
  shows no picture, a sound having none. Its playhead does not move back on its own: coming from
  a longer clip, it may land past the end of the new one, which then stays silent.
- **A video's own sound is not played yet**: only sound tracks are. A video laid on a picture track
  is seen without being heard.
- **The first sound may take a moment to arrive**: the file is decoded whole before it plays. A
  clip whose start went by in the meantime does not catch up, it is skipped — otherwise the sound
  would stay behind the picture for the rest of the clip.

---

## When a clip cannot be shown

The monitor then shows this in place of the picture:

> This clip could not be shown: its media is missing, or its format cannot be read here.

Three picture formats import without ever showing in a monitor — **`.exr`, `.tif` and `.tiff`**.
They do enter the project and they do drop onto a track, but the studio's picture decoder does
not open them. A truncated or damaged video file gives the same message.

**The studio converts nothing.** The message says what is happening; it does not replace your
file. To edit an `.exr` or a `.tif`, convert it to `.png` yourself before importing it.

> **The message only shows when the monitor has nothing else to show.** An unreadable clip laid
> **over** a track that does display leaves that one visible and simply goes missing: covering a
> perfectly good picture to flag another one would cost more than it gives.

---

## What is still missing

> **A sequence saves** as `.seq` with `⌘S`, and opens back as it was: tracks, clips, fades and
> gains. What does not come back is the undo history.
>
> **Two exports exist**, both on the File menu. *Export video* writes a final file, frame by
> frame, 3D scenes included — but **without the sound**, which is not in it yet. *Export edit
> (OTIO)* writes the edit itself: tracks, clips, in points, speeds and links to the media, in a
> file other editing applications open. See [What does not exist yet](18-limits.md).

---

[← Modelling workspace](09-modelling-workspace.md) · [Contents](../user-guide.md) · [Next chapter: Audio workspace →](11-audio-workspace.md)
