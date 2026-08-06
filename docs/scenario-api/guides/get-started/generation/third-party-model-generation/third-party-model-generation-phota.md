---
title: Phota | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Phota** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Phota Edit](#phota-edit)
- [Phota Text to Image](#phota-text-to-image)

---

## Phota Edit

Personalized photo editing with profile-aware identity preservation.

**Model ID:** `model_phota-edit`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_phota-edit/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                              | Description                                                    |
| ----------------- | ----------- | -------- | ------- | --- | --- | ------------------------------------------- | -------------------------------------------------------------- |
| `referenceImages` | file\_array | Yes      | -       | -   | -   | -                                           | Images to edit. The first image is used as the primary source. |
| `prompt`          | string      | Yes      | -       | -   | -   | -                                           | Text description of the desired edit.                          |
| `numOutputs`      | number      | No       | `1`     | 1   | 4   | -                                           | Number of images to generate.                                  |
| `resolution`      | string      | No       | `1K`    | -   | -   | `1K`, `4K`                                  | Output image resolution.                                       |
| `aspectRatio`     | string      | No       | `auto`  | -   | -   | `auto`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16` | Aspect ratio of the output image.                              |

## Phota Text to Image

Generate photorealistic, personalized images with optional profile conditioning.

**Model ID:** `model_phota`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_phota/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                              | Description                            |
| ------------- | ------ | -------- | ------- | --- | --- | ------------------------------------------- | -------------------------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                           | Text description of the desired image. |
| `numOutputs`  | number | No       | `1`     | 1   | 4   | -                                           | Number of images to generate.          |
| `resolution`  | string | No       | `1K`    | -   | -   | `1K`, `4K`                                  | Output image resolution.               |
| `aspectRatio` | string | No       | `auto`  | -   | -   | `auto`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16` | Aspect ratio of the generated image.   |
