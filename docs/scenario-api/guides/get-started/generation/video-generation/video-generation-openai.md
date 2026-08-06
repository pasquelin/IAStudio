---
title: OpenAI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **OpenAI** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [SORA 2](#sora-2)
- [SORA 2 Pro](#sora-2-pro)

---

## SORA 2

**Model ID:** `model_open-ai-sora-2`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_open-ai-sora-2/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values             | Description                                                                              |
| ------------- | ------ | -------- | ------- | --- | --- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                          | A text description of the video to generate                                              |
| `image`       | file   | No       | -       | -   | -   | -                          | Input image to start generating from. Ideal images match requested ratio and resolution. |
| `aspectRatio` | string | No       | `16:9`  | -   | -   | `16:9`, `9:16`             | Video aspect ratio                                                                       |
| `duration`    | number | No       | `4`     | -   | -   | `4`, `8`, `12`, `16`, `20` | Video duration in seconds                                                                |

## SORA 2 Pro

**Model ID:** `model_open-ai-sora-2-pro`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_open-ai-sora-2-pro/markdown>

| Parameter     | Type   | Required | Default    | Min | Max | Allowed Values             | Description                                                                              |
| ------------- | ------ | -------- | ---------- | --- | --- | -------------------------- | ---------------------------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -          | -   | -   | -                          | A text description of the video to generate                                              |
| `image`       | file   | No       | -          | -   | -   | -                          | Input image to start generating from. Ideal images match requested ratio and resolution. |
| `aspectRatio` | string | No       | `16:9`     | -   | -   | `16:9`, `9:16`             | Video aspect ratio                                                                       |
| `duration`    | number | No       | `4`        | -   | -   | `4`, `8`, `12`, `16`, `20` | Video duration in seconds                                                                |
| `resolution`  | string | No       | `standard` | -   | -   | `standard`, `high`         | Output resolution. Standard is 1280x720 or 720x1280, High is 1920x1080 or 1080x1920.     |
