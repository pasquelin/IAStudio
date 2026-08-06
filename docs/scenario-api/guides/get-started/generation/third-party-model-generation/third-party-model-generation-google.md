---
title: Google | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Google** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Gemini 2.5 Flash](#gemini-25-flash)
- [Gemini 3.0 Pro](#gemini-30-pro)
- [Gemini 3.1 Flash (Nano Banana 2)](#gemini-31-flash-nano-banana-2)
- [Gemini 3.1 Flash-Lite Image (Nano Banana 2 Lite)](#gemini-31-flash-lite-image-nano-banana-2-lite)
- [Imagen 3](#imagen-3)
- [Imagen 3 Fast](#imagen-3-fast)
- [Imagen 4](#imagen-4)
- [Imagen 4 Fast](#imagen-4-fast)
- [Imagen 4 Ultra](#imagen-4-ultra)

---

## Gemini 2.5 Flash

Nano-banana is Google’s state-of-the-art image generation and editing model

**Model ID:** `model_google-gemini-2-5-flash-image-editing`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-gemini-2-5-flash-image-editing/markdown>

| Parameter         | Type        | Required | Default | Min | Max        | Allowed Values                                                                  | Description                                                            |
| ----------------- | ----------- | -------- | ------- | --- | ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `referenceImages` | file\_array | No       | -       | -   | -          | -                                                                               | Reference images for style or content guidance                         |
| `prompt`          | string      | Yes      | -       | -   | -          | -                                                                               | Text prompt for image generation/editing                               |
| `aspectRatio`     | string      | No       | `auto`  | -   | -          | `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `auto` | Aspect ratio for the generated image                                   |
| `numOutputs`      | number      | No       | `1`     | 1   | 4          | -                                                                               | Number of images to generate                                           |
| `seed`            | number      | No       | -       | 0   | 2147483647 | -                                                                               | Use a seed for reproducible results. Leave blank to use a random seed. |

## Gemini 3.0 Pro

Nano Banana Pro (a.k.a Nano Banana 2) is Google’s new state-of-the-art image generation and editing model

**Model ID:** `model_google-gemini-pro-image-editing`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-gemini-pro-image-editing/markdown>

| Parameter         | Type        | Required | Default | Min | Max        | Allowed Values                                                                  | Description                                                            |
| ----------------- | ----------- | -------- | ------- | --- | ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `referenceImages` | file\_array | No       | -       | -   | -          | -                                                                               | Reference images for style or content guidance                         |
| `prompt`          | string      | Yes      | -       | -   | -          | -                                                                               | Text prompt for image editing                                          |
| `aspectRatio`     | string      | No       | `auto`  | -   | -          | `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `auto` | Aspect ratio for the generated image                                   |
| `resolution`      | string      | No       | `2K`    | -   | -          | `1K`, `2K`, `4K`                                                                | Resolution for the generated image                                     |
| `useGoogleSearch` | boolean     | No       | `false` | -   | -          | -                                                                               | Use Google Search to find more information about the prompt            |
| `numOutputs`      | number      | No       | `1`     | 1   | 4          | -                                                                               | Number of images to generate                                           |
| `seed`            | number      | No       | -       | 0   | 2147483647 | -                                                                               | Use a seed for reproducible results. Leave blank to use a random seed. |

## Gemini 3.1 Flash (Nano Banana 2)

Nano Banana 2 combines Pro capabilities with Flash-tier speed — edit and generate images using multimodal understanding, up to 14 reference images or an input video (not both), and natural language instructions for context-aware edits that preserve composition, lighting, and style coherence.

**Model ID:** `model_google-gemini-3-1-flash`

**Capabilities:** `txt2img`, `img2img`, `video2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-gemini-3-1-flash/markdown>

| Parameter         | Type        | Required | Default | Min | Max        | Allowed Values                                                                  | Description                                                                                                                                                      |
| ----------------- | ----------- | -------- | ------- | --- | ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -          | -                                                                               | Text prompt for image generation/editing                                                                                                                         |
| `referenceImages` | file\_array | No       | -       | -   | -          | -                                                                               | Reference images for style or content guidance (up to 14). Mutually exclusive with input video — use reference images or a video, not both.                      |
| `video`           | file        | No       | -       | -   | -          | -                                                                               | Optional input video for video to image generation (e.g. a thumbnail from a clip). Mutually exclusive with reference images. Max \~15 MB inline.                 |
| `videoFps`        | number      | No       | `1`     | 0.1 | 24         | -                                                                               | Frame sampling rate for the input video in (0, 24] fps. Lower values sample fewer frames. Defaults to 1.0 fps when unset. Only applies when a video is provided. |
| `aspectRatio`     | string      | No       | `auto`  | -   | -          | `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `auto` | Aspect ratio for the generated image                                                                                                                             |
| `resolution`      | string      | No       | `1K`    | -   | -          | `512`, `1K`, `2K`, `4K`                                                         | Resolution for the generated image                                                                                                                               |
| `useGoogleSearch` | boolean     | No       | `false` | -   | -          | -                                                                               | Use Google Search to find more information about the prompt                                                                                                      |
| `thinkingLevel`   | string      | No       | `HIGH`  | -   | -          | `MINIMAL`, `LOW`, `MEDIUM`, `HIGH`                                              | Thinking level for the generated image                                                                                                                           |
| `numOutputs`      | number      | No       | `1`     | 1   | 4          | -                                                                               | Number of images to generate                                                                                                                                     |
| `seed`            | number      | No       | -       | 0   | 2147483647 | -                                                                               | Use a seed for reproducible results. Leave blank to use a random seed.                                                                                           |

## Gemini 3.1 Flash-Lite Image (Nano Banana 2 Lite)

Nano Banana 2 Lite is Google’s fastest and most affordable image generation and editing model — 1K output only, with multimodal understanding and natural language instructions for context-aware edits.

**Model ID:** `model_google-gemini-3-1-flash-lite-image`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-gemini-3-1-flash-lite-image/markdown>

| Parameter         | Type        | Required | Default | Min | Max        | Allowed Values                                                                  | Description                                                                                                                                          |
| ----------------- | ----------- | -------- | ------- | --- | ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -          | -                                                                               | Describe the image you want to create, or how to edit your reference images. Plain, natural language works well.                                     |
| `referenceImages` | file\_array | No       | -       | -   | -          | -                                                                               | Images to guide the style or content, or to edit (up to 14).                                                                                         |
| `aspectRatio`     | string      | No       | `auto`  | -   | -          | `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `auto` | The shape of the image. Auto picks a fitting shape for you.                                                                                          |
| `thinkingLevel`   | string      | No       | `HIGH`  | -   | -          | `MINIMAL`, `HIGH`                                                               | How much reasoning effort the model puts into the image. High gives the best results; Minimal is fastest.                                            |
| `numOutputs`      | number      | No       | `1`     | 1   | 4          | -                                                                               | How many images to create from the same prompt.                                                                                                      |
| `seed`            | number      | No       | -       | 0   | 2147483647 | -                                                                               | A number that makes results repeatable. Reusing the same seed and settings produces the same image; leave it empty for a different result each time. |

## Imagen 3

Google’s highest quality text-to-image model, capable of generating images with detail, rich lighting and beauty

**Model ID:** `model_imagen3`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_imagen3/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                      | Description         |
| ------------- | ------ | -------- | ------- | --- | --- | ----------------------------------- | ------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                   | Describe your image |
| `aspectRatio` | string | No       | `4:3`   | -   | -   | `9:16`, `3:4`, `1:1`, `4:3`, `16:9` | Image aspect ratio  |

## Imagen 3 Fast

A faster and cheaper Imagen 3 model, for when price or speed are more important than final image quality.

**Model ID:** `model_imagen3-fast`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_imagen3-fast/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                      | Description         |
| ------------- | ------ | -------- | ------- | --- | --- | ----------------------------------- | ------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                   | Describe your image |
| `aspectRatio` | string | No       | `4:3`   | -   | -   | `9:16`, `3:4`, `1:1`, `4:3`, `16:9` | Image aspect ratio  |

## Imagen 4

Google’s Imagen 4 flagship model.

**Model ID:** `model_imagen4`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_imagen4/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                      | Description         |
| ------------- | ------ | -------- | ------- | --- | --- | ----------------------------------- | ------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                   | Describe your image |
| `aspectRatio` | string | No       | `4:3`   | -   | -   | `9:16`, `3:4`, `1:1`, `4:3`, `16:9` | Image aspect ratio  |

## Imagen 4 Fast

Use this fast version of Imagen 4 when speed and cost are more important than quality.

**Model ID:** `model_imagen4-fast`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_imagen4-fast/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                      | Description         |
| ------------- | ------ | -------- | ------- | --- | --- | ----------------------------------- | ------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                   | Describe your image |
| `aspectRatio` | string | No       | `4:3`   | -   | -   | `9:16`, `3:4`, `1:1`, `4:3`, `16:9` | Image aspect ratio  |

## Imagen 4 Ultra

Use this ultra version of Imagen 4 when quality matters more than speed and cost.

**Model ID:** `model_imagen4-ultra`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_imagen4-ultra/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                      | Description         |
| ------------- | ------ | -------- | ------- | --- | --- | ----------------------------------- | ------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                   | Describe your image |
| `aspectRatio` | string | No       | `4:3`   | -   | -   | `9:16`, `3:4`, `1:1`, `4:3`, `16:9` | Image aspect ratio  |
