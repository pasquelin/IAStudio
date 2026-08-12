# 19. How do I…

[← What does not exist yet](18-limits.md) · [Contents](../user-guide.md)

The previous chapters explain **every piece** of the studio. This one does the opposite: it
starts from what you want to end up with, and gives the whole path, from the first click to the
result.

Each recipe stands on its own. You need not read anything first.

---

## The three things to have before any recipe

They recur everywhere, so they are said once here.

| You need | How to check | If it is missing |
|---|---|---|
| **A connected account** | the dot is **green**, top right of the window | [First steps ▸ step 3](02-first-steps.md) |
| **An open project** | its name is written bottom left, in the status line | `⌘N` to create one |
| **The right workspace** | the seven tabs, at the top of the window | click the one you need |

**The third is the one people forget.** Half the studio's "it does not work" moments are the
right gesture made in the wrong workspace.

---

## The gesture that misleads everybody

Before the recipes, one rule that runs through all of them.

**Double-clicking an asset does not open a tab.** It sends the asset into the tab **already open
in front of you** — failing that, into a document open **elsewhere**, switching workspace on the
way. If there is nowhere at all, a message says so: "This asset has nowhere to go".

So in every recipe below, the order is **always** the same:

```
1. the right workspace   (the tabs, at the top)
2. the + button          (the left rail — it creates the document)
3. only then, the asset
```

Remember those three lines and nothing will block you.

---

# Making

## Make a picture from a sentence

**This is the basic path**, detailed in [First steps](02-first-steps.md). In short:

1. **Image** workspace;
2. **Models** panel, on the left: click a thumbnail;
3. click the **Generate** icon in the left rail — choosing a model does not open the panel for
   you — then write your sentence in the **prompt**;
4. **Generate**. The status line, bottom right, follows the progress;
5. the result arrives in the **Assets** panel, and in `assets/img/` on your disk.

**The catch.** With no project open there is **neither form nor button**: the panel shows "Open a
project to generate." instead. It is not a greyed-out button, it is the whole panel waiting for a
folder.

---

## Make a variant of a picture I already have

This is called **image to image**: you give a starting picture, the model returns another one,
inspired by it.

1. **Image** workspace;
2. in the **Models** panel, the **Capability** filter is visible without unfolding anything →
   tick **Image to image**;
3. choose a model from what remains;
4. in the form, an **image** field appears: give it your starting picture;
5. write what you want to end up with, and set **strength** if the model offers it:
   **0 = almost unchanged, 1 = unrecognisable**. Start around 0.5;
6. **Generate**.

**This is how a model transforms a picture.** To take it up by hand — brush, eraser, shapes,
text — the other path is an image document with the picture dragged onto it as a layer (see
[Image workspace](08-image-workspace.md)).

---

## Enlarge a picture

**Image ▸ Enlarge** flattens the document, sends it, and opens the upscaler's form with your
picture already in it. You are the one who presses **Generate**.

Once, before the first time: **Settings ▸ Generation ▸ Upscaling**, pick a model. Without it the
command sends nothing and opens that screen — the **Models** panel cannot serve here, it only
shows the open workspace's family.

**Cut out** and **Vectorize** work exactly the same way, with their own settings sub-sections:
**Background removal** and **Vectorization**.

**Do not look for it in the Image workspace's Models panel**: that panel only ever lists its own
workspace's family, and an upscaler is not part of it — you could look for a long time. The
**Image ▸ Enlarge** menu is the way in.

---

## Make a 360° sky

A *sky* — or *skybox* — is a picture that surrounds you completely. It serves as scenery **and**
as light.

1. **Skyboxes** workspace;
2. the **+** button on the left rail: an empty sky document opens;
3. **Models** panel: it shows only **three**, and that is correct — they are the only ones that
   make panoramas;
4. write your prompt, **Generate**;
5. **the generation lands by itself** in the document it started from. You have nothing to do.

Then **click and drag** in the preview to turn your head, and use the **Skybox** panel, on the
right, to set exposure and rotation.

**To check what you are shipping**, go through the other three views — equirectangular, cross,
6 faces. They show the same sky, at the same rotation, but laid flat: a seam at the back or a
crushed pole shows up at a glance, where the 360 view makes you turn your head to run into it.

**To take it into an engine**: **File ▸ Export the sky**, and a size. Six PNGs come out into a
folder, named `_Rt`, `_Lf`, `_Up`, `_Dn`, `_Ft`, `_Bk` — the two letters Unity, Unreal and Roblox
expect. **Grade before you export**: the exposure, the horizon rotation and everything else are
baked into the files. See [Skyboxes workspace](13-skyboxes-workspace.md#taking-the-sky-out-the-six-faces).

---

## Make a material for a 3D object

A *material* (or *texture*) is not a picture: it is a surface you judge **on a lit object**, not
flat.

1. **Textures** workspace;
2. the **+** button on the left rail;
3. **drag a picture from the project onto the preview** — a blue frame confirms the drop will be
   taken. It becomes the **base colour**;
4. **Inspector** → **Preview** section: choose the shape — **sphere**, box, cylinder, plane or
   torus knot. The **sphere** shows the light best, the **plane** shows the pattern's repetition
   best;
5. **Inspector**: the **Material** section sets roughness and metalness; **Relief** and
   **Emission** are two neighbouring sections, not its contents. If the
   material looks uniformly average, it is the **ranges** — "Roughness range", "Metalness range" —
   that need adjusting; they sit in the Material section, under the two settings;
6. **Channels** panel: drop a picture onto the thumbnail of each channel you want to fill — and
   for **height**, **normal**, **occlusion** and **roughness**, the thumbnail's menu computes them
   from another channel, at no cost;
7. `⌘S` **saves**.

**The catch.** A picture dropped on the **preview** always goes to the base colour — that is
deliberate. To aim at normals or roughness, drop onto **their thumbnail** in the Channels panel.

---

## Make a still picture move

1. **Video** workspace;
2. **Models** panel → **Capability** filter, visible without unfolding anything → **Image to video**;
3. pick a model, give it your picture, describe the motion you want;
4. **Generate** — allow longer than for a picture: a few minutes is normal;
5. the clip arrives in **Assets**.

**To see it large**: the **+** button on the left rail to open a sequence, then drag the clip
onto the timeline.

---

## Make music or a sound effect

1. **Audio** workspace;
2. **Models** panel: the publishers on offer are ElevenLabs, Google, Bytedance;
3. describe the sound you want, **Generate**;
4. the sound arrives in **Assets**.

**To hear it and shape it:** the **+** button on the left rail — a sound tab opens — then
**double-click** your sound in the shelf. The waveform appears.

---

## Compose a small 3D scene

1. **3D** workspace;
2. the **+** button on the left rail: a fresh scene, with its ground grid;
3. **it is black, and that is normal** — there is no light. The Lights panel says so;
4. **Lights** panel → **+** → **Directional**. The scene lights up;
5. add a weak **Ambient** so the shadows are not completely black. That is the classic recipe;
6. **Meshes** panel → **+** → a **Sphere**, for instance;
7. `G` to move it, `R` to rotate it, `S` to scale it, `F` to frame it;
8. `⌘S` **saves**.

**To fly through the scene:** hold the **right mouse button** and use `W` `A` `S` `D` (`Z` `Q`
`S` `D` on a French keyboard — the studio listens to the key's position, not the letter). `E`
goes up, `Q` goes down, left `⇧` speeds up.

---

# Assembling

## Edit two shots back to back

1. **Video** workspace;
2. the **+** button on the left rail: a fresh sequence;
3. **drag** your first clip from the shelf — in Video it sits in the **right column**, the bottom
   strip being taken by the timeline — onto a picture track;
4. drag the second **right after it**: it lands on the nearest frame, but **it does not stick to
   the first one's edge**. Release too early and it covers its neighbour; edge snapping only comes
   into play when you move a clip already laid down;
5. `Space` to play, `Home` to go back to the start.

**To cut:** place the playhead, press `S`. To delete a clip: select it, `Del`.

**To keep the edit:** `⌘S`. The sequence writes as `.seq` into the project and opens back as it
was — tracks, clips, fades and gains. What does not come back is the undo history.

**What is still missing:** the **export**. The studio cannot yet write a final video file.

---

## Trim a sound and fade it in

1. **Audio** workspace, the **+** button, then **double-click** your sound;
2. drag the region's edges to **trim**;
3. set a **fade in** and a **fade out**;
4. the **A/B** tool compares against the original, before your edits — it is a tool of its own,
   not the play button.

**The catch.** Nothing is written until you ask for it, and **swapping takes wipes your
settings**: cuts are measured against the take that received them.

---

## Put an asset where it belongs

The table of the commonest drops. **Nine** surfaces accept an asset; the [Assets](07-assets.md)
chapter lists them all, and double-click obeys a
different rule again.

| You want… | The gesture | You need, in front of you |
|---|---|---|
| a clip on an edit | drag onto the **timeline** | a sequence tab |
| a picture as a layer | drag onto the **canvas** | an image tab |
| a picture as base colour | drag onto the **material preview** | a texture tab |
| a picture as sky | drag onto the **sky preview** | a sky tab |
| a 3D object in a scene | drag onto the **3D view** | a scene tab |

A texture double-clicks like the rest: it then lands as the base colour of the open material.

---

# Filing, finding, carrying

## Bring in my own files

1. **Assets** panel → the **Import media** button, on its title row;
2. choose your files. Accepted formats: video (`mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v`),
   audio (`wav` `mp3` `aac` `flac` `m4a` `ogg`), image (`png` `jpg` `jpeg` `webp` `tif` `tiff`
   `exr`), 3D (`glb`);
3. a banner follows each file: Probing, Fingerprinting, Proxy, Waveform, Ready.

**What you need to know, and it has real consequences: on import, the file is not copied.** The
studio creates a **link** to where it sits. Moving, renaming or deleting the original **breaks the
link**. Editing it, on the other hand, brings it into the project, without touching your file.

**On the 3D side, only `.glb` comes in.** A separate `.gltf` — the kind that drags its `.bin`
files and its textures along beside it — as well as `.obj`, `.fbx` and HDRIs (`.hdr`) are refused.

---

## Remake a picture that came out well

1. click the picture in the **Assets** panel;
2. look at the **Inspector**, on the right: if it knows the generation, it shows the **model**,
   the **prompt** and the **seed**;
3. the **Regenerate** button: the model and its parameters come back into the Generate panel,
   ready to go again.

**The principle to remember.** Same model + same prompt + **same seed** = same picture. Change
the seed and you get a variant; keep it and change the prompt, and you explore around the same
result.

---

## Carry my project to another machine

A project is **an ordinary folder**. Copy it, that is all.

1. find where it sits — the **Show in the file manager** button in an asset's inspector;
2. copy the whole folder: USB stick, disk, sync service, it makes no difference;
3. on the other machine, `⌘O` and open it.

**The catch.** **Imported** media are not inside the folder: they are links. Copy them
separately — or better, copy them into the project folder **before** importing them.

**Your settings do not follow**, and your API keys even less: they are encrypted by **your**
session's keychain and unreadable anywhere else. On the new machine you will have to connect the
account again.

---

## Work with two accounts

Each API key carries **its own** Scenario project: its models, its assets, its credit.

1. **Settings ▸ Account**: add a second one, with a name of its own;
2. **Use this account** switches;
3. quicker day to day: the account name, top right of the window, opens the list in one click.

**What changes**: the model catalogue and the **remote** assets. **What does not change**: your
local project's files, which are on your disk and belong to no account.

**Good news**: a running generation **finishes on the account that launched it**. You can launch
a ten-minute video, switch to go and find a model elsewhere, and the first one carries on
quietly.

---

## Put the window back in order

Menu **View ▸ Reset layout**. The panels return to their starting places, workspace by
workspace.

That command **deliberately has no shortcut**: you reach for it twice a year, and reserving a key
for it would be a waste. You can assign one in **Settings ▸ Shortcuts**.

---

# What not to try

Five known dead ends. They are not faults: they are features that do not exist yet, and nothing
on screen says so at the moment you try.

| You try to… | What happens | Why |
|---|---|---|
| **find the history** of a reopened document | the undo stack is empty | only the state is saved, not the gestures that led to it |
| **import an `.hdr`**, an `.obj` or an `.fbx` | it is refused | on the 3D side, only `.glb` comes in |
| **cut out or vectorize** a picture | **Settings ▸ Generation** opens on the right section | the model is chosen there, once and for all |
| **export a video** | no button | video export is not written — a picture does go out with `⇧⌘E` |
| **undo a crop** | the size comes back, the cropped pixels do not | the history does not keep the whole picture from before |

All of it is spelled out, with nothing hidden, in
[What does not exist yet](18-limits.md).

---

## The recap, on one page

| I want… | Workspace | The path |
|---|---|---|
| a picture from a sentence | Image | Models → prompt → Generate |
| a variant of a picture | Image | *Image to image* filter → give the picture |
| a bigger picture | Image | the **Image ▸ Enlarge** menu, once its model is set |
| a 360° sky | Skyboxes | `+` → Generate, it lands by itself |
| a material | Textures | `+` → drag a picture onto the preview → `⌘S` |
| an animated shot | Video | *Image to video* filter → Generate |
| a sound | Audio | Models → Generate, then `+` and double-click |
| a 3D scene | 3D | `+` → a light **first**, then the objects → `⌘S` |
| to light a scene with a sky | 3D | Inspector → Environment → choose the skybox |
| to place a 3D model | 3D | double-click the mesh, or drag it onto the view |
| to edit two shots | Video | `+` → drag the clips onto the timeline |
| to import my files | anywhere | Assets → Import media |
| to remake the same picture | anywhere | Inspector → Regenerate |
| to carry my project | — | copy the folder |

---

[← What does not exist yet](18-limits.md) · [Contents](../user-guide.md)
