---
title: Creatify | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Creatify** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Creatify Aurora](#creatify-aurora)
- [Creatify Lipsync](#creatify-lipsync)

---

## Creatify Aurora

Generate high fidelity, studio quality videos of your avatar speaking or singing using the Aurora from Creatify team!

**Model ID:** `model_creatify-aurora`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_creatify-aurora/markdown>

| Parameter            | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                  |
| -------------------- | ------ | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------- |
| `image`              | file   | Yes      | -       | -   | -   | -              | Input avatar image file                                                      |
| `audio`              | file   | Yes      | -       | -   | -   | -              | Input audio file                                                             |
| `prompt`             | string | No       | -       | -   | -   | -              | Prompt to guide the video generation process.                                |
| `guidanceScale`      | number | No       | `1`     | 0   | 5   | -              | Higher values follow the prompt more closely, lower values are more creative |
| `audioGuidanceScale` | number | No       | `2`     | 0   | 5   | -              | Higher values follow the audio more closely, lower values are more creative  |
| `resolution`         | string | No       | `720p`  | -   | -   | `480p`, `720p` | Resolution for the avatar                                                    |

## Creatify Lipsync

Realistic lipsync video - optimized for speed, quality, and consistency.

**Model ID:** `model_creatify-lipsync`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_creatify-lipsync/markdown>

| Parameter | Type    | Required | Default | Min | Max | Allowed Values | Description               |
| --------- | ------- | -------- | ------- | --- | --- | -------------- | ------------------------- |
| `video`   | file    | Yes      | -       | -   | -   | -              | Input video file          |
| `audio`   | file    | Yes      | -       | -   | -   | -              | Input audio file          |
| `loop`    | boolean | No       | `true`  | -   | -   | -              | Whether to loop the audio |
