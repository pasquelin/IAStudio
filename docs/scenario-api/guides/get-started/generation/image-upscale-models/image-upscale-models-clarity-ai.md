---
title: Clarity AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-05-11.

This reference lists all available **Clarity AI** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Clarity Pro Upscaler](#clarity-pro-upscaler)
- [Crystal Upscaler](#crystal-upscaler)

---

## Clarity Pro Upscaler

Photorealistic image upscaler with up to 16x scaling and controllable creativity.

**Model ID:** `model_clarity-pro-upscaler`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_clarity-pro-upscaler/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values      | Description                                                                                                           |
| ------------- | ------ | -------- | ------- | --- | --- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `image`       | file   | Yes      | -       | -   | -   | -                   | Input image to upscale.                                                                                               |
| `scaleFactor` | number | No       | `2`     | -   | -   | `2`, `4`, `8`, `16` | Scaling factor to apply to the input image.                                                                           |
| `creativity`  | number | No       | `0`     | -10 | 10  | -                   | Controls how strictly the output follows the source image. Lower values preserve fidelity, higher values add details. |

## Crystal Upscaler

High-precision image upscaler optimized for portraits and faces.

**Model ID:** `model_crystal-upscaler`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_crystal-upscaler/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                               |
| ------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------- |
| `image`       | file   | Yes      | -       | -   | -   | -              | An input image for upscaling                                                              |
| `scaleFactor` | number | No       | `2`     | 1   | 200 | -              | Scale factor for upscaling. It will be automatically adjusted to fit within memory limits |
| `creativity`  | number | No       | `0`     | 0   | 10  | -              | Creativity level for upscaling                                                            |
