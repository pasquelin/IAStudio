---
title: Vast AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Vast AI** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [TripoSplat](#triposplat)

---

## TripoSplat

Generate a 3D Gaussian splat from a single image with TripoSplat. Returns a compact .spz splat for fast preview, with the original .ply available to download.

**Model ID:** `model_vast-ai-triposplat`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vast-ai-triposplat/markdown>

| Parameter       | Type   | Required | Default  | Min   | Max        | Allowed Values | Description                                                                                                                                                                                                                                                                |
| --------------- | ------ | -------- | -------- | ----- | ---------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`         | file   | Yes      | -        | -     | -          | -              | A single, clear photo of ONE object (e.g. a product shot). The background is removed automatically — avoid scenes, clutter, or multiple objects. The model infers the object’s unseen sides from this one view, so a well-framed, unambiguous angle gives the best result. |
| `numGaussians`  | number | No       | `262144` | 32768 | 262144     | -              | Target number of 3D Gaussians; higher is more detailed but heavier.                                                                                                                                                                                                        |
| `steps`         | number | No       | `20`     | 1     | 50         | -              | Number of flow-matching sampler steps; more is slower but more faithful.                                                                                                                                                                                                   |
| `guidanceScale` | number | No       | `3`      | 1     | 10         | -              | Classifier-free guidance strength; 1.0 disables CFG.                                                                                                                                                                                                                       |
| `shift`         | number | No       | `3`      | 1     | 6          | -              | Flow-matching timestep schedule shift; >1.0 favors the high-noise end.                                                                                                                                                                                                     |
| `erodeRadius`   | number | No       | `1`      | 0     | 8          | -              | Alpha-matte erosion radius (px) after background removal; 0 disables.                                                                                                                                                                                                      |
| `seed`          | number | No       | -        | 0     | 2147483647 | -              | Use a seed for reproducible results. Leave blank to use a random seed.                                                                                                                                                                                                     |
