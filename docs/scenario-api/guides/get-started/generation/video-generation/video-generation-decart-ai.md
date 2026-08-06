---
title: Decart AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Decart AI** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Lucy Edit Dev](#lucy-edit-dev)
- [Lucy Edit Pro](#lucy-edit-pro)

---

## Lucy Edit Dev

Lucy Edit Dev

**Model ID:** `model_lucy-edit-dev`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_lucy-edit-dev/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values | Description                                      |
| --------------- | ------- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------ |
| `prompt`        | string  | Yes      | -       | -   | -   | -              | Text description of the desired video content    |
| `videoUrl`      | file    | Yes      | -       | -   | -   | -              | Input video to edit                              |
| `enhancePrompt` | boolean | No       | `true`  | -   | -   | -              | Whether to enhance the prompt for better results |

## Lucy Edit Pro

Lucy Edit Pro

**Model ID:** `model_lucy-edit-pro`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_lucy-edit-pro/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values | Description                                      |
| --------------- | ------- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------ |
| `prompt`        | string  | Yes      | -       | -   | -   | -              | Text description of the desired video content    |
| `videoUrl`      | file    | Yes      | -       | -   | -   | -              | Input video to edit                              |
| `resolution`    | string  | No       | `720p`  | -   | -   | `480p`, `720p` | Output video resolution                          |
| `enhancePrompt` | boolean | No       | `true`  | -   | -   | -              | Whether to enhance the prompt for better results |
