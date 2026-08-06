---
title: xAI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-03.

This reference lists all available **xAI** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Grok Edit Video](#grok-edit-video)
- [Grok Extend Video](#grok-extend-video)
- [Grok Imagine Video](#grok-imagine-video)
- [Grok Imagine Video 1.5](#grok-imagine-video-15)

---

## Grok Edit Video

Edit an existing video with natural-language instructions using xAI Grok Imagine.

**Model ID:** `model_xai-grok-edit-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_xai-grok-edit-video/markdown>

| Parameter | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                  |
| --------- | ------ | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------- |
| `prompt`  | string | Yes      | -       | -   | -   | -              | Instructions for how to edit the video (style, objects, environment, motion) |
| `video`   | file   | Yes      | -       | -   | -   | -              | Video to edit. Auto-preprocessed to max 8.7s at 720p.                        |

## Grok Extend Video

Extend an existing video with new footage using xAI Grok: up to 15s of source video is preprocessed at 720p, then 2–10s of continuation is generated from your prompt.

**Model ID:** `model_xai-grok-extend-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_xai-grok-extend-video/markdown>

| Parameter  | Type   | Required | Default | Min | Max | Allowed Values | Description                                                 |
| ---------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------- |
| `prompt`   | string | Yes      | -       | -   | -   | -              | Describe how the video should continue after the input clip |
| `video`    | file   | Yes      | -       | -   | -   | -              | Source video to extend.                                     |
| `duration` | number | No       | `6`     | 2   | 10  | -              | Seconds of new footage to generate (2-10)                   |

## Grok Imagine Video

Generate videos using xAI’s Grok model — text-to-video and image-to-video (up to 15s) at 480p or 720p with flexible aspect ratios

**Model ID:** `model_xai-grok-imagine-video`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_xai-grok-imagine-video/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                                            | Description                                                                                                                        |
| ------------- | ------ | -------- | ------- | --- | --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                                         | Text description of the video to generate                                                                                          |
| `image`       | file   | No       | -       | -   | -   | -                                                         | Source image for image-to-video generation. The model will animate the provided image based on the text prompt.                    |
| `numOutputs`  | number | No       | `1`     | 1   | 4   | -                                                         | Number of videos to generate concurrently                                                                                          |
| `duration`    | number | No       | `5`     | 1   | 15  | -                                                         | Output video duration in seconds (1–15)                                                                                            |
| `aspectRatio` | string | No       | `auto`  | -   | -   | `auto`, `16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16` | Aspect ratio for the generated video. Auto will use the aspect ratio of the source image or 16:9 by default in Text to Video mode. |
| `resolution`  | string | No       | `480p`  | -   | -   | `480p`, `720p`                                            | Output resolution for the generated video                                                                                          |

## Grok Imagine Video 1.5

Animate a source image using xAI’s Grok Imagine Video 1.5 preview model — image-to-video generation up to 15s at 480p or 720p with flexible aspect ratios

**Model ID:** `model_xai-grok-imagine-video-1-5`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_xai-grok-imagine-video-1-5/markdown>

| Parameter    | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                              |
| ------------ | ------ | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------------------- |
| `prompt`     | string | Yes      | -       | -   | -   | -              | Text description of how to animate the source image                                      |
| `image`      | file   | Yes      | -       | -   | -   | -              | Source image for image-to-video generation. Required for Grok Imagine Video 1.5 preview. |
| `numOutputs` | number | No       | `1`     | 1   | 4   | -              | Number of videos to generate concurrently                                                |
| `duration`   | number | No       | `5`     | 1   | 15  | -              | Output video duration in seconds (1-15)                                                  |
| `resolution` | string | No       | `480p`  | -   | -   | `480p`, `720p` | Output resolution for the generated video                                                |
