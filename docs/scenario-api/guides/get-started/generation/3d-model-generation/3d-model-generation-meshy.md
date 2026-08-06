---
title: Meshy | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Meshy** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Meshy 6 - Multi Image to 3D](#meshy-6---multi-image-to-3d)
- [Meshy Animation](#meshy-animation)
- [Meshy Image-to-3D](#meshy-image-to-3d)
- [Meshy Remesh](#meshy-remesh)
- [Meshy Retexture](#meshy-retexture)
- [Meshy Rigging](#meshy-rigging)
- [Meshy T2 Smart Topology](#meshy-t2-smart-topology)
- [Meshy Text-to-3D](#meshy-text-to-3d)
- [Meshy UV Unwrap](#meshy-uv-unwrap)

---

## Meshy 6 - Multi Image to 3D

Meshy multi-view image-to-3D: combine 1–4 reference images (or a prior image task) into one 3D asset with optional PBR texturing.

**Model ID:** `model_meshy-multi-image-to-3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-multi-image-to-3d/markdown>

| Parameter              | Type        | Required | Default    | Min | Max    | Allowed Values        | Description                                                                                                                                                                                                                                                 |
| ---------------------- | ----------- | -------- | ---------- | --- | ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`                | file\_array | Yes      | -          | -   | -      | -                     | Provide 1–4 images from multiple angles for higher-quality 3D.                                                                                                                                                                                              |
| `aiModel`              | string      | No       | `meshy-6`  | -   | -      | `meshy-5`, `meshy-6`  | Meshy generation model. meshy-6 and latest use Meshy 6 pricing; meshy-5 uses standard pricing.                                                                                                                                                              |
| `shouldTexture`        | boolean     | No       | `true`     | -   | -      | -                     | Generate textures for a fully colored model. Disable for an untextured mesh (lower cost).                                                                                                                                                                   |
| `enablePbr`            | boolean     | No       | `false`    | -   | -      | -                     | Generate PBR maps (metallic, roughness, normal, emission) in addition to base color. Requires texture generation.                                                                                                                                           |
| `textureResolution`    | string      | No       | `2k`       | -   | -      | `2k`, `4k`, `8k`      | Base color texture resolution: 2K (2048), 4K (4096), or 8K (8192). 4K/8K take effect on Meshy 6; other models ignore them. At 8K, PBR maps are generated at 4K and no emission map is produced. 8K is only supported with triangle topology when remeshing. |
| `texturePrompt`        | string      | No       | -          | -   | -      | -                     | Optional text to guide texturing (max 600 characters).                                                                                                                                                                                                      |
| `textureImage`         | file        | No       | -          | -   | -      | -                     | Optional 2D image to guide texturing (.jpg, .jpeg, .png). Requires texture generation.                                                                                                                                                                      |
| `topology`             | string      | No       | `triangle` | -   | -      | `triangle`, `quad`    | Mesh topology for the generated model.                                                                                                                                                                                                                      |
| `targetPolycount`      | number      | No       | `30000`    | 100 | 300000 | -                     | Target polygon count; actual count may vary with geometry complexity.                                                                                                                                                                                       |
| `savePreRemeshedModel` | boolean     | No       | `false`    | -   | -      | -                     | Store the GLB before the remesh phase.                                                                                                                                                                                                                      |
| `poseMode`             | string      | No       | -          | -   | -      | “, `a-pose`, `t-pose` | Pose for the generated model: A-Pose, T-Pose, or none.                                                                                                                                                                                                      |
| `imageEnhancement`     | boolean     | No       | `true`     | -   | -      | -                     | Optimize input images. Supported on Meshy 6 only.                                                                                                                                                                                                           |
| `removeLighting`       | boolean     | No       | `true`     | -   | -      | -                     | Remove highlights and shadows from input images. Supported on Meshy 6 only.                                                                                                                                                                                 |
| `autoSize`             | boolean     | No       | `false`    | -   | -      | -                     | Estimate real-world scale for the generated model.                                                                                                                                                                                                          |
| `originAt`             | string      | No       | `bottom`   | -   | -      | `bottom`, `center`    | Place the model origin at the bottom or center.                                                                                                                                                                                                             |

## Meshy Animation

Animate a 3D character with Meshy. The model is rigged first, then animated with the selected action.

**Model ID:** `model_meshy-animation`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-animation/markdown>

| Parameter              | Type   | Required | Default | Min | Max | Allowed Values                      | Description                                                                                                                                                    |
| ---------------------- | ------ | -------- | ------- | --- | --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`                | file   | Yes      | -       | -   | -   | -                                   | The 3D character you want to animate. It’s automatically prepared with a skeleton first, then the chosen animation is applied.                                 |
| `heightMeters`         | number | No       | `1.7`   | 0.1 | 100 | -                                   | The character’s approximate real-world height in meters. This helps scale and prepare the model correctly.                                                     |
| `actionId`             | number | Yes      | `0`     | 0   | -   | -                                   | The animation to apply, given as its ID number from Meshy’s animation library. All action IDs available here: <https://docs.meshy.ai/en/api/animation-library> |
| `postProcessOperation` | string | No       | -       | -   | -   | “, `change_fps`, `extract_armature` | An optional extra step applied to the finished animation: change its frame rate.                                                                               |
| `postProcessFps`       | number | No       | `30`    | -   | -   | `24`, `25`, `30`, `60`              | The target frame rate, used only when the post-process step is set to Change FPS.                                                                              |

## Meshy Image-to-3D

**Model ID:** `model_meshy-img23d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-img23d/markdown>

| Parameter           | Type        | Required | Default    | Min | Max    | Allowed Values        | Description                                                                                                                                                                                                                                                                                 |
| ------------------- | ----------- | -------- | ---------- | --- | ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiModel`           | string      | No       | `latest`   | -   | -      | `meshy-5`, `latest`   | Meshy model to use.                                                                                                                                                                                                                                                                         |
| `image`             | file\_array | Yes      | -          | -   | -      | -                     | Upload one image to convert it into 3D, or provide up to four images from multiple angles for higher accuracy.                                                                                                                                                                              |
| `texturePrompt`     | string      | No       | -          | -   | -      | -                     | Provide a text description to guide the texturing process. The Style Prompt is only used when no Style Image is provided. If you upload an image, this text prompt will be ignored.                                                                                                         |
| `textureImage`      | file        | No       | -          | -   | -      | -                     | Upload a reference image to guide the visual style of the generated texture. This will override the Style Prompt. Requires the Texture setting to be enabled (toggle ON).                                                                                                                   |
| `shouldTexture`     | boolean     | No       | `true`     | -   | -      | -                     | Enable texture generation for a fully colored model. Disable to create a plain, untextured mesh.                                                                                                                                                                                            |
| `textureResolution` | string      | No       | `2k`       | -   | -      | `2k`, `4k`, `8k`      | Base color texture resolution: 2K (2048), 4K (4096), or 8K (8192). Requires Texture to be enabled. 4K/8K take effect on Meshy 6; other models ignore them. At 8K, PBR maps are generated at 4K and no emission map is produced. 8K is only supported with triangle topology when remeshing. |
| `topology`          | string      | No       | `triangle` | -   | -      | `triangle`, `quad`    | Choose the mesh structure type used for the generated model (e.g., triangles or quads).                                                                                                                                                                                                     |
| `enablePbr`         | boolean     | No       | `true`     | -   | -      | -                     | Generate advanced PBR maps (metallic, roughness, normal) for more realistic materials. Requires the Texture setting to be enabled (toggle ON).                                                                                                                                              |
| `poseMode`          | string      | No       | -          | -   | -      | “, `a-pose`, `t-pose` | Specify the pose mode for the generated model. Accepts ‘A-Pose’, ‘T-Pose’, or empty string (default).                                                                                                                                                                                       |
| `shouldRemesh`      | boolean     | No       | `false`    | -   | -      | -                     | Enable remeshing to improve mesh quality and control polycount. Disable to keep the raw, unprocessed mesh.                                                                                                                                                                                  |
| `targetPolycount`   | number      | No       | `30000`    | 100 | 300000 | -                     | Specify the target number of polygons in the generated model. The actual number of polygons may deviate from the target depending on the complexity of the geometry.                                                                                                                        |

## Meshy Remesh

**Model ID:** `model_meshy-remesh`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-remesh/markdown>

| Parameter         | Type   | Required | Default    | Min | Max    | Allowed Values              | Description                                                                                                                        |
| ----------------- | ------ | -------- | ---------- | --- | ------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `model`           | file   | Yes      | -          | -   | -      | -                           | Upload a GLB file of the 3D model you want to remesh.                                                                              |
| `topology`        | string | No       | `triangle` | -   | -      | `triangle`, `quad`          | Choose the mesh structure type used for the generated model. For Quad, choose output format ‘obj’                                  |
| `targetPolycount` | number | No       | `30000`    | 100 | 300000 | -                           | Set the approximate number of polygons for your 3D model. Higher values increase detail, while lower values create simpler meshes. |
| `resizeHeight`    | number | No       | `0`        | 0   | 10000  | -                           | Adjust the model’s height in meters. Set to 0 to keep the original scale.                                                          |
| `originAt`        | string | No       | `empty`    | -   | -      | `empty`, `bottom`, `center` | Define where the model’s origin point is positioned. Leave empty to keep the default origin.                                       |

## Meshy Retexture

Retexture your 3D model with Meshy’s AI re texturing capabilities.

**Model ID:** `model_meshy-retexture`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-retexture/markdown>

| Parameter           | Type    | Required | Default | Min | Max | Allowed Values   | Description                                                                                                                                                                                     |
| ------------------- | ------- | -------- | ------- | --- | --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`             | file    | Yes      | -       | -   | -   | -                | Upload a GLB file of the 3D model you want to retexture.                                                                                                                                        |
| `textStylePrompt`   | string  | No       | -       | -   | -   | -                | Describe your desired texture style of the object using text.                                                                                                                                   |
| `imageStyle`        | file    | No       | -       | -   | -   | -                | Provide a 2d image to guide the texturing process.                                                                                                                                              |
| `enablePbr`         | boolean | No       | `false` | -   | -   | -                | Generate PBR Maps (metallic, roughness, normal) in addition to the base color.                                                                                                                  |
| `textureResolution` | string  | No       | `2k`    | -   | -   | `2k`, `4k`, `8k` | Base color texture resolution: 2K (2048), 4K (4096), or 8K (8192). 4K/8K take effect on Meshy 6; other models ignore them. At 8K, PBR maps are generated at 4K and no emission map is produced. |
| `enableOriginalUv`  | boolean | No       | `true`  | -   | -   | -                | Use the model’s existing UV map instead of generating a new one. If no UVs are present, output quality may be lower.                                                                            |
| `removeLighting`    | boolean | No       | `true`  | -   | -   | -                | Removes highlights and shadows from the base color texture, producing a cleaner result that works better under custom lighting setups.                                                          |

## Meshy Rigging

**Model ID:** `model_meshy-rigging`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-rigging/markdown>

| Parameter      | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                                                       |
| -------------- | ------ | -------- | ------- | --- | --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `model`        | file   | Yes      | -       | -   | -   | -              | The 3D model (GLB)                                                                                                                |
| `heightMeters` | number | No       | `1.7`   | 0.1 | 100 | -              | The approximate height of the character model in meters. This aids in scaling and rigging accuracy. It must be a positive number. |
| `textureImage` | file   | No       | -       | -   | -   | -              | Model’s base color texture image.                                                                                                 |

## Meshy T2 Smart Topology

Meshy Smart Topology (meshy-t2) generates clean, production-ready 3D meshes from images in \~15s with native polycount control and separated parts — no remesh pass.

**Model ID:** `model_meshy-smart-topology`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-smart-topology/markdown>

| Parameter           | Type        | Required | Default | Min | Max   | Allowed Values        | Description                                                                                                                                                                                                 |
| ------------------- | ----------- | -------- | ------- | --- | ----- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`             | file\_array | Yes      | -       | -   | -     | -                     | Upload one image to turn into a 3D model, or up to four photos of the same subject from different angles for higher accuracy.                                                                               |
| `texturePrompt`     | string      | No       | -       | -   | -     | -                     | A text description to guide the model’s surface look. Used only when no Style Image is provided. If you upload one, this text is ignored.                                                                   |
| `textureImage`      | file        | No       | -       | -   | -     | -                     | A reference image to guide the surface look of the model. Overrides the Style Prompt. Requires Texture to be turned on.                                                                                     |
| `shouldTexture`     | boolean     | No       | `true`  | -   | -     | -                     | On, the model comes with a full colored surface; off, you get a plain, uncolored mesh.                                                                                                                      |
| `textureResolution` | string      | No       | `2k`    | -   | -     | `2k`, `4k`, `8k`      | Base color texture resolution: 2K (2048), 4K (4096), or 8K (8192). Requires Texture to be turned on. At 8K, PBR maps are generated at 4K and no emission map is produced.                                   |
| `enablePbr`         | boolean     | No       | `true`  | -   | -     | -                     | Adds realistic material detail, how metallic, rough, or bumpy the surface looks. Requires Texture to be turned on.                                                                                          |
| `poseMode`          | string      | No       | -       | -   | -     | “, `a-pose`, `t-pose` | For characters, generates the model in a standard reference pose. A-Pose (arms angled down) and T-Pose (arms straight out) are both common starting points for animation. Leave empty for no specific pose. |
| `targetPolycount`   | number      | No       | `4000`  | 100 | 15000 | -                     | The number of polygons (faces) in the model. More means finer detail and heavier files.                                                                                                                     |

## Meshy Text-to-3D

**Model ID:** `model_meshy-txt23d`

**Capabilities:** `txt23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-txt23d/markdown>

| Parameter           | Type    | Required | Default    | Min | Max    | Allowed Values        | Description                                                                                                                                                                                                                                                                      |
| ------------------- | ------- | -------- | ---------- | --- | ------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiModel`           | string  | No       | `latest`   | -   | -      | `meshy-5`, `latest`   | Meshy model to use.                                                                                                                                                                                                                                                              |
| `prompt`            | string  | Yes      | -          | -   | -      | -                     | Describe the object you want to generate as a 3D model.                                                                                                                                                                                                                          |
| `texturePrompt`     | string  | No       | -          | -   | -      | -                     | Provide a text description to guide the texturing process. The Style Prompt is only used when no Style Image is provided. If you upload an image, this text prompt will be ignored.                                                                                              |
| `textureImage`      | file    | No       | -          | -   | -      | -                     | Upload a reference image to guide the visual style of the generated texture. This will override the Style Prompt.                                                                                                                                                                |
| `topology`          | string  | No       | `triangle` | -   | -      | `triangle`, `quad`    | Choose the mesh structure type used for the generated model (e.g., triangles or quads).                                                                                                                                                                                          |
| `textureResolution` | string  | No       | `2k`       | -   | -      | `2k`, `4k`, `8k`      | Base color texture resolution for the refine phase: 2K (2048), 4K (4096), or 8K (8192). 4K/8K take effect on Meshy 6; other models ignore them. At 8K, PBR maps are generated at 4K and no emission map is produced. 8K is only supported with triangle topology when remeshing. |
| `enablePbr`         | boolean | No       | `true`     | -   | -      | -                     | Generate advanced PBR maps (metallic, roughness, normal) for more realistic materials.                                                                                                                                                                                           |
| `poseMode`          | string  | No       | -          | -   | -      | “, `a-pose`, `t-pose` | Specify the pose mode for the generated model. Accepts ‘a-pose’, ‘t-pose’, or empty string (default).                                                                                                                                                                            |
| `shouldRemesh`      | boolean | No       | `false`    | -   | -      | -                     | Enable remeshing to improve mesh quality and control polycount. Disable to keep the raw, unprocessed mesh.                                                                                                                                                                       |
| `targetPolycount`   | number  | No       | `30000`    | 100 | 300000 | -                     | Specify the target number of polygons in the generated model. The actual number of polygons may deviate from the target depending on the complexity of the geometry.                                                                                                             |
| `seed`              | number  | No       | -          | -   | -      | -                     | Seed for random number generator. If None, a random seed will be used.                                                                                                                                                                                                           |

## Meshy UV Unwrap

Generate UV maps for a 3D model with Meshy. Produces a UV white-model GLB ready for texturing.

**Model ID:** `model_meshy-uv-unwrap`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meshy-uv-unwrap/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                 |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`   | file | Yes      | -       | -   | -   | -              | Upload a GLB file of the 3D model you want to UV unwrap. Models above 44,000 faces are rejected — run Meshy Remesh first to reduce polygon count if needed. |
