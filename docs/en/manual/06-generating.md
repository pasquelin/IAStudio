# 6. Generating

[← Finding a model](05-models.md) · [Contents](../user-guide.md) · [Next chapter: Assets →](07-assets.md)

This is the heart of the studio: you describe, it makes.

---

## The principle, in three beats

**1. You fill in a form and press Generate.**

**2. The request leaves.** It does not come straight back. It becomes a **job**, visible in the
panel of the same name, with a progress bar.

**3. The result arrives** in the Assets panel and on your disk.

In between, you can keep working, switch workspace, open another document. Nothing blocks.

---

## The form

Choose a model in the **Models** panel, on the left, then open the **Generate** panel: its icon has
just appeared in the rail, and the panel takes the place of Models in the same half of the column.

**The form is not written by hand.** It is built from what the chosen model declares it can accept.
Two models therefore do not have the same form, and a model published tomorrow will have its own
too — with no update to the studio.

> If a model offers a setting the studio cannot represent, it still appears, as free text. A form
> never disappears because one field is unknown.

### The kinds of field you will meet

| What you see | What it is | What goes in it |
|---|---|---|
| A **large text area** | the *prompt* | your description |
| A **text line** | a short text | a word, a name, a value |
| A **number** | a quantity | often with a minimum and a maximum |
| A **checkbox** | yes or no | — |
| A **dropdown** | a list of imposed choices | a format, a style, a size |
| A **colour square** | a colour | a click opens the system picker |
| A **number with a die** 🎲 | the *seed* — see below | a number, or a click on the die |

Fields are **grouped** when the model groups them, and some **only appear when another has the
right value** — no point offering an effect's strength when the effect is switched off.

A required field left empty **stops the send**: the form flags it rather than letting a request
leave that the server would refuse.

---

## The prompt

This is the field that matters. A few principles, in order of importance.

### Write in English if you can

The great majority of models were trained on English descriptions. A prompt in another language
sometimes works, but less well. Grammar counts for little, words count for a lot.

**You do not need a translator elsewhere**: the **Translate to English** button, above the field,
does it. See the next section.

### Describe what is there

Models understand negation badly. "Without a car" has a good chance of producing a car. Describe
the scene as you want it instead: "an empty street at dawn".

### Go from subject to detail

A structure that almost always works:

```
[the subject], [what it is doing or how it looks], [the setting], [the light], [the style]
```

For example:

```
a small red lighthouse, standing on a rocky cliff, calm grey sea behind,
soft morning light, photographic
```

### Be concrete

| Vague | Precise |
|---|---|
| "something nice" | "a clearing at sunset, low mist" |
| "a character" | "an old woman in a wool coat, three-quarter view" |
| "warm colours" | "ochre, brick red, pale gold" |

### One word per idea, not ten

Stacking forty adjectives does not make the image forty times better. Beyond thirty words or so,
most models dilute. One accurate sentence beats three vague ones.

---

## Getting help writing the prompt

Three buttons sit above the field. They are not on every form: **the model is the one naming the
field to assist**, and the studio follows. A model that does not flag one shows no buttons — the
studio does not try to guess which of its fields is a prompt.

| Button | What it does |
|---|---|
| **Suggest variants** | has your draft rewritten by the model that will read it |
| **Translate to English** | rewrites your text in the language the models learned on |
| **Describe the style of the references** | reads the pictures already on the form and writes what they have in common |

While it works, "Writing variants…" appears and all three buttons are inactive.

### What a variant offers, and how you take it

Each variant appears in its own box, with up to three things:

- **the rewritten text**, the one you will adopt;
- **the reason** for the rewrite, in italics, when the model gives one;
- **the settings** it suggests alongside the text — a ratio, a step count — listed in plain sight
  below the proposal.

Two buttons, and the difference between them matters:

| Button | Effect |
|---|---|
| **Use the text** | replaces the prompt, **and nothing else** |
| **Text + settings** | replaces the prompt **and** applies the suggested settings |

**The second only appears when there are settings to apply.** Separating the two gestures is
deliberate: overwriting a ratio you have just chosen is not a decision a suggestion makes on its
own.

> Suggested settings are **filtered against what the model declares it accepts** before being
> applied. A value out of bounds is dropped, never forced back into range.

### The two refusals you will meet

| Message | What it means |
|---|---|
| "This text is already in English." | translation has nothing to do — the studio checks the language before calling |
| "Drop a reference picture to describe its style." | the form carries no picture to read |

Neither is a failure, and nothing is spent when they appear.

> **These requests are immediate**, unlike a generation: they do not enter the queue, do not show
> in the status line, and there is nothing to cancel. **Suggesting variants costs no creative
> units** — that is measured, not assumed. For translation and style reading the studio measures
> nothing: treat them as ordinary calls.

---

## The settings you meet most often

They are not the same everywhere, but these names recur:

| Common name | What it does | Advice |
|---|---|---|
| **prompt** | your description | see above |
| **negative prompt** | what you want to avoid | keep it short: "blurry, text, watermark" |
| **seed** | the starting point of randomness | see below |
| **steps** | the number of calculation steps | higher = longer, not necessarily better |
| **guidance** / **cfg** | how closely the model obeys the prompt | too high and the image turns harsh and saturated |
| **width** / **height** | the dimensions | often constrained to multiples of 8 or 64 |
| **num images** | how many images at once | each one consumes credit |
| **strength** | how much a starting image is transformed | 0 = unchanged, 1 = unrecognisable |

### The seed

A number that fixes randomness.

**Two generations with the same prompt, the same model and the same seed give the same image.**
Change the seed and you get a variant.

That is what makes an image **reproducible**. Got something almost right? Keep the seed, adjust the
prompt: you explore around the same result instead of starting over.

The **die button** 🎲 beside the field draws a new random seed.

---

## Generating

The **Generate** button, at the bottom of the form.

> **Button not responding?** It is inactive as long as no project is open — the message "Open a
> project to generate." appears above the form. A result has to land somewhere.

---

## Following your generations

They live **in the status line**, bottom right of the window — not in a panel.

That is deliberate. A generation is minutes of waiting you spend elsewhere: it has to be readable
from any workspace, and a panel could only be in one. There, it costs no space at all.

### The summary

```
3 generations  ▓▓▓▓▓░░░░░  45 %  ⌃
```

| Element | What it says |
|---|---|
| **"3 generations"** | how many are working right now |
| **The bar** | their average progress |
| **The percentage** | the same figure, spelled out |
| **The chevron** | one click opens the detail |

**When nothing is working, the summary disappears.** Unless something failed: "2 failures" stays on
screen, because a failure that vanished with the last running job is a failure nobody would have
read.

### The detail

One click opens the list above the status line. One line per generation, with the model's name and
its state.

| State | What is happening |
|---|---|
| **Queued** | the request is waiting its turn |
| **Running** | the model is working — the bar advances |
| **Done** | it is finished, the result has arrived in your assets |
| **Failed** | something went wrong — the line says what |
| **Cancelled** | you stopped it |

The **Cancel job** button stops anything not yet finished.

### The queue

The studio does not launch everything at once. It runs **three at a time** by default, and queues
the rest.

That number is adjustable: **Settings ▸ Generation ▸ Concurrent generations**, from 1 to 16.

> **Raising this number does not speed up the service.** It only makes it likelier that Scenario
> refuses your surplus requests. The queue exists precisely to spread a burst rather than have it
> rejected. Three is a good balance.

### Automatic retries

When a request fails because of a dropped connection or a busy server, the studio **retries on its
own**, waiting a little longer at each attempt.

The number of attempts is adjustable: **Settings ▸ Generation ▸ Maximum retries**, from 0 to 10.
Four by default.

> **An invalid API key is never retried.** Retrying would not fix it. The studio distinguishes what
> is worth another attempt from what is not.

### Switching accounts does not interrupt a running generation

**A job finishes on the account that launched it.** It captures its key the moment you press
Generate and keeps it to the end — including for dropping the result into your assets.

So you can launch a ten-minute video, switch to another account to go and find a model, and the
first one carries on quietly.

> What does change is **the catalogue**: moving from one account to another clears the previous
> one's remote models and assets. That is intended — they are two different libraries, and mixing
> them would have you choose a model your key cannot reach.

---

## When the result arrives

The line turns to **Done**, and the asset appears:

- in the **Assets** panel — the project's shelf;
- on your disk, in `assets/img/`, `assets/vid/`, `assets/aud/`… depending on its type.

**What you can then do with it depends on its type**, and this is where the studio surprises
people most often:

| The result is… | What is possible today |
|---|---|
| a **picture** | paint on it in an **image** document, use it as the starting point of another generation, or set it as a **sky** or as a material's **base colour** |
| a **video** or a **sound** | drop it on a **timeline** (Video workspace), or edit it (Audio workspace) |
| a **panorama** | place it in a **sky** document (Skyboxes workspace) |
| a **3D object** | nothing useful — the studio cannot open a mesh yet |

**A reminder about the gesture**, because it misleads: double-click **does not open a tab**, it
sends the asset into the tab already in front. Open the document meant to receive it first, with
the `+` button on the left rail. See [Assets](07-assets.md).

> **A generated picture is retouched in the Image workspace**: open a document with `+`, then
> drag the picture onto the canvas — it becomes a layer there. That document, however, does not
> save; `⇧⌘E` gets a PNG out of it. See [Image workspace](08-image-workspace.md).

<!-- SCREENSHOT: the Generate panel with a model's form, and the status line below with a running
     generation. Save to ../../images/generate.png -->

---

## Regenerating with the same settings

Select an asset in the shelf and look at the **Inspector**, on the right. If it knows the
generation that produced it, it shows the model, the prompt and the seed — and offers
**Regenerate**.

One click fills the generation form with those values. Change a single one and relaunch: that is
the fastest way to explore a direction.

> The values stay in the form until another "Regenerate" replaces them. Read it as "the last
> settings used".

---

## The errors, and what they mean

| Message | Cause | What to do |
|---|---|---|
| **No credentials saved.** | no API key | Settings ▸ Account |
| **Invalid API key or secret.** | one of the two strings is wrong | check it, often a stray space |
| **This API key lacks the required permissions.** | the key exists but cannot do this | check your plan at app.scenario.com |
| **Too many requests. Retrying…** | you exceeded the allowed rate | nothing, the studio retries on its own |
| **The Scenario service is temporarily unavailable.** | server-side outage | try again later |
| **Cannot reach Scenario.** | your internet connection | check the network |
| **The generation failed.** | the model refused the request | often an out-of-range parameter, or a refused prompt |
| **Could not save the result to disk.** | the project folder is no longer reachable | disk full, project moved, write permissions |
| **Invalid value.** | one field of the form | the offending field is flagged |

The chapter [When something goes wrong](16-troubleshooting.md) covers these cases in detail.

---

[← Finding a model](05-models.md) · [Contents](../user-guide.md) · [Next chapter: Assets →](07-assets.md)
