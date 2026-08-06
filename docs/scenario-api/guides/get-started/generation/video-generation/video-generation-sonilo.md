---
title: Sonilo | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Sonilo** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Sonilo V1.1 Video to Video](#sonilo-v11-video-to-video)

---

## Sonilo V1.1 Video to Video

Generate a perfectly synced, commercially licensed soundtrack for any video — optionally keeping the original speech while replacing the music

**Model ID:** `model_sonilo-v1-1-video-to-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sonilo-v1-1-video-to-video/markdown>

| Parameter         | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                                                                                                                                                   |
| ----------------- | ------- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`           | file    | Yes      | -       | -   | -   | -              | The video to score with a new soundtrack. The model analyzes its pacing, mood, and visual rhythm to produce music that fits, then muxes it back into the video. Cost scales with video duration.                                                                                                              |
| `prompt`          | string  | No       | -       | -   | -   | -              | Optional style guidance for the generated music. If omitted, Sonilo generates a prompt from the video.                                                                                                                                                                                                        |
| `keepSpeechVocal` | boolean | No       | `false` | -   | -   | -              | When enabled, the original speech/vocals are isolated and blended over the generated music with automatic ducking. When off (default), the original soundtrack is replaced entirely.                                                                                                                          |
| `numSamples`      | number  | No       | `1`     | 1   | 3   | -              | How many scored video variations to generate from the same source. Useful for picking the best fit. Each additional sample adds to the cost.                                                                                                                                                                  |
| `startOffset`     | number  | No       | -       | 0   | 600 | -              | Optional. Start scoring from this offset in the video, in seconds. Start offset plus duration must not exceed the video duration.                                                                                                                                                                             |
| `duration`        | number  | No       | -       | 1   | 600 | -              | Optional. Length (seconds) of the video segment to score. When set, scores a segment of this length starting at Start Offset (or from the beginning if Start Offset is unset). Defaults to the rest of the video: the whole video when Start Offset is unset, or from Start Offset to the end when it is set. |
