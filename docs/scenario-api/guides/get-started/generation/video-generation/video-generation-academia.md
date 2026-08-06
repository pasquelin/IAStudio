---
title: Academia | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Academia** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Foley Control](#foley-control)
- [MM Audio](#mm-audio)
- [MM Audio 2](#mm-audio-2)
- [Reverse Video](#reverse-video)
- [Video Foreground Extractor - BiRefNet v2](#video-foreground-extractor---birefnet-v2)

---

## Foley Control

Foley Control is a model that automatically generates synchronized sound effects for videos, using text prompts to shape the type of sound while matching the timing and action on screen.

**Model ID:** `model_controlfoley`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_controlfoley/markdown>

| Parameter           | Type    | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                                                                |
| ------------------- | ------- | -------- | ------- | --- | ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`             | file    | Yes      | -       | -   | -          | -              | Video to generate synchronized audio for.                                                                                                                                  |
| `prompt`            | string  | No       | -       | -   | -          | -              | Optional text prompt describing the desired audio. When combined with the video it provides text-controlled video-to-audio generation; leave empty for pure video-to-audio |
| `negativePrompt`    | string  | No       | -       | -   | -          | -              | Audio characteristics to avoid.                                                                                                                                            |
| `referenceAudio`    | file    | No       | -       | -   | -          | -              | Optional 2-4 second reference audio clip whose timbre should guide the generated audio. Audio shorter than 2s is zero-padded; longer is truncated.                         |
| `duration`          | number  | No       | `8`     | 1   | 30         | -              | Target audio duration in seconds. Truncated to the source video length when shorter.                                                                                       |
| `numInferenceSteps` | number  | No       | `25`    | 4   | 100        | -              | Number of steps.                                                                                                                                                           |
| `guidanceScale`     | number  | No       | `4.5`   | 0   | 20         | -              | Classifier-free guidance strength.                                                                                                                                         |
| `maskAwayClip`      | boolean | No       | `false` | -   | -          | -              | Disable the CLIP visual stream for text-driven generation.                                                                                                                 |
| `seed`              | number  | No       | -       | 0   | 2147483647 | -              | Optional seed for reproducibility.                                                                                                                                         |

## MM Audio

**Model ID:** `model_mm-audio`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_mm-audio/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                                           |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -   | -              | Text prompt for generated audio                                                                                       |
| `video`          | file   | Yes      | -       | -   | -   | -              | Video file for video-to-audio generation                                                                              |
| `negativePrompt` | string | No       | -       | -   | -   | -              | Negative prompt to avoid certain sounds                                                                               |
| `duration`       | number | No       | `30`    | 1   | 30  | -              | Output duration in seconds. If this value exceeds the video’s length, the video’s full duration will be used instead. |
| `numSteps`       | number | No       | `25`    | 4   | 50  | -              | The number of steps to generate the audio for                                                                         |
| `cfgStrength`    | number | No       | `4.5`   | 1   | 20  | -              | Higher values will keep output closer to the prompt                                                                   |
| `seed`           | number | No       | -       | -1  | -   | -              | Random seed. Use -1 or leave blank to randomize the seed                                                              |

## MM Audio 2

MMAudio generates synchronized audio given video and text prompts. It can be combined with video models to get videos with audio.

**Model ID:** `model_mm-audio-2`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_mm-audio-2/markdown>

| Parameter        | Type    | Required | Default | Min | Max   | Allowed Values | Description                                         |
| ---------------- | ------- | -------- | ------- | --- | ----- | -------------- | --------------------------------------------------- |
| `prompt`         | string  | Yes      | -       | -   | -     | -              | Text prompt for generated audio                     |
| `video`          | file    | Yes      | -       | -   | -     | -              | Video to generate the audio for.                    |
| `negativePrompt` | string  | No       | -       | -   | -     | -              | Negative prompt to avoid certain sounds             |
| `duration`       | number  | No       | `8`     | 1   | 30    | -              | Output duration in seconds.                         |
| `numSteps`       | number  | No       | `25`    | 4   | 50    | -              | The number of steps to generate the audio for       |
| `cfgStrength`    | number  | No       | `4.5`   | 1   | 20    | -              | Higher values will keep output closer to the prompt |
| `maskAwayClip`   | boolean | No       | `false` | -   | -     | -              | Mask away certain sounds in the audio               |
| `seed`           | number  | No       | -       | 0   | 65535 | -              | Random seed for reproducible generation             |

## Reverse Video

Reverse a video so it plays backwards, including both video and audio streams.

**Model ID:** `model_reverse-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_reverse-video/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                                                                                                              |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `video`   | file | Yes      | -       | -   | -   | -              | The video you want to play backwards. Both the picture and the sound are reversed. Accepts MP4, MOV, WebM, M4V, and GIF. |

## Video Foreground Extractor - BiRefNet v2

BiRefNet is a model that cleanly separates the main subject from the background in a video, producing clear and detailed cutouts.

**Model ID:** `model_birefnet-v2-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_birefnet-v2-video/markdown>

| Parameter             | Type    | Required | Default               | Min | Max | Allowed Values                                                                                | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ------- | -------- | --------------------- | --- | --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`               | file    | Yes      | -                     | -   | -   | -                                                                                             | Video to remove background from                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `model`               | string  | No       | `General Use (Light)` | -   | -   | `General Use (Light)`, `General Use (Light 2K)`, `General Use (Heavy)`, `Matting`, `Portrait` | Model to use for background removal. The ‘General Use (Light)’ model is the original model used in the BiRefNet repository. The ‘General Use (Light)’ model is the original model used in the BiRefNet repository but trained with 2K images. The ‘General Use (Heavy)’ model is a slower but more accurate model. The ‘Matting’ model is a model trained specifically for matting images. The ‘Portrait’ model is a model trained specifically for portrait images. The ‘General Use (Light)’ model is recommended for most use cases. |
| `operatingResolution` | string  | No       | `1024x1024`           | -   | -   | `1024x1024`, `2048x2048`                                                                      | The resolution to operate on. The higher the resolution, the more accurate the output will be for high res input images.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `outputMask`          | boolean | No       | `false`               | -   | -   | -                                                                                             | Whether to output the mask used to remove the background                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `refineForeground`    | boolean | No       | `true`                | -   | -   | -                                                                                             | Refine the foreground for better results                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `videoQuality`        | string  | No       | `high`                | -   | -   | `low`, `medium`, `high`, `maximum`                                                            | Video output quality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `videoWriteMode`      | string  | No       | `balanced`            | -   | -   | `fast`, `balanced`, `small`                                                                   | Video write mode for encoding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `videoOutputType`     | string  | No       | `VP9 (.webm)`         | -   | -   | `X264 (.mp4)`, `VP9 (.webm)`, `PRORES4444 (.mov)`, `GIF (.gif)`                               | Output format. Transparency (alpha): VP9 (.webm) and ProRes 4444 (.mov). MP4 has no alpha. GIF: limited transparency only.                                                                                                                                                                                                                                                                                                                                                                                                              |
