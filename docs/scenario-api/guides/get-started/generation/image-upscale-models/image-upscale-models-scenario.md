---
title: Scenario | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Scenario** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Scenario Gemini Upscale](#scenario-gemini-upscale)
- [Scenario Upscale V3](#scenario-upscale-v3)

---

## Scenario Gemini Upscale

**Model ID:** `model_scenario-gemini-upscale`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-gemini-upscale/markdown>

| Parameter       | Type   | Required | Default | Min | Max | Allowed Values | Description                     |
| --------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------------------- |
| `image`         | file   | Yes      | -       | -   | -   | -              | Input image to upscale          |
| `prompt`        | string | No       | -       | -   | -   | -              | User prompt for image upscaling |
| `upscaleFactor` | string | No       | `4k`    | -   | -   | `4k`           | Target resolution               |
| `creativity`    | number | No       | `50`    | 0   | 100 | -              | Creativity level from 0 to 100  |
| `seed`          | number | No       | -       | 0   | -   | -              | Seed for generation             |

## Scenario Upscale V3

**Model ID:** `model_upscale-v3`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_upscale-v3/markdown>

| Parameter                     | Type        | Required | Default    | Min  | Max        | Allowed Values                                                                      | Description                                                                                                                                                                                                                                   |
| ----------------------------- | ----------- | -------- | ---------- | ---- | ---------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`                       | file        | Yes      | -          | -    | -          | -                                                                                   | Image to upscale                                                                                                                                                                                                                              |
| `style`                       | string      | No       | `standard` | -    | -          | `standard`, `cartoon`, `anime`, `comic`, `minimalist`, `photography`, `3d-rendered` | Selecting a custom style will optimize settings for the output image to match the selected style                                                                                                                                              |
| `upscaleFactor`               | number      | No       | `2`        | 1    | 16         | -                                                                                   | Scaling factor (when target width not specified). If 1, then it’s a refinement step only                                                                                                                                                      |
| `preset`                      | string      | No       | `precise`  | -    | -          | `precise`, `balanced`, `creative`                                                   | Select a preset to apply a set of parameters                                                                                                                                                                                                  |
| `styleImages`                 | file\_array | No       | -          | -    | -          | -                                                                                   | Upload up to 10 images for the AI to learn from and shape the style of your final output                                                                                                                                                      |
| `styleStrength`               | number      | No       | `0.5`      | 0    | 3          | -                                                                                   | Higher fidelity keeps the enhanced image’s style closely aligned with the style images.                                                                                                                                                       |
| `tileStyle`                   | boolean     | No       | `false`    | -    | -          | -                                                                                   | If set to true, during the upscaling process, the model will match tiles of the source image with tiles of the style image. This will result in a more coherent style transfer. Works best with style images that have a similar composition. |
| `prompt`                      | string      | No       | -          | -    | -          | -                                                                                   | Prompt                                                                                                                                                                                                                                        |
| `negativePrompt`              | string      | No       | -          | -    | -          | -                                                                                   | -                                                                                                                                                                                                                                             |
| `guidanceScale`               | number      | No       | `6`        | 0    | 10         | -                                                                                   | Higher fidelity prioritizes the prompt over the image                                                                                                                                                                                         |
| `controlnetConditioningScale` | number      | No       | `0.8`      | 0    | 1.2        | -                                                                                   | Higher fidelity keeps the enhanced image closer to the original structure of the input image                                                                                                                                                  |
| `strength`                    | number      | No       | `0.1`      | 0.1  | 1          | -                                                                                   | Higher creativity levels introduce extra imaginative elements to enhanced images                                                                                                                                                              |
| `fractality`                  | number      | No       | `0`        | 0    | 1          | -                                                                                   | Fractality will add small fractal-like details, possibly repeating intricated patterns and repeating these details across tiles                                                                                                               |
| `loraDetailsScale`            | number      | No       | `0`        | -1.5 | 1.5        | -                                                                                   | Enhances or reduces the intensity of the details                                                                                                                                                                                              |
| `seed`                        | number      | No       | -          | 0    | 2147483647 | -                                                                                   | Seed used for reproduction                                                                                                                                                                                                                    |
| `strengthDecay`               | number      | No       | `0.8`      | 0.1  | 1          | -                                                                                   | The degree of creativity retained at each stage of the enhancement process (only applies for scale factors above 2)                                                                                                                           |
| `overrideEmbeddings`          | boolean     | No       | `false`    | -    | -          | -                                                                                   | Removes any additional custom embeddings used to guide the ‘Style’                                                                                                                                                                            |
