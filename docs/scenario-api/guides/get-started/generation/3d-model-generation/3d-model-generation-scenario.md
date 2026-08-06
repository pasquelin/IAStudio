---
title: Scenario | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Scenario** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Scenario Voxels](#scenario-voxels)

---

## Scenario Voxels

**Model ID:** `model_scenario-voxels`

**Capabilities:** `txt23d`, `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-voxels/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values | Description                               |
| ----------------- | ----------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -   | -              | Text prompt for voxel generation          |
| `referenceImages` | file\_array | No       | -       | -   | -   | -              | List of input images for voxel generation |
| `width`           | number      | No       | `32`    | 16  | 256 | -              | Width of the voxel grid                   |
| `height`          | number      | No       | `32`    | 16  | 256 | -              | Height of the voxel grid                  |
| `depth`           | number      | No       | `32`    | 16  | 256 | -              | Depth of the voxel grid                   |
