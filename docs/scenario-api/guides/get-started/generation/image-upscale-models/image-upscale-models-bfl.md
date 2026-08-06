---
title: BFL | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **BFL** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Scenario Flux Upscale](#scenario-flux-upscale)

---

## Scenario Flux Upscale

**Model ID:** `model_sc-upscale-flux`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sc-upscale-flux/markdown>

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
| `baseModel`                   | string        | No       | `FLUX.1-dev` | -   | -          | `FLUX.1-dev`, `FLUX.1-Krea-dev`   | Use FLUX.1-dev for stylized images, FLUX.1-Krea-dev for realistic images               |
| `seed`                        | number        | No       | -            | 0   | 2147483647 | -                                 | Seed used for reproduction                                                             |
