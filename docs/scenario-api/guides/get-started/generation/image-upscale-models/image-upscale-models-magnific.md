---
title: Magnific | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Magnific** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Magnific Upscaler Creative](#magnific-upscaler-creative)
- [Magnific Upscaler Precision](#magnific-upscaler-precision)

---

## Magnific Upscaler Creative

**Model ID:** `model_magnific-upscaler-creative`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_magnific-upscaler-creative/markdown>

| Parameter      | Type   | Required | Default     | Min | Max | Allowed Values                                                                                                                                                                   | Description                        |
| -------------- | ------ | -------- | ----------- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `image`        | file   | Yes      | -           | -   | -   | -                                                                                                                                                                                | The image to upscale.              |
| `prompt`       | string | No       | -           | -   | -   | -                                                                                                                                                                                | The prompt to upscale the image.   |
| `scaleFactor`  | string | No       | `2x`        | -   | -   | `2x`, `4x`, `8x`, `16x`                                                                                                                                                          | The scale factor of the upscaler.  |
| `optimizedFor` | string | No       | `standard`  | -   | -   | `standard`, `soft_portraits`, `hard_portraits`, `art_n_illustration`, `videogame_assets`, `nature_n_landscapes`, `films_n_photography`, `3d_renders`, `science_fiction_n_horror` | The optimized for of the upscaler. |
| `creativity`   | number | No       | `0`         | -10 | 10  | -                                                                                                                                                                                | The creativity of the upscaler.    |
| `hdr`          | number | No       | `0`         | -10 | 10  | -                                                                                                                                                                                | The HDR of the upscaler.           |
| `resemblance`  | number | No       | `0`         | -10 | 10  | -                                                                                                                                                                                | The resemblance of the upscaler.   |
| `fractality`   | number | No       | `0`         | -10 | 10  | -                                                                                                                                                                                | The fractality of the upscaler.    |
| `engine`       | string | No       | `automatic` | -   | -   | `automatic`, `magnific_illusio`, `magnific_sharpy`, `magnific_sparkle`                                                                                                           | The engine of the upscaler.        |

## Magnific Upscaler Precision

**Model ID:** `model_magnific-upscaler-precision`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_magnific-upscaler-precision/markdown>

| Parameter     | Type   | Required | Default   | Min | Max | Allowed Values                       | Description                       |
| ------------- | ------ | -------- | --------- | --- | --- | ------------------------------------ | --------------------------------- |
| `image`       | file   | Yes      | -         | -   | -   | -                                    | The image to upscale.             |
| `sharpen`     | number | No       | `7`       | 0   | 100 | -                                    | Whether to sharpen the image.     |
| `smartGrain`  | number | No       | `7`       | 0   | 100 | -                                    | Whether to use smart grain.       |
| `ultraDetail` | number | No       | `30`      | 0   | 100 | -                                    | Whether to use ultra detail.      |
| `flavor`      | string | No       | `sublime` | -   | -   | `sublime`, `photo`, `photo_denoiser` | The flavor of the upscaler.       |
| `scaleFactor` | number | No       | `2`       | 2   | 16  | -                                    | The scale factor of the upscaler. |
