---
title: Academia | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Academia** video upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Flash VSR Upscale Video](#flash-vsr-upscale-video)

---

## Flash VSR Upscale Video

Upscale your videos using FlashVSR with the fastest speeds!

**Model ID:** `model_flash-vsr-video-upscale`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_flash-vsr-video-upscale/markdown>

| Parameter         | Type    | Required | Default    | Min | Max | Allowed Values                     | Description                                                                                                                                                                           |
| ----------------- | ------- | -------- | ---------- | --- | --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`           | file    | Yes      | -          | -   | -   | -                                  | Video to upscale                                                                                                                                                                      |
| `upscaleFactor`   | number  | No       | `2`        | 2   | 4   | -                                  | How much to upscale the image                                                                                                                                                         |
| `acceleration`    | string  | No       | `regular`  | -   | -   | `regular`, `high`, `full`          | Acceleration mode for VAE decoding. Options: regular (best quality), high (balanced), full (fastest). More acceleration means longer duration videos can be processed too.            |
| `colorFix`        | boolean | No       | `true`     | -   | -   | -                                  | Color correction enabled.                                                                                                                                                             |
| `quality`         | number  | No       | `70`       | 0   | 100 | -                                  | Quality level for tile blending. Higher values (80-100) provide better quality with more tile overlap, lower values (0-40) prioritize speed. Recommended: 60-80 for balanced results. |
| `preserveAudio`   | boolean | No       | `false`    | -   | -   | -                                  | Preserve the audio of the input video.                                                                                                                                                |
| `outputQuality`   | string  | No       | `high`     | -   | -   | `low`, `medium`, `high`, `maximum` | The quality of the output video                                                                                                                                                       |
| `outputWriteMode` | string  | No       | `balanced` | -   | -   | `fast`, `balanced`, `small`        | The write mode of the output video                                                                                                                                                    |
