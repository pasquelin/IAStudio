---
title: Sonilo | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Sonilo** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Sonilo V1.1 Text to Music](#sonilo-v11-text-to-music)
- [Sonilo V1.1 Video to Music](#sonilo-v11-video-to-music)

---

## Sonilo V1.1 Text to Music

Turn a text description into original music — specify the style, mood, and instrumentation, and get back a ready-to-use audio track in seconds.

**Model ID:** `model_sonilo-v1-1-text-to-music`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sonilo-v1-1-text-to-music/markdown>

| Parameter    | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                                        |
| ------------ | ------ | -------- | ------- | --- | --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`     | string | Yes      | -       | -   | -   | -              | Describe the music you want — genre, mood, instruments, tempo, and structure. For example: ‘upbeat lo-fi hip hop with soft piano and vinyl crackle’ or ‘epic orchestral build for a battle scene’. |
| `duration`   | number | No       | `90`    | 1   | 600 | -              | How long the generated track should be, in seconds. Longer tracks cost more.                                                                                                                       |
| `numSamples` | number | No       | `1`     | 1   | 3   | -              | How many variations to generate from the same prompt. Useful for picking the best take. Each additional sample adds to the cost.                                                                   |

## Sonilo V1.1 Video to Music

Upload a video and get back an original soundtrack that matches its pacing, mood, and timing

**Model ID:** `model_sonilo-v1-1-video-to-music`

**Capabilities:** `video2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sonilo-v1-1-video-to-music/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                                                                                                                                                   |
| ------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`       | file   | Yes      | -       | -   | -   | -              | The video to generate a soundtrack for. The model analyzes its pacing, mood, and visual rhythm to produce music that fits. Cost scales with video duration.                                                                                                                                                   |
| `prompt`      | string | No       | -       | -   | -   | -              | Optional style guidance for the generated music. If omitted, Sonilo generates a prompt from the video.                                                                                                                                                                                                        |
| `numSamples`  | number | No       | `1`     | 1   | 3   | -              | How many soundtrack variations to generate from the same video. Useful for picking the best fit. Each additional sample adds to the cost.                                                                                                                                                                     |
| `startOffset` | number | No       | -       | 0   | 600 | -              | Optional. Start scoring from this offset in the video, in seconds. Start offset plus duration must not exceed the video duration.                                                                                                                                                                             |
| `duration`    | number | No       | -       | 1   | 600 | -              | Optional. Length (seconds) of the video segment to score. When set, scores a segment of this length starting at Start Offset (or from the beginning if Start Offset is unset). Defaults to the rest of the video: the whole video when Start Offset is unset, or from Start Offset to the end when it is set. |
