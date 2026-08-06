---
title: ElevenLabs | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **ElevenLabs** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [ElevenLabs Dubbing](#elevenlabs-dubbing)

---

## ElevenLabs Dubbing

Automatically dub audio or video content into another language while preserving speaker voices.

**Model ID:** `model_elevenlabs-dubbing`

**Capabilities:** `audio2audio`, `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-dubbing/markdown>

| Parameter             | Type    | Required | Default | Min | Max | Allowed Values                                                                                                                                                                              | Description                                                                        |
| --------------------- | ------- | -------- | ------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `file`                | file    | Yes      | -       | -   | -   | -                                                                                                                                                                                           | The audio or video file to dub.                                                    |
| `targetLang`          | string  | Yes      | `en`    | -   | -   | `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ru`, `ar`, `hi`, `pt`, `nl`, `sv`, `da`, `no`, `fi`, `pl`, `tr`, `id`, `th`, `vi`, `ms`, `tl`, `ro`, `hu`, `cs`, `sk`, `uk`, `bg`, `hr`    | The target language for dubbing (ISO 639-1 code).                                  |
| `sourceLang`          | string  | No       | -       | -   | -   | “, `en`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ru`, `ar`, `hi`, `pt`, `nl`, `sv`, `da`, `no`, `fi`, `pl`, `tr`, `id`, `th`, `vi`, `ms`, `tl`, `ro`, `hu`, `cs`, `sk`, `uk`, `bg`, `hr` | The source language of the audio (ISO 639-1 code). Leave empty for auto-detection. |
| `numSpeakers`         | number  | No       | `0`     | 0   | 10  | -                                                                                                                                                                                           | Number of speakers in the audio. Set to 0 for automatic detection.                 |
| `dropBackgroundAudio` | boolean | No       | `false` | -   | -   | -                                                                                                                                                                                           | Whether to remove background audio from the dubbed output.                         |
| `disableVoiceCloning` | boolean | No       | `false` | -   | -   | -                                                                                                                                                                                           | Whether to disable voice cloning and use a generic voice instead.                  |
| `highestResolution`   | boolean | No       | `false` | -   | -   | -                                                                                                                                                                                           | Whether to return the dubbed video in the highest resolution available.            |
