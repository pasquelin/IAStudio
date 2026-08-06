---
title: Meta | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Meta** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [SAM3D Align](#sam3d-align)
- [SAM3D Body](#sam3d-body)
- [SAM3D Objects](#sam3d-objects)

---

## SAM3D Align

Align SAM-3D Body mesh with the original image using Meta’s SAM 3D Align. Aligns body meshes with images for accurate 3D reconstruction.

**Model ID:** `model_meta-sam-3d-align`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meta-sam-3d-align/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                   |
| ------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------- |
| `image`       | file   | Yes      | -       | -   | -   | -              | Original image used for MoGe depth estimation                                 |
| `bodyMesh`    | file   | Yes      | -       | -   | -   | -              | SAM-3D Body mesh file to align                                                |
| `bodyMask`    | file   | No       | -       | -   | -   | -              | The human mask image. If not provided, uses full image.                       |
| `objectMesh`  | file   | No       | -       | -   | -   | -              | Optional SAM-3D Object mesh (.glb) to create combined scene                   |
| `focalLength` | number | No       | -       | 0   | -   | -              | Focal length from SAM-3D Body metadata. If not provided, estimated from MoGe. |

## SAM3D Body

Generate 3D body meshes from images using Meta’s SAM (Segment Anything Model) 3D Body. Extract and reconstruct human bodies from images as 3D models.

**Model ID:** `model_meta-sam-3d-body`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meta-sam-3d-body/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                             |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | --------------------------------------- |
| `image`   | file | Yes      | -       | -   | -   | -              | Input image to extract body meshes from |

## SAM3D Objects

Generate 3D objects from images using Meta’s SAM (Segment Anything Model) 3D Objects. Extract objects from images and convert them to 3D models.

**Model ID:** `model_meta-sam-3d-objects`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meta-sam-3d-objects/markdown>

| Parameter      | Type          | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                                                                                                                              |
| -------------- | ------------- | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`        | file          | Yes      | -       | -   | -   | -              | Input image to extract objects from                                                                                                                                                                                                                                                      |
| `prompt`       | string        | No       | -       | -   | -   | -              | Short noun phrase selecting the object to reconstruct when no masks are provided (e.g., ‘chair’, ‘wooden lamp’, ‘ceramic vase’). Use a noun phrase, not a full sentence: prompts are capped at 120 characters (about 20 words). Leave blank to use point/box prompts or the whole image. |
| `mask`         | file\_array   | No       | -       | -   | -   | -              | Optional list of mask URLs (one per object). If not provided, use prompt/point\_prompts/box\_prompts to auto-segment, or entire image will be used.                                                                                                                                      |
| `pointPrompts` | inputs\_array | No       | -       | -   | -   | -              | Point prompts for auto-segmentation when no masks provided. JSON array of objects with ‘x’, ‘y’, and optional ‘object\_id’ fields.                                                                                                                                                       |
| `boxPrompts`   | inputs\_array | No       | -       | -   | -   | -              | Box prompts for auto-segmentation when no masks provided. JSON array of objects with ‘x1’, ‘y1’, ‘x2’, ‘y2’, and optional ‘object\_id’ fields.                                                                                                                                           |
| `seed`         | number        | No       | -       | 0   | -   | -              | Random seed. Leave blank to randomize the seed                                                                                                                                                                                                                                           |
