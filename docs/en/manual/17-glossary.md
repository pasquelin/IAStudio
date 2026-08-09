# 17. Glossary

[← When something goes wrong](16-troubleshooting.md) · [Contents](../user-guide.md) · [Next chapter: What does not exist yet →](18-limits.md)

Every word in the studio, in alphabetical order, explained without assuming any others.

When one word calls for another, it is written *in italics*: you will find it under its letter.

---

## A

**A/B**
A button that plays — or shows — the original version while you hold it, to compare it with the
modified one. It undoes nothing: it shows.

**Accent colour**
The colour that marks what is selected or under way in the interface: the outline of the active
panel, the *playhead*, the frame around a selection. Adjustable in Settings → **Appearance**.

**Account**
A stored API key, under a name you choose. The studio holds **several**, and the switcher in the
title bar moves between them.

Each key carries **its own Scenario project** — its models, its assets, its credit. Switching
accounts therefore changes the remote library you browse, **never** the files in your local project,
which are on your disk and belong to no account.

A *job* already under way finishes on the account that launched it: switching interrupts nothing.

**Adjustment layer**
A *layer* holding no pixels of its own: it **changes what sits below it**. Brightness, contrast,
saturation, hue. Moving it in the stack changes what it touches; switching it off puts everything
back.

That is its strength: it never writes into the other layers' pixels. You can adjust it a hundred
times, or delete it, having spoilt nothing.

**Ambient occlusion** *(AO, texture channel)*
A greyscale image marking the places ambient light struggles to reach: hollows, corners, joints. It
adds depth to a material that looked flat.

**API key**
Your identifier with Scenario, the equivalent of a username. It always goes with an *API secret*.
Both are taken from [app.scenario.com](https://app.scenario.com) and pasted into Settings →
**Account**.

**API secret**
The second half of your Scenario credentials, the equivalent of a password. It always goes with an
*API key*, and is never displayed in the clear once stored.

**Asset**
A raw-material file in your *project*: an image, a video, a sound, a 3D object, a *texture*, a sky.
Keep this in mind: **an asset is a finished, reusable file**.

Assets live in the **Assets** panel, familiarly called *the shelf*.

**Automatic retry**
What the studio does when a *job* fails for a reason another attempt can mend: a dropped
connection, a busy service, too many requests. See *Exponential backoff*.

**Azimuth**
The direction of something all around you, measured by turning on the spot. For a *skybox*'s sun:
east, south, west, north. It pairs with *elevation*, which gives its height.

---

## B

**Background removal** *(cut out)*
Taking the background out of a picture to keep only the subject, on transparency. The **Cut out**
command lives in the Image menu; its model is set in **Settings ▸ Generation ▸ Background removal**.

**Backoff** → see *Exponential backoff*.

**Badge** *(of an asset)*
The small mark on a thumbnail in the *shelf*, saying where that file stands with respect to the
*library*: local only, in sync, to send, to fetch, changed on both sides, failed, or belonging to
another project. It is not stored but **recomputed** — it depends on the active account. See
[Assets](07-assets.md).

**Base colour** *(texture channel)*
A material's colour, as it would be under perfectly neutral light: no shadow, no reflection, no
relief. The "paint" aspect of the surface.

**Blend mode**
How a layer mixes with what is below it. **Normal** simply lays it on top; **Multiply** darkens;
**Screen** lightens; there are sixteen in all.

It is the setting that turns a stack of pictures into a composition.

---

## C

**Canvas**
The drawing surface, in the centre of the Image workspace. This is where you paint, erase and crop.

**Capability**
What a *model* can do, written in shorthand. The catalogue shows them as filters.

| Shorthand | In plain words |
|---|---|
| txt2img | text to image |
| img2img | image to image |
| inpaint | retouch inside an image |
| outpaint | extension beyond the edges |
| controlnet | *guidance* by a structural image |
| reference | a reference image for style |
| txt2video | text to video |
| img2video | image to video |
| txt23d / img23d | text or image to 3D object |
| txt2audio | text to sound |

**Catalogue**
The list of *models* available on Scenario. Several hundred. The **Models** panel only ever shows you
the ones that can make what the current *workspace* makes.

**Channel** *(of a texture)*
One of the images a material is made of. A *texture* is not an image but a set of stacked images,
each answering a different question: what colour? what relief? matte or glossy? The studio knows
eight — see [Textures workspace](12-textures-workspace.md).

**Clip**
A piece of video or sound placed on a *track* of the edit. The same *asset* can give several clips;
cutting a clip never touches the original file.

**Colour grading**
Setting a picture's colours and lights as a whole, after the fact: *exposure*, *contrast*,
*saturation*, *temperature*, *tint*. The term comes from cinema.

**Context** *(of a shortcut)*
The surface where a key has a meaning. The studio knows four: anywhere in the application, in the 3D
view, in the edit, in the image. That is what lets `S` split a clip **and** scale an object, without
ambiguity: only one surface listens at a time.

**Contrast**
The gap between dark and light areas. Below 1, the image flattens and goes grey; above, it hardens
and loses detail at the extremes.

**Creative unit** *(CU)*
What a generation spends on your Scenario account. The service sets the rate, never the studio: a
video does not cost what an image costs, and two image models do not cost the same either.

You meet it in three places: the **Generate** button carries an estimate — `~12 CU` — before you
press it; the generation's own line shows the real figure once it has gone; **Help ▸ Usage…**
totals a period. Asking for the estimate spends nothing and generates nothing.

---

## D

**Default model**
The one the **Generate** panel preselects when a *workspace* opens. Adjustable per *family*, in
Settings → **Generation**.

**Density**
The size of the interface's controls. **Comfortable** leaves air (28 px tall); **Compact** tightens
(24 px) to fit more on screen.

**Derived** *(channel)*
A texture *channel* the studio computed from another, rather than received from a *model*. The
computation is relaunched from its thumbnail's menu, as many times as you like.

**Dock**
An area of the window where *panels* can settle: the left and right columns, the bottom strip. See
[The window](03-the-window.md).

**Document**
A work in progress, open in a tab in the centre of the window.

The difference from an *asset* is the one between material and work: a generated image is an asset;
the image you are painting on, with its *layers* and its history, is a document.

Six kinds, one per *workspace*: `.img` (image), `.scene` (3D scene), `.seq` (sequence), `.aud`
(audio), `.tex` (material), `.sky` (sky).

---

## E

**Edges** *(texture channel)*
A black-and-white image saying where a surface's borders are. It is not displayed directly: it feeds
other calculations.

**Elevation**
The height of something above the horizon, in degrees. For a *skybox*'s sun: 0° flat on the horizon,
90° straight overhead. It pairs with *azimuth*.

**Emission** *(texture channel)*
What glows by itself in a material: a neon sign, embers, a lit screen. An emissive area stays visible
even with no light around.

**Environment** *(of a 3D scene)*
What lights a scene besides its own lamps. Two values: **Studio**, a neutral computed lighting, or
**a *skybox* from the project**, which lays its light and its reflections over everything. Chosen
in the 3D workspace's Inspector, under Environment.

**Equirectangular**
The format of an image holding a whole sphere, flattened: twice as wide as it is tall, the way a
world map holds the Earth. That is the form a *skybox* is stored in before being folded around you.

**Exponential backoff**
How the studio retries after a failure: it waits, then doubles the wait at each new attempt — 1
second, 2, 4, 8. Retrying immediately, in a loop, would worsen the congestion instead of resolving
it.

**Exposure**
The overall brightening or darkening of an image, counted in **stops**: +1 doubles the amount of
light, −1 halves it. The most useful correction on an image that is too dark.

---

## F

**Fade**
A rise from silence (fade in) or a fall towards it (fade out). Avoids the "click" of a sound that
starts or stops dead.

**Family** *(of models)*
The broad type of what a *model* makes: image, video, 3D, audio, texture, sky, upscaling, background
removal, vectorisation. Seven of them have their *default model* in settings; Texture and Sky do
not yet. The last three — upscaling, background removal, vectorisation — have no workspace at all:
it is the Image menu's edits that use them.

**ffmpeg**
A small program outside the studio, which can read and convert just about every existing video and
audio format. The studio uses it on import to make *proxies* and *waveforms*. Optional: without it,
importing still works, just less comfortably.

**Field of view** *(FOV)*
What a camera takes in, measured in degrees. A narrow angle: you see little, but closely, and
distances flatten. A wide angle: you see a lot, but the edges distort. A human eye sits around 60°.

**Fingerprint** *(of a file)*
A signature computed from a file's content. Two identical files have the same fingerprint, even under
different names. That is how the studio recognises a duplicate on import.

**Flatten**
Melting every visible *layer* into a single picture, as if photographing it. That is what export
does, and what leaves when you ask the model to cut out or enlarge: the service receives a
picture, not a stack.

The document keeps its layers. Flattening is not destructive here.

---

## G

**Generate**
To ask a *model* to make something. The request leaves for Scenario, comes back as a *job*, and the
result lands in your *assets*.

**Group**
Several objects filed under one parent. In the 3D workspace (`⌘G`) as in the layer stack: moving
the group moves everything hanging below it, and folding it away makes a busy scene readable.

**Guidance** *(ControlNet, cfg)*
Two meanings, unfortunately:

1. **ControlNet** — supplying a structural image (an outline, a pose, a depth map) the model must
   follow;
2. **guidance / cfg** — how closely the model obeys the *prompt*. Too high and the image turns harsh
   and saturated; too low and the model wanders off.

**Guide**
A thin line, horizontal or vertical, placed on the image to align what you put there. It is not part
of the image and does not export. Hiding guides does not erase them.

**Gutter**
The space between two panels. It is itself the handle that resizes them: there is no tiny grip to aim
at.

---

## H

**HDRI**
A high-dynamic-range image: an image that keeps the real gap between sun and shadow, where an
ordinary image crushes everything between black and white. It is the natural format of a *skybox*
meant to light. Extensions `.hdr` and `.exr`.

**Height** *(texture channel)*
A greyscale image giving a surface's real relief: white is high, black is low. Stronger than
*normals*, because it actually displaces the geometry rather than simulating it.

**Horizon rotation**
Turning a whole *skybox* around you. A sky's most useful setting: it puts the sun on whichever
side suits you, instantly, without regenerating anything.

---

## I

**IBL** *(image-based lighting)*
Lighting a 3D scene **with an image** rather than with lamps. Every part of the sky throws its colour
and its light onto the objects. That is what makes an object credible: it receives the orange light
of a sunset, not a generic white lamp.

**Import**
Bringing a file from elsewhere into the project. The studio *links* it: it notes where it is,
computes its *fingerprint*, and prepares its *proxy* and its *waveform*. The original file stays
where it is.

**Inpaint**
Remaking an area inside an image, keeping the rest intact. You erase a car from a street, you change
a piece of clothing.

---

## J

**Job**
A request being made. It lives in the **status line**, bottom right of the window, with a progress
bar, and goes through five states: **Queued** → **Running** → **Done**, or else **Failed**, or
**Cancelled**.

You can keep working while a job runs.

**Journal** *(activity)*
The list of what the studio has done and failed to do, opened from the *status line*. Four
topics — generation, import, library, document — and three levels: information, warning, failure.
A failure also raises a **toast** in the corner of the window, which only leaves if you dismiss
it. See [When something goes wrong](16-troubleshooting.md).

---

## K

**Keychain**
Your operating system's vault, the one that holds your passwords. It is what encrypts your *API key*
and your *API secret*. They never come out in the clear, and the screen you are looking at has no
access: it only knows whether the connection works.

---

## L

**Layer**
A transparent sheet stacked on the others, in the Image workspace. Like tracing paper laid one sheet
on another: you draw on the top one without spoiling the ones below. You can hide one, move it up,
move it down, delete it.

That is what makes an image **editable** instead of a final flat.

**Library** *(of the account)*
The stock of assets living online, on your Scenario account's side — as opposed to the *project*,
which is a folder on your disk. The two are separate and nothing travels between them without an
action of yours. Today only the **project → library** direction has a button (**Send**).

**Local frame / world frame**
The orientation of the manipulation handles, in the 3D workspace. In the **world** frame the red
arrow always points the same way. In the **local** frame it follows the object's orientation:
which is what you need to drive a car forwards along the way it faces. The `L` key switches.

**LUFS**
The unit measuring a sound's **perceived** loudness, as opposed to its technical peak. Two sounds at
the same peak level can sound very different; two sounds at the same LUFS sound equally loud. −14
LUFS is the streaming platforms' convention, and what the **Normalise** button aims at.

---

## M

**Mask**
What decides **where** a layer shows. A layer mask hides part of a layer without erasing it: the
pixels are still there, they are not displayed. You paint it, adjust it, remove it — the original
picture never moved.

A mask can also be made from a *selection*, in one command.

**Mesh**
A 3D object, described by its points and the triangles joining them. It is the shape, without the
material or the light.

**Metalness** *(texture channel)*
Area by area: is this part metal, or not? It is not a look slider but a physical switch, because
metal and non-metal reflect light in two different ways. Intermediate values barely exist in nature —
they serve to soften the boundary between two areas.

**Model**
The distant program that makes things. There are several hundred, and they cannot all do the same
thing. **Choosing the right model matters as much as writing a good prompt.**

---

## N

**Negative prompt**
What you want to avoid. Short, in keywords: `blurry, text, watermark`. It is not the place to
describe a scene in reverse.

**Normalise** *(audio)*
Bringing a sound's perceived loudness to a reference level, here −14 *LUFS*. It stops two sounds
played in sequence from jolting each other's volume.

**Normals** *(texture channel)*
An oddly coloured image — blues, purples — encoding a surface's **micro-relief**: the bumps and
hollows that catch light, without adding a single triangle to the object. That is what gives stone
its grain and cloth its weave.

---

## O

**Outpaint**
Extending an image **beyond its edges**, inventing what comes next. It turns a tight portrait into a
wide shot.

---

## P

**Panel**
A small window inside the big one. Each panel does one thing: list the models, show the layers,
adjust what is selected. You open and close them with a click on the *rails*.

The rail only shows the panels the workspace **can** open: no Layers in Audio, and no Generate while
no model is chosen.

**Playhead**
The vertical line marking the current instant in the edit. You move it to place yourself, and it is
at its position that a *clip* is split.

**Projection**
How the 3D camera lays volume flat. In **perspective**, what is far is smaller — that is what an
eye sees. In **orthographic**, sizes do not change with distance: it is an architect's drawing,
and it is what you want to line objects up.

**Prompt**
Your instruction sentence: the text describing what you want. The most important field in the form.

Three principles: **write in English** if you can, **describe what is there** rather than what is
not, and **be concrete**.

**Proxy**
A lightweight copy of a video, made at import, which lets you scrub through the edit smoothly. You
work on the proxy and export from the original. Making it requires *ffmpeg*.

---

## Q

**Queue**
The line of pending *jobs*. How many work at once is adjustable (3 by default). Everything goes
through this queue — that is what stops a burst of requests from being refused wholesale.

**QWERTY / AZERTY**
The two common keyboard layouts. The studio listens to the **position** of the keys, not the letter
printed on them: the flying keys always form the same square at the top left — `WASD` on an American
keyboard, `ZQSD` on a French one. Nothing to set.

---

## R

**Rail**
One of the two strips of icons stuck to the left and right edges of the window. A click on an icon
opens or closes the matching *panel*.

**Regenerate**
To relaunch a generation with the settings that produced a given result — same *model*, same
*prompt*, same *seed*. The starting point of any controlled variation.

**Roughness** *(texture channel)*
Matte or glossy, area by area. A rough surface scatters light and has no sharp reflection; a smooth
one returns it and mirrors. That is what separates dry asphalt from a puddle — the colour is nearly
the same.

**Ruler**
One of the two graduated strips, at the top and left of the *canvas*. It is from them that *guides*
are dragged.

---

## S

**Saturation**
The intensity of colours. At 0 the image is black and white; above 1 the colours shout.

**Seed**
The starting point of a generation's randomness. It is a number.

Two generations with **the same seed, the same model and the same settings** give the same image.
Change the seed and you get another image from the same family. Leave it on "Random" and you explore;
fix it and you refine.

It is the most useful setting in the form, and the most often ignored.

**Selection** *(in an image)*
A region drawn on the image — rectangle, ellipse or lasso — that **bounds the tools**. While it
exists, the brush, the eraser and the fill only act inside it. `⌘D` drops it.

It also serves to make a *mask*, and to tell the model which area to repaint.

**Sequence**
An edit: *clips* placed on *tracks*, through time. It is the *document* of the Video workspace.

**Shadow** *(cast, caught)*
Two separate settings, on every object of a 3D scene. **Casts a shadow**: the object blocks light.
**Catches shadows**: other objects' shadows are drawn on it. A floor catches without casting; a
distant piece of set can do neither without anyone noticing.

**Shelf**
The nickname of the **Assets** panel. You file what you have made and imported there; you pick from
it to work.

**Skybox**
What you see all around you in a 3D scene when you turn your head: the sky, the horizon, the distant
scenery. Stored *equirectangular*.

It does two things: **you see it** (it is the backdrop), and **it lights** (see *IBL*). The second
matters more.

**Snap**
Making what you drag stick to *guides*, edges and centre, within a few pixels. It avoids alignments
that miss by a hair.

**Sprite**
A picture placed in a 3D scene that **always faces the camera**, whichever direction you look from.
Useful for foliage, a spark, a flat character. It is neither lit nor part of shadows: its colour is
the one you give it.

---

## T

**Tab**
An open *document*, in the centre of the window. A tab whose work is not yet written to disk
carries a dot (`•`) beside its name.

**Temperature**
An image's shift towards cold (blue) or warm (orange). It is the setting that stops a photograph
taken under a bulb from looking yellow.

**Texture**
A material meant to dress a 3D object: wood, rusted metal, fabric. **It is not an image**, but a set
of stacked *channels*, each answering a different question.

**Theme**
The interface's colour scheme: **Dark**, **Light**, or **System** (which follows your computer and
switches on its own). The background always stays opaque — in a studio, a translucent background
would falsify colour judgement.

**Thumbnail**
The small image representing an *asset* in the shelf or a *model* in the catalogue.

**Tint**
An image's shift towards green or magenta. It rescues a cast that *temperature* cannot correct.

**Track**
A line of the edit, on which *clips* are laid end to end. A picture track, a sound track, several of
each if needed.

**Trim**
To shorten a *clip* from one of its ends, or to keep only the selected portion of a sound.

---

## U

**Undo** *(⌘Z)*
To take back the last action. Each *document* has its own *undo stack*: `⌘Z` steps back in the
active tab, not in the last gesture made anywhere in the studio.

**Undo stack**
A *document*'s history of actions, in which `⌘Z` steps back and `⇧⌘Z` steps forward. **Each document
has its own** — that is why undoing in one tab does not touch the others.

**Upscaling**
Remaking an image larger, inventing the missing detail. It is not a stretch: a real upscale adds
plausible matter where there was only a smeared pixel.

---

## V

**Vectorisation**
Turning a picture into paths — lines and curves, which scale up without ever going blurry. The
**Vectorize** command lives in the Image menu; its model is set in
**Settings ▸ Generation ▸ Vectorization**.

---

## W

**Waveform**
The drawing of a sound: those waves showing where it is loud and where it is silent. It is what lets
you spot a phrase or a beat without listening. Making it requires *ffmpeg*.

**Workspace**
One of the studio's six arrangements: **Image**, **Video**, **3D**, **Audio**, **Textures**,
**Skyboxes**. Switching workspace rearranges the *panels* and refilters the *catalogue*.

It is not six applications: it is one application that rearranges itself.

---

## Z

**Zoom, actual size, fit**
Three ways of looking at an image:

| Command | What it does |
|---|---|
| **Zoom in / out** (`⌘=` / `⌘−`) | changes the scale one step |
| **Fit to window** (`⌘0`) | frames the whole image, never enlarging beyond real size |
| **Actual size** (`⌘1`) | one image pixel to one screen pixel |

**Actual size is the only scale where you judge sharpness.** Everywhere else, what you see is a
calculation.

---

[← When something goes wrong](16-troubleshooting.md) · [Contents](../user-guide.md) · [Next chapter: What does not exist yet →](18-limits.md)
