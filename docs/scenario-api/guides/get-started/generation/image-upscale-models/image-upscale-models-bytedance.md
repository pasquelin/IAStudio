---
title: Bytedance | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Bytedance** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [SeedVR2 - Image Upscale](#seedvr2---image-upscale)

---

## SeedVR2 - Image Upscale

SeedVR2 Upscale Image is a model that can upscale images.

**Model ID:** `model_seedvr-2-upscale-image`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_seedvr-2-upscale-image/markdown>

| Parameter          | Type   | Required | Default  | Min | Max | Allowed Values                    | Description                                                                                                                                                                |
| ------------------ | ------ | -------- | -------- | --- | --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `imageUrl`         | file   | Yes      | -        | -   | -   | -                                 | Image to upscale                                                                                                                                                           |
| `upscaleMode`      | string | No       | `factor` | -   | -   | `factor`, `target`                | The mode to use for the upscale. If ‘target’, the upscale factor will be calculated based on the target resolution. If ‘factor’, the upscale factor will be used directly. |
| `upscaleFactor`    | number | No       | `2`      | 2   | 10  | -                                 | How much to upscale the image                                                                                                                                              |
| `targetResolution` | string | No       | `1080p`  | -   | -   | `720p`, `1080p`, `1440p`, `2160p` | The target resolution to upscale to when Upscale Mode is target.                                                                                                           |
| `noiseScale`       | number | No       | `0.1`    | 0   | 1   | -                                 | The noise scale to use for the generation process.                                                                                                                         |
| `seed`             | number | No       | -        | -   | -   | -                                 | Random seed for reproducibility. If None, a random seed is chosen.                                                                                                         |
