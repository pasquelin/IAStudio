---
title: Tencent | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Tencent** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Hunyuan Image V3](#hunyuan-image-v3)
- [HY World - Image to Skybox](#hy-world---image-to-skybox)
- [Hy Wu Edit](#hy-wu-edit)

---

## Hunyuan Image V3

Leverage the state-of-the-art capabilities of Hunyuan Image 3.0 to generate visual content that effectively conveys the messaging of your written material.

**Model ID:** `model_hunyuan-image-v3`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-image-v3/markdown>

| Parameter               | Type    | Required | Default         | Min | Max        | Allowed Values                                                                            | Description                                                                                                |
| ----------------------- | ------- | -------- | --------------- | --- | ---------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `prompt`                | string  | Yes      | -               | -   | -          | -                                                                                         | A textual prompt to guide model generation.                                                                |
| `negativePrompt`        | string  | No       | -               | -   | -          | -                                                                                         | The negative prompt to guide the image generation away from certain concepts.                              |
| `imageSize`             | string  | No       | `landscape_4_3` | -   | -          | `portrait_16_9`, `portrait_4_3`, `square`, `square_hd`, `landscape_4_3`, `landscape_16_9` | The size of the generated image.                                                                           |
| `numOutputs`            | number  | No       | `1`             | 1   | 4          | -                                                                                         | Number of Images to generate                                                                               |
| `numInferenceSteps`     | number  | No       | `50`            | 1   | 50         | -                                                                                         | The number of inference steps.                                                                             |
| `guidanceScale`         | number  | No       | `3.5`           | 1   | 20         | -                                                                                         | Higher values adhere more closely to the input prompt, while lower values allow for more creative freedom. |
| `enablePromptExpansion` | boolean | No       | `false`         | -   | -          | -                                                                                         | Enable prompt expansion                                                                                    |
| `seed`                  | number  | No       | -               | 0   | 2147483647 | -                                                                                         | Use a seed for reproducible results. Leave blank to use a random seed.                                     |

## HY World - Image to Skybox

Expand a single photo of a place into a 360° equirectangular skybox image.

**Model ID:** `model_hunyuan-world-image-to-skybox`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-world-image-to-skybox/markdown>

| Parameter | Type   | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                  |
| --------- | ------ | -------- | ------- | --- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `image`   | file   | Yes      | -       | -   | -          | -              | A single photo of a PLACE/scene (indoor or outdoor), NOT an object — expanded into a 360° equirectangular panorama.          |
| `prompt`  | string | No       | -       | -   | -          | -              | Optional text describing what should fill the unseen surroundings.                                                           |
| `backend` | string | No       | `full`  | -   | -          | `full`, `qwen` | Panorama backend. `full` = HunyuanImage-3 (highest quality, slower & costlier); `qwen` = faster and cheaper, lower fidelity. |
| `seed`    | number | No       | -       | 0   | 2147483647 | -              | Seed for reproducible results; leave blank for random.                                                                       |

## Hy Wu Edit

Image editing with HY-WU. Transfer outfits, swap faces, and blend textures instantly with reference images.

**Model ID:** `model_hy-wu-edit`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hy-wu-edit/markdown>

| Parameter           | Type        | Required | Default | Min | Max        | Allowed Values | Description                                                                              |
| ------------------- | ----------- | -------- | ------- | --- | ---------- | -------------- | ---------------------------------------------------------------------------------------- |
| `prompt`            | string      | Yes      | -       | -   | -          | -              | Text prompt describing the desired edit.                                                 |
| `referenceImages`   | file\_array | Yes      | -       | -   | -          | -              | Input images for editing. Typically includes base image and reference image.             |
| `numInferenceSteps` | number      | No       | `30`    | 1   | 100        | -              | Number of denoising steps.                                                               |
| `numOutputs`        | number      | No       | `1`     | 1   | 4          | -              | Number of images to generate.                                                            |
| `enableThinking`    | boolean     | No       | `true`  | -   | -          | -              | When enabled, the model reasons before generation for higher quality at additional cost. |
| `seed`              | number      | No       | -       | 0   | 2147483647 | -              | Random seed for reproducibility.                                                         |
