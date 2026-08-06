---
title: Bytedance | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Bytedance** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Dreamina 3.1](#dreamina-31)
- [Seedream 4.0 Edit](#seedream-40-edit)
- [Seedream 4.5 Edit](#seedream-45-edit)
- [Seedream 5.0 Lite](#seedream-50-lite)
- [Seedream 5.0 Pro](#seedream-50-pro)

---

## Dreamina 3.1

ByteDance’s creativity-focused model for stylized outputs.

**Model ID:** `model_bytedance-dreamina-3-1`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-dreamina-3-1/markdown>

| Parameter     | Type   | Required | Default | Min | Max  | Allowed Values                                                              | Description                                                            |
| ------------- | ------ | -------- | ------- | --- | ---- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -       | -   | -    | -                                                                           | Text prompt for image generation                                       |
| `aspectRatio` | string | No       | `4:3`   | -   | -    | `9:21`, `9:16`, `2:3`, `3:4`, `1:1`, `3:2`, `4:3`, `16:9`, `21:9`, `custom` | Image aspect ratio. Set to ‘custom’ to specify width and height.       |
| `resolution`  | string | No       | `2K`    | -   | -    | `1K`, `2K`                                                                  | Image resolution quality                                               |
| `width`       | number | No       | `1328`  | 512 | 3024 | -                                                                           | Image width (only used when aspect\_ratio is ‘custom’)                 |
| `height`      | number | No       | `1328`  | 512 | 3024 | -                                                                           | Image height (only used when aspect\_ratio is ‘custom’)                |
| `seed`        | number | No       | -       | -   | -    | -                                                                           | Use a seed for reproducible results. Leave blank to use a random seed. |

## Seedream 4.0 Edit

**Model ID:** `model_bytedance-seedream-4-editing`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedream-4-editing/markdown>

| Parameter                   | Type        | Required | Default    | Min | Max | Allowed Values                                                    | Description                                                                                                                                                             |
| --------------------------- | ----------- | -------- | ---------- | --- | --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceImages`           | file\_array | No       | “          | -   | -   | -                                                                 | Input image(s) for image-to-image generation. List of 1-14 images for single or multi-reference generation.                                                             |
| `prompt`                    | string      | Yes      | -          | -   | -   | -                                                                 | Text prompt for image generation                                                                                                                                        |
| `size`                      | string      | No       | `4K`       | -   | -   | `4K`, `2K`, `1K`                                                  | Output resolution. 1K for low quality, 2K for medium quality, 4K for high quality.                                                                                      |
| `aspectRatio`               | string      | No       | `auto`     | -   | -   | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9`, `auto` | Image aspect ratio. ‘Auto’ preserves the original aspect ratio but does not upscale image resolution.                                                                   |
| `sequentialImageGeneration` | string      | No       | `disabled` | -   | -   | `disabled`, `auto`                                                | Off: always generates one image. On: The model may generate a set of related images (story steps, variations, or alternatives), up to your chosen Max Images parameter. |
| `maxImages`                 | number      | No       | `1`        | 1   | 15  | -                                                                 | The maximum number of images the model can generate in one sequence. Total image count (input +generated) cannot exceed 15.                                             |

## Seedream 4.5 Edit

**Model ID:** `model_bytedance-seedream-4-5-editing`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedream-4-5-editing/markdown>

| Parameter                   | Type        | Required | Default    | Min | Max | Allowed Values                                                    | Description                                                                                                                                                             |
| --------------------------- | ----------- | -------- | ---------- | --- | --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceImages`           | file\_array | No       | “          | -   | -   | -                                                                 | Input image(s) for image-to-image generation. List of 1-10 images for single or multi-reference generation.                                                             |
| `prompt`                    | string      | Yes      | -          | -   | -   | -                                                                 | Text prompt for image generation                                                                                                                                        |
| `size`                      | string      | No       | `4K`       | -   | -   | `4K`, `2K`                                                        | Image resolution: 2K (2048px), 4K (4096px).                                                                                                                             |
| `aspectRatio`               | string      | No       | `auto`     | -   | -   | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9`, `auto` | Image aspect ratio. ‘Auto’ preserves the original aspect ratio but does not upscale image resolution.                                                                   |
| `sequentialImageGeneration` | string      | No       | `disabled` | -   | -   | `disabled`, `auto`                                                | Off: always generates one image. On: The model may generate a set of related images (story steps, variations, or alternatives), up to your chosen Max Images parameter. |
| `maxImages`                 | number      | No       | `1`        | 1   | 15  | -                                                                 | The maximum number of images the model can generate in one sequence. Total image count (input + generated) cannot exceed 15.                                            |

## Seedream 5.0 Lite

**Model ID:** `model_bytedance-seedream-5-0-lite`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedream-5-0-lite/markdown>

| Parameter                   | Type        | Required | Default    | Min  | Max  | Allowed Values     | Description                                                                                                                                                             |
| --------------------------- | ----------- | -------- | ---------- | ---- | ---- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                    | string      | Yes      | -          | -    | -    | -                  | Text prompt for image generation                                                                                                                                        |
| `referenceImages`           | file\_array | No       | “          | -    | -    | -                  | Input image(s) for image-to-image generation.                                                                                                                           |
| `width`                     | number      | No       | `2048`     | 1024 | 6240 | -                  | Custom image width (only used when size is set to ‘Custom’). Range: 1024-6240 pixels.                                                                                   |
| `height`                    | number      | No       | `2048`     | 1024 | 6240 | -                  | Custom image height (only used when size is set to ‘Custom’). Range: 1024-6240 pixels.                                                                                  |
| `sequentialImageGeneration` | string      | No       | `disabled` | -    | -    | `disabled`, `auto` | Off: always generates one image. On: The model may generate a set of related images (story steps, variations, or alternatives), up to your chosen Max Images parameter. |
| `maxImages`                 | number      | No       | `1`        | 1    | 15   | -                  | The maximum number of images the model can generate in one sequence. Total image count (input + generated) cannot exceed 15.                                            |

## Seedream 5.0 Pro

ByteDance Seedream 5.0 Pro generates and edits high-resolution images up to 2K, with support for multiple reference images and custom dimensions.

**Model ID:** `model_bytedance-seedream-5-0-pro`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedream-5-0-pro/markdown>

| Parameter         | Type        | Required | Default | Min | Max  | Allowed Values | Description                                                                                        |
| ----------------- | ----------- | -------- | ------- | --- | ---- | -------------- | -------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -    | -              | Describe the image you want to create, including any text that should appear in it.                |
| `referenceImages` | file\_array | No       | -       | -   | -    | -              | Optional images to generate from or edit (up to 10). Leave empty to create from your prompt alone. |
| `width`           | number      | No       | `2048`  | 672 | 3136 | -              | The exact width of the image in pixels (672-3136). Used only when Resolution is set to Custom.     |
| `height`          | number      | No       | `2048`  | 672 | 3136 | -              | The exact height of the image in pixels (672-3136). Used only when Resolution is set to Custom.    |
