---
title: Microsoft | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Microsoft** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Trellis 2](#trellis-2)
- [Trellis 2 Retexture](#trellis-2-retexture)

---

## Trellis 2

Generate 3D models from your images using Trellis 2. A native 3D generative model enabling versatile and high-quality 3D asset creation.

**Model ID:** `model_trellis-2`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_trellis-2/markdown>

| Parameter                   | Type    | Required | Default  | Min    | Max        | Allowed Values         | Description                                                            |
| --------------------------- | ------- | -------- | -------- | ------ | ---------- | ---------------------- | ---------------------------------------------------------------------- |
| `image`                     | file    | Yes      | -        | -      | -          | -                      | Input image to generate 3D asset from                                  |
| `resolution`                | number  | No       | `1024`   | -      | -          | `512`, `1024`, `1536`  | Output resolution; higher is slower but more detailed                  |
| `ssGuidanceStrength`        | number  | No       | `8.5`    | 0      | 10         | -                      | Stage 1: Sparse Structure Generation - Guidance                        |
| `ssGuidanceRescale`         | number  | No       | `0.7`    | 0      | 1          | -                      | Stage 1: Sparse Structure Generation - Guidance Rescale                |
| `ssSamplingSteps`           | number  | No       | `20`     | 1      | 50         | -                      | Stage 1: Sparse Structure Generation - Steps                           |
| `ssRescaleT`                | number  | No       | `5`      | 1      | 6          | -                      | Stage 1: Sparse Structure Generation - Rescale T                       |
| `shapeSlatGuidanceStrength` | number  | No       | `7.5`    | 0      | 10         | -                      | Stage 2: Shape Structured Latent Generation - Guidance                 |
| `shapeSlatGuidanceRescale`  | number  | No       | `0.5`    | 0      | 1          | -                      | Stage 2: Shape Structured Latent Generation - Guidance Rescale         |
| `shapeSlatSamplingSteps`    | number  | No       | `20`     | 1      | 50         | -                      | Stage 2: Shape Structured Latent Generation - Steps                    |
| `texSlatGuidanceStrength`   | number  | No       | `2`      | 0      | 10         | -                      | Stage 3: Texture Structured Latent Generation - Guidance               |
| `texSlatGuidanceRescale`    | number  | No       | `0`      | 0      | 1          | -                      | Stage 3: Texture Structured Latent Generation - Guidance               |
| `texSlatSamplingSteps`      | number  | No       | `20`     | 1      | 50         | -                      | Stage 3: Texture Structured Latent Generation - Steps                  |
| `texSlatRescaleT`           | number  | No       | `3`      | 1      | 6          | -                      | Stage 3: Texture Structured Latent Generation - Rescale T              |
| `decimationTarget`          | number  | No       | `500000` | 100000 | 2000000    | -                      | Target number of faces for mesh decimation                             |
| `textureSize`               | number  | No       | `2048`   | -      | -          | `1024`, `2048`, `4096` | Texture size for the generated 3D model                                |
| `remesh`                    | boolean | No       | `true`   | -      | -          | -                      | Enable remeshing                                                       |
| `remeshBand`                | number  | No       | `1`      | 1      | 4          | -                      | Remesh band parameter                                                  |
| `seed`                      | number  | No       | -        | 0      | 2147483647 | -                      | Use a seed for reproducible results. Leave blank to use a random seed. |

## Trellis 2 Retexture

Retexture 3D models with Trellis 2. Apply new textures to existing meshes using a reference image for style guidance.

**Model ID:** `model_trellis-2-retexture`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_trellis-2-retexture/markdown>

| Parameter                 | Type   | Required | Default | Min | Max        | Allowed Values         | Description                                                            |
| ------------------------- | ------ | -------- | ------- | --- | ---------- | ---------------------- | ---------------------------------------------------------------------- |
| `model`                   | file   | Yes      | -       | -   | -          | -                      | Input mesh                                                             |
| `image`                   | file   | Yes      | -       | -   | -          | -                      | Reference image for retexturing                                        |
| `resolution`              | number | No       | `1024`  | -   | -          | `512`, `1024`          | Output resolution; higher is slower but more detailed                  |
| `textureSize`             | number | No       | `2048`  | -   | -          | `1024`, `2048`, `4096` | Texture size for the retextured 3D model                               |
| `texSlatGuidanceStrength` | number | No       | `1`     | 0   | 10         | -                      | Guidance strength                                                      |
| `texSlatGuidanceRescale`  | number | No       | `0`     | 0   | 1          | -                      | Texture generation guidance rescale                                    |
| `texSlatSamplingSteps`    | number | No       | `12`    | 1   | 50         | -                      | Texture generation sampling steps                                      |
| `texSlatRescaleT`         | number | No       | `3`     | 1   | 6          | -                      | Texture generation rescale T                                           |
| `seed`                    | number | No       | -       | 0   | 2147483647 | -                      | Use a seed for reproducible results. Leave blank to use a random seed. |
