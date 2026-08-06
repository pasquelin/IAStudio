---
title: Topaz Labs | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Topaz Labs** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Topaz Image Upscale](#topaz-image-upscale)

---

## Topaz Image Upscale

**Model ID:** `model_topaz-image-upscale`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_topaz-image-upscale/markdown>

| Parameter                   | Type    | Required | Default       | Min | Max | Allowed Values                                                               | Description                                                                                                                                                                        |
| --------------------------- | ------- | -------- | ------------- | --- | --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`                     | file    | Yes      | -             | -   | -   | -                                                                            | Image to enhance                                                                                                                                                                   |
| `enhanceModel`              | string  | No       | `Standard V2` | -   | -   | `Standard V2`, `Low Resolution V2`, `CGI`, `High Fidelity V2`, `Text Refine` | Model to use: Standard V2 (general purpose), Low Resolution V2 (for low-res images), CGI (for digital art), High Fidelity V2 (preserves details), Text Refine (optimized for text) |
| `upscaleFactor`             | string  | No       | `2x`          | -   | -   | `None`, `2x`, `4x`, `6x`                                                     | How much to upscale the image                                                                                                                                                      |
| `subjectDetection`          | string  | No       | `None`        | -   | -   | `None`, `All`, `Foreground`, `Background`                                    | Subject detection                                                                                                                                                                  |
| `faceEnhancement`           | boolean | No       | `false`       | -   | -   | -                                                                            | Enhance faces in the image                                                                                                                                                         |
| `faceEnhancementCreativity` | number  | No       | `0`           | 0   | 1   | -                                                                            | Choose the level of creativity for face enhancement from 0 to 1. Defaults to 0, and is ignored if face\_enhancement is false.                                                      |
| `faceEnhancementStrength`   | number  | No       | `0.8`         | 0   | 1   | -                                                                            | Control how sharp the enhanced faces are relative to the background from 0 to 1. Defaults to 0.8, and is ignored if face\_enhancement is false.                                    |
