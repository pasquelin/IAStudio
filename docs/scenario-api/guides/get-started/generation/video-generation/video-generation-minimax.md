---
title: MiniMax | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **MiniMax** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Minimax 01 Director](#minimax-01-director)
- [Minimax Hailuo 02](#minimax-hailuo-02)
- [Minimax Hailuo 2.3](#minimax-hailuo-23)
- [Minimax Hailuo 2.3 Fast](#minimax-hailuo-23-fast)
- [Minimax Video 01](#minimax-video-01)

---

## Minimax 01 Director

A cinematography model offering advanced camera control for cinematic storytelling and professional framing.

**Model ID:** `model_minimax-video-01-director`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_minimax-video-01-director/markdown>

| Parameter         | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                             |
| ----------------- | ------- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------- |
| `prompt`          | string  | Yes      | -       | -   | -   | -              | Describe your video. Try Prompt Spark or check our Help Center for detailed prompt tips for this model. |
| `firstFrameImage` | file    | No       | -       | -   | -   | -              | Image used as the first frame of the video.                                                             |
| `promptOptimizer` | boolean | No       | `true`  | -   | -   | -              | Use prompt optimizer                                                                                    |

## Minimax Hailuo 02

**Model ID:** `model_minimax-hailuo-02`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_minimax-hailuo-02/markdown>

| Parameter         | Type    | Required | Default | Min | Max | Allowed Values  | Description                                                                                                                |
| ----------------- | ------- | -------- | ------- | --- | --- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string  | Yes      | -       | -   | -   | -               | Describe your video                                                                                                        |
| `firstFrameImage` | file    | No       | -       | -   | -   | -               | Image used as the first frame of the video. The output video will have the same aspect ratio as this image.                |
| `lastFrameImage`  | file    | No       | -       | -   | -   | -               | Used to generate a video that transitions from the first frame to this image. Requires a first frame image.                |
| `duration`        | number  | No       | `6`     | -   | -   | `6`, `10`       | Duration of the video in seconds. 10 seconds is only available for 768p resolution.                                        |
| `resolution`      | string  | No       | `1080p` | -   | -   | `768p`, `1080p` | Pick between standard 768p, or pro 1080p resolution. The pro model is not just high resolution, it is also higher quality. |
| `promptOptimizer` | boolean | No       | `true`  | -   | -   | -               | Use prompt optimizer                                                                                                       |

## Minimax Hailuo 2.3

A high-fidelity video generation model optimized for realistic human motion, cinematic VFX, expressive characters, and strong prompt and style adherence across both text-to-video and image-to-video workflows

**Model ID:** `model_minimax-hailuo-2-3`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_minimax-hailuo-2-3/markdown>

| Parameter         | Type    | Required | Default | Min | Max | Allowed Values  | Description                                                                                             |
| ----------------- | ------- | -------- | ------- | --- | --- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `prompt`          | string  | Yes      | -       | -   | -   | -               | Text prompt for generation                                                                              |
| `firstFrameImage` | file    | No       | -       | -   | -   | -               | First frame image for video generation. The output video will have the same aspect ratio as this image. |
| `duration`        | number  | No       | `6`     | -   | -   | `6`, `10`       | Duration of the video in seconds. 10 seconds is only available for 768p resolution.                     |
| `resolution`      | string  | No       | `768p`  | -   | -   | `768p`, `1080p` | Pick between 768p or 1080p resolution. 1080p supports only 6-second duration.                           |
| `promptOptimizer` | boolean | No       | `true`  | -   | -   | -               | Use prompt optimizer                                                                                    |

## Minimax Hailuo 2.3 Fast

A lower-latency image-to-video version of Hailuo 2.3 that preserves core motion quality, visual consistency, and stylization performance while enabling faster iteration cycles.

**Model ID:** `model_minimax-hailuo-2-3-fast`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_minimax-hailuo-2-3-fast/markdown>

| Parameter         | Type    | Required | Default | Min | Max | Allowed Values  | Description                                                                                             |
| ----------------- | ------- | -------- | ------- | --- | --- | --------------- | ------------------------------------------------------------------------------------------------------- |
| `prompt`          | string  | Yes      | -       | -   | -   | -               | Text prompt for generation                                                                              |
| `firstFrameImage` | file    | No       | -       | -   | -   | -               | First frame image for video generation. The output video will have the same aspect ratio as this image. |
| `duration`        | number  | No       | `6`     | -   | -   | `6`, `10`       | Duration of the video in seconds. 10 seconds is only available for 768p resolution.                     |
| `resolution`      | string  | No       | `768p`  | -   | -   | `768p`, `1080p` | Pick between 768p or 1080p resolution. 1080p supports only 6-second duration.                           |
| `promptOptimizer` | boolean | No       | `true`  | -   | -   | -               | Use prompt optimizer                                                                                    |

## Minimax Video 01

Minimax Video-01 is a versatile model generating high-quality videos with 720p resolution and smooth motion.

**Model ID:** `model_minimax-video-01`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_minimax-video-01/markdown>

| Parameter          | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                        |
| ------------------ | ------- | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------------- |
| `prompt`           | string  | Yes      | -       | -   | -   | -              | Describe your video                                                                |
| `firstFrameImage`  | file    | No       | -       | -   | -   | -              | Image used as the first frame of the video.                                        |
| `subjectReference` | file    | No       | -       | -   | -   | -              | An optional character reference image to use as the subject in the generated video |
| `promptOptimizer`  | boolean | No       | `true`  | -   | -   | -              | Use prompt optimizer                                                               |
