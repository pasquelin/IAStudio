---
title: Pruna AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Pruna AI** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [P-Image](#p-image)
- [P-Image Edit](#p-image-edit)
- [P-Image Ideogram](#p-image-ideogram)
- [P-Image Try-On](#p-image-try-on)

---

## P-Image

**Model ID:** `model_p-image`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_p-image/markdown>

| Parameter | Type   | Required | Default | Min | Max  | Allowed Values | Description                                                                                       |
| --------- | ------ | -------- | ------- | --- | ---- | -------------- | ------------------------------------------------------------------------------------------------- |
| `prompt`  | string | Yes      | -       | -   | -    | -              | Text prompt for image generation.                                                                 |
| `width`   | number | No       | `1216`  | 256 | 1440 | -              | Width of the generated image. Only used when Aspect Ratio is ‘custom’. Must be a multiple of 16.  |
| `height`  | number | No       | `832`   | 256 | 1440 | -              | Height of the generated image. Only used when Aspect Ratio is ‘custom’. Must be a multiple of 16. |
| `seed`    | number | No       | -       | -   | -    | -              | Random seed. Set for reproducible generation.                                                     |

## P-Image Edit

A sub 1 second cheap multi-image editing model built for production use cases.

**Model ID:** `model_p-image-editing`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_p-image-editing/markdown>

| Parameter         | Type        | Required | Default             | Min | Max | Allowed Values                                                         | Description                                                                                                                                       |
| ----------------- | ----------- | -------- | ------------------- | --- | --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `referenceImages` | file\_array | Yes      | -                   | -   | -   | -                                                                      | Images to use as a reference. For editing task, provide the main image as the first image.                                                        |
| `prompt`          | string      | Yes      | -                   | -   | -   | -                                                                      | Text prompt for image generation. Make sure to describe your edit task clearly. You can refer to the images as ‘image 1’ and ‘image 2’ and so on. |
| `turbo`           | boolean     | No       | `true`              | -   | -   | -                                                                      | If turned on, the model will run faster with additional optimizations. For complicated tasks, it is recommended to turn this off.                 |
| `aspectRatio`     | string      | No       | `match_input_image` | -   | -   | `16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16`, `match_input_image` | Aspect ratio for the generated image. `match_input_image` will match the aspect ratio of the first image.                                         |
| `seed`            | number      | No       | -                   | -   | -   | -                                                                      | Random seed. Set for reproducible generation.                                                                                                     |

## P-Image Ideogram

Pruna p-image-ideogram text-to-image generation with adjustable thinking effort and 1K/2K output.

**Model ID:** `model_pruna-p-image-ideogram`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pruna-p-image-ideogram/markdown>

| Parameter          | Type    | Required | Default | Min | Max        | Allowed Values                                              | Description                                                                                                                                                            |
| ------------------ | ------- | -------- | ------- | --- | ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`           | string  | Yes      | -       | -   | -          | -                                                           | Describe the image you want to create, including any text that should appear in it.                                                                                    |
| `thinking`         | string  | No       | `high`  | -   | -          | `very low`, `low`, `medium`, `high`                         | How much reasoning effort the model puts into the image. Higher levels improve quality but cost more and take longer.                                                  |
| `imageSize`        | string  | No       | `1K`    | -   | -          | `1K`, `2K`                                                  | The output size, 1K or 2K. Ignored when Aspect Ratio is set to Custom (the Width and Height fields take over instead).                                                 |
| `promptUpsampling` | boolean | No       | `true`  | -   | -          | -                                                           | Automatically enriches your prompt with extra detail before generating. On by default.                                                                                 |
| `aspectRatio`      | string  | No       | `1:1`   | -   | -          | `9:16`, `2:3`, `3:4`, `1:1`, `4:3`, `3:2`, `16:9`, `custom` | The shape of the image. Choose Custom to set your own exact dimensions with the Width and Height fields below.                                                         |
| `width`            | number  | No       | -       | 1   | 2560       | -                                                           | The exact width in pixels (up to 2560). Required when Aspect Ratio is set to Custom; ignored otherwise. Width × height cannot exceed 6 megapixels (6,000,000 pixels).  |
| `height`           | number  | No       | -       | 1   | 2560       | -                                                           | The exact height in pixels (up to 2560). Required when Aspect Ratio is set to Custom; ignored otherwise. Width × height cannot exceed 6 megapixels (6,000,000 pixels). |
| `seed`             | number  | No       | -       | 0   | 4294967295 | -                                                           | A number that makes results repeatable. Reusing the same seed and settings produces the same image; leave it empty for a different result each time.                   |

## P-Image Try-On

Dress a person with one or more garment reference images using Pruna’s virtual try-on model.

**Model ID:** `model_pruna-p-image-try-on`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pruna-p-image-try-on/markdown>

| Parameter           | Type        | Required | Default | Min | Max        | Allowed Values | Description                                                                               |
| ------------------- | ----------- | -------- | ------- | --- | ---------- | -------------- | ----------------------------------------------------------------------------------------- |
| `personImage`       | file        | Yes      | -       | -   | -          | -              | Image of the person to dress.                                                             |
| `referenceImages`   | file\_array | Yes      | -       | -   | -          | -              | Garment reference images to apply to the person. Up to 6 recommended, up to 11 supported. |
| `prompt`            | string      | No       | -       | -   | -          | -              | Optional guidance for non-flatlay garment images.                                         |
| `referencePose`     | file        | No       | -       | -   | -          | -              | Optional reference pose image for reposing the person.                                    |
| `turbo`             | boolean     | No       | `false` | -   | -          | -              | Faster processing. Not recommended when using four or more garment images.                |
| `preserveInputSize` | boolean     | No       | `true`  | -   | -          | -              | Maintain the original resolution of the person image.                                     |
| `seed`              | number      | No       | -       | 0   | 4294967295 | -              | Random seed for reproducible generation.                                                  |
