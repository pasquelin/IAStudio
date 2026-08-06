---
title: xAI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **xAI** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Grok Imagine Image](#grok-imagine-image)
- [Grok Imagine Image Quality](#grok-imagine-image-quality)

---

## Grok Imagine Image

Generate and edit images using xAI’s Grok model, powered by Aurora — supports text-to-image generation and image editing with multiple aspect ratios and batch output up to 10 images

**Model ID:** `model_xai-grok-imagine-image`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_xai-grok-imagine-image/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                                                          | Description                                                                                                               |
| ----------------- | ----------- | -------- | ------- | --- | --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -   | -                                                                       | Text description of the image to generate, or desired edits when a source image is provided                               |
| `referenceImages` | file\_array | No       | “       | -   | -   | -                                                                       | Reference images to edit. When provided, the prompt describes the desired edits. Aspect ratio is ignored in editing mode. |
| `numOutputs`      | number      | No       | `1`     | 1   | 10  | -                                                                       | Number of images to generate                                                                                              |
| `aspectRatio`     | string      | No       | `1:1`   | -   | -   | `2:1`, `16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16`, `1:2`, `auto` | Aspect ratio for the generated image. Ignored when editing a source image.                                                |
| `resolution`      | string      | No       | `2k`    | -   | -   | `1k`, `2k`                                                              | Output resolution for the generated image. 2K is only available with the Pro model.                                       |

## Grok Imagine Image Quality

Generate and edit high-resolution images using xAI’s Grok Imagine Image Quality model (successor to Pro), powered by Aurora — text-to-image and image editing at up to 2K resolution, extended aspect ratios including ultrawide and ultratall formats, batch output up to 10 images

**Model ID:** `model_xai-grok-imagine-image-quality`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_xai-grok-imagine-image-quality/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                                                                                              | Description                                                                                                               |
| ----------------- | ----------- | -------- | ------- | --- | --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -   | -                                                                                                           | Text description of the image to generate, or desired edits when a source image is provided                               |
| `referenceImages` | file\_array | No       | “       | -   | -   | -                                                                                                           | Reference images to edit. When provided, the prompt describes the desired edits. Aspect ratio is ignored in editing mode. |
| `numOutputs`      | number      | No       | `1`     | 1   | 10  | -                                                                                                           | Number of images to generate                                                                                              |
| `resolution`      | string      | No       | `2k`    | -   | -   | `1k`, `2k`                                                                                                  | Output resolution for the generated image. Omitted requests default to 2k for this model per xAI.                         |
| `aspectRatio`     | string      | No       | `1:1`   | -   | -   | `20:9`, `19.5:9`, `2:1`, `16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16`, `1:2`, `9:19.5`, `9:20`, `auto` | Aspect ratio for the generated image. Ignored when editing a source image.                                                |
