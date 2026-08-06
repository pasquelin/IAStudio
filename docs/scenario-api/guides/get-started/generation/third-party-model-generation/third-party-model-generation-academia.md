---
title: Academia | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Academia** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [ERNIE Image](#ernie-image)
- [ERNIE Image Turbo](#ernie-image-turbo)
- [Joyai Image Edit](#joyai-image-edit)
- [Physic Edit](#physic-edit)
- [Telestyle V2 Style Transfer](#telestyle-v2-style-transfer)
- [Z-Image](#z-image)
- [Z-Image Turbo](#z-image-turbo)

---

## ERNIE Image

Baidu ERNIE-Image (SFT) — strong instruction following, text rendering, and layout-aware generation; \~50 inference steps with optional prompt enhancer.

**Model ID:** `model_ernie-image`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ernie-image/markdown>

| Parameter           | Type    | Required | Default | Min | Max  | Allowed Values | Description                                                                    |
| ------------------- | ------- | -------- | ------- | --- | ---- | -------------- | ------------------------------------------------------------------------------ |
| `prompt`            | string  | Yes      | -       | -   | -    | -              | Text prompt for image generation.                                              |
| `numOutputs`        | number  | No       | `1`     | 1   | 4    | -              | Number of images to generate.                                                  |
| `width`             | number  | No       | `1024`  | 64  | 2048 | -              | Width of the generated image. Recommended sizes are listed in presets.         |
| `height`            | number  | No       | `1024`  | 64  | 2048 | -              | Height of the generated image. Recommended sizes are listed in presets.        |
| `numInferenceSteps` | number  | No       | `50`    | 1   | 100  | -              | Number of denoising steps. The SFT model is tuned for \~50 steps.              |
| `guidanceScale`     | number  | No       | `4`     | 0   | 20   | -              | Classifier-free guidance scale.                                                |
| `usePe`             | boolean | No       | `true`  | -   | -    | -              | Expand short prompts into richer descriptions (recommended on the model card). |
| `seed`              | number  | No       | -       | -   | -    | -              | Random seed for reproducible generation.                                       |

## ERNIE Image Turbo

Baidu ERNIE-Image-Turbo — fast \~8-step generation with optional prompt enhancer (guidance fixed in the deployment).

**Model ID:** `model_ernie-image-turbo`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ernie-image-turbo/markdown>

| Parameter    | Type    | Required | Default | Min | Max  | Allowed Values | Description                                                                    |
| ------------ | ------- | -------- | ------- | --- | ---- | -------------- | ------------------------------------------------------------------------------ |
| `prompt`     | string  | Yes      | -       | -   | -    | -              | Text prompt for image generation.                                              |
| `numOutputs` | number  | No       | `1`     | 1   | 4    | -              | Number of images to generate.                                                  |
| `width`      | number  | No       | `1024`  | 64  | 2048 | -              | Width of the generated image. Recommended sizes are listed in presets.         |
| `height`     | number  | No       | `1024`  | 64  | 2048 | -              | Height of the generated image. Recommended sizes are listed in presets.        |
| `usePe`      | boolean | No       | `true`  | -   | -    | -              | Expand short prompts into richer descriptions (recommended on the model card). |
| `seed`       | number  | No       | -       | -   | -    | -              | Random seed for reproducible generation.                                       |

## Joyai Image Edit

All-in-one image editing model with strong visual understanding for precise natural language edits.

**Model ID:** `model_joyai-image-edit`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_joyai-image-edit/markdown>

| Parameter           | Type   | Required | Default | Min | Max        | Allowed Values | Description                                                        |
| ------------------- | ------ | -------- | ------- | --- | ---------- | -------------- | ------------------------------------------------------------------ |
| `prompt`            | string | Yes      | -       | -   | -          | -              | The edit instruction describing what changes to make to the image. |
| `image`             | file   | Yes      | -       | -   | -          | -              | Input image to edit.                                               |
| `negativePrompt`    | string | No       | -       | -   | -          | -              | Text describing what should not appear in the output image.        |
| `numInferenceSteps` | number | No       | `30`    | 1   | 50         | -              | Number of denoising steps.                                         |
| `cfgScale`          | number | No       | `5`     | 1   | 15         | -              | Controls how closely the output follows the edit instruction.      |
| `seed`              | number | No       | -       | 0   | 2147483647 | -              | Random seed for reproducibility.                                   |

## Physic Edit

Physics-aware image editing with realistic refraction, material changes, and deformations.

**Model ID:** `model_physic-edit`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_physic-edit/markdown>

| Parameter           | Type   | Required | Default | Min | Max        | Allowed Values | Description                                                           |
| ------------------- | ------ | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------- |
| `image`             | file   | Yes      | -       | -   | -          | -              | Input image to edit with physics-aware transformations.               |
| `prompt`            | string | Yes      | -       | -   | -          | -              | Editing instructions describing the physical transformation to apply. |
| `negativePrompt`    | string | No       | -       | -   | -          | -              | Description of unwanted elements in the output.                       |
| `numInferenceSteps` | number | No       | `40`    | 1   | 50         | -              | Number of denoising steps.                                            |
| `cfgScale`          | number | No       | `4`     | 1   | 20         | -              | Classifier-free guidance scale.                                       |
| `seed`              | number | No       | -       | 0   | 2147483647 | -              | Random seed for reproducibility.                                      |

## Telestyle V2 Style Transfer

Restyle an image with TeleStyle v2 by transferring style, material, lighting, and color from a reference while preserving the content image composition.

**Model ID:** `model_telestyle-v2`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_telestyle-v2/markdown>

| Parameter               | Type    | Required | Default     | Min | Max        | Allowed Values                                                                            | Description                                                                                                                                          |
| ----------------------- | ------- | -------- | ----------- | --- | ---------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contentImage`          | file    | Yes      | -           | -   | -          | -                                                                                         | The image you want to restyle. Its subject and composition are kept; only the look changes.                                                          |
| `styleImage`            | file    | Yes      | -           | -   | -          | -                                                                                         | The image whose look you want to borrow — its artistic style, materials, lighting, and colors are applied to your content image.                     |
| `resolution`            | string  | No       | `square_hd` | -   | -          | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9` | The size and shape of the result.                                                                                                                    |
| `loraScale`             | number  | No       | `1`         | 0   | 4          | -                                                                                         | How strongly the reference style is applied. Higher values push the styling harder; lower values keep more of the original look.                     |
| `useLightningLora`      | boolean | No       | `true`      | -   | -          | -                                                                                         | Adds a speed booster that generates results faster. On by default.                                                                                   |
| `lightningLoraScale`    | number  | No       | `1`         | 0   | 4          | -                                                                                         | How strongly the speed booster is applied. Only matters when “Use Lightning” is on.                                                                  |
| `useContentDescription` | boolean | No       | `true`      | -   | -          | -                                                                                         | Automatically analyzes your content image and feeds a written description into the process, which can improve how well the subject is preserved.     |
| `useStyleDescription`   | boolean | No       | `true`      | -   | -          | -                                                                                         | Automatically analyzes your style image and feeds a written description into the process, which can improve how well the style is captured.          |
| `negativePrompt`        | string  | No       | -           | -   | -          | -                                                                                         | Things to keep out of the result — for example, “text, watermark, blurry.”                                                                           |
| `numInferenceSteps`     | number  | No       | `4`         | 2   | 50         | -                                                                                         | How many refinement passes the model makes. More steps can improve quality but take longer.                                                          |
| `guidanceScale`         | number  | No       | `1`         | 0   | 20         | -                                                                                         | How closely the result follows the model’s internal prompt. Higher values stick to it more strictly.                                                 |
| `acceleration`          | string  | No       | `none`      | -   | -          | `none`, `regular`                                                                         | An optional speed boost. Regular is faster; None prioritizes quality.                                                                                |
| `numOutputs`            | number  | No       | `1`         | 1   | 4          | -                                                                                         | How many images to create at once.                                                                                                                   |
| `seed`                  | number  | No       | -           | 0   | 2147483647 | -                                                                                         | A number that makes results repeatable. Reusing the same seed and settings produces the same image; leave it empty for a different result each time. |

## Z-Image

Z-Image - Highest quality text-to-image and image-to-image generation

**Model ID:** `model_z-image`

**Capabilities:** `txt2img`, `img2img`, `controlnet`

**LLM Markdown:** <https://app.scenario.com/api/models/model_z-image/markdown>

| Parameter                     | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ----------------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`                     | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`                       | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`                  | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`                      | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `negativePrompt`              | string        | No       | -       | -   | -          | -              | Text prompt for what to avoid in the image                                                                                              |
| `image`                       | file          | No       | -       | -   | -          | -              | Source image for img2img transformation                                                                                                 |
| `strength`                    | number        | No       | `0.6`   | 0   | 1          | -              | How much to transform the reference image. 0 means no change, 1 means complete transformation                                           |
| `controlImage`                | file\_array   | No       | -       | -   | -          | -              | Control images to use as input (edge, depth, or pose)                                                                                   |
| `controlnetConditioningScale` | number        | No       | `0.75`  | 0   | 1          | -              | The scale of the controlnet conditioning                                                                                                |
| `numOutputs`                  | number        | No       | `4`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps`           | number        | No       | `28`    | 1   | 100        | -              | Number of inference steps.                                                                                                              |
| `width`                       | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`                      | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`                    | number        | No       | `5`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `seed`                        | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## Z-Image Turbo

Z-Image Turbo - Fast text-to-image and image-to-image generation model

**Model ID:** `model_z-image-turbo`

**Capabilities:** `txt2img`, `img2img`, `controlnet`

**LLM Markdown:** <https://app.scenario.com/api/models/model_z-image-turbo/markdown>

| Parameter                     | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ----------------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`                     | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`                       | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`                  | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`                      | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `negativePrompt`              | string        | No       | -       | -   | -          | -              | Text prompt for what to avoid in the image                                                                                              |
| `image`                       | file          | No       | -       | -   | -          | -              | Source image for img2img transformation. Cannot be used with ControlNet.                                                                |
| `strength`                    | number        | No       | `0.75`  | 0   | 1          | -              | How much to transform the reference image. 0 means no change, 1 means complete transformation                                           |
| `controlImage`                | file\_array   | No       | -       | -   | -          | -              | Control images to use as input (edge, depth, or pose). Cannot be used with Reference Image.                                             |
| `controlnetConditioningScale` | number        | No       | `0.7`   | 0   | 1          | -              | The scale of the controlnet conditioning                                                                                                |
| `numOutputs`                  | number        | No       | `4`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps`           | number        | No       | `9`     | 1   | 100        | -              | Number of inference steps.                                                                                                              |
| `width`                       | number        | No       | -       | 128 | 2048       | -              | Width of the generated image                                                                                                            |
| `height`                      | number        | No       | -       | 128 | 2048       | -              | Height of the generated image                                                                                                           |
| `seed`                        | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |
