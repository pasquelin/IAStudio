---
title: Pixa | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Pixa** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Pixelcut Video Background Removal](#pixelcut-video-background-removal)

---

## Pixelcut Video Background Removal

Remove video backgrounds frame by frame with temporal consistency, outputting transparent video or a solid background color.

**Model ID:** `model_pixelcut-video-background-removal`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixelcut-video-background-removal/markdown>

| Parameter              | Type   | Required | Default       | Min | Max | Allowed Values                                                                                           | Description                                                                                                         |
| ---------------------- | ------ | -------- | ------------- | --- | --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `video`                | file   | Yes      | -             | -   | -   | -                                                                                                        | Input video to remove the background from.                                                                          |
| `background`           | string | No       | `transparent` | -   | -   | `transparent`, `black`, `white`, `green`, `blue`, `magenta`, `custom`                                    | Output background. Transparent preserves alpha; choose a preset color or Custom to use the background color picker. |
| `backgroundColorRed`   | number | No       | `255`         | 0   | 255 | -                                                                                                        | Red channel for the custom solid background color. Only used when Background is set to Custom.                      |
| `backgroundColorGreen` | number | No       | `255`         | 0   | 255 | -                                                                                                        | Green channel for the custom solid background color. Only used when Background is set to Custom.                    |
| `backgroundColorBlue`  | number | No       | `255`         | 0   | 255 | -                                                                                                        | Blue channel for the custom solid background color. Only used when Background is set to Custom.                     |
| `outputFormat`         | string | No       | `webm_vp9`    | -   | -   | `webm_vp9`, `mp4_h264`, `mp4_h265`, `mov_proresks`, `mov_h265`, `mkv_h264`, `mkv_h265`, `mkv_vp9`, `gif` | Output video format. Leave empty to let Pixelcut choose the best format; transparent output defaults to WebM VP9.   |
