---
title: Scenario | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Scenario** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Audio Cut](#audio-cut)
- [Audio Extract](#audio-extract)
- [Audio Split](#audio-split)

---

## Audio Cut

Trim an audio file to a precise time range with sample-accurate cutting.

**Model ID:** `model_scenario-audio-cut`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-audio-cut/markdown>

| Parameter      | Type   | Required | Default | Min | Max | Allowed Values                | Description                                                              |
| -------------- | ------ | -------- | ------- | --- | --- | ----------------------------- | ------------------------------------------------------------------------ |
| `audio`        | file   | Yes      | -       | -   | -   | -                             | Audio to cut/trim                                                        |
| `startTime`    | number | No       | `0`     | 0   | -   | -                             | Start time in seconds. Default is 0 (beginning of audio).                |
| `endTime`      | number | No       | -       | 0   | -   | -                             | End time in seconds. If not specified, cuts to the end of the audio.     |
| `outputFormat` | string | No       | -       | -   | -   | “, `mp3`, `wav`, `ogg`, `m4a` | Output audio format. If not specified, the original format is preserved. |

## Audio Extract

Pull the audio out of any video and save it as a standalone MP3, WAV, or AAC file.

**Model ID:** `model_scenario-audio-extract`

**Capabilities:** `video2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-audio-extract/markdown>

| Parameter           | Type    | Required | Default | Min | Max | Allowed Values      | Description                                                                                                                                                               |
| ------------------- | ------- | -------- | ------- | --- | --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`             | file    | Yes      | -       | -   | -   | -                   | The video file to extract audio from. The existing audio track is pulled out as-is — no generation or modification applied.                                               |
| `outputFormat`      | string  | No       | `mp3`   | -   | -   | `mp3`, `wav`, `aac` | The file format for the extracted audio. MP3 is widely compatible; WAV is lossless; AAC offers a good balance of quality and file size.                                   |
| `normalizeLoudness` | boolean | No       | `false` | -   | -   | -                   | Adjusts the volume of the extracted audio to a consistent, broadcast-safe level. Useful if the original video is too quiet or uneven. Enabling this re-encodes the audio. |

## Audio Split

Split an audio file at one or more timestamps into ordered segments.

**Model ID:** `model_scenario-audio-split`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-audio-split/markdown>

| Parameter      | Type          | Required | Default | Min | Max | Allowed Values                | Description                                                                                                                                         |
| -------------- | ------------- | -------- | ------- | --- | --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio`        | file          | Yes      | -       | -   | -   | -                             | Audio file to split                                                                                                                                 |
| `cutPoints`    | number\_array | No       | “       | 0   | -   | -                             | Sorted timestamps in seconds at which to split the audio. N cut points produce N+1 segments. Leave empty for one segment containing the full audio. |
| `outputFormat` | string        | No       | -       | -   | -   | “, `mp3`, `wav`, `ogg`, `m4a` | Output format for all segments. If not specified, the source format is preserved.                                                                   |
| `strict`       | boolean       | No       | `false` | -   | -   | -                             | If enabled, reject malformed cut points (unsorted, duplicates, out of range, or empty). If disabled, cut points are normalized automatically.       |
