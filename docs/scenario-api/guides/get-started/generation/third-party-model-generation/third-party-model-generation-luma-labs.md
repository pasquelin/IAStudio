---
title: Luma Labs | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Luma Labs** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Luma Photon](#luma-photon)
- [Luma Photon Flash](#luma-photon-flash)
- [Luma Uni-1](#luma-uni-1)
- [Luma Uni-1 Max](#luma-uni-1-max)

---

## Luma Photon

**Model ID:** `model_luma-photon`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-photon/markdown>

| Parameter               | Type   | Required | Default | Min | Max | Allowed Values                                      | Description                                                                                                                                 |
| ----------------------- | ------ | -------- | ------- | --- | --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                | string | Yes      | -       | -   | -   | -                                                   | Text prompt for image generation                                                                                                            |
| `aspectRatio`           | string | No       | `4:3`   | -   | -   | `9:21`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9` | Aspect ratio of the generated image                                                                                                         |
| `imageReferenceUrl`     | file   | No       | -       | -   | -   | -                                                   | Use a reference image to guide your generation.                                                                                             |
| `imageReferenceWeight`  | number | No       | `0.85`  | 0   | 1   | -                                                   | Influence of the reference image. Larger values will make the reference image have a stronger influence on the generated image.             |
| `styleReferenceUrl`     | file   | No       | -       | -   | -   | -                                                   | Use a style image to influence the visual style of your generation.                                                                         |
| `styleReferenceWeight`  | number | No       | `0.85`  | 0   | 1   | -                                                   | Influence of the style reference image. Larger values will make the style reference image have a stronger influence on the generated image. |
| `characterReferenceUrl` | file   | No       | -       | -   | -   | -                                                   | Use a character image to guide your generation.                                                                                             |
| `seed`                  | number | No       | -       | -   | -   | -                                                   | Use a custom seed for targeted results (single-image inference)                                                                             |

## Luma Photon Flash

**Model ID:** `model_luma-photon-flash`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-photon-flash/markdown>

| Parameter               | Type   | Required | Default | Min | Max | Allowed Values                                      | Description                                                                                                                                 |
| ----------------------- | ------ | -------- | ------- | --- | --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                | string | Yes      | -       | -   | -   | -                                                   | Text prompt for image generation                                                                                                            |
| `aspectRatio`           | string | No       | `4:3`   | -   | -   | `9:21`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9` | Aspect ratio of the generated image                                                                                                         |
| `imageReferenceUrl`     | file   | No       | -       | -   | -   | -                                                   | Use a reference image to guide your generation.                                                                                             |
| `imageReferenceWeight`  | number | No       | `0.85`  | 0   | 1   | -                                                   | Influence of the reference image. Larger values will make the reference image have a stronger influence on the generated image.             |
| `styleReferenceUrl`     | file   | No       | -       | -   | -   | -                                                   | Use a style image to influence the visual style of your generation.                                                                         |
| `styleReferenceWeight`  | number | No       | `0.85`  | 0   | 1   | -                                                   | Influence of the style reference image. Larger values will make the style reference image have a stronger influence on the generated image. |
| `characterReferenceUrl` | file   | No       | -       | -   | -   | -                                                   | Use a character image to guide your generation.                                                                                             |
| `seed`                  | number | No       | -       | -   | -   | -                                                   | Use a custom seed for targeted results (single-image inference)                                                                             |

## Luma Uni-1

Generate or edit images from a text prompt, with optional reference images for style guidance and a web search option to ground results in real-world visuals.

**Model ID:** `model_luma-uni-1`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-uni-1/markdown>

| Parameter      | Type        | Required | Default | Min | Max | Allowed Values                                                  | Description                                                                                                                                                                                       |
| -------------- | ----------- | -------- | ------- | --- | --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`       | string      | Yes      | -       | -   | -   | -                                                               | Describe the image you want to generate, or describe the changes you want to make when editing an existing image. Be specific about subject, style, mood, and composition for best results.       |
| `source`       | file        | No       | -       | -   | -   | -                                                               | An existing image to edit. When provided, your prompt describes what to change rather than what to create. The output keeps the same aspect ratio unless you set one explicitly.                  |
| `imageRef`     | file\_array | No       | “       | -   | -   | -                                                               | Reference images that guide the style or content of the output. Add up to 9 for generation, or up to 8 when editing (the source image occupies one slot). Each reference image adds a small cost. |
| `aspectRatio`  | string      | No       | `3:2`   | -   | -   | `1:3`, `1:2`, `9:16`, `2:3`, `1:1`, `3:2`, `16:9`, `2:1`, `3:1` | The width-to-height ratio of the generated image. Ignored when editing an existing image unless explicitly set.                                                                                   |
| `outputFormat` | string      | No       | `png`   | -   | -   | `png`, `jpeg`                                                   | File format of the generated image. PNG is lossless and supports transparency; JPEG is smaller and loads faster.                                                                                  |
| `webSearch`    | boolean     | No       | `false` | -   | -   | -                                                               | When enabled, the model searches the web for relevant reference images before generating. Useful when your prompt refers to real-world subjects, places, or styles the model may not know well.   |

## Luma Uni-1 Max

Generate or edit images from a text prompt at higher quality, with optional reference images for style guidance and a web search option to ground results in real-world visuals.

**Model ID:** `model_luma-uni-1-max`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-uni-1-max/markdown>

| Parameter      | Type        | Required | Default | Min | Max | Allowed Values                                                  | Description                                                                                                                                                                                       |
| -------------- | ----------- | -------- | ------- | --- | --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`       | string      | Yes      | -       | -   | -   | -                                                               | Describe the image you want to generate, or describe the changes you want to make when editing an existing image. Be specific about subject, style, mood, and composition for best results.       |
| `source`       | file        | No       | -       | -   | -   | -                                                               | An existing image to edit. When provided, your prompt describes what to change rather than what to create. The output keeps the same aspect ratio unless you set one explicitly.                  |
| `imageRef`     | file\_array | No       | “       | -   | -   | -                                                               | Reference images that guide the style or content of the output. Add up to 9 for generation, or up to 8 when editing (the source image occupies one slot). Each reference image adds a small cost. |
| `aspectRatio`  | string      | No       | `3:2`   | -   | -   | `1:3`, `1:2`, `9:16`, `2:3`, `1:1`, `3:2`, `16:9`, `2:1`, `3:1` | The width-to-height ratio of the generated image. Ignored when editing an existing image unless explicitly set.                                                                                   |
| `outputFormat` | string      | No       | `png`   | -   | -   | `png`, `jpeg`                                                   | File format of the generated image. PNG is lossless and supports transparency; JPEG is smaller and loads faster.                                                                                  |
| `webSearch`    | boolean     | No       | `false` | -   | -   | -                                                               | When enabled, the model searches the web for relevant reference images before generating. Useful when your prompt refers to real-world subjects, places, or styles the model may not know well.   |
