---
title: Reve AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Reve AI** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Reve Remix](#reve-remix)
- [Reve v2.1](#reve-v21)

---

## Reve Remix

**Model ID:** `model_reve-remix`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_reve-remix/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                                    | Description                                     |
| ----------------- | ----------- | -------- | ------- | --- | --- | ------------------------------------------------- | ----------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -   | -                                                 | Text prompt for image generation                |
| `referenceImages` | file\_array | Yes      | -       | -   | -   | -                                                 | List of 1-6 image files to remix from           |
| `aspectRatio`     | string      | No       | `3:2`   | -   | -   | `16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16` | The desired aspect ratio of the generated image |

## Reve v2.1

**Model ID:** `model_reve-v2-1`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_reve-v2-1/markdown>

| Parameter     | Type        | Required | Default | Min | Max | Allowed Values                                                                                                                    | Description                                                                                                                                                                                         |
| ------------- | ----------- | -------- | ------- | --- | --- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string      | Yes      | -       | -   | -   | -                                                                                                                                 | Describe the image you want to create. To refer to a reference image, use a \<frame>N\</frame> tag, where N is the image’s position starting from 0 (so the first reference is \<frame>0\</frame>). |
| `references`  | file\_array | No       | -       | -   | -   | -                                                                                                                                 | Optional images to guide the result. Refer to them in your prompt with \<frame>N\</frame> tags, numbered from 0 in the order you add them.                                                          |
| `aspectRatio` | string      | No       | `auto`  | -   | -   | `4:1`, `3:1`, `21:9`, `2:1`, `17:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `1:2`, `1:3`, `1:4`, `auto` | The shape of the image. Auto picks a fitting shape for you.                                                                                                                                         |
