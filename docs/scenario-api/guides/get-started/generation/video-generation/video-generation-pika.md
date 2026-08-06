---
title: Pika | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Pika** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Pika 2.2 Frames](#pika-22-frames)
- [Pika 2.2 I2V](#pika-22-i2v)
- [Pika 2.2 Scenes](#pika-22-scenes)
- [Pika 2.2 T2V](#pika-22-t2v)

---

## Pika 2.2 Frames

Discover ultimate control with Pikaframes key frame interpolation, a stunning image-to-video feature that allows you to upload up to 5 keyframes, customize their transition length and prompt, and see their images come to life

**Model ID:** `model_pika-2-2-frames`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pika-2-2-frames/markdown>

| Parameter         | Type          | Required | Default | Min | Max        | Allowed Values  | Description                                                                                                                                                                                                             |
| ----------------- | ------------- | -------- | ------- | --- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceImages` | file\_array   | Yes      | -       | -   | -          | -               | Keyframe images (2-5 images) to create transitions between                                                                                                                                                              |
| `prompt`          | string        | Yes      | -       | -   | -          | -               | A textual prompt to guide model generation.                                                                                                                                                                             |
| `negativePrompt`  | string        | No       | -       | -   | -          | -               | A negative prompt to guide the model.                                                                                                                                                                                   |
| `transitions`     | inputs\_array | No       | -       | -   | -          | -               | Configuration for each transition. Length must be ‘Keyframe images count - 1’. Total duration of all transitions must not exceed 25 seconds. If not provided, uses default 5-second transitions with the global prompt. |
| `resolution`      | string        | No       | `720p`  | -   | -          | `720p`, `1080p` | Resolution of the generated video.                                                                                                                                                                                      |
| `seed`            | number        | No       | -       | 0   | 2147483647 | -               | Seed for random number generation.                                                                                                                                                                                      |

## Pika 2.2 I2V

Turn photos into mind-blowing, dynamic videos in up to 1080p. Experience better image clarity and crisper, sharper visuals.

**Model ID:** `model_pika-2-2-i2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pika-2-2-i2v/markdown>

| Parameter        | Type   | Required | Default | Min | Max        | Allowed Values        | Description                                       |
| ---------------- | ------ | -------- | ------- | --- | ---------- | --------------------- | ------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -          | -                     | A textual prompt to guide model generation.       |
| `image`          | file   | Yes      | -       | -   | -          | -                     | Input image used as the first frame of the video. |
| `negativePrompt` | string | No       | -       | -   | -          | -                     | A negative prompt to guide the model.             |
| `resolution`     | string | No       | `720p`  | -   | -          | `720p`, `1080p`       | Resolution of the generated video.                |
| `duration`       | number | No       | `5`     | -   | -          | `5`, `10`             | Duration of the generated video in seconds.       |
| `aspectRatio`    | string | No       | `16:9`  | -   | -          | `16:9`, `1:1`, `9:16` | Aspect ratio of the generated video.              |
| `seed`           | number | No       | -       | 0   | 2147483647 | -                     | Seed for random number generation.                |

## Pika 2.2 Scenes

Build a shot from the exact character, object, wardrobe, and setting you want and watch them come to life in high definition. The model’s advanced image recognition intuits the role of each reference, and combines them seamlessly

**Model ID:** `model_pika-2-2-scenes`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pika-2-2-scenes/markdown>

| Parameter          | Type        | Required | Default   | Min | Max        | Allowed Values        | Description                                                                                          |
| ------------------ | ----------- | -------- | --------- | --- | ---------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| `referenceImages`  | file\_array | Yes      | -         | -   | -          | -                     | Images to combine into a video. Maximum 10 images.                                                   |
| `prompt`           | string      | Yes      | -         | -   | -          | -                     | A textual prompt to guide model generation.                                                          |
| `negativePrompt`   | string      | No       | -         | -   | -          | -                     | A negative prompt to guide the model.                                                                |
| `resolution`       | string      | No       | `720p`    | -   | -          | `720p`, `1080p`       | Resolution of the generated video.                                                                   |
| `duration`         | number      | No       | `5`       | -   | -          | `5`, `10`             | Duration of the generated video in seconds.                                                          |
| `aspectRatio`      | string      | No       | `16:9`    | -   | -          | `16:9`, `1:1`, `9:16` | Aspect ratio of the generated video.                                                                 |
| `ingredients_mode` | string      | No       | `precise` | -   | -          | `precise`, `creative` | Mode for integrating multiple images. Precise mode is more accurate, creative mode is more creative. |
| `seed`             | number      | No       | -         | 0   | 2147483647 | -                     | Seed for random number generation.                                                                   |

## Pika 2.2 T2V

Start with a simple text input to create dynamic generations that defy expectations in up to 1080p. Experience better image clarity and crisper, sharper visuals.

**Model ID:** `model_pika-2-2-t2v`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pika-2-2-t2v/markdown>

| Parameter        | Type   | Required | Default | Min | Max        | Allowed Values        | Description                                 |
| ---------------- | ------ | -------- | ------- | --- | ---------- | --------------------- | ------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -          | -                     | A textual prompt to guide model generation. |
| `negativePrompt` | string | No       | -       | -   | -          | -                     | A negative prompt to guide the model.       |
| `resolution`     | string | No       | `720p`  | -   | -          | `720p`, `1080p`       | Resolution of the generated video.          |
| `duration`       | number | No       | `5`     | -   | -          | `5`, `10`             | Duration of the generated video in seconds. |
| `aspectRatio`    | string | No       | `16:9`  | -   | -          | `16:9`, `1:1`, `9:16` | Aspect ratio of the generated video.        |
| `seed`           | number | No       | -       | 0   | 2147483647 | -                     | Seed for random number generation.          |
