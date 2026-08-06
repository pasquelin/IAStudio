---
title: Magnific | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Magnific** video upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Magnific Video Upscaler Creative](#magnific-video-upscaler-creative)
- [Magnific Video Upscaler Precision](#magnific-video-upscaler-precision)

---

## Magnific Video Upscaler Creative

Creative video upscaling with creativity, flavor (vivid / natural), sharpening, grain, optional FPS boost, and optional turbo mode for faster runs.

**Model ID:** `model_magnific-video-upscaler-creative`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_magnific-video-upscaler-creative/markdown>

| Parameter    | Type    | Required | Default | Min | Max | Allowed Values     | Description                                                                                         |
| ------------ | ------- | -------- | ------- | --- | --- | ------------------ | --------------------------------------------------------------------------------------------------- |
| `video`      | file    | Yes      | -       | -   | -   | -                  | Source video to upscale (HTTPS URL, data URL, or other resolvable file URI after asset resolution). |
| `creativity` | number  | No       | `0`     | 0   | 100 | -                  | Creativity intensity (0–100); higher values add more inferred detail.                               |
| `resolution` | string  | No       | `2k`    | -   | -   | `1k`, `2k`, `4k`   | Output resolution tier (1k, 2k, or 4k).                                                             |
| `fpsBoost`   | boolean | No       | `false` | -   | -   | -                  | Increase output frame rate for smoother motion.                                                     |
| `sharpen`    | number  | No       | `0`     | 0   | 100 | -                  | Sharpening intensity (0–100).                                                                       |
| `smartGrain` | number  | No       | `0`     | 0   | 100 | -                  | Film grain / texture enhancement (0–100).                                                           |
| `flavor`     | string  | No       | `vivid` | -   | -   | `vivid`, `natural` | vivid: enhanced colors; natural: faithful to source.                                                |
| `turbo`      | boolean | No       | `false` | -   | -   | -                  | Faster processing with the turbo quality preset (lower per-second rate).                            |

## Magnific Video Upscaler Precision

Precision video upscaling with strength blend, sharpening, grain, and optional FPS boost.

**Model ID:** `model_magnific-video-upscaler-precision`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_magnific-video-upscaler-precision/markdown>

| Parameter    | Type    | Required | Default | Min | Max | Allowed Values   | Description                                                                    |
| ------------ | ------- | -------- | ------- | --- | --- | ---------------- | ------------------------------------------------------------------------------ |
| `video`      | file    | Yes      | -       | -   | -   | -                | Source video to upscale.                                                       |
| `resolution` | string  | No       | `2k`    | -   | -   | `1k`, `2k`, `4k` | Output resolution tier (1k, 2k, or 4k).                                        |
| `fpsBoost`   | boolean | No       | `false` | -   | -   | -                | Enable FPS boost to increase the frame rate of the upscaled video.             |
| `sharpen`    | number  | No       | `0`     | 0   | 100 | -                | Sharpening intensity (0–100).                                                  |
| `smartGrain` | number  | No       | `0`     | 0   | 100 | -                | Film grain / texture enhancement (0–100).                                      |
| `strength`   | number  | No       | `60`    | 0   | 100 | -                | Upscale blend: 0 = original, 100 = full upscale; ignored when FPS boost is on. |
