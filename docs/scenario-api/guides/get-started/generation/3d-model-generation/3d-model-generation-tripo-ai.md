---
title: Tripo AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Tripo AI** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Tripo 3.0](#tripo-30)
- [Tripo 3.0 Multi View](#tripo-30-multi-view)
- [Tripo 3.0 Texturing](#tripo-30-texturing)
- [Tripo 3.1](#tripo-31)
- [Tripo 3.1 Multi View](#tripo-31-multi-view)
- [Tripo P1](#tripo-p1)
- [Tripo P1 Multi View](#tripo-p1-multi-view)
- [Tripo Retopology](#tripo-retopology)
- [Tripo Rigging v1](#tripo-rigging-v1)
- [Tripo Rigging v2.5](#tripo-rigging-v25)
- [Tripo Segmentation v1](#tripo-segmentation-v1)
- [Tripo Segmentation v2](#tripo-segmentation-v2)
- [Tripo Stylization](#tripo-stylization)

---

## Tripo 3.0

Tripo V3.0 Image to 3D model.

**Model ID:** `model_tripo-v3-0-image-to-3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-v3-0-image-to-3d/markdown>

| Parameter          | Type    | Required | Default          | Min | Max | Allowed Values                    | Description                                                                                                                                                                                                                               |
| ------------------ | ------- | -------- | ---------------- | --- | --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`            | file    | Yes      | -                | -   | -   | -                                 | Single image for image-to-model.                                                                                                                                                                                                          |
| `texture`          | boolean | No       | `true`           | -   | -   | -                                 | Enable texturing. Set to false for a model without textures.                                                                                                                                                                              |
| `textureQuality`   | string  | No       | `standard`       | -   | -   | `standard`, `detailed`, `extreme` | Texture quality level. ‘Detailed’ gives HD quality textures.                                                                                                                                                                              |
| `textureAlignment` | string  | No       | `original_image` | -   | -   | `original_image`, `geometry`      | Determines the prioritization of texture alignment in the 3D model.                                                                                                                                                                       |
| `geometryQuality`  | string  | No       | `standard`       | -   | -   | `standard`, `detailed`            | Geometry quality level. ‘Detailed’ gives HD quality geometry.                                                                                                                                                                             |
| `textureSeed`      | number  | No       | -                | -   | -   | -                                 | Random seed for texture generation. Using the same seed will produce identical textures.                                                                                                                                                  |
| `orientation`      | string  | No       | `default`        | -   | -   | `default`, `align_image`          | Set orientation to ‘Align Image’ will automatically rotate the model to align the original image.                                                                                                                                         |
| `pbr`              | boolean | No       | `true`           | -   | -   | -                                 | Enable PBR generation. Default value is True. If this option is set to True, texture parameters will be ignored.                                                                                                                          |
| `faceLimit`        | number  | No       | -                | -   | -   | -                                 | Maximum face count. Adaptive if unset. With Smart Low Poly: 1,000–20,000 (500–10,000 if Quad is also enabled). Otherwise capped at 1,500,000 (standard geometry) or 2,000,000 (detailed geometry). Quad alone caps face limit at 150,000. |
| `autoSize`         | boolean | No       | `false`          | -   | -   | -                                 | Automatically scale the model to real-world dimensions, with the unit in meters.                                                                                                                                                          |
| `quad`             | boolean | No       | `false`          | -   | -   | -                                 | Enable quad mesh output (FBX format). When Smart Low Poly is off, face limit is capped at 150,000. When Smart Low Poly is on and Face Limit is unset, defaults to 10,000.                                                                 |
| `smartLowPoly`     | boolean | No       | `false`          | -   | -   | -                                 | Generate hand-crafted low-poly topology. When enabled and Face Limit is set: 1,000–20,000 (500–10,000 if Quad is also enabled).                                                                                                           |
| `generateParts`    | boolean | No       | `false`          | -   | -   | -                                 | Generate segmented 3D model parts. Incompatible with texture, pbr, and quad.                                                                                                                                                              |
| `seed`             | number  | No       | -                | -   | -   | -                                 | Random seed for model generation. The seed controls the geometry generation process, ensuring identical models when the same seed is used.                                                                                                |

## Tripo 3.0 Multi View

Tripo V3.0 Multiview (front + left/back/right) to 3D model.

**Model ID:** `model_tripo-v3-0-multiview-to-3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-v3-0-multiview-to-3d/markdown>

| Parameter          | Type    | Required | Default          | Min | Max | Allowed Values                    | Description                                                                                                                                                                                                                               |
| ------------------ | ------- | -------- | ---------------- | --- | --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontImage`       | file    | Yes      | -                | -   | -   | -                                 | Front view image (0 deg). Required for multiview mode. Provide with at least one of left, back, right.                                                                                                                                    |
| `leftImage`        | file    | No       | -                | -   | -   | -                                 | Left view image (90 deg — character’s left arm side).                                                                                                                                                                                     |
| `backImage`        | file    | No       | -                | -   | -   | -                                 | Back view image (180 deg).                                                                                                                                                                                                                |
| `rightImage`       | file    | No       | -                | -   | -   | -                                 | Right view image (270 deg).                                                                                                                                                                                                               |
| `texture`          | boolean | No       | `true`           | -   | -   | -                                 | Enable texturing. Set to false for a model without textures.                                                                                                                                                                              |
| `textureQuality`   | string  | No       | `standard`       | -   | -   | `standard`, `detailed`, `extreme` | Texture quality level. ‘Detailed’ gives HD quality textures.                                                                                                                                                                              |
| `textureAlignment` | string  | No       | `original_image` | -   | -   | `original_image`, `geometry`      | Determines the prioritization of texture alignment in the 3D model.                                                                                                                                                                       |
| `geometryQuality`  | string  | No       | `standard`       | -   | -   | `standard`, `detailed`            | Geometry quality level. ‘Detailed’ gives HD quality geometry.                                                                                                                                                                             |
| `textureSeed`      | number  | No       | -                | -   | -   | -                                 | Random seed for texture generation. Using the same seed will produce identical textures.                                                                                                                                                  |
| `orientation`      | string  | No       | `default`        | -   | -   | `default`, `align_image`          | Set orientation to ‘Align Image’ will automatically rotate the model to align the original image.                                                                                                                                         |
| `pbr`              | boolean | No       | `true`           | -   | -   | -                                 | Enable PBR generation. Default value is True. If this option is set to True, texture parameters will be ignored.                                                                                                                          |
| `faceLimit`        | number  | No       | -                | -   | -   | -                                 | Maximum face count. Adaptive if unset. With Smart Low Poly: 1,000–20,000 (500–10,000 if Quad is also enabled). Otherwise capped at 1,500,000 (standard geometry) or 2,000,000 (detailed geometry). Quad alone caps face limit at 150,000. |
| `autoSize`         | boolean | No       | `false`          | -   | -   | -                                 | Automatically scale the model to real-world dimensions, with the unit in meters.                                                                                                                                                          |
| `quad`             | boolean | No       | `false`          | -   | -   | -                                 | Enable quad mesh output (FBX format). When Smart Low Poly is off, face limit is capped at 150,000. When Smart Low Poly is on and Face Limit is unset, defaults to 10,000.                                                                 |
| `smartLowPoly`     | boolean | No       | `false`          | -   | -   | -                                 | Generate hand-crafted low-poly topology. When enabled and Face Limit is set: 1,000–20,000 (500–10,000 if Quad is also enabled).                                                                                                           |
| `generateParts`    | boolean | No       | `false`          | -   | -   | -                                 | Generate segmented 3D model parts. Incompatible with texture, pbr, and quad.                                                                                                                                                              |
| `seed`             | number  | No       | -                | -   | -   | -                                 | Random seed for model generation. The seed controls the geometry generation process, ensuring identical models when the same seed is used.                                                                                                |

## Tripo 3.0 Texturing

Tripo V3.0 Texture service - texture existing 3D models with text prompts, image prompts, or multiview images. Supports standard/HD quality and style reference.

**Model ID:** `model_tripo-v3-0-texturing`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-v3-0-texturing/markdown>

| Parameter          | Type    | Required | Default          | Min | Max | Allowed Values                    | Description                                                                                                   |
| ------------------ | ------- | -------- | ---------------- | --- | --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `model`            | file    | Yes      | -                | -   | -   | -                                 | Source 3D model.                                                                                              |
| `pbr`              | boolean | No       | `false`          | -   | -   | -                                 | PBR generates material maps (albedo, metallic, roughness, normal). When enabled, texture options are ignored. |
| `textureQuality`   | string  | No       | `standard`       | -   | -   | `standard`, `detailed`, `extreme` | Texture quality level. ‘Detailed’ gives HD quality textures.                                                  |
| `textureAlignment` | string  | No       | `original_image` | -   | -   | `original_image`, `geometry`      | Texture alignment strategy.                                                                                   |
| `textureSeed`      | number  | No       | -                | -   | -   | -                                 | Random seed for texture generation.                                                                           |
| `prompt`           | string  | No       | -                | -   | -   | -                                 | Text description for texture generation. Mutually exclusive with image prompt and multiview images.           |
| `imagePrompt`      | file    | No       | -                | -   | -   | -                                 | Single image used as texture prompt. Mutually exclusive with text prompt.                                     |
| `styleImage`       | file    | No       | -                | -   | -   | -                                 | Reference image for artistic style. Requires prompt or image prompt to also be set.                           |
| `bake`             | boolean | No       | `true`           | -   | -   | -                                 | Bake textures onto the model.                                                                                 |

## Tripo 3.1

Tripo V3.1 Image to 3D model.

**Model ID:** `model_tripo-v3-1-image-to-3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-v3-1-image-to-3d/markdown>

| Parameter          | Type    | Required | Default          | Min | Max | Allowed Values                    | Description                                                                                                                                                                                                                               |
| ------------------ | ------- | -------- | ---------------- | --- | --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`            | file    | Yes      | -                | -   | -   | -                                 | Single image for image-to-model.                                                                                                                                                                                                          |
| `texture`          | boolean | No       | `true`           | -   | -   | -                                 | Enable texturing. Set to false for a model without textures.                                                                                                                                                                              |
| `textureQuality`   | string  | No       | `standard`       | -   | -   | `standard`, `detailed`, `extreme` | Texture quality level. ‘Detailed’ gives HD quality textures.                                                                                                                                                                              |
| `textureAlignment` | string  | No       | `original_image` | -   | -   | `original_image`, `geometry`      | Determines the prioritization of texture alignment in the 3D model.                                                                                                                                                                       |
| `geometryQuality`  | string  | No       | `standard`       | -   | -   | `standard`, `detailed`            | Geometry quality level. ‘Detailed’ gives HD quality geometry.                                                                                                                                                                             |
| `textureSeed`      | number  | No       | -                | -   | -   | -                                 | Random seed for texture generation. Using the same seed will produce identical textures.                                                                                                                                                  |
| `orientation`      | string  | No       | `default`        | -   | -   | `default`, `align_image`          | Set orientation to ‘Align Image’ will automatically rotate the model to align the original image.                                                                                                                                         |
| `pbr`              | boolean | No       | `true`           | -   | -   | -                                 | Enable PBR generation. Default value is True. If this option is set to True, texture parameters will be ignored.                                                                                                                          |
| `faceLimit`        | number  | No       | -                | -   | -   | -                                 | Maximum face count. Adaptive if unset. With Smart Low Poly: 1,000–20,000 (500–10,000 if Quad is also enabled). Otherwise capped at 1,500,000 (standard geometry) or 2,000,000 (detailed geometry). Quad alone caps face limit at 150,000. |
| `autoSize`         | boolean | No       | `false`          | -   | -   | -                                 | Automatically scale the model to real-world dimensions, with the unit in meters.                                                                                                                                                          |
| `quad`             | boolean | No       | `false`          | -   | -   | -                                 | Enable quad mesh output (FBX format). When Smart Low Poly is off, face limit is capped at 150,000. When Smart Low Poly is on and Face Limit is unset, defaults to 10,000.                                                                 |
| `smartLowPoly`     | boolean | No       | `false`          | -   | -   | -                                 | Generate hand-crafted low-poly topology. When enabled and Face Limit is set: 1,000–20,000 (500–10,000 if Quad is also enabled).                                                                                                           |
| `generateParts`    | boolean | No       | `false`          | -   | -   | -                                 | Generate segmented 3D model parts. Incompatible with texture, pbr, and quad.                                                                                                                                                              |
| `seed`             | number  | No       | -                | -   | -   | -                                 | Random seed for model generation. The seed controls the geometry generation process, ensuring identical models when the same seed is used.                                                                                                |

## Tripo 3.1 Multi View

Tripo V3.1 Multiview (front + left/back/right) to 3D model.

**Model ID:** `model_tripo-v3-1-multiview-to-3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-v3-1-multiview-to-3d/markdown>

| Parameter          | Type    | Required | Default          | Min | Max | Allowed Values                    | Description                                                                                                                                                                                                                               |
| ------------------ | ------- | -------- | ---------------- | --- | --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontImage`       | file    | Yes      | -                | -   | -   | -                                 | Front view image (0 deg). Required for multiview mode. Provide with at least one of left, back, right.                                                                                                                                    |
| `leftImage`        | file    | No       | -                | -   | -   | -                                 | Left view image (90 deg — character’s left arm side).                                                                                                                                                                                     |
| `backImage`        | file    | No       | -                | -   | -   | -                                 | Back view image (180 deg).                                                                                                                                                                                                                |
| `rightImage`       | file    | No       | -                | -   | -   | -                                 | Right view image (270 deg).                                                                                                                                                                                                               |
| `texture`          | boolean | No       | `true`           | -   | -   | -                                 | Enable texturing. Set to false for a model without textures.                                                                                                                                                                              |
| `textureQuality`   | string  | No       | `standard`       | -   | -   | `standard`, `detailed`, `extreme` | Texture quality level. ‘Detailed’ gives HD quality textures.                                                                                                                                                                              |
| `textureAlignment` | string  | No       | `original_image` | -   | -   | `original_image`, `geometry`      | Determines the prioritization of texture alignment in the 3D model.                                                                                                                                                                       |
| `geometryQuality`  | string  | No       | `standard`       | -   | -   | `standard`, `detailed`            | Geometry quality level. ‘Detailed’ gives HD quality geometry.                                                                                                                                                                             |
| `textureSeed`      | number  | No       | -                | -   | -   | -                                 | Random seed for texture generation. Using the same seed will produce identical textures.                                                                                                                                                  |
| `orientation`      | string  | No       | `default`        | -   | -   | `default`, `align_image`          | Set orientation to ‘Align Image’ will automatically rotate the model to align the original image.                                                                                                                                         |
| `pbr`              | boolean | No       | `true`           | -   | -   | -                                 | Enable PBR generation. Default value is True. If this option is set to True, texture parameters will be ignored.                                                                                                                          |
| `faceLimit`        | number  | No       | -                | -   | -   | -                                 | Maximum face count. Adaptive if unset. With Smart Low Poly: 1,000–20,000 (500–10,000 if Quad is also enabled). Otherwise capped at 1,500,000 (standard geometry) or 2,000,000 (detailed geometry). Quad alone caps face limit at 150,000. |
| `autoSize`         | boolean | No       | `false`          | -   | -   | -                                 | Automatically scale the model to real-world dimensions, with the unit in meters.                                                                                                                                                          |
| `quad`             | boolean | No       | `false`          | -   | -   | -                                 | Enable quad mesh output (FBX format). When Smart Low Poly is off, face limit is capped at 150,000. When Smart Low Poly is on and Face Limit is unset, defaults to 10,000.                                                                 |
| `smartLowPoly`     | boolean | No       | `false`          | -   | -   | -                                 | Generate hand-crafted low-poly topology. When enabled and Face Limit is set: 1,000–20,000 (500–10,000 if Quad is also enabled).                                                                                                           |
| `generateParts`    | boolean | No       | `false`          | -   | -   | -                                 | Generate segmented 3D model parts. Incompatible with texture, pbr, and quad.                                                                                                                                                              |
| `seed`             | number  | No       | -                | -   | -   | -                                 | Random seed for model generation. The seed controls the geometry generation process, ensuring identical models when the same seed is used.                                                                                                |

## Tripo P1

Tripo P1.0 production-grade native 3D diffusion model. Generates engine-ready assets directly in 3D space with clean topology and stable geometry.

**Model ID:** `model_tripo-p1-image-to-3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-p1-image-to-3d/markdown>

| Parameter            | Type    | Required | Default          | Min | Max   | Allowed Values                    | Description                                                                                                                                                                                                                                                                             |
| -------------------- | ------- | -------- | ---------------- | --- | ----- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`              | file    | Yes      | -                | -   | -     | -                                 | Single image for image-to-model.                                                                                                                                                                                                                                                        |
| `texture`            | boolean | No       | `true`           | -   | -     | -                                 | Enable texturing. Set to false for a model without textures.                                                                                                                                                                                                                            |
| `textureQuality`     | string  | No       | `standard`       | -   | -     | `standard`, `detailed`, `extreme` | Texture quality level. ‘Detailed’ gives HD quality textures.                                                                                                                                                                                                                            |
| `textureAlignment`   | string  | No       | `original_image` | -   | -     | `original_image`, `geometry`      | Determines the prioritization of texture alignment in the 3D model. Original Image: prioritizes visual fidelity to the source image (may have minor 3D inconsistencies). Geometry: prioritizes 3D structural accuracy (may cause slight deviations from the original image appearance). |
| `textureSeed`        | number  | No       | -                | -   | -     | -                                 | Random seed for texture generation. Using the same seed will produce identical textures.                                                                                                                                                                                                |
| `orientation`        | string  | No       | `default`        | -   | -     | `default`, `align_image`          | Set to ‘Align Image’ to automatically rotate the model to align the original image.                                                                                                                                                                                                     |
| `enableImageAutofix` | boolean | No       | `false`          | -   | -     | -                                 | When enabled, optimizes the input image to get better generation results.                                                                                                                                                                                                               |
| `pbr`                | boolean | No       | `true`           | -   | -     | -                                 | Enable PBR generation. Default value is True. If this option is set to True, texture parameters will be ignored.                                                                                                                                                                        |
| `faceLimit`          | number  | No       | -                | 48  | 20000 | -                                 | Maximum face count. Adaptive if unset. Must be between 48 and 20,000 if set.                                                                                                                                                                                                            |
| `autoSize`           | boolean | No       | `false`          | -   | -     | -                                 | Automatically scale the model to real-world dimensions, with the unit in meters.                                                                                                                                                                                                        |
| `seed`               | number  | No       | -                | -   | -     | -                                 | Random seed for model generation. The seed controls the geometry generation process, ensuring identical models when the same seed is used.                                                                                                                                              |

## Tripo P1 Multi View

Tripo P1.0 Multiview (front + left/back/right) to 3D model. Production-grade native 3D diffusion with clean topology.

**Model ID:** `model_tripo-p1-multiview-to-3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-p1-multiview-to-3d/markdown>

| Parameter          | Type    | Required | Default          | Min | Max   | Allowed Values                    | Description                                                                                                                                |
| ------------------ | ------- | -------- | ---------------- | --- | ----- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontImage`       | file    | Yes      | -                | -   | -     | -                                 | Front view image (0 deg). Required for multiview mode. Provide with at least one of left, back, right.                                     |
| `leftImage`        | file    | No       | -                | -   | -     | -                                 | Left view image (90 deg — character’s left arm side).                                                                                      |
| `backImage`        | file    | No       | -                | -   | -     | -                                 | Back view image (180 deg).                                                                                                                 |
| `rightImage`       | file    | No       | -                | -   | -     | -                                 | Right view image (270 deg).                                                                                                                |
| `texture`          | boolean | No       | `true`           | -   | -     | -                                 | Enable texturing. Set to false for a model without textures.                                                                               |
| `textureQuality`   | string  | No       | `standard`       | -   | -     | `standard`, `detailed`, `extreme` | Texture quality level. ‘Detailed’ gives HD quality textures.                                                                               |
| `textureAlignment` | string  | No       | `original_image` | -   | -     | `original_image`, `geometry`      | Determines the prioritization of texture alignment in the 3D model.                                                                        |
| `textureSeed`      | number  | No       | -                | -   | -     | -                                 | Random seed for texture generation. Using the same seed will produce identical textures.                                                   |
| `orientation`      | string  | No       | `default`        | -   | -     | `default`, `align_image`          | Set orientation to ‘Align Image’ will automatically rotate the model to align the original image.                                          |
| `pbr`              | boolean | No       | `true`           | -   | -     | -                                 | Enable PBR generation. Default value is True. If this option is set to True, texture parameters will be ignored.                           |
| `faceLimit`        | number  | No       | -                | 48  | 20000 | -                                 | Maximum face count. Adaptive if unset. Must be between 48 and 20,000 if set.                                                               |
| `autoSize`         | boolean | No       | `false`          | -   | -     | -                                 | Automatically scale the model to real-world dimensions, with the unit in meters.                                                           |
| `seed`             | number  | No       | -                | -   | -     | -                                 | Random seed for model generation. The seed controls the geometry generation process, ensuring identical models when the same seed is used. |

## Tripo Retopology

Tripo SmartLowpoly - Convert high-poly 3D meshes to clean low-poly with optional quad output.

**Model ID:** `model_tripo-retopology`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-retopology/markdown>

| Parameter   | Type    | Required | Default | Min  | Max   | Allowed Values | Description                                                                      |
| ----------- | ------- | -------- | ------- | ---- | ----- | -------------- | -------------------------------------------------------------------------------- |
| `model`     | file    | Yes      | -       | -    | -     | -              | Source 3D model.                                                                 |
| `faceLimit` | number  | No       | -       | 1000 | 20000 | -              | Target face count. Adaptive if not set. Must be between 1,000 and 20,000 if set. |
| `quad`      | boolean | No       | `false` | -    | -     | -              | Output quad faces instead of triangles.                                          |
| `bake`      | boolean | No       | `true`  | -    | -     | -              | Bake textures onto lowpoly mesh.                                                 |

## Tripo Rigging v1

Tripo Rigging v1.0 - Rig 3D models with optional animation retargeting. 100+ biped animations.

**Model ID:** `model_tripo-rigging-v1`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-rigging-v1/markdown>

| Parameter            | Type    | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                                                       | Description                                                                                                                                    |
| -------------------- | ------- | -------- | ------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`              | file    | Yes      | -       | -   | -   | -                                                                                                                                                                                                                                                    | Source 3D file. Supported formats: GLB, OBJ, FBX, STL.                                                                                         |
| `rigType`            | string  | No       | `biped` | -   | -   | `biped`, `quadruped`, `hexapod`, `octopod`, `avian`, `serpentine`, `aquatic`, `others`                                                                                                                                                               | Skeleton type for rigging.                                                                                                                     |
| `animation`          | string  | No       | -       | -   | -   | “, `biped:idle`, `biped:walk`, `biped:run`, `biped:dive`, `biped:climb`, `biped:jump`, `biped:slash`, `biped:shoot`, `biped:hurt`, `biped:fall`, `biped:turn`, `quadruped:walk`, `hexapod:walk`, `octopod:walk`, `serpentine:march`, `aquatic:march` | Animation to retarget (e.g. biped:walk, biped:dance\_01, quadruped:walk). Leave empty for rigging only. 100+ biped animations available in v1. |
| `includeRiggedModel` | boolean | No       | `false` | -   | -   | -                                                                                                                                                                                                                                                    | Include the rigged model (without animations) in output. When animation is set, only retarget file is returned by default.                     |

## Tripo Rigging v2.5

Tripo Rigging v2.5 - Rig 3D models with optional animation retargeting. Recommended for non-biped rigs.

**Model ID:** `model_tripo-rigging-v2-5`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-rigging-v2-5/markdown>

| Parameter            | Type    | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                                                       | Description                                                                                                                |
| -------------------- | ------- | -------- | ------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `model`              | file    | Yes      | -       | -   | -   | -                                                                                                                                                                                                                                                    | Source 3D file. Supported formats: GLB, OBJ, FBX, STL.                                                                     |
| `rigType`            | string  | No       | `biped` | -   | -   | `biped`, `quadruped`, `hexapod`, `octopod`, `avian`, `serpentine`, `aquatic`, `others`                                                                                                                                                               | Skeleton type for rigging.                                                                                                 |
| `animation`          | string  | No       | -       | -   | -   | “, `biped:idle`, `biped:walk`, `biped:run`, `biped:dive`, `biped:climb`, `biped:jump`, `biped:slash`, `biped:shoot`, `biped:hurt`, `biped:fall`, `biped:turn`, `quadruped:walk`, `hexapod:walk`, `octopod:walk`, `serpentine:march`, `aquatic:march` | Animation to retarget (e.g. biped:walk, biped:run, quadruped:walk). Leave empty for rigging only.                          |
| `includeRiggedModel` | boolean | No       | `false` | -   | -   | -                                                                                                                                                                                                                                                    | Include the rigged model (without animations) in output. When animation is set, only retarget file is returned by default. |

## Tripo Segmentation v1

Tripo Mesh Segment v1.0 - Geometry-based segmentation of uploaded 3D meshes into parts.

**Model ID:** `model_tripo-segmentation-v1`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-segmentation-v1/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                                                      |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------- |
| `model`   | file | Yes      | -       | -   | -   | -              | The 3D model you want to split into parts. Max file size: 150MB. |

## Tripo Segmentation v2

Tripo Mesh Segment v2.0 - Semantic segmentation of uploaded 3D meshes into parts, with optional reference image guidance.

**Model ID:** `model_tripo-segmentation-v2`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-segmentation-v2/markdown>

| Parameter                 | Type    | Required | Default    | Min | Max | Allowed Values                   | Description                                                                                                                                                                                 |
| ------------------------- | ------- | -------- | ---------- | --- | --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`                   | file    | Yes      | -          | -   | -   | -                                | The 3D model you want to split into parts. Max file size: 150MB.                                                                                                                            |
| `segmentationGranularity` | string  | No       | `balanced` | -   | -   | `simple`, `balanced`, `detailed` | How finely to divide the model into parts. Simple gives a few large parts; Detailed breaks it into many smaller ones; Balanced sits between. Overridden when a reference image is provided. |
| `splitByConnectivity`     | boolean | No       | `true`     | -   | -   | -                                | Also separates pieces that aren’t physically joined, treating each disconnected chunk as its own part. On by default.                                                                       |
| `image`                   | file    | No       | -          | -   | -   | -                                | An optional image to guide how the model is divided into meaningful parts. When provided, it takes over from the Granularity setting.                                                       |

## Tripo Stylization

Tripo Stylization - Apply LEGO, voxel or Voronoi style to 3D models.

**Model ID:** `model_tripo-stylization`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_tripo-stylization/markdown>

| Parameter | Type   | Required | Default | Min | Max | Allowed Values             | Description                |
| --------- | ------ | -------- | ------- | --- | --- | -------------------------- | -------------------------- |
| `model`   | file   | Yes      | -       | -   | -   | -                          | Source 3D model.           |
| `style`   | string | Yes      | `lego`  | -   | -   | `lego`, `voxel`, `voronoi` | Stylization type to apply. |
