---
title: Recraft AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Recraft AI** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Recraft V4](#recraft-v4)
- [Recraft V4.1](#recraft-v41)
- [Recraft V4.1 Pro](#recraft-v41-pro)
- [Recraft V4.1 Pro SVG](#recraft-v41-pro-svg)
- [Recraft V4.1 SVG](#recraft-v41-svg)
- [Recraft V4.1 Utility](#recraft-v41-utility)
- [Recraft V4.1 Utility Pro](#recraft-v41-utility-pro)

---

## Recraft V4

Recraft’s image generation model, built around design taste. Strong prompt accuracy, art-directed composition, and integrated text rendering. Fast and cost-efficient at standard resolution.

**Model ID:** `model_recraft-v4`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-v4/markdown>

| Parameter     | Type   | Required | Default     | Min | Max | Allowed Values                                                                                                                                                          | Description                                                                         |
| ------------- | ------ | -------- | ----------- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -           | -   | -   | -                                                                                                                                                                       | Text prompt for image generation                                                    |
| `aspectRatio` | string | No       | `Not set`   | -   | -   | `Not set`, `1:2`, `9:16`, `6:10`, `2:3`, `10:14`, `3:4`, `4:5`, `1:1`, `5:4`, `4:3`, `14:10`, `3:2`, `16:9`, `2:1`                                                      | Aspect ratio of the generated image                                                 |
| `size`        | string | No       | `1024x1024` | -   | -   | `768x1536`, `768x1344`, `832x1344`, `832x1280`, `896x1280`, `896x1216`, `896x1152`, `1024x1024`, `1152x896`, `1216x896`, `1280x896`, `1280x832`, `1344x768`, `1536x768` | Width and height of the generated image. Size is ignored if an aspect ratio is set. |

## Recraft V4.1

Recraft’s latest image model, tuned for brand systems and editorial work. Strong prompt accuracy, art-directed composition, and integrated text rendering. Production-ready raster images at standard resolution.

**Model ID:** `model_recraft-v4-1`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-v4-1/markdown>

| Parameter          | Type          | Required | Default     | Min | Max | Allowed Values                                                                            | Description                                                                                                                       |
| ------------------ | ------------- | -------- | ----------- | --- | --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`           | string        | Yes      | -           | -   | -   | -                                                                                         | Describe the image you want to create, including any text that should appear in it.                                               |
| `imageSize`        | string        | No       | `square_hd` | -   | -   | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9` | The size and shape of the generated image.                                                                                        |
| `backgroundColorR` | number        | No       | -           | 0   | 255 | -                                                                                         | Red level (0–255) of the background color you want behind the image.                                                              |
| `backgroundColorG` | number        | No       | -           | 0   | 255 | -                                                                                         | Green level (0–255) of the background color you want behind the image.                                                            |
| `backgroundColorB` | number        | No       | -           | 0   | 255 | -                                                                                         | Blue level (0–255) of the background color you want behind the image.                                                             |
| `colors`           | inputs\_array | No       | -           | -   | -   | -                                                                                         | Optional colors to steer the image’s palette toward. Add up to ten; the model treats them as preferences, not exact requirements. |

## Recraft V4.1 Pro

Recraft V4.1 Pro raster generation at high (\~2048px) resolution. Same design taste and prompt accuracy as V4.1, with higher resolution for print-ready and large-scale work.

**Model ID:** `model_recraft-v4-1-pro`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-v4-1-pro/markdown>

| Parameter          | Type          | Required | Default     | Min | Max | Allowed Values                                                                            | Description                                                                                                                       |
| ------------------ | ------------- | -------- | ----------- | --- | --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`           | string        | Yes      | -           | -   | -   | -                                                                                         | Describe the image you want to create, including any text that should appear in it.                                               |
| `imageSize`        | string        | No       | `square_hd` | -   | -   | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9` | The size and shape of the generated image.                                                                                        |
| `backgroundColorR` | number        | No       | -           | 0   | 255 | -                                                                                         | Red level (0–255) of the background color you want behind the image.                                                              |
| `backgroundColorG` | number        | No       | -           | 0   | 255 | -                                                                                         | Green level (0–255) of the background color you want behind the image.                                                            |
| `backgroundColorB` | number        | No       | -           | 0   | 255 | -                                                                                         | Blue level (0–255) of the background color you want behind the image.                                                             |
| `colors`           | inputs\_array | No       | -           | -   | -   | -                                                                                         | Optional colors to steer the image’s palette toward. Add up to ten; the model treats them as preferences, not exact requirements. |

## Recraft V4.1 Pro SVG

Generate detailed SVG vector graphics from text prompts with Recraft V4.1 Pro — more geometric detail, finer paths, clean editable layers, scalable to any size.

**Model ID:** `model_recraft-v4-1-pro-svg`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-v4-1-pro-svg/markdown>

| Parameter          | Type          | Required | Default     | Min | Max | Allowed Values                                                                            | Description                                                                                                                       |
| ------------------ | ------------- | -------- | ----------- | --- | --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`           | string        | Yes      | -           | -   | -   | -                                                                                         | Describe the image you want to create, including any text that should appear in it.                                               |
| `imageSize`        | string        | No       | `square_hd` | -   | -   | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9` | The size and shape of the generated image.                                                                                        |
| `backgroundColorR` | number        | No       | -           | 0   | 255 | -                                                                                         | Red level (0–255) of the background color you want behind the image.                                                              |
| `backgroundColorG` | number        | No       | -           | 0   | 255 | -                                                                                         | Green level (0–255) of the background color you want behind the image.                                                            |
| `backgroundColorB` | number        | No       | -           | 0   | 255 | -                                                                                         | Blue level (0–255) of the background color you want behind the image.                                                             |
| `colors`           | inputs\_array | No       | -           | -   | -   | -                                                                                         | Optional colors to steer the image’s palette toward. Add up to ten; the model treats them as preferences, not exact requirements. |

## Recraft V4.1 SVG

Generate production-ready SVG vector images from text prompts with Recraft V4.1’s design taste — clean geometry, structured layers, and editable paths.

**Model ID:** `model_recraft-v4-1-svg`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-v4-1-svg/markdown>

| Parameter          | Type          | Required | Default     | Min | Max | Allowed Values                                                                            | Description                                                                                                                       |
| ------------------ | ------------- | -------- | ----------- | --- | --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`           | string        | Yes      | -           | -   | -   | -                                                                                         | Describe the image you want to create, including any text that should appear in it.                                               |
| `imageSize`        | string        | No       | `square_hd` | -   | -   | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9` | The size and shape of the generated image.                                                                                        |
| `backgroundColorR` | number        | No       | -           | 0   | 255 | -                                                                                         | Red level (0–255) of the background color you want behind the image.                                                              |
| `backgroundColorG` | number        | No       | -           | 0   | 255 | -                                                                                         | Green level (0–255) of the background color you want behind the image.                                                            |
| `backgroundColorB` | number        | No       | -           | 0   | 255 | -                                                                                         | Blue level (0–255) of the background color you want behind the image.                                                             |
| `colors`           | inputs\_array | No       | -           | -   | -   | -                                                                                         | Optional colors to steer the image’s palette toward. Add up to ten; the model treats them as preferences, not exact requirements. |

## Recraft V4.1 Utility

A faster, lighter variant of Recraft V4.1 for high-volume creative workflows — optimized for throughput and cost efficiency while keeping design sensibility. Ideal for ideation, A/B exploration, and content pipelines.

**Model ID:** `model_recraft-v4-1-utility`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-v4-1-utility/markdown>

| Parameter          | Type          | Required | Default     | Min | Max | Allowed Values                                                                            | Description                                                                                                                       |
| ------------------ | ------------- | -------- | ----------- | --- | --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`           | string        | Yes      | -           | -   | -   | -                                                                                         | Describe the image you want to create, including any text that should appear in it.                                               |
| `imageSize`        | string        | No       | `square_hd` | -   | -   | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9` | The size and shape of the generated image.                                                                                        |
| `backgroundColorR` | number        | No       | -           | 0   | 255 | -                                                                                         | Red level (0–255) of the background color you want behind the image.                                                              |
| `backgroundColorG` | number        | No       | -           | 0   | 255 | -                                                                                         | Green level (0–255) of the background color you want behind the image.                                                            |
| `backgroundColorB` | number        | No       | -           | 0   | 255 | -                                                                                         | Blue level (0–255) of the background color you want behind the image.                                                             |
| `colors`           | inputs\_array | No       | -           | -   | -   | -                                                                                         | Optional colors to steer the image’s palette toward. Add up to ten; the model treats them as preferences, not exact requirements. |

## Recraft V4.1 Utility Pro

Recraft V4.1 Utility Pro pairs the high-resolution output of V4.1 Pro with a faster, cost-efficient runtime — designed for studios shipping large-format work at scale.

**Model ID:** `model_recraft-v4-1-utility-pro`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-v4-1-utility-pro/markdown>

| Parameter          | Type          | Required | Default     | Min | Max | Allowed Values                                                                            | Description                                                                                                                       |
| ------------------ | ------------- | -------- | ----------- | --- | --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`           | string        | Yes      | -           | -   | -   | -                                                                                         | Describe the image you want to create, including any text that should appear in it.                                               |
| `imageSize`        | string        | No       | `square_hd` | -   | -   | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9` | The size and shape of the generated image.                                                                                        |
| `backgroundColorR` | number        | No       | -           | 0   | 255 | -                                                                                         | Red level (0–255) of the background color you want behind the image.                                                              |
| `backgroundColorG` | number        | No       | -           | 0   | 255 | -                                                                                         | Green level (0–255) of the background color you want behind the image.                                                            |
| `backgroundColorB` | number        | No       | -           | 0   | 255 | -                                                                                         | Blue level (0–255) of the background color you want behind the image.                                                             |
| `colors`           | inputs\_array | No       | -           | -   | -   | -                                                                                         | Optional colors to steer the image’s palette toward. Add up to ten; the model treats them as preferences, not exact requirements. |
