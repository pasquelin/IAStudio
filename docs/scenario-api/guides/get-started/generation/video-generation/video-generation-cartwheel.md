---
title: Cartwheel | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Cartwheel** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Cartwheel Mascot](#cartwheel-mascot)

---

## Cartwheel Mascot

Replace characters in a video with new characters described by reference images and a prompt using Cartwheel.

**Model ID:** `model_cartwheel-mascot`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_cartwheel-mascot/markdown>

| Parameter                  | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                      |
| -------------------------- | ----------- | -------- | ------- | --- | --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`                    | file        | Yes      | -       | -   | -   | -              | The video you want to transform. The people or characters in it are replaced with your new character. Supports MP4, WEBM, and MOV.                                               |
| `characterReferenceImages` | file\_array | Yes      | -       | -   | -   | -              | Images showing what the replacement character should look like. Order matters: the first image is used for the first character in the video, the second for the next, and so on. |
| `prompt`                   | string      | Yes      | -       | -   | -   | -              | Describe the replacement you want — for example, what the new character looks like or how it should appear in the scene.                                                         |
| `environmentImage`         | file        | No       | -       | -   | -   | -              | An optional reference image for the background or setting the character should appear in.                                                                                        |
