# 16. When something goes wrong

[← Every shortcut](15-shortcuts.md) · [Contents](../user-guide.md) · [Next chapter: Glossary →](17-glossary.md)

Every message the studio can show, what it means, and what to do.

---

## The first place to look: the journal

Bottom right, next to the generations, an icon opens the **activity journal**. It keeps what the
studio has done and what it has failed to do, even while you were looking elsewhere.

When something did not go as expected, that is where to go **before** looking any further: it
names the object involved and says what failed.

| What the journal can report | Topic |
|---|---|
| "Generation \"…\" failed", "Generation \"…\" cancelled", "2 assets generated in Image, 3D" | Generation |
| "Could not import \"…\"", "\"…\" is unreadable" | Import |
| "Could not send \"…\"", "The tags of \"…\" did not reach the library", "The Scenario API refused a request" | Library |
| "Saving the document failed", "A layer could not be loaded", "Exporting the scene failed", "The file could not be shown" | Document |

Filter by **level** — information, warning, failure — or by **topic**, and **Show everything**
releases the filters.

The panel closes three ways: a click beside it, `Escape`, or switching to another application.
Clicking the icon again works too. The same holds for the generations bar to its left.

> **A successful generation says which shelf it landed in.** That matters most for **Apps**: an
> App produces what it produces, whichever workspace you launched it from — a pipeline started
> from 3D can drop a picture in the Image shelf.

**A failure also raises a toast** in the corner, which does not fade on its own. If you missed
it, the red counter in the status line holds it until you open the journal.

---

## First: most messages are not errors

The studio writes a lot of sentences in empty panels. **These are not failures**: they are panels
telling you what they are missing in order to fill up.

| What you read | What it means |
|---|---|
| "No project open" | you need to create or open a project (`⌘N` / `⌘O`) |
| "No document open. Generate or open an asset to get started." | the centre of the window is waiting for a first tab |
| "No asset yet. Generate something to get started." | the project's shelf is still empty |
| "No job running." | nothing is working right now — the generations list is empty |
| "Open a project to generate." | the form is waiting for a project to drop the result into |
| "Open a project to see its assets." | the same, for the shelf |
| "Open a scene to see what is in it." | the explorer is waiting for a 3D scene |
| "The explorer follows a 3D scene. Open the 3D workspace to see its contents." | you are in another workspace; this panel only serves 3D |
| "No model chosen" / "Pick one from the list" | the Generation panel is waiting for a model to be selected |
| "This model takes no parameters." | that is normal: some models take only a prompt |
| "No result for this filter." | your search finds nothing; widen it |
| "No setting matches this search." | the same, in the settings window |
| "No action uses this key: it is free." | you can assign a shortcut to it |
| "This document is no longer open." | the tab was closed in the meantime |
| "No model in this workspace." | the catalogue is there, but no model matches this workspace |
| "Open an image to see its layers." | the Layers panel is waiting for an image document |
| "No mesh yet. Add one to get started." | the 3D scene is empty — the **+** button places one |
| "Open a scene to see its meshes." | the Meshes panel is waiting for a 3D scene |
| "No light. The scene will stay black." | you need at least one light to see anything |
| "Open a scene to see its lights." | the same, for the Lights panel |
| "Open a scene to inspect what is in it." | the Inspector is waiting for a 3D scene |
| "Select an object to see its properties." | the scene is there, nothing is selected |
| "Select something to see its properties." | the same thing, outside 3D |
| "Select a clip to see it here." | the Source monitor is waiting for a selection |
| "No sequence open. Create one to start editing." | the timeline is waiting for a sequence document — the **+** button |
| "Open a skybox to grade it." | the Skybox panel is waiting for a sky document |

None of these sentences calls for troubleshooting. The rest of the chapter is about real failures.

---

## Connection messages

They appear in red under the fields of the **Account** section of settings, or in the **Models**
panel when it cannot show anything.

### "No credentials saved."

**What it means.** No account is stored, or the one that was has been removed.

**What to do.** Settings (`⌘,`) → **Account** → give it a name, paste your key and secret →
**Add an account**. They are taken from [app.scenario.com](https://app.scenario.com).

### "The keychain did not give your accounts back. Try again once it is unlocked — nothing was changed."

**What it means.** Your system's vault is locked, and the studio could not read your account list
back.

**The end of that sentence is what matters most.** The studio **refused to write** rather than write
halfway: unable to read the existing list, saving an account would have replaced it with that one
alone. Your other accounts are intact.

**What to do.** Unlock your keychain — on macOS, open "Keychain Access" and authenticate; on Linux,
unlock the desktop keyring — then start again.

### "Enter your API credentials to see your models."

The same thing, said by the **Models** panel. The catalogue comes from the service: with no account
connected, there is nothing to list.

### "Invalid API key or secret."

**What it means.** The service replied that this pair means nothing to it.

**What to do, in order:**

1. **check there is no space** stuck to the start or the end of what you pasted. This is by far the
   most frequent cause;
2. **check you have not swapped** the key and the secret;
3. **regenerate the pair** at [app.scenario.com](https://app.scenario.com) and paste it again.

> **This message does not fix itself.** The studio **never** retries an invalid key, whatever the
> "Max retries" setting says: retrying would not fix it, it would only delay this message.

### "This API key lacks the required permissions."

**What it means.** The key is valid, but it is not allowed to do what you just asked — or your plan
does not cover it.

**What to do.** Check the key's permissions and your subscription's state at
[app.scenario.com](https://app.scenario.com). A read-only key, for instance, can list models without
being able to launch a generation.

### "Cannot reach Scenario. Check your connection."

**What it means.** The request never arrived. This is not a refusal from the service, it is the
journey that failed.

**What to do:**

1. check you actually have internet;
2. if you are behind a corporate firewall or a VPN, try without;
3. try again: the studio already does so on its own (see below), but a long outage exhausts its
   attempts.

### "The Scenario service is temporarily unavailable."

**What it means.** The service answered, but only to say it has a problem of its own. This does not
come from you.

**What to do.** Wait. The studio retries on its own, spacing out its attempts. If it lasts, check
[status.scenario.com](https://status.scenario.com) or Scenario's support.

### "Resource not found."

**What it means.** The studio asked for something specific — a model, an asset — that no longer
exists, or is not available to your account.

**What to do.** The common case is a model withdrawn from the catalogue since you chose it. Refresh
the **Models** panel and take another.

### "An unexpected error occurred."

**What it means.** Something failed in a way the studio could not name.

**What to do.** Try once more. If it happens again, set **Log detail** to "Everything"
(Settings → Advanced), repeat the gesture, and open the **Developer tools** to read what is written.
That is the only situation where that button is of any use.

> **No error message from the service is shown to you as-is.** The studio translates them all into
> one of these sentences. That is not laziness: a raw error message contains the request that
> produced it, therefore the authentication header, therefore **your API key**. It must never reach
> the screen, where it would end up in a screenshot posted to a forum.

---

## When part of the screen breaks down

Two messages that do not come from the service, but from the studio itself. They appear **in
place of** what should have been drawn, with a **Retry** button.

### "This panel ran into an error."

**What it means.** One panel failed to draw. The rest of the window — your documents, your other
panels, your running generations — **carries on working normally**.

**What to do.** Click **Retry**: the panel rebuilds itself. Nine times out of ten it comes back.

**What you do not lose**: nothing. A panel is a view onto data that lives elsewhere.

### "The application ran into an error."

**What it means.** The same thing, one notch up: the whole window could not be drawn.

**What to do.** **Retry** first. If the screen returns to the same state, close the window and
open it again.

> **Neither screen says what failed**, and that is deliberate: the technical detail is in the
> console, and it only serves someone who can act on it. If you want to see it before reporting
> the problem: Settings → Advanced → **Developer tools**.
>
> **What is saved on disk is safe.** A drawing crash touches neither your assets nor documents
> already written.

---

## Generation messages

They appear on the job's line, in the list opened by the generations summary, bottom right of the
window.

### "Too many requests. Retrying…"

**What it means.** You asked for more than the service accepts in a short span of time.

**What the studio does on its own.** It waits, then retries — doubling the wait each time: 1 second,
then 2, then 4, then 8. This is called **exponential backoff**, and it is the right behaviour:
retrying immediately, in a loop, worsens the congestion instead of resolving it.

**What you can do.** If this comes back often, lower **Concurrent generations** in settings. Three is
the starting value; two is plenty to work comfortably.

> **This message has become rare.** The studio now bounds its call **rate**, not just how many
> generations run in parallel: those were two different things, and counting one did not cover
> the other. Seeing it often anyway means another tool is using the same key at the same time.

### "The generation failed."

**What it means.** The service did receive the request, processed it, and returned a failure. This is
neither a network problem nor an account problem.

**The ordinary causes:**

- **a refused parameter** — a dimension this model does not accept, a value outside its bounds;
- **a refused prompt** — the service applies its own content rules;
- **an unusable input image** — too large, too small, in a format the model does not take.

**What to do.** Start again from the form: restore the parameters to their default values (the small
restore button beside each one), and relaunch. If it goes through, reintroduce your values one at a
time to find the one that was blocking.

> **This message is never retried automatically.** A refused request will be refused identically the
> next time: only a change on your part can get it through.

### "Could not save the result to disk."

**What it means.** The generation **succeeded** — the image exists — but the studio could not write
it into your project.

**The ordinary causes:**

- **the disk is full**;
- **the project folder was moved, renamed or deleted** while the job was working;
- **the folder is read-only**, or on a network drive that unmounted;
- **the project is in a synchronised folder** (iCloud, Dropbox, OneDrive) that grabbed the file at
  the wrong moment.

**What to do.** Free up space, check the project folder is still where it was, and relaunch the
generation.

> **A project in a synchronised folder is a source of trouble.** Those services move and rewrite
> files while you work. Prefer a local folder, and back it up some other way.

### Which errors are retried, and which are not

The studio only retries **what another attempt can repair**.

| Message | Retried? |
|---|---|
| Too many requests | **yes** |
| Service unavailable | **yes** |
| Cannot reach Scenario | **yes** |
| Invalid key or secret | no |
| Insufficient permissions | no |
| Resource not found | no |
| The generation failed | no |
| Could not save | no |
| Unexpected error | no |

The number of attempts is adjustable: Settings → **Generation** → **Max retries** (4 by default, 0
to 10).

---

## Import messages

They appear while a file you dropped into the project is being prepared.

### The normal steps

| What you read | What is happening |
|---|---|
| **Waiting…** | the file is queuing |
| **Probing…** | the studio reads its duration, size, format |
| **Fingerprinting…** | it computes its signature, to recognise a duplicate |
| **Proxy…** | it makes the lightweight copy that keeps scrubbing smooth |
| **Waveform…** | it draws the soundtrack |
| **Ready** | it is finished, the file is usable |

The **Stop preparing this file** button halts the work in progress. **Remove from the list** takes
the line away once it is finished.

### "Video preparation unavailable: no lighter copy, no waveform."

**Where it shows.** On an amber warning triangle, on the asset shelf's title bar: hover it, or
reach it with the keyboard. The same state is written out in full, and permanently, in
**Settings ▸ Media**.

**What it means.** No usable ffmpeg was found — not even the one the application carries.

**What still works.** The import itself. Your file is in the project, it plays, it edits.

**What is missing.** Scrubbing the timeline stutters on large files (no lightweight copy), and audio
tracks do not show their waves.

**What to do.** The studio ships its own ffmpeg on all three systems, so this message should not
appear on a normally installed application. If it does anyway:

1. **you ran the studio from its source code** — run `pnpm ffmpeg:fetch`, which downloads the
   missing binaries;
2. **the shipped binary is there but does not start** — it is the one being kept, and a path you
   set in Settings → **Media** → **Path to ffmpeg** does not replace it: that field only matters
   when the shipped binary is absent. Repair or replace that one;
3. **otherwise**, doing without stays perfectly viable on short or light files.

#### The puzzling case: ffmpeg is there, and the studio says it is not

You type `which ffmpeg` in a terminal, it answers a path. The file exists. And the studio keeps
saying video preparation is unavailable.

**This is not a contradiction.** The studio does not merely *find* the program: it **runs** the one
it has kept, with `ffmpeg -version`, and announces video preparation only if it answers. An ffmpeg
installed by Homebrew whose library has gone missing — after a macOS update, or a slightly
over-eager `brew cleanup` — still exists as a file, but no longer starts.

**Mind what "kept" means**: the studio takes the **first candidate present** — shipped, then the
settings one, then the `PATH` — and does not walk back down the list. The `which ffmpeg` you just
typed is therefore only consulted when the other two are missing.

A program you can find but cannot run would be worse than a missing one: the studio would promise
proxies it could not make.

**To check for yourself**, in a terminal:

```bash
ffmpeg -version
```

If that command prints a version number, ffmpeg is fine. If it complains about a missing library,
that is your diagnosis.

**To fix it**, on macOS:

```bash
brew reinstall ffmpeg
```

### "Already in the project"

**What it means.** This file has the same fingerprint as an asset already present. The studio
refuses to keep two copies.

**This is not an error.** Look for it in the **Assets** panel: it is already there.

### "Unreadable file"

**What it means.** The studio cannot open this file.

**The ordinary causes:** a truncated file (interrupted download), an extension that lies about the
content, an exotic format, or a file protected by digital rights.

**What to do.** Open it in another player to check it is sound. If it is, convert it to a common
format (`.mp4`, `.wav`, `.png`).

### "Failed" / "Stopped"

**Failed**: preparation stopped on a problem. **Stopped**: you halted it yourself. In both cases,
the file can be imported again.

### "This asset has nowhere to go"

**What it means.** You double-clicked an asset, and **no open document knows how to receive it**.
It is neither a bug nor a damaged file.

**The cause.** Double-click **never opens a tab**: it sends the asset into a document that is
already open. It looks across every workspace, not only the one you are in — but it needs at
least one destination.

| You double-click… | You need, open somewhere… |
|---|---|
| a picture, to make it a sky | a **sky** document (Skyboxes workspace) |
| a mesh, to set it in a scene | a **3D scene** |
| a sound, to edit it | a **take** (Audio workspace) |
| a picture, to paint on it | an **image** document |
| anything, to cut it into an edit | a **sequence** (Video workspace) |
| a picture, to make it a material | a **material** (Textures workspace) |

**What to do.** Open a document able to receive it — the `+` button on the left rail, in the
workspace you want — then double-click. You do not have to go there first: the studio takes you.

> **Right-click answers the question without trying.** It lists every destination this asset has,
> greying out those whose document is not open. Quicker than guessing.

---

## Dictation messages

### "Dictation needs a recognition model, downloaded once and for all."

Not a fault: it is the first time. The model weighs 640 MB and is never fetched without being
asked. Click, and carry on working while it downloads — it gets in the way of nothing.

### "Microphone access was refused."

You answered no to the system's request, and **macOS never asks again**. The "Open the system
settings" button takes you to the exact place to allow it. The studio then has to be restarted.

### "The downloaded model is damaged; it has been removed."

The file arrived incomplete or corrupted — a dropped connection, a proxy that rewrites, a full
disk. The studio deleted it rather than load a model it does not trust. Start the download again.

### "The model could not be downloaded."

The network gave up. What had arrived is kept: the next attempt **resumes where it stopped**, it
does not start the 640 MB again.

### "Speech recognition stopped."

The engine quit mid-way. It restarts on its own at the next dictation, up to three times; past
that the studio stops trying rather than relaunch a process that dies on every sentence. The
detail is in the journal (**Help ▸ Journal**), not on screen: it names a file path, which helps
nobody in front of the screen and tells everything to whoever reads the journal.

### "No microphone available."

No audio input answered. A USB headset unplugged mid-dictation gives this message: plug it back
in, or let the studio take the built-in microphone.

### The text is written nowhere

Dictation writes **at the caret**, in the field it sits in. If the caret is in no text field,
there is nowhere to write and nothing happens: click into the field first.

### The level does not move when you speak

The microphone is hearing nothing. Check which one your computer is using (System Settings ▸
Sound ▸ Input), and that it is not a muted input — some audio interfaces expose those.

---

## The troubles that show no message

These are the most disconcerting: nothing is written, but something is wrong.

### "I paint and nothing lands"

**Look at the cursor before you drag.** If it is a no-entry sign, the tool is telling you it can
do nothing where it is, and it tells you **before** the gesture.

| What is blocking | How to clear it |
|---|---|
| A **group** is armed in the stack | pick a layer, not the group holding it |
| The active layer is an **adjustment layer** | it has no pixels to paint: take the layer below |
| Its **pixels are locked** | unlock it in the Layers panel |
| Its **position is locked** | same thing, for the Move tool |

If the cursor is normal and nothing appears anyway, it is elsewhere: a **selection** may be drawn
outside the area you are painting — the brush, the eraser and the bucket only act inside it. `⌘D`
drops it.


### "⌘Z does nothing"

**The cause, almost always.** The action you want to undo belongs to **another tab**.

Each document has its own undo stack. `⌘Z` steps back in the **active** tab, not in the last gesture
you made in the studio.

**What to do.** Activate the tab concerned, then undo.

### "The canvas is black after detaching a panel"

**The cause.** A 3D view does not survive being moved from one window to another: the graphics card
takes back its drawing context.

**What to do.** Close the tab and reopen it. The view rebuilds itself from the scene — you lose no
work, only the display.

### "The interface freezes for a few seconds during a search"

**The cause.** A search across a very large catalogue.

**What to do.** Wait; it unblocks. To avoid it, type more letters before launching the search, or
narrow it with the filters.

### "Playback stutters for no reason"

**Two possible causes:**

1. **there is no proxy** — see the ffmpeg message above. This is the most frequent case on a heavy
   video;
2. **the machine is loaded** — a running generation consumes the network, and a 3D scene open in
   another tab consumes the graphics card.

**What to do.** Close the tabs you are not using, and check that ffmpeg is available.

### "The interface animations stutter"

Settings → **Appearance** → tick **Limit animations**. Panels appear at once instead of sliding in,
which is far more pleasant than a jerky slide.

### "I lost my work when I closed a tab"

**This is not supposed to be possible any more.** All document kinds save, and closing a tab
whose work is not written asks first: *Save*, *Don't save*, *Cancel*.

**If no question came up**, the document was clean — no dot (`•`) beside its name. Two known
cases:

- **the document was never saved and never received anything**: there was nothing to keep;
- **its file could not be read when it opened.** The studio then deliberately refuses to save it,
  so as not to write an empty document over the one it could not read — the file is the only
  copy. The reason is in the activity journal.

**What never comes back**, by design: the **undo history**. Reopening a document means starting
again without `⌘Z`. The complete list is in [What does not exist yet](18-limits.md).

### "I deleted a document by mistake"

**Nothing gives it back.** *Delete document…* in a tab's context menu removes the file from the
project folder, and the studio has no wastebasket. That is why the confirmation has *Cancel* as
its default button.

If the project folder is in a system backup (Time Machine, a synced folder), that is where to go
and look for it.

### "The panels are all over the place and I am lost"

Menu **View** → **Reset layout**. The panels take their original places back. **Your work is not
touched** — only the window's arrangement is.

### "The studio does not remember my settings"

**The likely cause.** You closed the settings window without **Apply**, and chose "Don't apply" at
the question asked.

**What to do.** Start again, and finish with **Apply** or **OK**.

### "Nothing happens when I click Generate"

Three checks, in this order:

1. **is a project open?** Otherwise the form shows "Open a project to generate.";
2. **is a model chosen?** Otherwise the panel shows "No model chosen";
3. **are you connected?** The dot on the account switcher, top right, must be green.

---

## Going further

### The log

Settings → **Advanced** → **Log detail**. Set it to "Everything", repeat the gesture that fails, then
open the **Developer tools** (same section): the messages appear there.

That is what to attach when you ask for help.

### The settings file

Settings → **Advanced** → **Settings file** → **Reveal**. It opens in your file manager.

**You can share it without fear for your credentials**: they are encrypted by your session's
keychain, and unreadable elsewhere. But you may also prefer not to send it at all — it holds all your
settings, including the paths of your folders.

### Starting over

Settings → **Advanced** → **Reset everything**. Puts every setting back to a fresh install.

**Your projects are not touched.** But the operation is final: there is no undo.

---

## The survival table

| Symptom | First thing to try |
|---|---|
| The model catalogue is empty | Settings → Account → sign in |
| "Invalid key or secret" | look for a stray space in what was pasted |
| "Too many requests" repeatedly | lower **Concurrent generations** to 2 |
| "The generation failed" | restore the model's parameters to default, relaunch |
| "Could not save" | check disk space and that the project folder exists |
| Stuttering timeline | check that video preparation is available, or shorten the video |
| No waves on the audio track | the same |
| "Video preparation unavailable" although `which ffmpeg` finds one | run `ffmpeg -version`: the binary exists but no longer starts |
| "The keychain did not give your accounts back" | unlock the keychain, then start again — nothing was lost |
| "This asset has nowhere to go" | open a document able to receive it, with `+` on the left rail |
| "This panel ran into an error" | click **Retry** — the rest of the window is fine |
| `⌘Z` has no effect | activate the right tab |
| Black 3D canvas | close and reopen the tab |
| Panels in disorder | View → Reset layout |
| Work lost when closing a tab | only `.scene` and `.tex` save — [see the limits](18-limits.md) |

---

[← Every shortcut](15-shortcuts.md) · [Contents](../user-guide.md) · [Next chapter: Glossary →](17-glossary.md)
