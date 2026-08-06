---
title: YVO3D | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **YVO3D** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [YVO3D Image to 3D](#yvo3d-image-to-3d)
- [YVO3D Retexture](#yvo3d-retexture)

---

## YVO3D Image to 3D

Generate production-ready 3D GLB models from one image (geometry or PBR-textured) or 2–4 multi-view images with YVO3D.

**Model ID:** `model_yvo3d-image-to-3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_yvo3d-image-to-3d/markdown>

| Parameter           | Type        | Required | Default     | Min  | Max     | Allowed Values                                           | Description                                                                                                                                                                                                      |
| ------------------- | ----------- | -------- | ----------- | ---- | ------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`            | file\_array | Yes      | -           | -    | -       | -                                                        | Upload one image to build a 3D model from a single view, or 2–4 photos of the same subject from different angles for a more accurate shape. Note: multi-view uploads always produce shape only, without texture. |
| `texture`           | boolean     | No       | `true`      | -    | -       | -                                                        | Single image only. On, the model comes with surface color and material; off, you get the bare shape only. Multi-view uploads are always shape-only.                                                              |
| `modelGenerator`    | string      | No       | `FAST_TRUE` | -    | -       | `FAST_TRUE`, `FAST_PRIME`, `ULTIMA_TRUE`, `ULTIMA_PRIME` | The shape quality level. Higher tiers produce better geometry but cost more.                                                                                                                                     |
| `textureResolution` | string      | No       | `1K`        | -    | -       | `1K`, `2K`, `FAST4K`, `REAL4K`, `ULTIMA8K`               | The detail level of the surface texture, for single-image textured models. Higher resolutions look sharper but cost more.                                                                                        |
| `polycount`         | number      | No       | `100000`    | 1000 | 2000000 | -                                                        | The target number of polygons in the model — more polygons mean finer detail and heavier files. Applies to shape-only and multi-view generation; ignored for textured single-image models.                       |
| `lowpoly`           | boolean     | No       | `false`     | -    | -       | -                                                        | Produces a simplified, low-polygon model for a lighter, stylized look. Applies to shape-only generation.                                                                                                         |
| `highdetails`       | boolean     | No       | `false`     | -    | -       | -                                                        | Available with the Ultima Prime generator only. Adds finer geometric detail for an extra cost. Can’t be combined with Low Poly.                                                                                  |
| `autopoly`          | boolean     | No       | `false`     | -    | -       | -                                                        | Available with the Ultima Prime generator only. Lets the model pick the best polygon count for you.                                                                                                              |
| `realismLevel`      | number      | No       | `0.85`      | 0    | 1       | -                                                        | How photorealistic the texture looks, for textured models. Higher values are more realistic.                                                                                                                     |
| `creativity`        | number      | No       | `3`         | 0    | 5       | -                                                        | How much creative freedom the model takes. 0 stays faithful to your image; 5 allows more imaginative interpretation.                                                                                             |
| `generateUvs`       | string      | No       | `ON`        | -    | -       | `ON`, `OFF`                                              | Automatically creates UV maps — the layout that lets a texture wrap correctly onto the 3D surface — when they’re missing.                                                                                        |
| `hyperMode`         | string      | No       | `OFF`       | -    | -       | `ON`, `OFF`                                              | Processes textures faster and at lower cost, with a small drop in quality.                                                                                                                                       |
| `insideOut`         | string      | No       | `OFF`       | -    | -       | `ON`, `OFF`                                              | Textures the inside surfaces of the model as well as the outside, rather than just the outside. Adds cost.                                                                                                       |
| `unlit`             | string      | No       | `OFF`       | -    | -       | `ON`, `OFF`                                              | Bakes the texture without any lighting or shadows, so the model looks the same under any lighting in your scene.                                                                                                 |
| `textureSharpness`  | number      | No       | `0.5`       | 0.5  | 1       | -                                                        | How sharp and detailed the texture appears. Higher values enhance fine detail.                                                                                                                                   |
| `textureAdherence`  | string      | No       | `OFF`       | -    | -       | `ON`, `OFF`                                              | When on, keeps the generated texture closer to the look of your source image.                                                                                                                                    |
| `roughness`         | number      | No       | `1.3`       | 0    | 2       | -                                                        | How matte or glossy the surface looks. Higher values are more matte; lower values are shinier.                                                                                                                   |

## YVO3D Retexture

Retexture an existing GLB model with YVO3D. Optionally guide the new textures with a reference image.

**Model ID:** `model_yvo3d-retexture`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_yvo3d-retexture/markdown>

| Parameter           | Type    | Required | Default | Min | Max | Allowed Values                             | Description                                                                                                                                     |
| ------------------- | ------- | -------- | ------- | --- | --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`             | file    | Yes      | -       | -   | -   | -                                          | The existing GLB 3D model you want to give a new surface.                                                                                       |
| `retexture`         | boolean | No       | `false` | -   | -   | -                                          | On, the model’s existing surface is replaced with newly generated textures (a reference image is required). Off, the current textures are kept. |
| `referenceImage`    | file    | No       | -       | -   | -   | -                                          | An image to guide the look of the new textures — color, material, and style. Required when Replace Textures is on.                              |
| `textureResolution` | string  | No       | `1K`    | -   | -   | `1K`, `2K`, `FAST4K`, `REAL4K`, `ULTIMA8K` | The detail level of the generated texture. Higher resolutions look sharper but cost more.                                                       |
| `realismLevel`      | number  | No       | `0.85`  | 0   | 1   | -                                          | How photorealistic the texture looks. Higher values are more realistic.                                                                         |
| `creativity`        | number  | No       | `3`     | 0   | 5   | -                                          | How much creative freedom the model takes. 0 stays faithful to your reference; 5 allows more imaginative interpretation.                        |
| `generateUvs`       | string  | No       | `ON`    | -   | -   | `ON`, `OFF`                                | Automatically creates UV maps — the layout that lets a texture wrap correctly onto the 3D surface — when they’re missing.                       |
| `hyperMode`         | string  | No       | `OFF`   | -   | -   | `ON`, `OFF`                                | Processes textures faster and at lower cost, with a small drop in quality.                                                                      |
| `insideOut`         | string  | No       | `OFF`   | -   | -   | `ON`, `OFF`                                | Textures the inside surfaces of the model as well as the outside, rather than just the outside. Adds cost.                                      |
| `unlit`             | string  | No       | `OFF`   | -   | -   | `ON`, `OFF`                                | Bakes the texture without any lighting or shadows, so the model looks the same under any lighting in your scene.                                |
| `textureSharpness`  | number  | No       | `0.5`   | 0.5 | 1   | -                                          | How sharp and detailed the texture appears. Higher values enhance fine detail.                                                                  |
| `textureAdherence`  | string  | No       | `OFF`   | -   | -   | `ON`, `OFF`                                | When on, keeps the generated texture closer to the look of your reference image.                                                                |
| `roughness`         | number  | No       | `1.3`   | 0   | 2   | -                                          | How matte or glossy the surface looks. Higher values are more matte; lower values are shinier.                                                  |
