---
title: Tencent | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Tencent** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Hunyuan 3D 2.1](#hunyuan-3d-21)
- [Hunyuan 3D 3.0 Pro](#hunyuan-3d-30-pro)
- [Hunyuan 3D 3.0 Pro (Multiview)](#hunyuan-3d-30-pro-multiview)
- [Hunyuan 3D 3.0 Pro (Sketch)](#hunyuan-3d-30-pro-sketch)
- [Hunyuan 3D 3.1 Pro](#hunyuan-3d-31-pro)
- [Hunyuan 3D 3.1 Pro (Multiview)](#hunyuan-3d-31-pro-multiview)
- [Hunyuan 3D 3.1 Pro (Sketch)](#hunyuan-3d-31-pro-sketch)
- [Hunyuan 3D Part](#hunyuan-3d-part)
- [Hunyuan Polygen 1.5](#hunyuan-polygen-15)
- [HY World - Image to Splat](#hy-world---image-to-splat)
- [HY World - Multi-view to Splat](#hy-world---multi-view-to-splat)
- [HY World - Skybox to Splat](#hy-world---skybox-to-splat)
- [Pixal3D](#pixal3d)
- [Tencent Texture Edit](#tencent-texture-edit)
- [Tencent UV Unwrapping](#tencent-uv-unwrapping)

---

## Hunyuan 3D 2.1

**Model ID:** `model_hunyuan-3d-v2-1`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-3d-v2-1/markdown>

| Parameter       | Type    | Required | Default | Min | Max        | Allowed Values | Description                                                                                               |
| --------------- | ------- | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `image`         | file    | Yes      | -       | -   | -          | -              | Front view to transform in 3D, should remove background to get better results                             |
| `paint`         | boolean | No       | `true`  | -   | -          | -              | Paint the mesh with texture.                                                                              |
| `steps`         | number  | No       | `30`    | 10  | 100        | -              | The number of steps for the generation                                                                    |
| `guidanceScale` | number  | No       | `5`     | 1   | 10         | -              | Higher values adhere more closely to the input image, while lower values allow for more creative freedom. |
| `targetFaceNum` | number  | No       | `40000` | 100 | 1000000    | -              | The number of faces to target for the generation                                                          |
| `seed`          | number  | No       | -       | 0   | 2147483647 | -              | Use a seed for reproducible results. Leave blank to use a random seed.                                    |

## Hunyuan 3D 3.0 Pro

**Model ID:** `model_hunyuan-3d-pro-i23d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-3d-pro-i23d/markdown>

| Parameter      | Type    | Required | Default    | Min   | Max     | Allowed Values                  | Description                                                                                                                                           |
| -------------- | ------- | -------- | ---------- | ----- | ------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`        | file    | Yes      | -          | -     | -       | -                               | Input image. Required if prompt not provided. Size: 128-5000 pixels per side, max 8MB. Formats: jpg, png, jpeg, webp.                                 |
| `faceCount`    | number  | No       | `500000`   | 40000 | 1500000 | -                               | Target number of faces in the generated 3D mesh. Higher values produce finer detail. This parameter is ignored when ‘Optimized Mesh’ mode is enabled. |
| `generateType` | string  | No       | `Normal`   | -     | -       | `Normal`, `LowPoly`, `Geometry` | Standard: textured mesh. Optimized Mesh: simplified mesh. Mesh Only: no textures.                                                                     |
| `enablePbr`    | boolean | No       | `false`    | -     | -       | -                               | Enables Physically Based Rendering (PBR) materials for realistic lighting.                                                                            |
| `polygonType`  | string  | No       | `triangle` | -     | -       | `triangle`, `quadrilateral`     | Polygon grid format. Tris for real-time engines; Quads for sculpting.                                                                                 |

## Hunyuan 3D 3.0 Pro (Multiview)

**Model ID:** `model_hunyuan-3d-pro-multiview`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-3d-pro-multiview/markdown>

| Parameter      | Type    | Required | Default    | Min   | Max     | Allowed Values                  | Description                                                                                                                                           |
| -------------- | ------- | -------- | ---------- | ----- | ------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontImage`   | file    | Yes      | -          | -     | -       | -                               | Front view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.                                                                   |
| `leftImage`    | file    | No       | -          | -     | -       | -                               | Left view image for multiview generation. Size: 128-5000 pixels per side, max 8MB                                                                     |
| `rightImage`   | file    | No       | -          | -     | -       | -                               | Right view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.                                                                   |
| `backImage`    | file    | No       | -          | -     | -       | -                               | Back view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.                                                                    |
| `faceCount`    | number  | No       | `500000`   | 40000 | 1500000 | -                               | Target number of faces in the generated 3D mesh. Higher values produce finer detail. This parameter is ignored when ‘Optimized Mesh’ mode is enabled. |
| `generateType` | string  | No       | `Normal`   | -     | -       | `Normal`, `LowPoly`, `Geometry` | Standard: textured mesh. Optimized Mesh: simplified mesh. Mesh Only: no textures.                                                                     |
| `enablePbr`    | boolean | No       | `false`    | -     | -       | -                               | Enables Physically Based Rendering (PBR) materials for realistic lighting.                                                                            |
| `polygonType`  | string  | No       | `triangle` | -     | -       | `triangle`, `quadrilateral`     | Polygon grid format. Tris for real-time engines; Quads for sculpting.                                                                                 |

## Hunyuan 3D 3.0 Pro (Sketch)

**Model ID:** `model_hunyuan-3d-pro-sketch`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-3d-pro-sketch/markdown>

| Parameter     | Type    | Required | Default    | Min   | Max     | Allowed Values              | Description                                                                          |
| ------------- | ------- | -------- | ---------- | ----- | ------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `prompt`      | string  | Yes      | -          | -     | -       | -                           | Text prompt for 3D content generation.                                               |
| `image`       | file    | Yes      | -          | -     | -       | -                           | Input sketch image. Size: 128-5000 pixels per side, max 8MB.                         |
| `faceCount`   | number  | No       | `500000`   | 40000 | 1500000 | -                           | Target number of faces in the generated 3D mesh. Higher values produce finer detail. |
| `enablePbr`   | boolean | No       | `false`    | -     | -       | -                           | Enables Physically Based Rendering (PBR) materials for realistic lighting.           |
| `polygonType` | string  | No       | `triangle` | -     | -       | `triangle`, `quadrilateral` | Polygon grid format. Tris for real-time engines; Quads for sculpting.                |

## Hunyuan 3D 3.1 Pro

Hunyuan 3D 3.1 (Pro) by Tencent is a state-of-the-art 10B parameter image-to-3D model with 1536³ resolution, hierarchical DiT carving, and enhanced texture color accuracy.

**Model ID:** `model_hunyuan-3d-pro-3-1-i23d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-3d-pro-3-1-i23d/markdown>

| Parameter      | Type    | Required | Default  | Min   | Max     | Allowed Values       | Description                                                                                                           |
| -------------- | ------- | -------- | -------- | ----- | ------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `image`        | file    | Yes      | -        | -     | -       | -                    | Input image. Required if prompt not provided. Size: 128-5000 pixels per side, max 8MB. Formats: jpg, png, jpeg, webp. |
| `faceCount`    | number  | No       | `500000` | 40000 | 1500000 | -                    | Target number of faces in the generated 3D mesh. Higher values produce finer detail.                                  |
| `generateType` | string  | No       | `Normal` | -     | -       | `Normal`, `Geometry` | Standard: textured mesh. Mesh Only: no textures.                                                                      |
| `enablePbr`    | boolean | No       | `false`  | -     | -       | -                    | Enables Physically Based Rendering (PBR) materials for realistic lighting.                                            |

## Hunyuan 3D 3.1 Pro (Multiview)

Hunyuan 3D 3.1 (Multiview) reconciles up to 8 reference images to produce symmetric 3D assets from 120 credits.

**Model ID:** `model_hunyuan-3d-pro-3-1-multiview`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-3d-pro-3-1-multiview/markdown>

| Parameter         | Type    | Required | Default  | Min   | Max     | Allowed Values       | Description                                                                                   |
| ----------------- | ------- | -------- | -------- | ----- | ------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `frontImage`      | file    | Yes      | -        | -     | -       | -                    | Front view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.           |
| `leftImage`       | file    | No       | -        | -     | -       | -                    | Left view image for multiview generation. Size: 128-5000 pixels per side, max 8MB             |
| `rightImage`      | file    | No       | -        | -     | -       | -                    | Right view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.           |
| `backImage`       | file    | No       | -        | -     | -       | -                    | Back view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.            |
| `topImage`        | file    | No       | -        | -     | -       | -                    | Top view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.             |
| `bottomImage`     | file    | No       | -        | -     | -       | -                    | Bottom view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.          |
| `leftFrontImage`  | file    | No       | -        | -     | -       | -                    | Left front 45° view image for multiview generation. Size: 128-5000 pixels per side, max 8MB.  |
| `rightFrontImage` | file    | No       | -        | -     | -       | -                    | Right front 45° view image for multiview generation. Size: 128-5000 pixels per side, max 8MB. |
| `faceCount`       | number  | No       | `500000` | 40000 | 1500000 | -                    | Target number of faces in the generated 3D mesh. Higher values produce finer detail.          |
| `generateType`    | string  | No       | `Normal` | -     | -       | `Normal`, `Geometry` | Standard: textured mesh. Mesh Only: no textures.                                              |
| `enablePbr`       | boolean | No       | `false`  | -     | -       | -                    | Enables Physically Based Rendering (PBR) materials for realistic lighting.                    |

## Hunyuan 3D 3.1 Pro (Sketch)

Hunyuan 3D 3.1 (Sketch) transforms hand-drawn line art and sketches into textured 3D meshes from 105 credits.

**Model ID:** `model_hunyuan-3d-pro-3-1-sketch`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-3d-pro-3-1-sketch/markdown>

| Parameter   | Type    | Required | Default  | Min   | Max     | Allowed Values | Description                                                                          |
| ----------- | ------- | -------- | -------- | ----- | ------- | -------------- | ------------------------------------------------------------------------------------ |
| `prompt`    | string  | Yes      | -        | -     | -       | -              | Text prompt for 3D content generation.                                               |
| `image`     | file    | Yes      | -        | -     | -       | -              | Input sketch image. Size: 128-5000 pixels per side, max 8MB.                         |
| `faceCount` | number  | No       | `500000` | 40000 | 1500000 | -              | Target number of faces in the generated 3D mesh. Higher values produce finer detail. |
| `enablePbr` | boolean | No       | `false`  | -     | -       | -              | Enables Physically Based Rendering (PBR) materials for realistic lighting.           |

## Hunyuan 3D Part

**Model ID:** `model_hunyuan-3d-part`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-3d-part/markdown>

| Parameter                 | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                                                     |
| ------------------------- | ------- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `mesh`                    | file    | Yes      | -       | -   | -   | -              | Upload a GLB file of the 3D model you want to generate a part of.                                                               |
| `postprocess`             | boolean | No       | `true`  | -   | -   | -              | Post-processingwill merge the small parts according to the threshold. The smaller the threshold, the more parts will be merged. |
| `postprocessingThreshold` | number  | No       | `0.95`  | 0   | 1   | -              | Threshold for postprocessing the segmentation mask                                                                              |
| `seed`                    | number  | No       | -       | -   | -   | -              | Use a seed for reproducible results. Leave blank to use a random seed.                                                          |

## Hunyuan Polygen 1.5

Hunyuan Polygen 1.5 by Tencent is an art-grade AI retopology model that converts high-poly 3D meshes into clean, production-ready low-poly assets with quad or triangle topology.

**Model ID:** `model_tencent-smarttopology`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tencent-smarttopology/markdown>

| Parameter     | Type   | Required | Default    | Min | Max | Allowed Values              | Description                                                                                                                 |
| ------------- | ------ | -------- | ---------- | --- | --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `file3d`      | file   | Yes      | -          | -   | -   | -                           | Source 3D file model link. Supported formats: GLB, OBJ. Maximum file size: 200MB.                                           |
| `polygonType` | string | No       | `triangle` | -   | -   | `triangle`, `quadrilateral` | Polygon type, indicates model surface composition. Triangles: triangle face, Quads: triangular and quadrilateral mixed face |
| `faceLevel`   | string | No       | `medium`   | -   | -   | `high`, `medium`, `low`     | Reduction level for polygon count. Options: high (minimal reduction), medium (balanced), low (aggressive reduction).        |

## HY World - Image to Splat

Turn a single photo of a place into a navigable 3D Gaussian-splat world. Returns a compact .spz splat for fast preview, with the original .ply available to download.

**Model ID:** `model_hunyuan-world-image-to-splat`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-world-image-to-splat/markdown>

| Parameter             | Type    | Required | Default | Min | Max        | Allowed Values | Description                                                                                                                                        |
| --------------------- | ------- | -------- | ------- | --- | ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`               | file    | Yes      | -       | -   | -          | -              | A single photo of a PLACE or scene (indoor or outdoor) — NOT a single object. The model expands the surroundings into a full navigable 360° world. |
| `prompt`              | string  | No       | -       | -   | -          | -              | Optional text describing what should fill the unseen surroundings.                                                                                 |
| `backend`             | string  | No       | `full`  | -   | -          | `full`, `qwen` | Panorama backend. ‘Full’ = HunyuanImage-3 (highest quality, slower & costlier); ‘Qwen’ = faster and cheaper, lower fidelity.                       |
| `maxSteps`            | number  | No       | `8000`  | 50  | 20000      | -              | Gaussian-splat training iterations. Higher is marginally sharper; does NOT materially change cost or time.                                         |
| `applyNavTraj`        | boolean | No       | `true`  | -   | -          | -              | Plan regular navigation fly-through trajectories (better coverage; adds time & cost).                                                              |
| `applyUpRoute`        | boolean | No       | `true`  | -   | -          | -              | Plan wandering ‘up-route’ trajectories (more coverage; adds time & cost).                                                                          |
| `applyReconIteration` | boolean | No       | `true`  | -   | -          | -              | Plan reconstruction-aware iteration passes (higher fidelity; adds time & cost).                                                                    |
| `seed`                | number  | No       | -       | 0   | 2147483647 | -              | Seed for reproducible results; leave blank for random.                                                                                             |

## HY World - Multi-view to Splat

Reconstruct a navigable 3D Gaussian-splat world from multiple photos of the same scene, or a video walkthrough. Returns a compact .spz splat for fast preview, with the original .ply available to download.

**Model ID:** `model_hunyuan-world-multiview-to-splat`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-world-multiview-to-splat/markdown>

| Parameter             | Type        | Required | Default   | Min   | Max      | Allowed Values | Description                                                                                                                      |
| --------------------- | ----------- | -------- | --------- | ----- | -------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `images`              | file\_array | No       | -         | -     | -        | -              | 2–64 overlapping photos of the SAME scene from different viewpoints (no camera setup needed). Provide this OR a video, not both. |
| `video`               | file        | No       | -         | -     | -        | -              | A video walkthrough of the scene; the model samples frames. Provide this OR images, not both.                                    |
| `targetSize`          | number      | No       | `1036`    | 256   | 1920     | -              | Inference resolution; higher is sharper but slower.                                                                              |
| `compressGsMaxPoints` | number      | No       | `5000000` | 10000 | 20000000 | -              | Maximum splat points kept after compression; lower = lighter file.                                                               |

## HY World - Skybox to Splat

Turn a 360° skybox (equirectangular panorama) into a navigable 3D Gaussian-splat world. Returns a compact .spz splat for fast preview, with the original .ply available to download.

**Model ID:** `model_hunyuan-world-skybox-to-splat`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hunyuan-world-skybox-to-splat/markdown>

| Parameter             | Type    | Required | Default   | Min   | Max      | Allowed Values | Description                                                                                                 |
| --------------------- | ------- | -------- | --------- | ----- | -------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| `panorama`            | file    | Yes      | -         | -     | -        | -              | A 360° skybox / equirectangular panorama (2:1 aspect ratio) of a scene — e.g. the output of a skybox model. |
| `maxSteps`            | number  | No       | `8000`    | 50    | 20000    | -              | Gaussian-splat training iterations. Higher is marginally sharper; does NOT materially change cost or time.  |
| `applyNavTraj`        | boolean | No       | `true`    | -     | -        | -              | Plan regular navigation fly-through trajectories (better coverage; adds time & cost).                       |
| `applyUpRoute`        | boolean | No       | `true`    | -     | -        | -              | Plan wandering ‘up-route’ trajectories (more coverage; adds time & cost).                                   |
| `applyReconIteration` | boolean | No       | `true`    | -     | -        | -              | Plan reconstruction-aware iteration passes (higher fidelity; adds time & cost).                             |
| `compressGsMaxPoints` | number  | No       | `5000000` | 10000 | 20000000 | -              | Maximum splat points kept after compression; lower = lighter file.                                          |

## Pixal3D

Pixal3D turns a single image into a high-fidelity 3D model with detailed geometry and realistic textures.

**Model ID:** `model_pixal3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixal3d/markdown>

| Parameter                   | Type    | Required | Default  | Min  | Max     | Allowed Values         | Description                                                                                                            |
| --------------------------- | ------- | -------- | -------- | ---- | ------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `image`                     | file    | Yes      | -        | -    | -       | -                      | Input image to convert into a 3D model.                                                                                |
| `ssGuidanceStrength`        | number  | No       | `7.5`    | 0    | 10      | -                      | How closely the initial 3D structure follows the input image. Higher values are more faithful but may introduce noise. |
| `ssGuidanceRescale`         | number  | No       | `0.7`    | 0    | 1       | -                      | Dampens artifacts from high guidance in the structure stage.                                                           |
| `ssSamplingSteps`           | number  | No       | `36`     | 1    | 50      | -                      | Number of denoising steps for initial structure generation.                                                            |
| `shapeSlatGuidanceStrength` | number  | No       | `7.5`    | 0    | 10      | -                      | How closely the detailed geometry follows the input image. Higher values add more detail but may introduce noise.      |
| `shapeSlatGuidanceRescale`  | number  | No       | `0.5`    | 0    | 1       | -                      | Dampens artifacts from high guidance in the shape stage.                                                               |
| `shapeSlatSamplingSteps`    | number  | No       | `36`     | 1    | 50      | -                      | Number of denoising steps for shape refinement.                                                                        |
| `shapeSlatRescaleT`         | number  | No       | `3`      | 1    | 6       | -                      | Controls noise schedule sharpness for shape refinement.                                                                |
| `texSlatGuidanceStrength`   | number  | No       | `1`      | 0    | 10      | -                      | How closely the texture follows the input image colors. Higher values are more vivid but may oversaturate textures.    |
| `texSlatGuidanceRescale`    | number  | No       | `0`      | 0    | 1       | -                      | Dampens artifacts from high guidance in the texture stage.                                                             |
| `texSlatSamplingSteps`      | number  | No       | `36`     | 1    | 50      | -                      | Number of denoising steps for texture generation.                                                                      |
| `texSlatRescaleT`           | number  | No       | `3`      | 1    | 6       | -                      | Controls noise schedule sharpness for texture generation.                                                              |
| `meshScale`                 | number  | No       | `1`      | 0.1  | 4       | -                      | Scale factor applied to the inferred mesh.                                                                             |
| `maxNumTokens`              | number  | No       | `49152`  | 4096 | 131072  | -                      | Maximum number of high-resolution tokens used by the shape sampler. Higher values allow finer geometry.                |
| `decimationTarget`          | number  | No       | `200000` | 5000 | 2000000 | -                      | Target number of vertices in the final mesh. Lower values produce smaller files but less detail.                       |
| `generationResolution`      | number  | No       | `1536`   | -    | -       | `1024`, `1536`         | Internal geometry resolution for generation.                                                                           |
| `resolution`                | number  | No       | `4096`   | -    | -       | `1024`, `2048`, `4096` | Texture resolution for the generated 3D model.                                                                         |
| `remesh`                    | boolean | No       | `true`   | -    | -       | -                      | Rebuild the mesh topology for cleaner triangles.                                                                       |
| `seed`                      | number  | No       | -        | -    | -       | -                      | Random seed for reproducible results. Leave blank to use a random seed.                                                |

## Tencent Texture Edit

AI-powered texture editing for 3D models. Apply textures from text prompts or reference images to FBX models. Supports PBR (Physically Based Rendering) when using prompts.

**Model ID:** `model_tencent-texture-edit`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tencent-texture-edit/markdown>

| Parameter | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                    |
| --------- | ------ | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------------------------- |
| `file3d`  | file   | Yes      | -       | -   | -   | -              | Source 3D model file. Supported format: FBX. Maximum: 100,000 faces.                           |
| `image`   | file   | No       | -       | -   | -   | -              | Reference image for texture style. Resolution: 128-4096px. Cannot be used with texture prompt. |
| `prompt`  | string | No       | -       | -   | -   | -              | Texture description prompt. Cannot be used with reference image.                               |

## Tencent UV Unwrapping

AI-powered UV unwrapping for 3D models. Generates clean UV maps for FBX, OBJ, and GLB models with up to 30,000 faces.

**Model ID:** `model_tencent-uv-unwrapping`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tencent-uv-unwrapping/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                                  |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | -------------------------------------------- |
| `file3d`  | file | Yes      | -       | -   | -   | -              | Source 3D model file. Maximum: 30,000 faces. |
