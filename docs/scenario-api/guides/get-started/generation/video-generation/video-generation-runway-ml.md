---
title: Runway ML | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Runway ML** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Runway Aleph 2](#runway-aleph-2)
- [Runway Gen4 Turbo](#runway-gen4-turbo)
- [Runway Gen4.5](#runway-gen45)

---

## Runway Aleph 2

Edit any video using a text prompt, with optional reference images pinned to specific moments for precise, frame-level control.

**Model ID:** `model_runway-aleph-2`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_runway-aleph-2/markdown>

| Parameter     | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                                                                              |
| ------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string        | Yes      | -       | -   | -          | -              | Describe how you want the video to look or feel after editing — style, atmosphere, visual changes. For example: ‘transform into a noir film with high contrast and rain-soaked streets’. |
| `video`       | file          | Yes      | -       | -   | -          | -              | The source video to edit. Maximum 30 seconds and 16 MB. The model rewrites its visuals based on your prompt while preserving the original motion and structure.                          |
| `keyframes`   | inputs\_array | No       | -       | -   | -          | -              | Pin reference images to specific moments in the video to guide the edit at those points. Add up to 5 keyframes. Use Seconds or Position to set each one’s timing.                        |
| `promptImage` | inputs\_array | No       | -       | -   | -          | -              | Alternative to Keyframes — pin reference images to moments in the output video. Cannot be used together with Keyframes. Add up to 5 images.                                              |
| `seed`        | number        | No       | -       | 0   | 4294967295 | -              | A number that locks in the randomness of the generation. Copy the seed from a result you liked to reproduce it exactly, or leave blank for a new result each time.                       |

## Runway Gen4 Turbo

The Turbo version of Gen-4 delivers further enhanced speeds at a lower cost, and is a powerful model for quickly iterating ideas.

**Model ID:** `model_runway-gen4-turbo`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_runway-gen4-turbo/markdown>

| Parameter     | Type   | Required | Default    | Min | Max | Allowed Values                                                        | Description                                                            |
| ------------- | ------ | -------- | ---------- | --- | --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -          | -   | -   | -                                                                     | Describe your video                                                    |
| `image`       | file   | Yes      | -          | -   | -   | -                                                                     | Image used as the first frame of the video.                            |
| `aspectRatio` | string | No       | `1280:720` | -   | -   | `1584:672`, `1280:720`, `1104:832`, `960:960`, `832:1104`, `720:1280` | Aspect ratio of the video. Ignored if first frame is provided.         |
| `duration`    | number | No       | `5`        | 2   | 10  | -                                                                     | Duration in seconds                                                    |
| `seed`        | number | No       | -          | -   | -   | -                                                                     | Use a seed for reproducible results. Leave blank to use a random seed. |

## Runway Gen4.5

Gen-4.5 is state-of-the-art and sets a new standard for video generation motion quality, prompt adherence and visual fidelity.

**Model ID:** `model_runway-gen4-5`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_runway-gen4-5/markdown>

| Parameter     | Type   | Required | Default    | Min | Max        | Allowed Values                                                                    | Description                                                                                                         |
| ------------- | ------ | -------- | ---------- | --- | ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -          | -   | -          | -                                                                                 | Describe your video                                                                                                 |
| `image`       | file   | No       | -          | -   | -          | -                                                                                 | Image used as the first frame of the video.                                                                         |
| `aspectRatio` | string | No       | `1280:720` | -   | -          | `1584:672`, `1280:720`, `1104:832`, `960:960`, `832:1104`, `720:1280`, `672:1584` | Aspect ratio of the video. Ignored if first frame is provided. For Text to Video, only 16:9 and 9:16 are supported. |
| `duration`    | number | No       | `5`        | 2   | 10         | -                                                                                 | Duration in seconds                                                                                                 |
| `seed`        | number | No       | -          | 0   | 4294967295 | -                                                                                 | Use a seed for reproducible results. Leave blank to use a random seed.                                              |
