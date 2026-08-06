---
title: Academia | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Academia** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [PartCrafter](#partcrafter)
- [ReconViaGen 0.5](#reconviagen-05)
- [Ultrashape 1.0](#ultrashape-10)

---

## PartCrafter

PartCrafter is a 3D model generator that creates 3D models from images.

**Model ID:** `model_partcrafter`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_partcrafter/markdown>

| Parameter       | Type   | Required | Default | Min  | Max        | Allowed Values | Description                                                            |
| --------------- | ------ | -------- | ------- | ---- | ---------- | -------------- | ---------------------------------------------------------------------- |
| `images`        | file   | Yes      | -       | -    | -          | -              | Input image to generate 3D asset from                                  |
| `numParts`      | number | No       | `6`     | 1    | 16         | -              | Number of parts to generate                                            |
| `steps`         | number | No       | `75`    | 1    | 100        | -              | Number of inference steps.                                             |
| `guidanceScale` | number | No       | `7`     | 1    | 10         | -              | Higher values will keep output closer to the input image               |
| `numTokens`     | number | No       | `4096`  | 1024 | 4096       | -              | Number of tokens                                                       |
| `seed`          | number | No       | -       | 0    | 2147483647 | -              | Use a seed for reproducible results. Leave blank to use a random seed. |

## ReconViaGen 0.5

Generate a textured 3D model from one or more images using ReconViaGen 0.5.

**Model ID:** `model_reconviagen-0-5`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_reconviagen-0-5/markdown>

| Parameter            | Type        | Required | Default                    | Min  | Max        | Allowed Values                                                                                                     | Description                                                 |
| -------------------- | ----------- | -------- | -------------------------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `images`             | file\_array | Yes      | -                          | -    | -          | -                                                                                                                  | One or more views of the same object for 3D reconstruction. |
| `resolution`         | number      | No       | `1024`                     | -    | -          | `512`, `1024`, `1536`                                                                                              | Output resolution. Higher values produce more detail.       |
| `multiImageStrategy` | string      | No       | `adaptive_guidance_weight` | -    | -          | `average_right`, `weighted_average`, `sequential`, `average`, `adaptive_guidance_weight`, `fixed_guidance_rescale` | How multiple input views are combined.                      |
| `ssSource`           | string      | No       | `mesh`                     | -    | -          | `direct`, `mesh`, `mvtrellis2`                                                                                     | Source strategy for sparse structure generation.            |
| `textureSize`        | number      | No       | `2048`                     | -    | -          | `1024`, `2048`, `4096`                                                                                             | Resolution of the baked texture map.                        |
| `decimationTarget`   | number      | No       | `500000`                   | 5000 | 2000000    | -                                                                                                                  | Target vertex count for the final mesh.                     |
| `seed`               | number      | No       | -                          | 0    | 2147483647 | -                                                                                                                  | Random seed for reproducibility.                            |

## Ultrashape 1.0

UltraShape-1.0 is a 3D diffusion framework that generates high-fidelity 3D geometry through coarse-to-fine geometric refinement.

**Model ID:** `model_ultrashape-1-0`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ultrashape-1-0/markdown>

| Parameter           | Type   | Required | Default | Min | Max  | Allowed Values | Description                                                    |
| ------------------- | ------ | -------- | ------- | --- | ---- | -------------- | -------------------------------------------------------------- |
| `image`             | file   | Yes      | -       | -   | -    | -              | Reference image for mesh refinement.                           |
| `model`             | file   | Yes      | -       | -   | -    | -              | The coarse mesh to refine                                      |
| `numInferenceSteps` | number | No       | `50`    | 1   | 50   | -              | Number of inference steps.                                     |
| `octreeResolution`  | number | No       | `1024`  | 128 | 1024 | -              | Marching cubes resolution.                                     |
| `seed`              | number | No       | -       | 0   | -    | -              | Seed value for randomization, leave blank to use a random seed |
