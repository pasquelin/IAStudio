---
title: Photoroom | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Photoroom** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Photoroom Expand](#photoroom-expand)
- [Photoroom Relighting](#photoroom-relighting)
- [Photoroom Text Remover](#photoroom-text-remover)
- [Photoroom Uncrop](#photoroom-uncrop)

---

## Photoroom Expand

Expand images using AI to extend the canvas beyond the original image boundaries using Photoroom’s expand service.

**Model ID:** `model_photoroom-expand`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_photoroom-expand/markdown>

| Parameter      | Type   | Required | Default | Min | Max  | Allowed Values | Description                |
| -------------- | ------ | -------- | ------- | --- | ---- | -------------- | -------------------------- |
| `image`        | file   | Yes      | -       | -   | -    | -              | Input image file           |
| `outputWidth`  | number | Yes      | `1024`  | 1   | 4096 | -              | Output width in pixels     |
| `outputHeight` | number | Yes      | `1024`  | 1   | 4096 | -              | Output height in pixels    |
| `seed`         | number | No       | -       | 0   | -    | -              | Seed for expand generation |

## Photoroom Relighting

Adjust lighting in images using AI to enhance or modify the lighting conditions using Photoroom’s relighting service.

**Model ID:** `model_photoroom-relighting`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_photoroom-relighting/markdown>

| Parameter      | Type   | Required | Default | Min | Max | Allowed Values                        | Description                 |
| -------------- | ------ | -------- | ------- | --- | --- | ------------------------------------- | --------------------------- |
| `image`        | file   | Yes      | -       | -   | -   | -                                     | Input image file            |
| `lightingMode` | string | No       | `auto`  | -   | -   | `auto`, `preserve-hue-and-saturation` | Lighting mode for the image |

## Photoroom Text Remover

Remove text from images using AI to clean up text overlays and watermarks using Photoroom’s text remover service.

**Model ID:** `model_photoroom-text-remover`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_photoroom-text-remover/markdown>

| Parameter | Type   | Required | Default      | Min | Max | Allowed Values                 | Description                                                                                                                                                                              |
| --------- | ------ | -------- | ------------ | --- | --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`   | file   | Yes      | -            | -   | -   | -                              | Input image file                                                                                                                                                                         |
| `mode`    | string | Yes      | `artificial` | -   | -   | `artificial`, `natural`, `all` | Controls which text is removed from images. Remove artificial overlays like logos and watermarks, natural scene text like signs or clothing prints, or both for a fully text free image. |

## Photoroom Uncrop

Uncrop images using AI to restore and extend cropped areas beyond the original image boundaries using Photoroom’s uncrop service.

**Model ID:** `model_photoroom-uncrop`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_photoroom-uncrop/markdown>

| Parameter | Type   | Required | Default | Min | Max | Allowed Values | Description                |
| --------- | ------ | -------- | ------- | --- | --- | -------------- | -------------------------- |
| `image`   | file   | Yes      | -       | -   | -   | -              | Input image file           |
| `seed`    | number | No       | -       | 0   | -   | -              | Seed for uncrop generation |
