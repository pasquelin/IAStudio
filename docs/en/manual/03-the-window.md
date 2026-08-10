# 3. The window, explained

[← First steps](02-first-steps.md) · [Contents](../user-guide.md) · [Next chapter: Projects →](04-projects.md)

The studio's window looks like a development environment or an editing suite, not a web page. This
chapter takes it apart, piece by piece.

---

## The home screen, before anything else

**The studio does not open on an empty window.** It opens on a full-width screen — the home —
saying where you were, what you have made, and what you can do next.

It closes as soon as you step into a workspace, and it has no rail, no panel and no tab: it is a
page, not a layout. The status line stays at the bottom, because a generation started yesterday
may well finish while you read it.

### The banner, at the top

It says one thing at a time, whichever matters right now.

| What it shows | When |
|---|---|
| **Pick up where you left off** | a document was open last time |
| **_n_ generations running** | something is still working |
| **Connect an API key** | no key is stored |
| **Start a project** | no project is open |
| **Ready when you are** | the project is open and still holds nothing |

**It waits to know before concluding.** Reading the projects and the documents takes a moment; the
banner appears once the answer has landed, rather than announcing "start a project" and then
correcting itself.

### The bands

Under the banner, one band per subject, in this order:

| Band | What it shows | It needs |
|---|---|---|
| **Tools** | the seven workspaces, and the project gestures | nothing |
| **Your recipes** | the settings you have pinned | nothing |
| **Running now** | the generations under way | an API key |
| **In the same vein** | public creations that look like your latest asset | an API key |
| **An idea to start from** | prompt starting points written for your image model | an API key |
| **What you have spent** | your units spent, in total and per model | an API key |
| **Explore** | what everyone has published, by kind | an API key |

**A band that lacks what it needs is not greyed out: it is not there.** With no API key,
**Explore** does not exist on this screen.

**Six of the home's contents are not bands**, which is why they do not tidy away like them: your
projects, what you have made, the counters by kind, your library, your documents and the recent
activity are **panels**, held in the home's two columns. A band is what the centre stacks; what
the rails hold is not one. The **Customise this section** menu therefore does not reach them.

### The four bands that look beyond your project

**Explore** is the only one that is not about your account: it is the feed of what **everyone**
has published, one category at a time — the studio's six kinds, as tabs. There is no "all" tab: a
grid mixing sounds and pictures is a grid of grey rectangles, and the API cannot order them
against each other anyway.

- **it loads as you go down**: the feed pages while you scroll, and it has no end;
- **it stays at the foot of the page, and does not move.** Ordering the bands is a preference;
  burying a section under an endless feed is not one, and the menu cannot express it;
- **the tiles do nothing.** They belong to someone else, and the studio has no way to fetch one
  into your project — a button that can only refuse is worth less than no button.

**In the same vein** starts from your **latest asset** — not from a choice, there is nothing to
select — and looks for public creations that resemble it. The reference itself is removed from the
results, where it would otherwise come first.

**If the library does not answer, this band does not vanish**: it says so, and offers **Try
again**. It is the only one that tells a refusal apart from an account with nothing alike — both
used to arrive as an empty shelf, and only the first is worth offering another go.

**An idea to start from** is the only band that calls nothing until you ask: it has a **Suggest an
idea** button. That is deliberate — a home screen firing a round trip at every launch would spend
the account's rate limit on a band nobody looked at. **It is free**: no creative unit is spent.
Taking an idea opens the generator on the prompt **and** on the settings that go with it. With no
image model chosen the band does not appear: the suggestion is written for a model, and without
one it would propose into the void.

**What you have spent** uses the same period as the consumption window, so the two can never
disagree. It is a summary, not the window: the detail is under **Help ▸ Consumption…**.

**Your recipes need nothing**, and that is deliberate: a recipe is kept outside every project and
follows you from one to the next. It is the one band with something left to show when no folder
is open.

### Clicking a tile opens it

**That is the rule for the whole page, and it is the only one to remember.** A click on a
picture opens it in its workspace. Anything that is not "open" is a **secondary** action,
revealed on hover in the corner of the tile, and every button says its verb.

**Making another image costs no network call.** In the corner of each creation, "Make another
one with…" reopens the form already filled in: the model, the prompt and the settings are kept
beside the asset, in the project.

**One exception, and only one: a library asset you have not fetched yet.** It is not on your
disk, so there is nothing to open — the click **fetches** it, and the button says so. Once it is
down, the tile joins the common rule and opens. Nothing is ever downloaded without your asking.

**That is where you fetch, and nowhere else.** The shelf can send but not take back: each
direction has its own door, and they are not the same — see [Assets](07-assets.md). With no
project open, or while a transfer is running, the tile stays a plain picture and does not
respond: there would be nowhere to write it.

**A counter leads to its assets.** Clicking the images one opens the Image workspace and sets the
filter: you land on the images, not on the whole shelf. A kind at zero stays on the row but does
not respond — there is nowhere to go. **And the panel never disappears**: empty project, or no
project at all, it shows its six kinds at zero. A band can take itself off the page; a panel
standing under a rail icon cannot — the icon would open onto nothing.

### Tidying the page

Every band has its menu — **Customise this section**.

| Entry | Effect |
|---|---|
| **Move up** / **Move down** | changes the order, which is remembered |
| **Hide this section** | takes it off the page |
| **Show _n_ items** | from 3 to 48 |

Hidden sections are counted at the foot of the page — "2 sections hidden" — with a **Show them
again** button. Nothing disappears without leaving a trace.

**Two bands cannot be hidden**: the banner and Tools. That is what keeps the home from ever being
a blank page, whatever you untick — and neither of them needs an API key, without which the
guarantee would not hold on a studio that is not connected.

### The left column

A narrow rail holding **Your projects**: the ones you opened recently, reopened with a click.
That is the place the workspaces give the Explorer — here, what you keep an eye on while reading
the page is the list of projects, not the contents of one. The open project's documents are
listed in the right column, which has panels of its own.

> **The home can be skipped.** **Preferences ▸ General ▸ Show the home screen**: unticked, the
> studio goes straight to the workspace you left. The order of the bands, and which ones you have
> hidden, are set on the home itself, not in the preferences.

---

## The overall plan

```
┌──────────────────────────────────────────────────────────────┐
│  TITLE BAR — the seven workspaces                            │
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

It does not carry the file name. It carries the **seven workspaces**:

**Image** · **Video** · **3D** · **Audio** · **Textures** · **Skyboxes** · **Graph**

> **The Graph is under construction.** It opens, nodes can be placed, wired and saved, and
> **selecting a node opens it in the Inspector** — its id, its kind, and a title you can type. A
> text node shows its prompt there, a sticky note its text. A **model node** goes further: the
> model is **chosen** from a list, and the chosen model's form opens below it, exactly the one the
> Generation panel shows. What you type there goes through the same ⌘Z as the node you drag.
>
> **Changing a node's model rebuilds its ports**, and the links those ports no longer answer for
> leave with them — the one whose port is gone, and the one whose port changed what it takes and
> no longer accepts what is at the other end. In one gesture, so one `⌘Z` takes it all back.
>
> **A loop says what it walks.** Selecting a loop node opens the lists it goes through — pictures
> or texts, your choice, each with the port handing out its item on every turn. Its **end of loop**
> carries one field, and it is the one that matters: which loop it closes.
>
> **It runs.** The first button of its bar runs the graph — or `⌘Enter`, or **Graph ▸ Run**: each
> node starts once what it reads is
> ready, independent branches start together, and the generations go through the same queue as the
> rest of the studio — they show in the jobs bar and count against the same budget. The button
> becomes **Stop** while it goes: nothing more is submitted, and what is in flight is cancelled.
> On an empty graph it is **greyed out**: there is nothing to run.
>
> **Bottom left, a line says whether the graph would export**, and it keeps up while you wire
> rather than arriving as a failed export: the number of steps when all is well, the reason when
> it is not — no output marked, nothing reaches the output, or the graph does not compile.
>
> **Two of those reasons are the studio's own.** An end of loop that does not close what it names,
> and two ends closing the same loop, are both accepted without a word by Scenario's validator —
> and a wire ends up plugged somewhere other than where it is drawn. The studio refuses them
> itself, because nothing else would say so.
>
> **Stop hands control back at once**, without waiting for the API to answer on the generations
> already sent. They are told to cancel, but the run does not stay parked on their answer: the
> button turns back to **Run** the moment you press it, even if the service never says another
> word about one of them.
>
> **Every node says where it stands**, in the corner of its header: *running*, *done*,
> *unchanged* — reused as it stands, because nothing it depends on has moved — or the reason it
> produced nothing: *loop*, *no model*, *not runnable*, *branch with no output* — the branch it
> chose has no port to leave by —, *failed*, *invalid expression*, and
> **upstream failed** — which
> does not mean "it is coming", but "it is not": something it depends on failed, so it will never
> leave in this run. Running it again after changing the last node's prompt runs **only** that
> node.
>
> **An *If / Else* node picks one branch, and only one.** Its condition is evaluated over what its
> incoming wire carries, and what it received leaves by the branch that was chosen — the others get
> nothing. The nodes reading them then show **not taken**: that is not a failure, it is the branch
> doing its job, and the state carries on to everything downstream. A branch left empty in the
> inspector cannot be taken: the run moves on to the next branch, and to the **Else** if there is
> none left.
>
> **An approval node stops the run to ask you.** You put one down like any other, wire it to the
> node whose result it should hold, and the Inspector gives it its **question asked** — left
> empty, the node simply asks "Approve this result?". When the graph runs, the node it guards
> produces first, then the graph stops: the node reads *to approve* and shows its two answers,
> **Approve** and **Decline**. Approving lets everything reading the guarded node go; declining
> holds them back — the node reads *declined*, and whatever reads it reads *upstream failed*.
> **The question is asked again on every run**, even where nothing has changed and everything
> else is reused: an approval is a gesture, not a result to keep. Stopping the run while a
> question is open is not a refusal — the node simply goes idle.
>
> **A transform node rewrites text.** You put one down like any other, wire the node whose result
> it should take into its input, and the Inspector gives it its **expression** — a CEL expression,
> the small language Scenario uses in its own workflows. What the wires bring reads under the name
> Scenario gives the wire: the provider's id, then `_` and the name of its output, `output` most of
> the time. So `'a photo of ' + text1_output` builds a prompt out of what a Text node holds.
> **Scenario's own evaluator does the computing**, the very one its site runs: what works here
> works identically once the App is published. An expression left empty produces nothing, so it
> overwrites nothing the next node's form already holds; one that will not evaluate — a missing
> bracket, a variable no wire feeds, a result that is not text — makes the node read *invalid
> expression*, and whatever reads it reads *upstream failed*. **It takes one wire for now**:
> assembling two texts in one expression comes with the logic nodes.
>
> What it cannot do **yet**: *create* a logic or loop node. A branch only arrives by import, and
> a loop does not run at all. Its chapter comes when it can.

One click switches workspace. The active one is the button lighter than the others.

Switching workspace does three things at once:

- **the panels rearrange** — each workspace shows the tools it needs and hides the rest;
- **the tabs change** — each workspace has its own open documents;
- **the catalogue filters** — the Models panel now shows only the models capable of making that
  kind of content.

On macOS, the three red / orange / green buttons stay in their usual place, on the left.

### Arranging the workspaces in the order that suits you

The bar's order is not imposed. Three ways to change it, whichever you prefer:

| Gesture | How |
|---|---|
| **Drag** | pick up a workspace and drop it onto another |
| **Keyboard** | `⌥←` / `⌥→` on the focused workspace — the bare arrows walk the bar instead |
| **Right-click** | **Move left** / **Move right** |

Both keys **remap like any other**, under the *In the workspace bar* context of the
[shortcuts screen](15-shortcuts.md).

**Home does not move**: it is not one workspace among the others, it covers them all, and it
stays at the head.

**The order follows everywhere.** The home screen's **Tools** band shows the same workspaces:
reordering one without the other would leave two truths on the same screen. It is kept from one
session to the next, along with your settings.

> **A workspace added by an update does not land at the end of your bar.** It lands where the
> studio files it by default — after the last of its earlier neighbours you kept. A stored order is
> a photograph of the workspaces that existed the day it was written: the Graph was the seventh and
> will not be the last.

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
| The **upper half** icons of the left column | Models, then Generate — the same two in every workspace |
| *separator* | |
| The **lower half** icons | Explorer, then Apps — the same in every workspace; the home puts **Your projects** there |
| At the bottom: the **bottom strip** icons | Assets or Timeline, depending on the workspace |

**One separator per cut of the column, never one more.** The rail is the column's legend: it cuts
the way the column is cut, and an empty half never reaches it.

The **+** button is solid and blue, where all the others are grey glyphs. That is because it
**acts** — it creates something — while the others only show or hide.

> The **+** button is greyed out when no project is open: a document is a file in a project folder,
> and without a project there is nowhere to write it.

### The right rail

The **right column** icons: Skybox, View, Layers, Channels, Styles, Scene, Lights, Meshes,
Assets — whichever ones the workspace declares, in that order — then, below the separator,
Inspector.

**Assets comes last, and that is no detail**: a half with nothing chosen shows the first panel
declared, so a shelf listed above the scene tree would open in front of it every time you enter
the 3D workspace.

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

## The complete list of the workspaces' panels

| Panel | Zone | Half | Visible in | What it is |
|---|---|---|---|---|
| **Models** | left | 1st | everywhere | the Scenario catalogue, filtered on the active workspace |
| **Generate** | left | 1st | everywhere *(if a model is chosen)* | the chosen model's form |
| **Skybox** | right | 1st | Skyboxes | the open sky's settings |
| **View** | right | 1st | Skyboxes | the projection, the field of view and the test objects |
| **Layers** | right | 1st | Image | the layer stack of the open image |
| **Channels** | right | 1st | Textures | the eight channels of the open material, and what each one holds |
| **Styles** | right | 1st | Textures | saved material settings, to replay on any material |
| **Scene** | right | 1st | 3D | the tree of the open scene |
| **Lights** | right | 1st | 3D | the scene's light sources |
| **Meshes** | right | 1st | 3D | the scene's objects, and the button that adds one |
| **Assets** | right | 1st | Video, Audio, 3D | the project's shelf, as a column |
| **Explorer** | left | 2nd | everywhere | the project folder, folders and files |
| **Apps** | left | 2nd | everywhere | Scenario's ready-made pipelines, run as they are |
| **Inspector** | right | 2nd | everywhere | what is selected, adjustable live |
| **Assets** | bottom | 1st | Image, Textures, Skyboxes, Graph | the same shelf, as a strip |
| **Timeline** | bottom | 1st | Video, Audio, 3D | the sequence being edited, or the scene's animation |

> **"Everywhere" means the workspaces, not the home screen**, unless the row says otherwise. A
> workspace is a place that opens documents of a kind of its own; the home opens none — it opens
> the others'. **The home has panels of its own, and this table does not list them**: it has two
> columns of its own, holding six panels that exist nowhere else. On the left it puts **Your
> projects** where the workspaces put the Explorer: the lower half. The logic is the same but for
> one word — a workspace files what
> you produce **with**, the home what you produce **in**, and that is the first thing anyone comes
> to this screen for. With no generation to sit above it, the panel fills the whole column there.

**The left column belongs to what produces**, and it is cut in two.

**Above, generation, and nothing else.** Only two panels may sit there — **Models** and
**Generate** — and neither appears anywhere else. Generating is the one thing every workspace
does, so it gets the same place in each, right under the **+** button that makes a document.
They are two moments of the same work, choosing then filling in, so they take turns in the same
half.

**Below, the Explorer and the Apps**, taking turns the same way. An App produces assets, which
is generating, so it belongs to the column one produces from. And a half rather than two more
turns above, because four icons stacked in a rail is the moment a column stops being a place you
know and becomes a pile you search — while two halves of two keep generation visible **while**
the Explorer is read.

**The right column belongs to the open document**: what it holds, what lights it, what is
selected. Its panels take turns in the upper half — no workspace declares them all at once — and
the **Inspector** holds the other half, always the lower one. You read what is selected **while**
a model is being chosen and a prompt written: in an editor, the inspector is never the panel you
have to switch away from to see something else.

**Why the asset shelf moves.** In most workspaces it sits at the bottom: it is a shelf, it reads
across, and the side column is reserved for what acts on the document. But in the **Video**,
**Audio** and **3D** workspaces the bottom strip belongs to the timeline, which needs the full
width. The shelf then moves to the **right column**, so that the timeline and the shelf hold the
screen **together**: dragging a take onto a track is the gesture those workspaces are built
around.

**The rule belongs to the strip, not to the montage.** 3D follows the other two because it has a
timeline too — time reads along the same line there, whether you are cutting shots or playing an
animation.

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

The lower left half opens on the **Explorer** in every workspace, the Apps behind it.

| Workspace | The upper right half opens on | The bottom strip on |
|---|---|---|
| **Image** | Layers | Assets |
| **Video** | Assets | Timeline |
| **3D** | Scene | Timeline |
| **Audio** | Assets | Timeline |
| **Textures** | Channels | Assets |
| **Skyboxes** | Skybox | Assets |
| **Graph** | *nothing — it declares no panel there* | Assets |

**Why this is not a panel pinned once and for all.** Your layout is remembered once for all
workspaces, while the panel that comes first differs in each. Writing one into the default layout
would impose one workspace's answer on the other six.

As soon as you click an icon, that half remembers **your** choice, and does not move again until
you click another — or reset the layout.

**Why the Explorer is visible everywhere.** It shows the project folder as a tree, and that is the
same question in every workspace: double-clicking a document opens it, switching workspace if it
belongs to another, and double-clicking anything else hands it to the system. It long showed the 3D scene tree — that
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

> **All seven document kinds save** — images, 3D scenes, materials, sequences, edited sounds,
> skies and graphs. What does not survive one save to the next is the undo history. See
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
its state, its bar, and the button that cancels it. Under the bar, what the generation cost — or,
if it failed, why. It is the content of the former panel, one click away instead of a permanent
piece of surface.

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
library, document, project). A **Show everything** button releases them.

**To close it**: a click outside, `Esc`, or switching to another application — clicking the icon
again works too. That holds for both panels of the status line, and for anything that floats over
the window.

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
| **Graph** | Run / Stop the graph — in the Graph workspace |
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

**Activities and Journal name their rows in the window's language**, not in the API's: you read
"Image generation", not `images-generation`. If Scenario adds a kind of event the studio does not
know yet, its row shows the raw API name — the only place that technical English comes back, and
better than an empty row.

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

## Closing the last window quits the studio

On macOS, the habit is for an application to outlive its windows and for you to reopen one from
the Dock. **That is not what the studio does**: closing the last window quits it, on all three
systems.

This is deliberate. A document editor has nothing left to offer once its windows are gone, and the
convention left an application running that no gesture could bring back into view.

> Your documents do not go with it: anything unsaved is **asked about before** the window closes,
> as everywhere else.

---

[← First steps](02-first-steps.md) · [Contents](../user-guide.md) · [Next chapter: Projects →](04-projects.md)
