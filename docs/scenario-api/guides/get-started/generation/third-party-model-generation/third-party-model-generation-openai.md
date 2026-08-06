---
title: OpenAI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-30.

This reference lists all available **OpenAI** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [GPT Image](#gpt-image)
- [GPT Image 1.5](#gpt-image-15)
- [GPT Image 2](#gpt-image-2)

---

## GPT Image

OpenAI’s GPT Image 1 model for image editing and generation

**Model ID:** `model_openai-gpt-image-1-editing`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_openai-gpt-image-1-editing/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                  | Description                                    |
| ----------------- | ----------- | -------- | ------- | --- | --- | ------------------------------- | ---------------------------------------------- |
| `referenceImages` | file\_array | No       | -       | -   | -   | -                               | Reference images for style or content guidance |
| `prompt`          | string      | Yes      | -       | -   | -   | -                               | Text prompt for image editing                  |
| `numOutputs`      | number      | No       | `1`     | 1   | 10  | -                               | Number of images to generate                   |
| `aspectRatio`     | string      | No       | `auto`  | -   | -   | `auto`, `1:1`, `3:2`, `2:3`     | Aspect ratio for the generated image           |
| `inputFidelity`   | string      | No       | `high`  | -   | -   | `low`, `high`                   | Preserve details from input images             |
| `quality`         | string      | No       | `high`  | -   | -   | `high`, `medium`, `low`         | Generation quality                             |
| `background`      | string      | No       | `auto`  | -   | -   | `transparent`, `opaque`, `auto` | Background transparency                        |

## GPT Image 1.5

OpenAI’s GPT Image 1.5 model for image editing

**Model ID:** `model_openai-gpt-image-1-5-editing`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_openai-gpt-image-1-5-editing/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                  | Description                                    |
| ----------------- | ----------- | -------- | ------- | --- | --- | ------------------------------- | ---------------------------------------------- |
| `referenceImages` | file\_array | No       | -       | -   | -   | -                               | Reference images for style or content guidance |
| `prompt`          | string      | Yes      | -       | -   | -   | -                               | Text prompt for image editing                  |
| `numOutputs`      | number      | No       | `1`     | 1   | 10  | -                               | Number of images to generate                   |
| `aspectRatio`     | string      | No       | `auto`  | -   | -   | `auto`, `1:1`, `3:2`, `2:3`     | Aspect ratio for the generated image           |
| `inputFidelity`   | string      | No       | `high`  | -   | -   | `low`, `high`                   | Preserve details from input images             |
| `quality`         | string      | No       | `high`  | -   | -   | `high`, `medium`, `low`         | Generation quality                             |
| `background`      | string      | No       | `auto`  | -   | -   | `transparent`, `opaque`, `auto` | Background transparency                        |

## GPT Image 2

OpenAI GPT Image 2 for high-fidelity image generation and editing (Modal)

**Model ID:** `model_openai-gpt-image-2`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_openai-gpt-image-2/markdown>

| Parameter         | Type        | Required | Default | Min | Max  | Allowed Values                  | Description                                                                                                                                                                                                                  |
| ----------------- | ----------- | -------- | ------- | --- | ---- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -    | -                               | Text description of desired generation or edit.                                                                                                                                                                              |
| `referenceImages` | file\_array | No       | -       | -   | -    | -                               | Reference images for editing.                                                                                                                                                                                                |
| `mask`            | file        | No       | -       | -   | -    | -                               | Mask image for inpainting. The image to edit and the mask must use the same format and dimensions. The mask must include an alpha channel—if you create the mask in an image editor, export or save it with alpha preserved. |
| `numOutputs`      | number      | No       | `1`     | 1   | 10   | -                               | Number of images to generate                                                                                                                                                                                                 |
| `width`           | number      | No       | -       | 16  | 3840 | -                               | Output width in pixels.                                                                                                                                                                                                      |
| `height`          | number      | No       | -       | 16  | 3840 | -                               | Output height in pixels.                                                                                                                                                                                                     |
| `quality`         | string      | No       | `auto`  | -   | -    | `auto`, `high`, `medium`, `low` | Generation quality                                                                                                                                                                                                           |
| `background`      | string      | No       | `auto`  | -   | -    | `auto`, `opaque`                | Background option                                                                                                                                                                                                            |
