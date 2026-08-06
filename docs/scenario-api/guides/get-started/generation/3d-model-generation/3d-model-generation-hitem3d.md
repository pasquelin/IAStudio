---
title: Hitem3D | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-30.

This reference lists all available **Hitem3D** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Sparc3D](#sparc3d)
- [Sparc3D 2.0](#sparc3d-20)
- [Sparc3D 2.0 Portrait](#sparc3d-20-portrait)
- [Sparc3D 2.1](#sparc3d-21)
- [Sparc3D 2.1 Portrait](#sparc3d-21-portrait)
- [Sparc3D Portrait](#sparc3d-portrait)

---

## Sparc3D

**Model ID:** `model_sparc3d`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sparc3d/markdown>

| Parameter     | Type        | Required | Default | Min | Max | Allowed Values                   | Description                                                                                                                                     |
| ------------- | ----------- | -------- | ------- | --- | --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`      | file\_array | Yes      | -       | -   | -   | -                                | Upload 1-4 images, starting with the front view. For multi-image input, you can optionally include back, left, and right views (in that order). |
| `requestType` | number      | No       | `3`     | -   | -   | `1`, `3`                         | Choose whether to generate just a mesh or a textured 3D asset                                                                                   |
| `resolution`  | string      | No       | `1024`  | -   | -   | `512`, `1024`, `1536`, `1536pro` | Controls the voxel resolution of the generated 3D asset. Higher values deliver more detail and cleaner topology.                                |

## Sparc3D 2.0

**Model ID:** `model_hitem-sparc-3d-2`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hitem-sparc-3d-2/markdown>

| Parameter     | Type        | Required | Default | Min | Max | Allowed Values    | Description                                                                                                                                     |
| ------------- | ----------- | -------- | ------- | --- | --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`      | file\_array | Yes      | -       | -   | -   | -                 | Upload 1-4 images, starting with the front view. For multi-image input, you can optionally include back, left, and right views (in that order). |
| `requestType` | number      | No       | `3`     | -   | -   | `1`, `3`          | Choose whether to generate just a mesh or a textured 3D asset                                                                                   |
| `resolution`  | string      | No       | `1536`  | -   | -   | `1536`, `1536pro` | Controls the voxel resolution of the generated 3D asset. Higher values deliver more detail and cleaner topology.                                |

## Sparc3D 2.0 Portrait

**Model ID:** `model_hitem-sparc-3d-portrait-2`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hitem-sparc-3d-portrait-2/markdown>

| Parameter     | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                     |
| ------------- | ----------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`      | file\_array | Yes      | -       | -   | -   | -              | Upload 1-4 images, starting with the front view. For multi-image input, you can optionally include back, left, and right views (in that order). |
| `requestType` | number      | No       | `3`     | -   | -   | `1`, `3`       | Choose whether to generate just a mesh or a textured 3D asset                                                                                   |

## Sparc3D 2.1

**Model ID:** `model_hitem-sparc-3d-2-1`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hitem-sparc-3d-2-1/markdown>

| Parameter     | Type        | Required | Default    | Min    | Max     | Allowed Values        | Description                                                                                                                                        |
| ------------- | ----------- | -------- | ---------- | ------ | ------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`      | file\_array | Yes      | -          | -      | -       | -                     | Upload 1-4 images, starting with the front view. For multi-image input, you can optionally include back, left, and right views (in that order).    |
| `requestType` | number      | No       | `3`        | -      | -       | `1`, `3`              | Choose whether to generate just a mesh or a textured 3D asset                                                                                      |
| `resolution`  | string      | No       | `1536fast` | -      | -       | `1536fast`, `1536pro` | 1536³ Fast balances speed and quality. 1536³ Pro maximizes detail and topology quality.                                                            |
| `face`        | number      | No       | `2000000`  | 100000 | 2000000 | -                     | Sets the target number of mesh faces. Higher counts yield more complex geometry. Use 500K for lightweight assets, or 2M for high-fidelity results. |
| `pbr`         | boolean     | No       | `true`     | -      | -       | -                     | Generate a PBR material                                                                                                                            |

## Sparc3D 2.1 Portrait

**Model ID:** `model_hitem-sparc-3d-portrait-2-1`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_hitem-sparc-3d-portrait-2-1/markdown>

| Parameter     | Type        | Required | Default   | Min    | Max     | Allowed Values           | Description                                                                                                                                        |
| ------------- | ----------- | -------- | --------- | ------ | ------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`      | file\_array | Yes      | -         | -      | -       | -                        | Upload 1-4 images, starting with the front view. For multi-image input, you can optionally include back, left, and right views (in that order).    |
| `requestType` | number      | No       | `3`       | -      | -       | `1`, `3`                 | Choose whether to generate just a mesh or a textured 3D asset                                                                                      |
| `resolution`  | string      | No       | `1536pro` | -      | -       | `1536profast`, `1536pro` | 1536³ Pro Fast balances speed and quality for portrait subjects. 1536³ Pro maximizes detail.                                                       |
| `face`        | number      | No       | `2000000` | 100000 | 2000000 | -                        | Sets the target number of mesh faces. Higher counts yield more complex geometry. Use 500K for lightweight assets, or 2M for high-fidelity results. |
| `pbr`         | boolean     | No       | `true`    | -      | -       | -                        | Generate a PBR material                                                                                                                            |

## Sparc3D Portrait

**Model ID:** `model_sparc3d-portrait`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sparc3d-portrait/markdown>

| Parameter     | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                     |
| ------------- | ----------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`      | file\_array | Yes      | -       | -   | -   | -              | Upload 1-4 images, starting with the front view. For multi-image input, you can optionally include back, left, and right views (in that order). |
| `requestType` | number      | No       | `3`     | -   | -   | `1`, `3`       | Choose whether to generate just a mesh or a textured 3D asset                                                                                   |
