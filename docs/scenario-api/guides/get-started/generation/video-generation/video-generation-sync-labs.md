---
title: Sync Labs | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Sync Labs** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Sync Lipsync React-1](#sync-lipsync-react-1)
- [Sync Lipsync v2](#sync-lipsync-v2)
- [SYNC Lipsync v2 Pro](#sync-lipsync-v2-pro)
- [Sync-3 Avatar Image to Video](#sync-3-avatar-image-to-video)
- [Sync-3 Lipsync](#sync-3-lipsync)

---

## Sync Lipsync React-1

Use React-1 from SyncLabs to refine human emotions and do realistic lip-sync without losing details!

**Model ID:** `model_sync-lipsync-react-1`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sync-lipsync-react-1/markdown>

| Parameter     | Type   | Required | Default   | Min | Max | Allowed Values                                               | Description                                                                                                                                                                                                                                                                    |
| ------------- | ------ | -------- | --------- | --- | --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `video`       | file   | Yes      | -         | -   | -   | -                                                            | Input video file                                                                                                                                                                                                                                                               |
| `audio`       | file   | Yes      | -         | -   | -   | -                                                            | Input audio file. Maximum duration is 15 seconds.                                                                                                                                                                                                                              |
| `emotion`     | string | No       | `neutral` | -   | -   | `happy`, `angry`, `sad`, `neutral`, `disgusted`, `surprised` | Emotion prompt for the generation.                                                                                                                                                                                                                                             |
| `modelMode`   | string | No       | `face`    | -   | -   | `lips`, `face`, `head`                                       | Controls the edit region and movement scope for the model. Available options: “lips”: Only lipsync using react-1 (minimal facial changes). “face”: Lipsync + facial expressions without head movements. “head”: Lipsync + facial expressions + natural talking head movements. |
| `lipsyncMode` | string | No       | `bounce`  | -   | -   | `loop`, `bounce`, `cut_off`, `silence`, `remap`              | Lipsync mode when audio and video durations are out of sync.                                                                                                                                                                                                                   |
| `temperature` | number | No       | `0.5`     | 0   | 1   | -                                                            | How expressive lipsync can be (0-1)                                                                                                                                                                                                                                            |

## Sync Lipsync v2

**Model ID:** `model_sync-lipsync-v2`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sync-lipsync-v2/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                                  | Description                                                 |
| ------------- | ------ | -------- | ------- | --- | --- | ----------------------------------------------- | ----------------------------------------------------------- |
| `video`       | file   | Yes      | -       | -   | -   | -                                               | Input video file                                            |
| `audio`       | file   | Yes      | -       | -   | -   | -                                               | Input audio file                                            |
| `syncMode`    | string | No       | `loop`  | -   | -   | `loop`, `bounce`, `cut_off`, `silence`, `remap` | Lipsync mode when audio and video durations are out of sync |
| `temperature` | number | No       | `0.5`   | 0   | 1   | -                                               | How expressive lipsync can be (0-1)                         |

## SYNC Lipsync v2 Pro

**Model ID:** `model_sync-lipsync-v2-pro`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sync-lipsync-v2-pro/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values                                  | Description                                                                                      |
| --------------- | ------- | -------- | ------- | --- | --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `video`         | file    | Yes      | -       | -   | -   | -                                               | Input video file                                                                                 |
| `audio`         | file    | Yes      | -       | -   | -   | -                                               | Input audio file                                                                                 |
| `syncMode`      | string  | No       | `loop`  | -   | -   | `loop`, `bounce`, `cut_off`, `silence`, `remap` | Lipsync mode when audio and video durations are out of sync                                      |
| `temperature`   | number  | No       | `0.5`   | 0   | 1   | -                                               | How expressive lipsync can be (0-1)                                                              |
| `activeSpeaker` | boolean | No       | `false` | -   | -   | -                                               | Whether to detect active speaker (i.e. whoever is speaking in the clip will be used for lipsync) |

## Sync-3 Avatar Image to Video

Animate a still image into a talking character video that lip-syncs to a provided audio track.

**Model ID:** `model_sync-lipsync-v3-image-to-video`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sync-lipsync-v3-image-to-video/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                                                                                      |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------ |
| `image`   | file | Yes      | -       | -   | -   | -              | A photo of the character or person to bring to life. Their mouth is animated to match the audio. |
| `audio`   | file | Yes      | -       | -   | -   | -              | The voice or speech track to lip-sync to. The video is the same length as this audio.            |

## Sync-3 Lipsync

Sync-3 lipsync model for professional-quality video lip synchronization.

**Model ID:** `model_sync-lipsync-v3`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sync-lipsync-v3/markdown>

| Parameter  | Type   | Required | Default   | Min | Max | Allowed Values                                  | Description                                                  |
| ---------- | ------ | -------- | --------- | --- | --- | ----------------------------------------------- | ------------------------------------------------------------ |
| `video`    | file   | Yes      | -         | -   | -   | -                                               | Input video file.                                            |
| `audio`    | file   | Yes      | -         | -   | -   | -                                               | Input audio file.                                            |
| `syncMode` | string | No       | `cut_off` | -   | -   | `cut_off`, `loop`, `bounce`, `silence`, `remap` | Lipsync mode when audio and video durations are out of sync. |
