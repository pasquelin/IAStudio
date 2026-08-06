---
title: Character AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Character AI** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Ovi I2V](#ovi-i2v)
- [Ovi T2V](#ovi-t2v)

---

## Ovi I2V

Ovi can generate videos with audio from image and text inputs

**Model ID:** `model_ovi-i2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ovi-i2v/markdown>

| Parameter             | Type   | Required | Default | Min | Max | Allowed Values | Description                                                            |
| --------------------- | ------ | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------- |
| `prompt`              | string | Yes      | -       | -   | -   | -              | Prompt for the video                                                   |
| `imageUrl`            | file   | Yes      | -       | -   | -   | -              | Input image containing a human subject, face or character.             |
| `negativePrompt`      | string | No       | -       | -   | -   | -              | Negative prompt for the video                                          |
| `audioNegativePrompt` | string | No       | -       | -   | -   | -              | Negative prompt for the audio                                          |
| `numInferenceSteps`   | number | No       | `30`    | 1   | 50  | -              | Number of inference steps.                                             |
| `seed`                | number | No       | -       | -   | -   | -              | Use a seed for reproducible results. Leave blank to use a random seed. |

## Ovi T2V

A unified paradigm for audio-video generation

**Model ID:** `model_ovi-t2v`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ovi-t2v/markdown>

| Parameter             | Type   | Required | Default   | Min | Max | Allowed Values                                                                | Description                                                            |
| --------------------- | ------ | -------- | --------- | --- | --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `prompt`              | string | Yes      | -         | -   | -   | -                                                                             | Prompt for the video                                                   |
| `resolution`          | string | No       | `992x512` | -   | -   | `448x1120`, `512x960`, `512x992`, `720x720`, `960x512`, `992x512`, `1120x448` | Resolution of the video.                                               |
| `negativePrompt`      | string | No       | -         | -   | -   | -                                                                             | Negative prompt for the video                                          |
| `audioNegativePrompt` | string | No       | -         | -   | -   | -                                                                             | Negative prompt for the audio                                          |
| `numInferenceSteps`   | number | No       | `30`      | 1   | 50  | -                                                                             | Number of inference steps.                                             |
| `seed`                | number | No       | -         | -   | -   | -                                                                             | Use a seed for reproducible results. Leave blank to use a random seed. |
