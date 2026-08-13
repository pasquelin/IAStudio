# 5. Finding a model

[← Projects](04-projects.md) · [Contents](../user-guide.md) · [Next chapter: Generating →](06-generating.md)

---

## What a model is

The distant program that makes things. You give it a sentence, and sometimes an image; it returns
an image, a video, a sound or a 3D object.

There are **several hundred models** in the Scenario catalogue, and they cannot all do the same
thing. Some are excellent at characters and mediocre at landscapes. Some take only text, others
require a starting image. Some return in ten seconds, others in three minutes.

**Choosing the right model matters at least as much as writing a good prompt.**

---

## The Models panel

It sits in the left column, in the same place in every workspace. It lists the catalogue
**for the workspace you are in**: in the Image
workspace, image models; in the 3D workspace, 3D models.

There are no type tabs to choose: the title bar already says which workspace you are in.

> **Panel empty and talking about credentials?** Your API key is not stored, or it was refused. See
> [First steps, step 3](02-first-steps.md#step-3--connect-your-account).

### Two ways of looking

At the top of the panel, two buttons:

| View | What it shows | When to prefer it |
|---|---|---|
| **Icons** | a grid of thumbnails | to choose by eye — the normal case |
| **List** | a dense list, one line per model | to find a specific name |

The slider beside them resizes the thumbnails: **Smaller** to see more, **Larger** to judge better.

### Search

The **Search…** field filters as you type. It waits a fraction of a second after your last
keystroke before searching, so it does not restart on every letter.

It searches the model's **name**.

### Sorting

| Sort | What it puts first |
|---|---|
| **Quality: highest first** | the most used and best rated models — the default sort |
| **Created: newest first** | the most recently published |
| **Created: oldest first** | the oldest, often the most proven |

---

## Filters

The **More filters** button opens the per-criterion menus. They are not the same in every
workspace, because they do not make sense everywhere.

### Origin — available everywhere

| Value | What it means |
|---|---|
| **Official** | published by Scenario |
| **Community** | published by somebody else |

### Capability — what the model can take in and give back

This is the most useful filter. The vocabulary is technical but short:

**In the Image workspace**

| Capability | In plain words |
|---|---|
| **Text to image** | you write a sentence, it draws |
| **Image to image** | you give a starting image, it transforms it |
| **Inpainting** | you erase an area, it redraws it |
| **Outpainting** | it extends the image beyond its edges |
| **Guidance** | it follows a structure you impose — a pose, an outline |
| **Reference** | it takes style cues from an image you supply |

**In the Video workspace**

| Capability | In plain words |
|---|---|
| **Text to video** | a sentence becomes a moving shot |
| **Image to video** | a still image starts moving |
| **Video to video** | a video is turned into another |

**In the 3D workspace**

| Capability | In plain words |
|---|---|
| **Text to 3D** | a sentence becomes an object with volume |
| **Image to 3D** | a photo becomes an object with volume |
| **3D to 3D** | an object is turned into another |

**In the Audio workspace**

| Capability | In plain words |
|---|---|
| **Text to audio** | a sentence becomes a sound or a piece of music |
| **Audio to audio** | a sound is turned into another |
| **Video to audio** | a video gets a soundtrack |

**In the Textures workspace**

| Capability | In plain words |
|---|---|
| **Text to texture** | a sentence becomes a material |
| **Image to texture** | an image is turned into a material |
| **Texture guidance** | it follows a structure you impose |
| **Texture reference** | it takes cues from a material you supply |

### Tag — the publishers' keywords

Labels put there by whoever publishes the models. The menu shows them **translated**; it is the
original label, untranslated, that reaches the catalogue — you read "First frame", the filter asks
for `First Frame`.

A few examples, by workspace: "Characters", "Fantasy", "Cartoon" for image; "First frame", "Video
editing" for video; "Multiview", "Motion" for 3D; "Music", "Text to speech" for audio.

Acronyms stay as they are, having no translation that would make anything clearer: `T2V`, `I2V`,
`V2V`, `PBR`, `TTS`, and the product name `Flux.1 LoRA`.

### Publisher — who made the model

The big names in the field, different per workspace:

| Workspace | Publishers offered |
|---|---|
| Image | Deacon, Black Forest Labs, Recraft, Ideogram, Google, Qwen, Alibaba |
| Video | Kling, Vidu, Alibaba, Wan, Bytedance, Luma, Google, Grok |
| 3D | Tripo, Tencent, Meshy, Hunyuan, Rodin |
| Audio | ElevenLabs, Google, Bytedance |

### Date — how long the model has existed

**Last 24 hours** · **Last 7 days** · **Last 30 days** · **Last 3 months**.

Useful for seeing what has just come out.

> **The Skyboxes workspace has no capabilities, tags or publishers to filter on, and the Textures
> workspace has no tags or publishers.** That is not an oversight: those families hold only a handful
> of models, and a menu that narrows three lines is useless. The Texture family was split out of the
> Image family on its capabilities alone — lending it the image tags would offer labels no texture
> model carries.

---

## Choosing

One click on a card chooses the model. Its name appears at the top of the panel, and it is the one
the **Generate** panel, just below, will put to work.

**The choice is remembered per family.** You choose an image model, switch to 3D, come back: your
image model is still there.

You can also fix a **default model** for each family, once and for all:
**Settings ▸ Generation ▸ Image** (or Video, 3D, Audio, Upscaling, Background removal, Vectorization). Leave
the setting on "Ask every time" to choose at each generation.

---

## Two details worth knowing

**A model appears in one workspace only.** The studio works out which family a model belongs to
from what it takes in and gives back: a model that returns a video is in the Video workspace, a
model that returns a sound is in the Audio workspace. If you are hunting for a model and cannot
find it, the first question to ask is **"am I in the right workspace?"**.

Three families have no workspace at all: **upscale**, **background removal** and
**vectorisation**. Their models take an image and return one, like image models, but they do a job
of their own and the studio files them apart. The **Models** panel therefore shows them nowhere:
their model is chosen in **Settings ▸ Generation**, and it is the **Image** menu's edits — Enlarge,
Cut out, Vectorize — that use them.

| Edit | Family asked for | Where its model is set |
|---|---|---|
| Regenerate the region, Extend | image | the Image workspace's **Models** panel |
| Enlarge | upscale | **Settings ▸ Generation ▸ Upscaling** |
| Cut out | background removal | **Settings ▸ Generation ▸ Background removal** |
| Vectorize | vectorisation | **Settings ▸ Generation ▸ Vectorization** |

With no model set, the edit does not leave and opens the screen where you choose one. Nothing is
sent, nothing is billed.

**The thumbnails are not all the same kind.** Most public models have no presentation image. The
studio then shows one of their generation samples instead. It is representative of what the model
can do, but it is not an official calling card.

**Images are only loaded for what you are looking at.** The studio downloads thumbnails only for
the cards that actually reach the screen, batched at each pause in scrolling. Scroll fast and they
appear slightly late — that is normal, and it is what keeps the list smooth across a catalogue of
several hundred models.

<!-- SCREENSHOT: the Models panel in grid view, filters open.
     Save to ../../images/models-grid.png -->

---

## How to choose well, in practice

**1. Start from the quality sort.** The first in the list are the most used. On an ordinary
subject, they are enough.

**2. Filter by capability before filtering by name.** If you want to transform an existing image,
the **Image to image** filter eliminates every text-only model in one go.

**3. Read the description.** It is short and often says the essential: the style, what the model
was trained for.

**4. Try, compare, keep.** A model is judged on three generations, not on its thumbnail. When you
find one that suits you, make it the default model of its family.

---

[← Projects](04-projects.md) · [Contents](../user-guide.md) · [Next chapter: Generating →](06-generating.md)
