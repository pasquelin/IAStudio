---
title: Veed IO | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Veed IO** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Veed Fabric 1.0](#veed-fabric-10)
- [Veed Lipsync v2](#veed-lipsync-v2)

---

## Veed Fabric 1.0

VEED Fabric 1.0 is an image-to-video model that turns any image into a talking video

**Model ID:** `model_veed-fabric-1-0`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_veed-fabric-1-0/markdown>

| Parameter    | Type   | Required | Default | Min | Max | Allowed Values | Description                       |
| ------------ | ------ | -------- | ------- | --- | --- | -------------- | --------------------------------- |
| `image`      | file   | Yes      | -       | -   | -   | -              | Input image file                  |
| `audioUrl`   | file   | Yes      | -       | -   | -   | -              | Input audio file                  |
| `resolution` | string | No       | `720p`  | -   | -   | `480p`, `720p` | Resolution of the generated video |

## Veed Lipsync v2

Generate production-quality lipsync from any audio using VEED’s most advanced model yet.

**Model ID:** `model_veed-lipsync-v2`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_veed-lipsync-v2/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                                                                                             |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------- |
| `video`   | file | Yes      | -       | -   | -   | -              | The video of a person talking that you want to re-sync. Their mouth is reshaped to match the new audio. |
| `audio`   | file | Yes      | -       | -   | -   | -              | The voice or speech track you want the person to appear to say. Their lip movements are matched to it.  |
