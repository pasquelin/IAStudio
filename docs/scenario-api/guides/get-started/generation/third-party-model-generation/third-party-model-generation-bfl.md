---
title: BFL | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **BFL** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [FLUX Kontext Edit](#flux-kontext-edit)
- [FLUX.1 Dev](#flux1-dev)
- [FLUX.1 Krea Dev](#flux1-krea-dev)
- [FLUX.1 Schnell](#flux1-schnell)
- [FLUX.1.1 Pro](#flux11-pro)
- [FLUX.1.1 Pro Ultra](#flux11-pro-ultra)
- [FLUX.2 Dev](#flux2-dev)
- [FLUX.2 Flex Edit](#flux2-flex-edit)
- [FLUX.2 Klein 4b](#flux2-klein-4b)
- [FLUX.2 Klein 9b](#flux2-klein-9b)
- [FLUX.2 Klein Base 4b](#flux2-klein-base-4b)
- [FLUX.2 Klein Base 9b](#flux2-klein-base-9b)
- [FLUX.2 Max Edit](#flux2-max-edit)
- [FLUX.2 Pro Edit](#flux2-pro-edit)
- [FLUX.2 Turbo Edit](#flux2-turbo-edit)
- [Scenario Skybox Flux.1](#scenario-skybox-flux1)
- [Scenario Skybox Upscale](#scenario-skybox-upscale)
- [Scenario Texture Upscale](#scenario-texture-upscale)

---

## FLUX Kontext Edit

Flux Kontext for advanced image editing and generation

**Model ID:** `model_flux-kontext-editing`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_flux-kontext-editing/markdown>

| Parameter         | Type          | Required | Default | Min | Max        | Allowed Values                                                            | Description                                                                                     |
| ----------------- | ------------- | -------- | ------- | --- | ---------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `loras`           | model\_array  | No       | “       | -   | -          | -                                                                         | List of one or more LoRA model IDs or URLs.                                                     |
| `lorasScale`      | number\_array | No       | -       | 0   | 2          | -                                                                         | Scales for the LoRA weights                                                                     |
| `referenceImages` | file\_array   | Yes      | -       | -   | -          | -                                                                         | Reference images for style or content guidance                                                  |
| `prompt`          | string        | Yes      | -       | -   | -          | -                                                                         | Text prompt for image editing or generation                                                     |
| `numOutputs`      | number        | No       | `1`     | 1   | 4          | -                                                                         | Number of images to generate                                                                    |
| `aspectRatio`     | string        | No       | `auto`  | -   | -          | `21:9`, `16:9`, `3:2`, `4:3`, `1:1`, `2:3`, `3:4`, `9:16`, `9:21`, `auto` | Aspect ratio for the generated image                                                            |
| `quality`         | string        | No       | `high`  | -   | -          | `high`, `medium`                                                          | Generation quality                                                                              |
| `guidanceScale`   | number        | No       | `3.5`   | 1   | 10         | -                                                                         | How closely to follow the prompt (1.0-10.0)                                                     |
| `seed`            | number        | No       | -       | 0   | 2147483647 | -                                                                         | Use a seed for reproducible results (single-image inference). Leave blank to use a random seed. |

## FLUX.1 Dev

FLUX.1 Dev - High-quality text-to-image generation model

**Model ID:** `model_bfl-flux-1-dev`

**Capabilities:** `txt2img`, `img2img`, `controlnet`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-1-dev/markdown>

| Parameter           | Type          | Required | Default | Min  | Max        | Allowed Values                                                  | Description                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------- | -------- | ------- | ---- | ---------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -    | -          | -                                                               | A single LoRA or composition model ID. If a composition is provided, the loras and lorasScale arrays will be automatically populated from the composition’s concepts. If a LoRA is provided, it will be added to the loras array.                                                                                                |
| `loras`             | model\_array  | No       | “       | -    | -          | -                                                               | List of one or more LoRA model IDs. If provided, this will override the LoRAs extracted from the composition (when modelId is a composition). If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId.                                                                                |
| `lorasScale`        | number\_array | No       | -       | 0    | 2          | -                                                               | Scales for the LoRA weights                                                                                                                                                                                                                                                                                                      |
| `prompt`            | string        | Yes      | -       | -    | -          | -                                                               | Text prompt for image generation                                                                                                                                                                                                                                                                                                 |
| `image`             | file          | No       | -       | -    | -          | -                                                               | Input image for img2img                                                                                                                                                                                                                                                                                                          |
| `strength`          | number        | No       | `0.8`   | 0.01 | 1          | -                                                               | Lower values adhere more closely to the image, while higher values allow for more creative freedom. (Higher values are recommended for this model)                                                                                                                                                                               |
| `controlImage`      | file          | No       | -       | -    | -          | -                                                               | Control image used to condition the generation (edge / depth / pose / etc., per the selected modality).                                                                                                                                                                                                                          |
| `controlModality`   | string        | No       | `canny` | -    | -          | `canny`, `tile`, `depth`, `blur`, `pose`, `gray`, `low-quality` | How the control image should be interpreted.                                                                                                                                                                                                                                                                                     |
| `controlStrength`   | number        | No       | `0.7`   | 0    | 1          | -                                                               | How strongly the control image conditions the generation. Higher = output adheres more closely to the control image’s structure; lower = the prompt dominates. Recommended range 0.3–0.8. Starting points: canny / depth / tile \~0.7, pose / gray / blur / low-quality \~0.8–0.9. Above 0.9 can become rigid or artifact-prone. |
| `controlStart`      | number        | No       | `0`     | 0    | 1          | -                                                               | Fraction of diffusion steps (0–1) at which the control image begins influencing the generation. 0 = active from the first step. Strength is how much; Start / End is when.                                                                                                                                                       |
| `controlEnd`        | number        | No       | `1`     | 0    | 1          | -                                                               | Fraction of diffusion steps (0–1) at which the control image stops influencing the generation. 1 = active until the last step. Lowering it (e.g. 0.65) locks composition early then releases so the prompt can refine details — useful for pose at high strength.                                                                |
| `numOutputs`        | number        | No       | `1`     | 1    | 4          | -                                                               | Number of images to generate.                                                                                                                                                                                                                                                                                                    |
| `numInferenceSteps` | number        | No       | `28`    | 1    | 50         | -                                                               | The number of denoising steps                                                                                                                                                                                                                                                                                                    |
| `width`             | number        | No       | `1104`  | 128  | 2048       | -                                                               | The width of the generated images, must be a multiple of 16                                                                                                                                                                                                                                                                      |
| `height`            | number        | No       | `832`   | 128  | 2048       | -                                                               | The height of the generated images, must be a multiple of 16                                                                                                                                                                                                                                                                     |
| `guidance`          | number        | No       | `3.5`   | 0    | 10         | -                                                               | Controls how closely the generated image follows the prompt (ignored for schnell)                                                                                                                                                                                                                                                |
| `seed`              | number        | No       | -       | 0    | 2147483647 | -                                                               | Used to reproduce previous results                                                                                                                                                                                                                                                                                               |

## FLUX.1 Krea Dev

An opinionated text-to-image model from Black Forest Labs in collaboration with Krea that excels in photorealism. Creates images that avoid the oversaturated ‘AI look’.

**Model ID:** `model_flux-krea-dev`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_flux-krea-dev/markdown>

| Parameter        | Type   | Required | Default | Min | Max        | Allowed Values                                                                  | Description                                                                                                                                        |
| ---------------- | ------ | -------- | ------- | --- | ---------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string | No       | -       | -   | -          | -                                                                               | Describe your image                                                                                                                                |
| `aspectRatio`    | string | No       | `4:3`   | -   | -          | `9:21`, `9:16`, `2:3`, `3:4`, `4:5`, `1:1`, `3:2`, `4:3`, `5:4`, `16:9`, `21:9` | Image aspect ratio. Ignored if you have a reference image.                                                                                         |
| `image`          | file   | No       | -       | -   | -          | -                                                                               | Use a reference image to guide your generation. The aspect ratio of your output will match this image                                              |
| `promptStrength` | number | No       | `0.8`   | 0   | 1          | -                                                                               | Lower values adhere more closely to the image, while higher values allow for more creative freedom. (Higher values are recommended for this model) |
| `numOutputs`     | number | No       | `1`     | 1   | 4          | -                                                                               | Number of images to generate.                                                                                                                      |
| `steps`          | number | No       | `28`    | 1   | 50         | -                                                                               | The number of steps for the generation                                                                                                             |
| `guidance`       | number | No       | `3`     | 0   | 10         | -                                                                               | Higher values adhere more closely to the prompt, while lower values allow for more creative freedom.                                               |
| `megapixels`     | string | No       | `1`     | -   | -          | `1`, `0.25`                                                                     | Approximate number of megapixels for generated image                                                                                               |
| `seed`           | number | No       | -       | 0   | 2147483647 | -                                                                               | Use a seed for reproducible results. Leave blank to use a random seed.                                                                             |

## FLUX.1 Schnell

FLUX.1 Schnell - Fast text-to-image generation model

**Model ID:** `model_bfl-flux-1-schnell`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-1-schnell/markdown>

| Parameter           | Type          | Required | Default | Min  | Max        | Allowed Values | Description                                                                                                                                                                                                                                       |
| ------------------- | ------------- | -------- | ------- | ---- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -    | -          | -              | A single LoRA or composition model ID. If a composition is provided, the loras and lorasScale arrays will be automatically populated from the composition’s concepts. If a LoRA is provided, it will be added to the loras array.                 |
| `loras`             | model\_array  | No       | “       | -    | -          | -              | List of one or more LoRA model IDs. If provided, this will override the LoRAs extracted from the composition (when modelId is a composition). If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0    | 2          | -              | Scales for the LoRA weights, overriding the composition scales.                                                                                                                                                                                   |
| `prompt`            | string        | Yes      | -       | -    | -          | -              | Text prompt for image generation                                                                                                                                                                                                                  |
| `image`             | file          | No       | -       | -    | -          | -              | Reference image                                                                                                                                                                                                                                   |
| `strength`          | number        | No       | `0.8`   | 0.01 | 1          | -              | Lower values adhere more closely to the image, while higher values allow for more creative freedom. (Higher values are recommended for this model)                                                                                                |
| `numOutputs`        | number        | No       | `1`     | 1    | 4          | -              | Number of images to generate.                                                                                                                                                                                                                     |
| `numInferenceSteps` | number        | No       | `4`     | 1    | 10         | -              | The number of denoising steps                                                                                                                                                                                                                     |
| `width`             | number        | No       | `1104`  | 128  | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                                                                                                                                       |
| `height`            | number        | No       | `832`   | 128  | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                                                                                                                                      |
| `guidance`          | number        | No       | `3.5`   | 0    | 10         | -              | Controls how closely the generated image follows the prompt (ignored for schnell)                                                                                                                                                                 |
| `seed`              | number        | No       | -       | 0    | 2147483647 | -              | Used to reproduce previous results                                                                                                                                                                                                                |

## FLUX.1.1 Pro

Faster, better FLUX Pro. Text-to-image model with excellent image quality, prompt adherence, and output diversity.

**Model ID:** `model_bfl-flux-1-1-pro`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-1-1-pro/markdown>

| Parameter          | Type    | Required | Default | Min | Max | Allowed Values                                                  | Description                                                                                                                                   |
| ------------------ | ------- | -------- | ------- | --- | --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`           | string  | Yes      | -       | -   | -   | -                                                               | Text prompt for image generation                                                                                                              |
| `imagePrompt`      | file    | No       | -       | -   | -   | -                                                               | Image to use with Flux Redux. This is used together with the text prompt to guide the generation towards the composition of the Image prompt. |
| `aspectRatio`      | string  | No       | `1:1`   | -   | -   | `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` | Aspect ratio for the generated image                                                                                                          |
| `promptUpsampling` | boolean | No       | `false` | -   | -   | -                                                               | Automatically modify the prompt for more creative generation                                                                                  |
| `seed`             | number  | No       | -       | -   | -   | -                                                               | Random seed. Set for reproducible generation                                                                                                  |

## FLUX.1.1 Pro Ultra

FLUX1.1 \[pro] in ultra and raw modes. Images are up to 4 megapixels. Use raw mode for realism.

**Model ID:** `model_bfl-flux-1-1-pro-ultra`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-1-1-pro-ultra/markdown>

| Parameter     | Type    | Required | Default | Min | Max | Allowed Values                                                                  | Description                                                                                                                                                                     |
| ------------- | ------- | -------- | ------- | --- | --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string  | Yes      | -       | -   | -   | -                                                                               | Text prompt for image generation                                                                                                                                                |
| `imagePrompt` | file    | No       | -       | -   | -   | -                                                                               | Image to use with Flux Redux. This is used together with the text prompt to guide the generation towards the composition of the image\_prompt. Must be jpeg, png, gif, or webp. |
| `aspectRatio` | string  | No       | `1:1`   | -   | -   | `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `9:21` | Aspect ratio for the generated image                                                                                                                                            |
| `raw`         | boolean | No       | `false` | -   | -   | -                                                                               | Generate less processed, more natural-looking images                                                                                                                            |
| `seed`        | number  | No       | -       | -   | -   | -                                                                               | Random seed. Set for reproducible generation                                                                                                                                    |

## FLUX.2 Dev

FLUX.2 Dev - High-quality text-to-image and image-to-image model

**Model ID:** `model_bfl-flux-2-dev`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-dev/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `referenceImages`   | file\_array   | No       | -       | -   | -          | -              | Reference images                                                                                                                        |
| `numOutputs`        | number        | No       | `1`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `28`    | 1   | 100        | -              | The number of denoising steps                                                                                                           |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `4`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## FLUX.2 Flex Edit

FLUX.2 Flex is designed for maximum versatility and ease of use. It prioritizes adaptability, allowing fast generation, broad compatibility, and reliable results

**Model ID:** `model_bfl-flux-2-flex-editing`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-flex-editing/markdown>

| Parameter          | Type        | Required | Default | Min | Max | Allowed Values                                                                       | Description                                                                                                                                                |
| ------------------ | ----------- | -------- | ------- | --- | --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceImages`  | file\_array | Yes      | -       | -   | -   | -                                                                                    | Reference images for style or content guidance                                                                                                             |
| `prompt`           | string      | Yes      | -       | -   | -   | -                                                                                    | Text prompt for image generation                                                                                                                           |
| `aspectRatio`      | string      | No       | `1:1`   | -   | -   | `match_input_image`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` | Aspect ratio for the generated image. When aspect ratio is ‘Match Input Image’, use ‘Match Input Image’ to match the input image’s aspect ratio.           |
| `resolution`       | string      | No       | `1 MP`  | -   | -   | `match_input_image`, `0.5 MP`, `1 MP`, `2 MP`, `4 MP`                                | Resolution in megapixels. When aspect ratio is ‘Auto (Match Input)’, use ‘Auto (Match Input)’ to match the input image’s resolution (clamped to 0.5-4 MP). |
| `promptUpsampling` | boolean     | No       | `false` | -   | -   | -                                                                                    | Automatically modify the prompt for more creative generation                                                                                               |
| `steps`            | number      | No       | `30`    | 1   | 50  | -                                                                                    | Number of steps to run the model for. Fewer steps means faster generation, at the expensive of output quality. 30 steps is sufficient for most prompts.    |
| `guidance`         | number      | No       | `4.5`   | 1.5 | 10  | -                                                                                    | Guidance scale. Higher values mean more guidance, lower values mean more creative generation.                                                              |
| `seed`             | number      | No       | -       | -   | -   | -                                                                                    | Random seed. Set for reproducible generation                                                                                                               |

## FLUX.2 Klein 4b

FLUX.2 Klein 4b - Efficient text-to-image and image-to-image model

**Model ID:** `model_bfl-flux-2-klein-4b`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-klein-4b/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `referenceImages`   | file\_array   | No       | -       | -   | -          | -              | Reference images                                                                                                                        |
| `numOutputs`        | number        | No       | `1`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `4`     | 1   | 100        | -              | The number of denoising steps                                                                                                           |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `1`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## FLUX.2 Klein 9b

FLUX.2 Klein 9b - Efficient text-to-image and image-to-image model

**Model ID:** `model_bfl-flux-2-klein-9b`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-klein-9b/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `referenceImages`   | file\_array   | No       | -       | -   | -          | -              | Reference images for img2img                                                                                                            |
| `numOutputs`        | number        | No       | `1`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `4`     | 1   | 100        | -              | The number of denoising steps                                                                                                           |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `1`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## FLUX.2 Klein Base 4b

FLUX.2 Klein Base 4b - Efficient text-to-image and image-to-image model

**Model ID:** `model_bfl-flux-2-klein-4b-base`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-klein-4b-base/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `referenceImages`   | file\_array   | No       | -       | -   | -          | -              | Reference images                                                                                                                        |
| `numOutputs`        | number        | No       | `1`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `28`    | 1   | 100        | -              | The number of denoising steps                                                                                                           |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `4`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## FLUX.2 Klein Base 9b

FLUX.2 Klein Base 9b - Efficient text-to-image and image-to-image model

**Model ID:** `model_bfl-flux-2-klein-9b-base`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-klein-9b-base/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `referenceImages`   | file\_array   | No       | -       | -   | -          | -              | Reference images for img2img                                                                                                            |
| `numOutputs`        | number        | No       | `1`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `28`    | 1   | 100        | -              | The number of denoising steps                                                                                                           |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `4`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## FLUX.2 Max Edit

**Model ID:** `model_bfl-flux-2-max-editing`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-max-editing/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                                                                       | Description                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------- | -------- | ------- | --- | --- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceImages` | file\_array | No       | -       | -   | -   | -                                                                                    | Reference images for style or content guidance                                                                                                                                                                                                                                                                                               |
| `prompt`          | string      | Yes      | -       | -   | -   | -                                                                                    | Text prompt for image generation                                                                                                                                                                                                                                                                                                             |
| `aspectRatio`     | string      | No       | `4:3`   | -   | -   | `match_input_image`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` | Aspect ratio for the generated image. Use ‘Auto (Match Input)’ to match the first input image’s aspect ratio.                                                                                                                                                                                                                                |
| `resolution`      | string      | No       | `1 MP`  | -   | -   | `match_input_image`, `0.5 MP`, `1 MP`, `2 MP`, `4 MP`                                | Resolution in megapixels. Up to 4 MP is possible, but 2 MP or below is recommended. The maximum image size is 2048x2048, which means that high-resolution images may not respect the resolution if aspect ratio is not 1:1. When Aspect ratio is ‘Auto (Match Input)’, use Auto to match the input image’s resolution (clamped to 0.5-4 MP). |
| `seed`            | number      | No       | -       | -   | -   | -                                                                                    | Random seed. Set for reproducible generation                                                                                                                                                                                                                                                                                                 |

## FLUX.2 Pro Edit

FLUX.2 Pro is the highest-fidelity, flagship version of the FLUX.2 lineup

**Model ID:** `model_bfl-flux-2-pro-editing`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-pro-editing/markdown>

| Parameter          | Type        | Required | Default | Min | Max | Allowed Values                                                                       | Description                                                                                                                                                |
| ------------------ | ----------- | -------- | ------- | --- | --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceImages`  | file\_array | No       | -       | -   | -   | -                                                                                    | Reference images for style or content guidance                                                                                                             |
| `prompt`           | string      | Yes      | -       | -   | -   | -                                                                                    | Text prompt for image generation                                                                                                                           |
| `aspectRatio`      | string      | No       | `1:1`   | -   | -   | `match_input_image`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` | Aspect ratio for the generated image. When aspect ratio is ‘Match Input Image’, use ‘Match Input Image’ to match the input image’s aspect ratio.           |
| `resolution`       | string      | No       | `1 MP`  | -   | -   | `match_input_image`, `0.5 MP`, `1 MP`, `2 MP`, `4 MP`                                | Resolution in megapixels. When aspect ratio is ‘Auto (Match Input)’, use ‘Auto (Match Input)’ to match the input image’s resolution (clamped to 0.5-4 MP). |
| `promptUpsampling` | boolean     | No       | `false` | -   | -   | -                                                                                    | Automatically modify the prompt for more creative generation                                                                                               |
| `seed`             | number      | No       | -       | -   | -   | -                                                                                    | Random seed. Set for reproducible generation                                                                                                               |

## FLUX.2 Turbo Edit

Image-to-image editing with FLUX.2 \[turbo] from Black Forest Labs. Precise modifications using natural language descriptions and hex color control—all at turbo speed.

**Model ID:** `model_bfl-flux-2-turbo-editing`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bfl-flux-2-turbo-editing/markdown>

| Parameter          | Type        | Required | Default         | Min | Max | Allowed Values                                                                  | Description                                                                                   |
| ------------------ | ----------- | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `referenceImages`  | file\_array | Yes      | -               | -   | -   | -                                                                               | Reference images for style or content guidance                                                |
| `prompt`           | string      | Yes      | -               | -   | -   | -                                                                               | Text prompt for image generation                                                              |
| `imageSize`        | string      | No       | `landscape_4_3` | -   | -   | `portrait_16_9`, `portrait_4_3`, `square_hd`, `landscape_4_3`, `landscape_16_9` | Image size for the generated image.                                                           |
| `guidance`         | number      | No       | `2.5`           | 1.5 | 10  | -                                                                               | Guidance scale. Higher values mean more guidance, lower values mean more creative generation. |
| `numOutputs`       | number      | No       | `1`             | 1   | 4   | -                                                                               | Number of images to generate.                                                                 |
| `promptUpsampling` | boolean     | No       | `false`         | -   | -   | -                                                                               | Automatically modify the prompt for more creative generation                                  |
| `seed`             | number      | No       | -               | -   | -   | -                                                                               | Random seed. Set for reproducible generation                                                  |

## Scenario Skybox Flux.1

Generates a seam-continuous equirectangular 360° panorama from a text prompt, powered by FLUX.1 Dev with the equirectangular geometry LoRA and black-band removal applied automatically.

**Model ID:** `model_scenario-skybox-flux`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-skybox-flux/markdown>

| Parameter                | Type   | Required | Default     | Min  | Max        | Allowed Values                                                                                                                                                                                                                                                                          | Description                                                                                                                                                                                                          |
| ------------------------ | ------ | -------- | ----------- | ---- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                 | string | Yes      | -           | -    | -          | -                                                                                                                                                                                                                                                                                       | Describe the scene you want to see all around you — a sunset beach, a futuristic city, a forest at dawn. The model automatically formats your prompt to produce a seamless 360° panorama.                            |
| `style`                  | string | No       | `cinematic` | -    | -          | `standard`, `cinematic`, `claymation`, `cloud-skydome`, `cyberpunk`, `fantasy`, `neon-tron`, `photo`, `psychedelic`, `retro-fantasy`, `scifi-concept-art`, `space`, `whimsical`, `3d-cartoon`, `cartoon`, `comic`, `manga`, `ink`, `pastel`, `oil-painting`, `enchanted`, `manga-color` | The artistic look of your panorama. Choose from cinematic, fantasy, cyberpunk, oil painting, and more. Each style shapes the color palette, lighting, and overall mood. Use Standard for a neutral, unstyled result. |
| `negativePrompt`         | string | No       | -           | -    | -          | -                                                                                                                                                                                                                                                                                       | Describe what you don’t want in the image — e.g. ‘blurry, people, text’. Has no effect unless Negative Prompt Strength is above 0. Try generating without one first to see if it’s needed.                           |
| `negativePromptStrength` | number | No       | `0`         | 0    | 10         | -                                                                                                                                                                                                                                                                                       | How strongly the model avoids what you described in the Negative Prompt. Leave at 0 to disable it entirely. Increase gradually — values between 1–4 are usually enough.                                              |
| `image`                  | file   | No       | -           | -    | -          | -                                                                                                                                                                                                                                                                                       | Upload an existing image to use as a starting point. The model will generate a new panorama inspired by it, with the amount of change controlled by the Strength slider below.                                       |
| `strength`               | number | No       | `0.8`       | 0.01 | 1          | -                                                                                                                                                                                                                                                                                       | How much the model transforms your reference image. Low values stay close to the original; high values produce a more creative, reimagined result.                                                                   |
| `numOutputs`             | number | No       | `2`         | 1    | 4          | -                                                                                                                                                                                                                                                                                       | How many panoramas to generate at once. Useful for exploring variations before committing to one.                                                                                                                    |
| `numInferenceSteps`      | number | No       | `30`        | 20   | 50         | -                                                                                                                                                                                                                                                                                       | Number of refinement passes the model takes. More steps generally produce sharper, more detailed results but take longer. 30 is a good default.                                                                      |
| `geometryEnforcement`    | number | No       | `0`         | 0    | 100        | -                                                                                                                                                                                                                                                                                       | Fine-tunes how strongly the model enforces correct 360° geometry. Leave at 0 to use the recommended level for your chosen style. Increase only if the panorama seam or poles look distorted.                         |
| `seed`                   | number | No       | -           | 0    | 2147483647 | -                                                                                                                                                                                                                                                                                       | A number that locks in the randomness of the generation. Copy the seed from a result you liked to reproduce it exactly, or leave blank for a new result each time.                                                   |

## Scenario Skybox Upscale

**Model ID:** `model_sc-upscale-flux-skybox`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sc-upscale-flux-skybox/markdown>

| Parameter                     | Type        | Required | Default      | Min | Max        | Allowed Values                  | Description                                                                            |
| ----------------------------- | ----------- | -------- | ------------ | --- | ---------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `image`                       | file        | Yes      | -            | -   | -          | -                               | Image to upscale                                                                       |
| `upscaleFactor`               | number      | No       | `2`          | 2   | 8          | -                               | Upscale factor                                                                         |
| `prompt`                      | string      | No       | -            | -   | -          | -                               | Prompt                                                                                 |
| `imagePrompt`                 | file\_array | No       | -            | -   | -          | -                               | Upload up to 4 images to guide the style of the output.                                |
| `imagePromptStrength`         | number      | No       | `0.6`        | 0   | 1          | -                               | Higher fidelity keeps the enhanced image’s style closely aligned with the style images |
| `controlnetConditioningScale` | number      | No       | `0.5`        | 0   | 1          | -                               | Higher values better preserve the structure of the input image.                        |
| `strength`                    | number      | No       | `0.6`        | 0   | 1          | -                               | Higher values introduce more imaginative elements to the output image.                 |
| `numInferenceSteps`           | number      | No       | `28`         | 1   | 50         | -                               | The number of steps for the generation                                                 |
| `detailsEnable`               | boolean     | No       | `true`       | -   | -          | -                               | Enhances fine details in the output image.                                             |
| `baseModel`                   | string      | No       | `FLUX.1-dev` | -   | -          | `FLUX.1-dev`, `FLUX.1-Krea-dev` | Use FLUX.1-dev for stylized images, and FLUX.1-Krea-dev for realistic images.          |
| `seed`                        | number      | No       | -            | 0   | 2147483647 | -                               | Seed used for reproduction                                                             |

## Scenario Texture Upscale

**Model ID:** `model_sc-upscale-flux-texture`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sc-upscale-flux-texture/markdown>

| Parameter                     | Type          | Required | Default      | Min | Max        | Allowed Values                    | Description                                                                            |
| ----------------------------- | ------------- | -------- | ------------ | --- | ---------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `image`                       | file          | Yes      | -            | -   | -          | -                                 | Image to upscale                                                                       |
| `upscaleFactor`               | number        | No       | `2`          | 2   | 8          | -                                 | Upscale factor                                                                         |
| `preset`                      | string        | No       | `balanced`   | -   | -          | `precise`, `balanced`, `creative` | Select a preset to apply a set of parameters                                           |
| `loras`                       | model\_array  | No       | “            | -   | -          | -                                 | List of one or more LoRA model IDs or URLs.                                            |
| `lorasScale`                  | number\_array | No       | “            | -   | -          | -                                 | Scales for the LoRA weights                                                            |
| `prompt`                      | string        | No       | -            | -   | -          | -                                 | Prompt                                                                                 |
| `imagePrompt`                 | file\_array   | No       | -            | -   | -          | -                                 | Upload up to 4 images to guide the style of the output.                                |
| `imagePromptStrength`         | number        | No       | `0.6`        | 0   | 1          | -                                 | Higher fidelity keeps the enhanced image’s style closely aligned with the style images |
| `controlnetConditioningScale` | number        | No       | `0.4`        | 0   | 1          | -                                 | Higher values better preserve the structure of the input image.                        |
| `strength`                    | number        | No       | `0.4`        | 0   | 1          | -                                 | Higher values introduce more imaginative elements to the output image.                 |
| `numInferenceSteps`           | number        | No       | `28`         | 1   | 50         | -                                 | The number of steps for the generation                                                 |
| `detailsEnable`               | boolean       | No       | `true`       | -   | -          | -                                 | Enhances fine details in the output image.                                             |
| `baseModel`                   | string        | No       | `FLUX.1-dev` | -   | -          | `FLUX.1-dev`, `FLUX.1-Krea-dev`   | Use FLUX.1-dev for stylized images, and FLUX.1-Krea-dev for realistic images.          |
| `seed`                        | number        | No       | -            | 0   | 2147483647 | -                                 | Seed used for reproduction                                                             |
