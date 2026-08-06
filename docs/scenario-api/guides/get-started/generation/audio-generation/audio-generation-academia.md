---
title: Academia | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Academia** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [ACE-Step 1.5 Edit Add Layer](#ace-step-15-edit-add-layer)
- [ACE-Step 1.5 Edit Complete Track](#ace-step-15-edit-complete-track)
- [ACE-Step 1.5 Edit Stem Extract](#ace-step-15-edit-stem-extract)
- [ACE-Step 1.5 Quality Cover](#ace-step-15-quality-cover)
- [ACE-Step 1.5 Quality Repaint](#ace-step-15-quality-repaint)
- [ACE-Step 1.5 Quality Text to Music](#ace-step-15-quality-text-to-music)
- [ACE-Step 1.5 Turbo Cover](#ace-step-15-turbo-cover)
- [ACE-Step 1.5 Turbo Repaint](#ace-step-15-turbo-repaint)
- [ACE-Step 1.5 Turbo Text to Music](#ace-step-15-turbo-text-to-music)
- [Lux TTS](#lux-tts)
- [MM Audio 2 Text To Audio](#mm-audio-2-text-to-audio)
- [Tada 1B Text to Speech](#tada-1b-text-to-speech)
- [Tada 3B Text to Speech](#tada-3b-text-to-speech)

---

## ACE-Step 1.5 Edit Add Layer

Add one instrument stem on top of existing audio, matched to key, tempo, and groove. Build arrangements layer by layer.

**Model ID:** `model_ace-step-1-5-edit-add-layer`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-edit-add-layer/markdown>

| Parameter         | Type    | Required | Default | Min | Max | Allowed Values                                                                                                                  | Description                                                                                                                    |
| ----------------- | ------- | -------- | ------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `srcAudio`        | file    | Yes      | -       | -   | -   | -                                                                                                                               | The existing track to layer onto.                                                                                              |
| `trackName`       | string  | Yes      | -       | -   | -   | `vocals`, `backing_vocals`, `drums`, `bass`, `guitar`, `keyboard`, `percussion`, `strings`, `synth`, `fx`, `brass`, `woodwinds` | The stem to add on top of the source audio.                                                                                    |
| `prompt`          | string  | Yes      | -       | -   | -   | -                                                                                                                               | Describe the new stem, e.g. “acoustic drum kit groove matching a fingerpicked folk guitar”.                                    |
| `repaintingStart` | number  | No       | `0`     | 0   | -   | -                                                                                                                               | Where the new layer begins, in seconds.                                                                                        |
| `repaintingEnd`   | number  | No       | `-1`    | -1  | -   | -                                                                                                                               | Where the new layer ends, in seconds. Use -1 through to the end of the track.                                                  |
| `thinking`        | boolean | No       | `true`  | -   | -   | -                                                                                                                               | Lets the model plan the layer first for tighter musical coherence. On by default.                                              |
| `numOutputs`      | number  | No       | `1`     | 1   | 4   | -                                                                                                                               | How many audio variations to generate (1-4). More outputs cost more.                                                           |
| `seed`            | number  | No       | -       | 0   | -   | -                                                                                                                               | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time. |
| `guidanceScale`   | number  | No       | `7`     | 1   | 15  | -                                                                                                                               | How strictly the result follows the prompt. Applies on the XL base edit tier.                                                  |

## ACE-Step 1.5 Edit Complete Track

Build full accompaniment around a partial track. Turn a bare vocal or solo instrument into a full arrangement (Vocal2BGM).

**Model ID:** `model_ace-step-1-5-edit-complete-track`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-edit-complete-track/markdown>

| Parameter              | Type          | Required | Default             | Min | Max | Allowed Values                                                                                                                  | Description                                                                                                                    |
| ---------------------- | ------------- | -------- | ------------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `srcAudio`             | file          | Yes      | -                   | -   | -   | -                                                                                                                               | The partial track to complete, such as an a cappella vocal or solo guitar.                                                     |
| `completeTrackClasses` | string\_array | Yes      | `drums,bass,guitar` | -   | -   | `vocals`, `backing_vocals`, `drums`, `bass`, `guitar`, `keyboard`, `percussion`, `strings`, `synth`, `fx`, `brass`, `woodwinds` | Which stems to generate around the source, e.g. drums, bass, and guitar.                                                       |
| `prompt`               | string        | Yes      | -                   | -   | -   | -                                                                                                                               | Overall style for the accompaniment, e.g. “rock style completion” or “warm lo-fi backing”.                                     |
| `thinking`             | boolean       | No       | `true`              | -   | -   | -                                                                                                                               | Lets the model plan the arrangement first for tighter musical coherence. On by default.                                        |
| `numOutputs`           | number        | No       | `1`                 | 1   | 4   | -                                                                                                                               | How many audio variations to generate (1-4). More outputs cost more.                                                           |
| `seed`                 | number        | No       | -                   | 0   | -   | -                                                                                                                               | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time. |
| `guidanceScale`        | number        | No       | `7`                 | 1   | 15  | -                                                                                                                               | How strictly the result follows the prompt. Applies on the XL base edit tier.                                                  |

## ACE-Step 1.5 Edit Stem Extract

Isolate a stem from a mixed track: vocals, drums, bass, guitar, and more. Uses the full-quality edit model with 50 diffusion steps.

**Model ID:** `model_ace-step-1-5-edit-stem-extract`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-edit-stem-extract/markdown>

| Parameter       | Type   | Required | Default | Min | Max | Allowed Values                                                                                                                  | Description                                                                                                                    |
| --------------- | ------ | -------- | ------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `srcAudio`      | file   | Yes      | -       | -   | -   | -                                                                                                                               | The mixed track to separate.                                                                                                   |
| `trackName`     | string | Yes      | -       | -   | -   | `vocals`, `backing_vocals`, `drums`, `bass`, `guitar`, `keyboard`, `percussion`, `strings`, `synth`, `fx`, `brass`, `woodwinds` | The stem to isolate from the mix.                                                                                              |
| `prompt`        | string | No       | -       | -   | -   | -                                                                                                                               | Optional hint about the stem character, e.g. “female pop vocals”.                                                              |
| `numOutputs`    | number | No       | `1`     | 1   | 4   | -                                                                                                                               | How many audio variations to generate (1-4). More outputs cost more.                                                           |
| `seed`          | number | No       | -       | 0   | -   | -                                                                                                                               | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time. |
| `guidanceScale` | number | No       | `7`     | 1   | 15  | -                                                                                                                               | How strictly the result follows the prompt. Applies on the XL base edit tier.                                                  |

## ACE-Step 1.5 Quality Cover

Higher-fidelity cover and restyle. Preserve melody while changing genre, vocals, and arrangement, or borrow style from a reference audio.

**Model ID:** `model_ace-step-1-5-quality-cover`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-quality-cover/markdown>

| Parameter            | Type    | Required | Default   | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                         | Description                                                                                                                                                      |
| -------------------- | ------- | -------- | --------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `srcAudio`           | file    | Yes      | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | The song you want to cover or restyle.                                                                                                                           |
| `referenceAudio`     | file    | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | An optional track whose style you want to borrow: its genre, mood, and feel guide the result.                                                                    |
| `prompt`             | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Describe the style you want: genre, mood, instruments, vocal character, and production. For example, “acoustic folk, warm and mellow, female vocals.”            |
| `lyrics`             | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Optional new or changed lyrics. Use section tags like \[Verse] and \[Chorus] to mark structure.                                                                  |
| `audioCoverStrength` | number  | No       | `1`       | 0   | 1   | -                                                                                                                                                                                                                                                                                                                      | How closely the result follows the original song. Higher values stay faithful to the source; use low values (around 0.2) when you mainly want to borrow a style. |
| `instrumental`       | boolean | No       | `false`   | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Creates a version without vocals.                                                                                                                                |
| `vocalLanguage`      | string  | No       | `unknown` | -   | -   | `ar`, `az`, `bg`, `bn`, `ca`, `cs`, `da`, `de`, `el`, `en`, `es`, `fa`, `fi`, `fr`, `he`, `hi`, `hr`, `ht`, `hu`, `id`, `is`, `it`, `ja`, `ko`, `la`, `lt`, `ms`, `ne`, `nl`, `no`, `pa`, `pl`, `pt`, `ro`, `ru`, `sa`, `sk`, `sr`, `sv`, `sw`, `ta`, `te`, `th`, `tl`, `tr`, `uk`, `ur`, `vi`, `yue`, `zh`, `unknown` | The language for the vocals. Leave as Auto to detect it automatically.                                                                                           |
| `numOutputs`         | number  | No       | `1`       | 1   | 4   | -                                                                                                                                                                                                                                                                                                                      | How many audio variations to generate (1-4). More outputs cost more.                                                                                             |
| `thinking`           | boolean | No       | `true`    | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Lets the model plan the track first, which improves how closely it follows your prompt. On by default.                                                           |
| `seed`               | number  | No       | -         | 0   | -   | -                                                                                                                                                                                                                                                                                                                      | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time.                                   |

## ACE-Step 1.5 Quality Repaint

Higher-fidelity region regeneration. Replace a section of an existing track guided by prompt and lyrics.

**Model ID:** `model_ace-step-1-5-quality-repaint`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-quality-repaint/markdown>

| Parameter         | Type    | Required | Default   | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                         | Description                                                                                                                    |
| ----------------- | ------- | -------- | --------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `srcAudio`        | file    | Yes      | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | The track that contains the section you want to regenerate.                                                                    |
| `prompt`          | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Describe the music for the new section: genre, mood, instruments, and tempo.                                                   |
| `lyrics`          | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Optional lyrics for the new section. Use section tags like \[Verse] and \[Chorus] to mark structure.                           |
| `repaintingStart` | number  | No       | `0`       | 0   | -   | -                                                                                                                                                                                                                                                                                                                      | Where the section to regenerate begins, in seconds.                                                                            |
| `repaintingEnd`   | number  | No       | `-1`      | -1  | -   | -                                                                                                                                                                                                                                                                                                                      | Where the section to regenerate ends, in seconds. Use -1 to regenerate through to the end of the track.                        |
| `instrumental`    | boolean | No       | `false`   | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Regenerates the section without vocals.                                                                                        |
| `vocalLanguage`   | string  | No       | `unknown` | -   | -   | `ar`, `az`, `bg`, `bn`, `ca`, `cs`, `da`, `de`, `el`, `en`, `es`, `fa`, `fi`, `fr`, `he`, `hi`, `hr`, `ht`, `hu`, `id`, `is`, `it`, `ja`, `ko`, `la`, `lt`, `ms`, `ne`, `nl`, `no`, `pa`, `pl`, `pt`, `ro`, `ru`, `sa`, `sk`, `sr`, `sv`, `sw`, `ta`, `te`, `th`, `tl`, `tr`, `uk`, `ur`, `vi`, `yue`, `zh`, `unknown` | The language for the vocals. Leave as Auto to detect it automatically.                                                         |
| `numOutputs`      | number  | No       | `1`       | 1   | 4   | -                                                                                                                                                                                                                                                                                                                      | How many audio variations to generate (1-4). More outputs cost more.                                                           |
| `thinking`        | boolean | No       | `true`    | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Lets the model plan the section first, which improves how closely it follows your prompt. On by default.                       |
| `seed`            | number  | No       | -         | 0   | -   | -                                                                                                                                                                                                                                                                                                                      | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time. |

## ACE-Step 1.5 Quality Text to Music

Higher-fidelity music generation with a 4B model and stronger planner. Lyrics, vocals, and structure tags; full tracks up to 10 minutes.

**Model ID:** `model_ace-step-1-5-quality-text-to-music`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-quality-text-to-music/markdown>

| Parameter       | Type    | Required | Default   | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                         | Description                                                                                                                                                                       |
| --------------- | ------- | -------- | --------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`        | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Describe the music you want: genre, mood, instruments, and tempo. Either a prompt or lyrics is required.                                                                          |
| `lyrics`        | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | The lyrics to sing, with optional section tags like \[Verse] and \[Chorus]. Leave empty and turn on Instrumental for music without vocals. Either lyrics or a prompt is required. |
| `instrumental`  | boolean | No       | `false`   | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Creates music without vocals.                                                                                                                                                     |
| `vocalLanguage` | string  | No       | `unknown` | -   | -   | `ar`, `az`, `bg`, `bn`, `ca`, `cs`, `da`, `de`, `el`, `en`, `es`, `fa`, `fi`, `fr`, `he`, `hi`, `hr`, `ht`, `hu`, `id`, `is`, `it`, `ja`, `ko`, `la`, `lt`, `ms`, `ne`, `nl`, `no`, `pa`, `pl`, `pt`, `ro`, `ru`, `sa`, `sk`, `sr`, `sv`, `sw`, `ta`, `te`, `th`, `tl`, `tr`, `uk`, `ur`, `vi`, `yue`, `zh`, `unknown` | The language for the vocals. Leave as Auto to detect it automatically.                                                                                                            |
| `duration`      | number  | No       | -         | 10  | 600 | -                                                                                                                                                                                                                                                                                                                      | How long the track should be, in seconds (10-600). Leave empty to let the model decide. Longer tracks cost more.                                                                  |
| `bpm`           | number  | No       | -         | 30  | 300 | -                                                                                                                                                                                                                                                                                                                      | The tempo, in beats per minute. Leave empty to let the model choose.                                                                                                              |
| `keyscale`      | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | The musical key, such as “C Major” or “Am.” Leave empty to let the model choose.                                                                                                  |
| `numOutputs`    | number  | No       | `1`       | 1   | 4   | -                                                                                                                                                                                                                                                                                                                      | How many audio variations to generate (1-4). More outputs cost more.                                                                                                              |
| `thinking`      | boolean | No       | `true`    | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Lets the model plan the track first, which improves how closely it follows your prompt. On by default.                                                                            |
| `seed`          | number  | No       | -         | 0   | -   | -                                                                                                                                                                                                                                                                                                                      | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time.                                                    |

## ACE-Step 1.5 Turbo Cover

Re-render or restyle an existing track with ACE-Step 1.5 turbo. Preserve melody while changing genre, vocals, and arrangement, or use a reference audio for style transfer.

**Model ID:** `model_ace-step-1-5-turbo-cover`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-turbo-cover/markdown>

| Parameter            | Type    | Required | Default   | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                         | Description                                                                                                                                                      |
| -------------------- | ------- | -------- | --------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `srcAudio`           | file    | Yes      | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | The song you want to cover or restyle.                                                                                                                           |
| `referenceAudio`     | file    | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | An optional track whose style you want to borrow: its genre, mood, and feel guide the result.                                                                    |
| `prompt`             | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Describe the style you want: genre, mood, instruments, vocal character, and production. For example, “acoustic folk, warm and mellow, female vocals.”            |
| `lyrics`             | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Optional new or changed lyrics. Use section tags like \[Verse] and \[Chorus] to mark structure.                                                                  |
| `audioCoverStrength` | number  | No       | `1`       | 0   | 1   | -                                                                                                                                                                                                                                                                                                                      | How closely the result follows the original song. Higher values stay faithful to the source; use low values (around 0.2) when you mainly want to borrow a style. |
| `instrumental`       | boolean | No       | `false`   | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Creates a version without vocals.                                                                                                                                |
| `vocalLanguage`      | string  | No       | `unknown` | -   | -   | `ar`, `az`, `bg`, `bn`, `ca`, `cs`, `da`, `de`, `el`, `en`, `es`, `fa`, `fi`, `fr`, `he`, `hi`, `hr`, `ht`, `hu`, `id`, `is`, `it`, `ja`, `ko`, `la`, `lt`, `ms`, `ne`, `nl`, `no`, `pa`, `pl`, `pt`, `ro`, `ru`, `sa`, `sk`, `sr`, `sv`, `sw`, `ta`, `te`, `th`, `tl`, `tr`, `uk`, `ur`, `vi`, `yue`, `zh`, `unknown` | The language for the vocals. Leave as Auto to detect it automatically.                                                                                           |
| `numOutputs`         | number  | No       | `1`       | 1   | 4   | -                                                                                                                                                                                                                                                                                                                      | How many audio variations to generate (1-4). More outputs cost more.                                                                                             |
| `thinking`           | boolean | No       | `true`    | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Lets the model plan the track first, which improves how closely it follows your prompt. On by default.                                                           |
| `seed`               | number  | No       | -         | 0   | -   | -                                                                                                                                                                                                                                                                                                                      | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time.                                   |

## ACE-Step 1.5 Turbo Repaint

Regenerate a time region in an existing track with ACE-Step 1.5 turbo. Replace a verse, chorus, or section with new music guided by prompt and lyrics.

**Model ID:** `model_ace-step-1-5-turbo-repaint`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-turbo-repaint/markdown>

| Parameter         | Type    | Required | Default   | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                         | Description                                                                                                                    |
| ----------------- | ------- | -------- | --------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `srcAudio`        | file    | Yes      | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | The track that contains the section you want to regenerate.                                                                    |
| `prompt`          | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Describe the music for the new section: genre, mood, instruments, and tempo.                                                   |
| `lyrics`          | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Optional lyrics for the new section. Use section tags like \[Verse] and \[Chorus] to mark structure.                           |
| `repaintingStart` | number  | No       | `0`       | 0   | -   | -                                                                                                                                                                                                                                                                                                                      | Where the section to regenerate begins, in seconds.                                                                            |
| `repaintingEnd`   | number  | No       | `-1`      | -1  | -   | -                                                                                                                                                                                                                                                                                                                      | Where the section to regenerate ends, in seconds. Use -1 to regenerate through to the end of the track.                        |
| `instrumental`    | boolean | No       | `false`   | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Regenerates the section without vocals.                                                                                        |
| `vocalLanguage`   | string  | No       | `unknown` | -   | -   | `ar`, `az`, `bg`, `bn`, `ca`, `cs`, `da`, `de`, `el`, `en`, `es`, `fa`, `fi`, `fr`, `he`, `hi`, `hr`, `ht`, `hu`, `id`, `is`, `it`, `ja`, `ko`, `la`, `lt`, `ms`, `ne`, `nl`, `no`, `pa`, `pl`, `pt`, `ro`, `ru`, `sa`, `sk`, `sr`, `sv`, `sw`, `ta`, `te`, `th`, `tl`, `tr`, `uk`, `ur`, `vi`, `yue`, `zh`, `unknown` | The language for the vocals. Leave as Auto to detect it automatically.                                                         |
| `numOutputs`      | number  | No       | `1`       | 1   | 4   | -                                                                                                                                                                                                                                                                                                                      | How many audio variations to generate (1-4). More outputs cost more.                                                           |
| `audioFormat`     | string  | No       | `mp3`     | -   | -   | `mp3`, `wav`, `flac`                                                                                                                                                                                                                                                                                                   | The audio file type you get back.                                                                                              |
| `thinking`        | boolean | No       | `true`    | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Lets the model plan the section first, which improves how closely it follows your prompt. On by default.                       |
| `seed`            | number  | No       | -         | 0   | -   | -                                                                                                                                                                                                                                                                                                                      | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time. |

## ACE-Step 1.5 Turbo Text to Music

Open-source music generation with lyrics, vocals, and structure tags like \[Verse] and \[Chorus]. Full tracks up to 10 minutes with ACE-Step v1.5 turbo.

**Model ID:** `model_ace-step-1-5-turbo-text-to-music`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ace-step-1-5-turbo-text-to-music/markdown>

| Parameter       | Type    | Required | Default   | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                         | Description                                                                                                                                                                       |
| --------------- | ------- | -------- | --------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`        | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Describe the music you want: genre, mood, instruments, and tempo. Either a prompt or lyrics is required.                                                                          |
| `lyrics`        | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | The lyrics to sing, with optional section tags like \[Verse] and \[Chorus]. Leave empty and turn on Instrumental for music without vocals. Either lyrics or a prompt is required. |
| `instrumental`  | boolean | No       | `false`   | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Creates music without vocals.                                                                                                                                                     |
| `vocalLanguage` | string  | No       | `unknown` | -   | -   | `ar`, `az`, `bg`, `bn`, `ca`, `cs`, `da`, `de`, `el`, `en`, `es`, `fa`, `fi`, `fr`, `he`, `hi`, `hr`, `ht`, `hu`, `id`, `is`, `it`, `ja`, `ko`, `la`, `lt`, `ms`, `ne`, `nl`, `no`, `pa`, `pl`, `pt`, `ro`, `ru`, `sa`, `sk`, `sr`, `sv`, `sw`, `ta`, `te`, `th`, `tl`, `tr`, `uk`, `ur`, `vi`, `yue`, `zh`, `unknown` | The language for the vocals. Leave as Auto to detect it automatically.                                                                                                            |
| `duration`      | number  | No       | -         | 10  | 600 | -                                                                                                                                                                                                                                                                                                                      | How long the track should be, in seconds (10-600). Leave empty to let the model decide. Longer tracks cost more.                                                                  |
| `bpm`           | number  | No       | -         | 30  | 300 | -                                                                                                                                                                                                                                                                                                                      | The tempo, in beats per minute. Leave empty to let the model choose.                                                                                                              |
| `keyscale`      | string  | No       | -         | -   | -   | -                                                                                                                                                                                                                                                                                                                      | The musical key, such as “C Major” or “Am.” Leave empty to let the model choose.                                                                                                  |
| `numOutputs`    | number  | No       | `1`       | 1   | 4   | -                                                                                                                                                                                                                                                                                                                      | How many audio variations to generate (1-4). More outputs cost more.                                                                                                              |
| `thinking`      | boolean | No       | `true`    | -   | -   | -                                                                                                                                                                                                                                                                                                                      | Lets the model plan the track first, which improves how closely it follows your prompt. On by default.                                                                            |
| `seed`          | number  | No       | -         | 0   | -   | -                                                                                                                                                                                                                                                                                                                      | A number that makes the first result repeatable; any extra outputs use random seeds. Leave empty for a fresh result each time.                                                    |

## Lux TTS

High-quality voice cloning TTS at 48kHz from text and a reference audio clip.

**Model ID:** `model_lux-tts`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_lux-tts/markdown>

| Parameter           | Type   | Required | Default | Min | Max        | Allowed Values | Description                                                         |
| ------------------- | ------ | -------- | ------- | --- | ---------- | -------------- | ------------------------------------------------------------------- |
| `prompt`            | string | Yes      | -       | -   | -          | -              | Text to convert to speech.                                          |
| `audio`             | file   | Yes      | -       | -   | -          | -              | Reference audio for voice cloning.                                  |
| `guidanceScale`     | number | No       | `3`     | 0   | 10         | -              | Higher values increase adherence to the reference voice.            |
| `numInferenceSteps` | number | No       | `4`     | 1   | 16         | -              | Number of flow-matching inference steps.                            |
| `maxRefLength`      | number | No       | `5`     | 1   | 15         | -              | Maximum reference audio duration used for voice encoding (seconds). |
| `seed`              | number | No       | -       | 0   | 2147483647 | -              | Seed for reproducible outputs.                                      |

## MM Audio 2 Text To Audio

MMAudio generates synchronized audio given text inputs. It can generate sounds described by a prompt.

**Model ID:** `model_mm-audio-2-t2a`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_mm-audio-2-t2a/markdown>

| Parameter        | Type    | Required | Default | Min | Max   | Allowed Values | Description                                         |
| ---------------- | ------- | -------- | ------- | --- | ----- | -------------- | --------------------------------------------------- |
| `prompt`         | string  | Yes      | -       | -   | -     | -              | Text prompt for generated audio                     |
| `negativePrompt` | string  | No       | -       | -   | -     | -              | Negative prompt to avoid certain sounds             |
| `duration`       | number  | No       | `8`     | 1   | 30    | -              | Output duration in seconds.                         |
| `numSteps`       | number  | No       | `25`    | 4   | 50    | -              | The number of steps to generate the audio for       |
| `cfgStrength`    | number  | No       | `4.5`   | 1   | 20    | -              | Higher values will keep output closer to the prompt |
| `maskAwayClip`   | boolean | No       | `false` | -   | -     | -              | Mask away certain sounds in the audio               |
| `seed`           | number  | No       | -       | 0   | 65535 | -              | Random seed for reproducible generation             |

## Tada 1B Text to Speech

Lighter Tada voice cloning text-to-speech variant with multilingual support.

**Model ID:** `model_tada-1b-text-to-speech`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tada-1b-text-to-speech/markdown>

| Parameter           | Type   | Required | Default | Min | Max | Allowed Values                                             | Description                                                             |
| ------------------- | ------ | -------- | ------- | --- | --- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `audio`             | file   | Yes      | -       | -   | -   | -                                                          | Reference audio for voice cloning.                                      |
| `prompt`            | string | Yes      | -       | -   | -   | -                                                          | Text to synthesize with the reference voice.                            |
| `transcript`        | string | No       | -       | -   | -   | -                                                          | Transcript of the reference audio. Required for non-English references. |
| `language`          | string | No       | `en`    | -   | -   | `en`, `ar`, `ch`, `de`, `es`, `fr`, `it`, `ja`, `pl`, `pt` | Language used for text alignment.                                       |
| `numInferenceSteps` | number | No       | `20`    | 1   | 50  | -                                                          | Number of ODE solver steps for acoustic generation.                     |
| `speedUpFactor`     | number | No       | `1`     | 0.5 | 2   | -                                                          | Values > 1 speed up and values < 1 slow down speech.                    |
| `temperature`       | number | No       | `0.6`   | 0   | 2   | -                                                          | Sampling temperature for text token generation.                         |
| `topP`              | number | No       | `0.9`   | 0   | 1   | -                                                          | Top-p nucleus sampling value.                                           |
| `repetitionPenalty` | number | No       | `1.1`   | 1   | 2   | -                                                          | Penalty applied to repeated tokens.                                     |
| `acousticCfgScale`  | number | No       | `1.6`   | 0   | 10  | -                                                          | Classifier-free guidance scale for acoustic generation.                 |
| `noiseTemperature`  | number | No       | `0.9`   | 0   | 2   | -                                                          | Temperature for diffusion noise during flow matching.                   |
| `numExtraSteps`     | number | No       | `0`     | 0   | 50  | -                                                          | Additional autoregressive steps for continuation.                       |

## Tada 3B Text to Speech

Voice cloning text-to-speech with multilingual alignment and expressive controls.

**Model ID:** `model_tada-3b-text-to-speech`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tada-3b-text-to-speech/markdown>

| Parameter           | Type   | Required | Default | Min | Max | Allowed Values                                             | Description                                                             |
| ------------------- | ------ | -------- | ------- | --- | --- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| `audio`             | file   | Yes      | -       | -   | -   | -                                                          | Reference audio for voice cloning.                                      |
| `prompt`            | string | Yes      | -       | -   | -   | -                                                          | Text to synthesize with the reference voice.                            |
| `transcript`        | string | No       | -       | -   | -   | -                                                          | Transcript of the reference audio. Required for non-English references. |
| `language`          | string | No       | `en`    | -   | -   | `en`, `ar`, `ch`, `de`, `es`, `fr`, `it`, `ja`, `pl`, `pt` | Language used for text alignment.                                       |
| `numInferenceSteps` | number | No       | `20`    | 1   | 50  | -                                                          | Number of ODE solver steps for acoustic generation.                     |
| `speedUpFactor`     | number | No       | `1`     | 0.5 | 2   | -                                                          | Values > 1 speed up and values < 1 slow down speech.                    |
| `temperature`       | number | No       | `0.6`   | 0   | 2   | -                                                          | Sampling temperature for text token generation.                         |
| `topP`              | number | No       | `0.9`   | 0   | 1   | -                                                          | Top-p nucleus sampling value.                                           |
| `repetitionPenalty` | number | No       | `1.1`   | 1   | 2   | -                                                          | Penalty applied to repeated tokens.                                     |
| `acousticCfgScale`  | number | No       | `1.6`   | 0   | 10  | -                                                          | Classifier-free guidance scale for acoustic generation.                 |
| `noiseTemperature`  | number | No       | `0.9`   | 0   | 2   | -                                                          | Temperature for diffusion noise during flow matching.                   |
| `numExtraSteps`     | number | No       | `0`     | 0   | 50  | -                                                          | Additional autoregressive steps for continuation.                       |
