---
title: Meta | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Meta** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Meta MusicGen](#meta-musicgen)

---

## Meta MusicGen

**Model ID:** `model_meta-musicgen`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meta-musicgen/markdown>

| Parameter                | Type    | Required | Default               | Min | Max | Allowed Values                                                 | Description                                                                                                                                                                                                                                                                       |
| ------------------------ | ------- | -------- | --------------------- | --- | --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modelVersion`           | string  | No       | `stereo-melody-large` | -   | -   | `stereo-melody-large`, `stereo-large`, `melody-large`, `large` | Model to use for generation                                                                                                                                                                                                                                                       |
| `prompt`                 | string  | No       | -                     | -   | -   | -                                                              | A description of the music you want to generate.                                                                                                                                                                                                                                  |
| `inputAudio`             | file    | No       | -                     | -   | -   | -                                                              | An audio file that will influence the generated music. If `continuation` is `True`, the generated music will be a continuation of the audio file. Otherwise, the generated music will mimic the audio file’s melody. Only works with Melody Large and Stereo Melody Large models. |
| `duration`               | number  | No       | `8`                   | 1   | 30  | -                                                              | Duration of the generated audio in seconds.                                                                                                                                                                                                                                       |
| `continuation`           | boolean | No       | `false`               | -   | -   | -                                                              | If True, generated music will continue from Input Audio. Otherwise, generated music will mimic Input Audio’s melody.                                                                                                                                                              |
| `continuationStart`      | number  | No       | `0`                   | 0   | -   | -                                                              | Start time of the audio file to use for continuation.                                                                                                                                                                                                                             |
| `continuationEnd`        | number  | No       | -                     | 0   | -   | -                                                              | End time of the audio file to use for continuation. If None, will default to the end of the audio clip.                                                                                                                                                                           |
| `multiBandDiffusion`     | boolean | No       | `false`               | -   | -   | -                                                              | If True, the EnCodec tokens will be decoded with MultiBand Diffusion. Only works with non-stereo models.                                                                                                                                                                          |
| `normalizationStrategy`  | string  | No       | `loudness`            | -   | -   | `loudness`, `clip`, `peak`, `rms`                              | Strategy for normalizing audio.                                                                                                                                                                                                                                                   |
| `temperature`            | number  | No       | `1`                   | -   | -   | -                                                              | Controls the ‘conservativeness’ of the sampling process. Higher temperature means more diversity.                                                                                                                                                                                 |
| `classifierFreeGuidance` | number  | No       | `3`                   | 0   | 10  | -                                                              | Increases the influence of inputs on the output. Higher values produce lower-varience outputs that adhere more closely to inputs.                                                                                                                                                 |
| `seed`                   | number  | No       | -                     | -   | -   | -                                                              | Seed for random number generator. If None or -1, a random seed will be used.                                                                                                                                                                                                      |
