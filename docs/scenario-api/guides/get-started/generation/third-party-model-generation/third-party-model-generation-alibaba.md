---
title: Alibaba | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Alibaba** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Qwen Edit - Camera Control](#qwen-edit---camera-control)
- [Qwen Edit 2509](#qwen-edit-2509)
- [Qwen Edit 2511](#qwen-edit-2511)
- [Qwen Edit Multiangle 2511](#qwen-edit-multiangle-2511)
- [Qwen Edit Plus](#qwen-edit-plus)
- [Qwen Image](#qwen-image)
- [Qwen Image 2512](#qwen-image-2512)
- [Qwen Image Layered](#qwen-image-layered)
- [Wan 2.7 Image](#wan-27-image)
- [Wan 2.7 Image Pro](#wan-27-image-pro)

---

## Qwen Edit - Camera Control

Camera-aware edits for Qwen/Qwen-Image-Edit-2509 with Lightning + multi-angle LoRA

**Model ID:** `model_qwen-edit-multiangle`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_qwen-edit-multiangle/markdown>

| Parameter       | Type    | Required | Default             | Min | Max | Allowed Values                                           | Description                                                                                                             |
| --------------- | ------- | -------- | ------------------- | --- | --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `image`         | file    | Yes      | -                   | -   | -   | -                                                        | Input image to edit.                                                                                                    |
| `prompt`        | string  | No       | -                   | -   | -   | -                                                        | Optional text instruction appended after the camera directive.                                                          |
| `rotateDegrees` | number  | No       | `0`                 | -90 | 90  | -                                                        | Camera orbit angle in degrees. Positive values move the camera to the left, while negative values move it to the right. |
| `moveForward`   | number  | No       | `0`                 | 0   | 10  | -                                                        | Move the camera forward (zoom in). Higher values push towards a close-up.                                               |
| `verticalTilt`  | number  | No       | `0`                 | -1  | 1   | -                                                        | Vertical camera tilt. -1 = top-down, 1 = low-angle view.                                                                |
| `useWideAngle`  | boolean | No       | `false`             | -   | -   | -                                                        | Switch to a wide-angle lens instruction.                                                                                |
| `aspectRatio`   | string  | No       | `match_input_image` | -   | -   | `match_input_image`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16` | Aspect ratio for the generated image                                                                                    |
| `loraScale`     | number  | No       | `1.25`              | 0   | 4   | -                                                        | Relative strength for the multi-angle LoRA.                                                                             |
| `goFast`        | boolean | No       | `false`             | -   | -   | -                                                        | Run faster predictions with additional optimizations.                                                                   |

## Qwen Edit 2509

Qwen Image Edit 2509 - Image-to-image editing model (September 2025 version)

**Model ID:** `model_qwen-image-edit-2509`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_qwen-image-edit-2509/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image editing                                                                                                           |
| `referenceImages`   | file\_array   | Yes      | -       | -   | -          | -              | Reference images for editing                                                                                                            |
| `numOutputs`        | number        | No       | `1`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `28`    | 1   | 100        | -              | The number of denoising steps                                                                                                           |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `4`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `goFast`            | boolean       | No       | `false` | -   | -          | -              | Applies a 8-step Lightning acceleration LoRA during generation. Speeds up generation at the cost of some quality.                       |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## Qwen Edit 2511

Qwen Image Edit 2511 - Image-to-image editing model (November 2025 version)

**Model ID:** `model_qwen-image-edit-2511`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_qwen-image-edit-2511/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image editing                                                                                                           |
| `referenceImages`   | file\_array   | Yes      | -       | -   | -          | -              | Reference images for editing                                                                                                            |
| `numOutputs`        | number        | No       | `1`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `28`    | 1   | 100        | -              | The number of denoising steps                                                                                                           |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `4`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `goFast`            | boolean       | No       | `false` | -   | -          | -              | Applies a 8-step Lightning acceleration LoRA during generation. Speeds up generation at the cost of some quality.                       |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## Qwen Edit Multiangle 2511

Generate same scene from different angles with Qwen image Edit 2511 and the LoRA Multiple Angles

**Model ID:** `model_qwen-edit-multiangle-2511`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_qwen-edit-multiangle-2511/markdown>

| Parameter           | Type        | Required | Default | Min | Max        | Allowed Values    | Description                                                                                                  |
| ------------------- | ----------- | -------- | ------- | --- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `images`            | file\_array | Yes      | -       | -   | -          | -                 | Input image to edit                                                                                          |
| `horizontalAngle`   | number      | No       | `0`     | 0   | 360        | -                 | Horizontal angle (azimuth) in degrees: 0°=front, 90°=right side, 180°=back, 270°=left, 360°=front view again |
| `verticalAngle`     | number      | No       | `0`     | -30 | 90         | -                 | Vertical angle (elevation) in degrees: -30°=low-angle, 0°=eye-level, 90°=bird’s-eye                          |
| `zoom`              | number      | No       | `5`     | 0   | 10         | -                 | Zoom - Distance level: 0=wide shot, 5=medium, 10=close-up                                                    |
| `loraScale`         | number      | No       | `1.5`   | 0   | 4          | -                 | LoRA scale controls camera control effect strength                                                           |
| `numOutputs`        | number      | No       | `1`     | 1   | 4          | -                 | Number of images to generate                                                                                 |
| `numInferenceSteps` | number      | No       | `28`    | 1   | 50         | -                 | Number of inference steps (higher = better quality, slower)                                                  |
| `guidanceScale`     | number      | No       | `4.5`   | 1   | 20         | -                 | Guidance scale for generation (higher = closer to prompt)                                                    |
| `acceleration`      | string      | No       | `none`  | -   | -          | `none`, `regular` | Acceleration mode for faster generation                                                                      |
| `seed`              | number      | No       | -       | 0   | 2147483647 | -                 | Use a seed for reproducible results. Leave blank to use a random seed.                                       |

## Qwen Edit Plus

Qwen Image Edit Plus- Image-to-image editing model

**Model ID:** `model_qwen-image-edit`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_qwen-image-edit/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image editing                                                                                                           |
| `referenceImages`   | file          | Yes      | -       | -   | -          | -              | Input image for editing                                                                                                                 |
| `numOutputs`        | number        | No       | `1`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `28`    | 1   | 100        | -              | The number of denoising steps                                                                                                           |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `4`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `goFast`            | boolean       | No       | `false` | -   | -          | -              | Applies a 8-step Lightning acceleration LoRA during generation. Speeds up generation at the cost of some quality.                       |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## Qwen Image

Qwen Image - Text-to-image and image-to-image generation model

**Model ID:** `model_qwen-image`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_qwen-image/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `image`             | file          | No       | -       | -   | -          | -              | Input image for img2img                                                                                                                 |
| `strength`          | number        | No       | `0.6`   | 0   | 1          | -              | Lower values adhere more closely to the image, while higher values allow for more creative freedom                                      |
| `numOutputs`        | number        | No       | `4`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `28`    | 1   | 100        | -              | The number of steps for the generation                                                                                                  |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `4`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## Qwen Image 2512

Qwen Image 2512 - Enhanced text-to-image and image-to-image generation model with improved resolution support

**Model ID:** `model_qwen-image-2512`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_qwen-image-2512/markdown>

| Parameter           | Type          | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `modelId`           | model         | No       | -       | -   | -          | -              | A single LoRA model ID. If provided, it will be added to the loras array.                                                               |
| `loras`             | model\_array  | No       | “       | -   | -          | -              | List of one or more LoRA model IDs. If modelId is a LoRA and this is not provided, it will be automatically populated with the modelId. |
| `lorasScale`        | number\_array | No       | -       | 0   | 2          | -              | Scales for the LoRA weights                                                                                                             |
| `prompt`            | string        | Yes      | -       | -   | -          | -              | Text prompt for image generation                                                                                                        |
| `image`             | file          | No       | -       | -   | -          | -              | Input image for img2img                                                                                                                 |
| `strength`          | number        | No       | `0.6`   | 0   | 1          | -              | Lower values adhere more closely to the image, while higher values allow for more creative freedom                                      |
| `numOutputs`        | number        | No       | `4`     | 1   | 4          | -              | Number of images to generate                                                                                                            |
| `numInferenceSteps` | number        | No       | `28`    | 1   | 100        | -              | Number of denoising steps. Use less steps for faster generation.                                                                        |
| `width`             | number        | No       | -       | 128 | 2048       | -              | The width of the generated images, must be a multiple of 16                                                                             |
| `height`            | number        | No       | -       | 128 | 2048       | -              | The height of the generated images, must be a multiple of 16                                                                            |
| `guidance`          | number        | No       | `4`     | 1   | 10         | -              | Controls how closely the generated image follows the prompt                                                                             |
| `goFast`            | boolean       | No       | `false` | -   | -          | -              | Applies a 8-step Lightning acceleration LoRA during generation. Speeds up generation at the cost of some quality.                       |
| `seed`              | number        | No       | -       | 0   | 2147483647 | -              | Used to reproduce previous results                                                                                                      |

## Qwen Image Layered

Generate images with separate foreground, background, and shadow layers for easy editing and compositing

**Model ID:** `model_qwen-image-layered`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_qwen-image-layered/markdown>

| Parameter     | Type    | Required | Default | Min | Max        | Allowed Values | Description                                                                                           |
| ------------- | ------- | -------- | ------- | --- | ---------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `image`       | file    | No       | -       | -   | -          | -              | Image to be converted into a layered image.                                                           |
| `description` | string  | No       | `auto`  | -   | -          | -              | Text description of the input image. Use ‘auto’ for auto captioning.                                  |
| `numLayers`   | number  | No       | `4`     | 2   | 8          | -              | Number of layers to generate.                                                                         |
| `goFast`      | boolean | No       | `true`  | -   | -          | -              | Enable this option to run faster generations with additional optimizations (8 steps Lightning preset) |
| `seed`        | number  | No       | -       | 0   | 2147483647 | -              | Use a seed for reproducible results. Leave blank to use a random seed.                                |

## Wan 2.7 Image

Alibaba Wan 2.7 Image — text-to-image, multi-image editing, and image sets up to 2K.

**Model ID:** `model_wan-2-7-image`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-7-image/markdown>

| Parameter      | Type        | Required | Default | Min | Max | Allowed Values                                                                                                                           | Description                                                                                |
| -------------- | ----------- | -------- | ------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `prompt`       | string      | Yes      | -       | -   | -   | -                                                                                                                                        | Describe generation, editing instructions, or structured image-set prompts                 |
| `images`       | file\_array | No       | “       | -   | -   | -                                                                                                                                        | Optional input images for editing, style transfer, or multi-reference generation (up to 9) |
| `size`         | string      | No       | `2K`    | -   | -   | `1K`, `2K`, `1024*1024`, `2048*2048`, `1280*720`, `720*1280`, `2048*1152`, `1152*2048`, `1024*768`, `768*1024`, `2048*1536`, `1536*2048` | Output resolution (1K/2K presets or explicit WxH)                                          |
| `numOutputs`   | number      | No       | `1`     | 1   | 4   | -                                                                                                                                        | Number of images to generate)                                                              |
| `imageSetMode` | boolean     | No       | `false` | -   | -   | -                                                                                                                                        | Generate a coherent set of related images from one prompt                                  |
| `thinkingMode` | boolean     | No       | `true`  | -   | -   | -                                                                                                                                        | Enhanced reasoning for text-to-image (no input images, not in image set mode); slower      |
| `seed`         | number      | No       | -       | -   | -   | -                                                                                                                                        | Random seed for reproducible results                                                       |

## Wan 2.7 Image Pro

Alibaba Wan 2.7 Image Pro on Replicate — higher quality, up to 4K text-to-image, multi-image editing, and image sets.

**Model ID:** `model_wan-2-7-image-pro`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-7-image-pro/markdown>

| Parameter      | Type        | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                  | Description                                                                                |
| -------------- | ----------- | -------- | ------- | --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `prompt`       | string      | Yes      | -       | -   | -   | -                                                                                                                                                                                                               | Describe generation, editing instructions, or structured image-set prompts                 |
| `images`       | file\_array | No       | “       | -   | -   | -                                                                                                                                                                                                               | Optional input images for editing, style transfer, or multi-reference generation (up to 9) |
| `size`         | string      | No       | `2K`    | -   | -   | `1K`, `2K`, `4K`, `1024*1024`, `2048*2048`, `4096*4096`, `1280*720`, `720*1280`, `2048*1152`, `1152*2048`, `4096*2304`, `2304*4096`, `1024*768`, `768*1024`, `2048*1536`, `1536*2048`, `4096*3072`, `3072*4096` | Output resolution (4K only for text-to-image without input images)                         |
| `numOutputs`   | number      | No       | `1`     | 1   | 4   | -                                                                                                                                                                                                               | Number of images to generate (1–4)                                                         |
| `imageSetMode` | boolean     | No       | `false` | -   | -   | -                                                                                                                                                                                                               | Generate a coherent set of related images from one prompt                                  |
| `thinkingMode` | boolean     | No       | `true`  | -   | -   | -                                                                                                                                                                                                               | Enhanced reasoning for text-to-image (no input images, not in image set mode); slower      |
| `seed`         | number      | No       | -       | -   | -   | -                                                                                                                                                                                                               | Random seed for reproducible results                                                       |
