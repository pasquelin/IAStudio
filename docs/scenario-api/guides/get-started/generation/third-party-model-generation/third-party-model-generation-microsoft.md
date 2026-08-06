---
title: Microsoft | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Microsoft** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [MAI Image 2.5](#mai-image-25)
- [MAI Image 2.5 Edit](#mai-image-25-edit)

---

## MAI Image 2.5

Generate photorealistic images and design-ready visuals with accurate text rendering — Microsoft’s most capable image model to date.

**Model ID:** `model_microsoft-mai-image-2-5`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_microsoft-mai-image-2-5/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                                                                  | Description                                                                                                                         |
| ------------- | ------ | -------- | ------- | --- | --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                                                               | Describe the image you want to generate, including subject, style, mood, composition, and any text that should appear in the image. |
| `aspectRatio` | string | No       | `auto`  | -   | -   | `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` | The aspect ratio of the generated image. Use Auto to let the model choose based on the prompt.                                      |
| `numOutputs`  | number | No       | `1`     | 1   | 4   | -                                                                               | How many images to generate from the same prompt. Useful for exploring variations. Each additional image adds to the cost.          |

## MAI Image 2.5 Edit

Edit any image with a text instruction — change style, lighting, composition, or add text — powered by Microsoft’s most capable image model.

**Model ID:** `model_microsoft-mai-image-2-5-edit`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_microsoft-mai-image-2-5-edit/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                                            | Description                                                                                                                                          |
| ----------------- | ----------- | -------- | ------- | --- | --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceImages` | file\_array | Yes      | -       | -   | -   | -                                                         | The image you want to edit. Upload one photo, illustration, or design — the model will modify it based on your instructions.                         |
| `prompt`          | string      | Yes      | -       | -   | -   | -                                                         | Describe how the input image should be edited, including visual changes, style, lighting, composition, and any text that should appear.              |
| `aspectRatio`     | string      | No       | `auto`  | -   | -   | `auto`, `16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16` | The aspect ratio of the edited image. Use Auto to match the input image or let the model choose.                                                     |
| `numOutputs`      | number      | No       | `1`     | 1   | 4   | -                                                         | How many edited versions to generate from the same prompt and source image. Useful for exploring variations. Each additional image adds to the cost. |
