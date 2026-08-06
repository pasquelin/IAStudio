---
title: Pruna AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Pruna AI** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [P-Image Upscale](#p-image-upscale)

---

## P-Image Upscale

Pruna P-Image-Upscale — fast upscaling to a target megapixel size (1–8 MP) or by factor (1–8×); optional realism and detail enhancement.

**Model ID:** `model_p-image-upscale`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_p-image-upscale/markdown>

| Parameter        | Type    | Required | Default  | Min | Max | Allowed Values     | Description                                                                             |
| ---------------- | ------- | -------- | -------- | --- | --- | ------------------ | --------------------------------------------------------------------------------------- |
| `image`          | file    | Yes      | -        | -   | -   | -                  | Input image to upscale                                                                  |
| `upscaleMode`    | string  | No       | `target` | -   | -   | `target`, `factor` | Target: fixed output megapixels. Factor: multiply each side (output capped at 8 MP).    |
| `target`         | number  | No       | `4`      | 1   | 8   | -                  | Target resolution in megapixels when mode is target (1–8)                               |
| `factor`         | number  | No       | `2`      | 1   | 8   | -                  | Scale each side by this factor when mode is factor (1–8)                                |
| `enhanceDetails` | boolean | No       | `false`  | -   | -   | -                  | Sharpen fine textures; may increase contrast vs. the original                           |
| `enhanceRealism` | boolean | No       | `false`  | -   | -   | -                  | Improve realism; can deviate more from the original (often good on AI-generated images) |
