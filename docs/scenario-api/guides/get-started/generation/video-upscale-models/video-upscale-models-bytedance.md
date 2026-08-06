---
title: Bytedance | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Bytedance** video upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [SeedVR2 - Video Upscale](#seedvr2---video-upscale)

---

## SeedVR2 - Video Upscale

SeedVR2 Upscale Video is a model that can upscale videos.

**Model ID:** `model_seedvr-2-upscale-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_seedvr-2-upscale-video/markdown>

| Parameter          | Type   | Required | Default    | Min | Max | Allowed Values                     | Description                                                                                                                                                                |
| ------------------ | ------ | -------- | ---------- | --- | --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`            | file   | Yes      | -          | -   | -   | -                                  | Video to upscale                                                                                                                                                           |
| `upscaleMode`      | string | No       | `factor`   | -   | -   | `factor`, `target`                 | The mode to use for the upscale. If ‘target’, the upscale factor will be calculated based on the target resolution. If ‘factor’, the upscale factor will be used directly. |
| `upscaleFactor`    | number | No       | `2`        | 2   | 10  | -                                  | How much to upscale the image                                                                                                                                              |
| `targetResolution` | string | No       | `1080p`    | -   | -   | `720p`, `1080p`, `1440p`, `2160p`  | The target resolution to upscale to when Upscale Mode is target.                                                                                                           |
| `noiseScale`       | number | No       | `0.1`      | 0   | 1   | -                                  | The noise scale to use for the generation process.                                                                                                                         |
| `outputQuality`    | string | No       | `high`     | -   | -   | `low`, `medium`, `high`, `maximum` | The quality of the output video                                                                                                                                            |
| `outputWriteMode`  | string | No       | `balanced` | -   | -   | `fast`, `balanced`, `small`        | The write mode of the output video                                                                                                                                         |
| `seed`             | number | No       | -          | -   | -   | -                                  | Random seed for reproducibility. If None, a random seed is chosen.                                                                                                         |
