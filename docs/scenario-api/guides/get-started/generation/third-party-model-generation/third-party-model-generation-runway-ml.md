---
title: Runway ML | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Runway ML** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Runway Gen 4](#runway-gen-4)

---

## Runway Gen 4

**Model ID:** `model_runway-gen4-image-editing`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_runway-gen4-image-editing/markdown>

| Parameter         | Type        | Required | Default     | Min | Max        | Allowed Values                                                                                                                                                                                    | Description                                                            |
| ----------------- | ----------- | -------- | ----------- | --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `referenceImages` | file\_array | Yes      | “           | -   | -          | -                                                                                                                                                                                                 | Up to 3 reference images.                                              |
| `prompt`          | string      | Yes      | -           | -   | -          | -                                                                                                                                                                                                 | Text prompt for image generation                                       |
| `aspectRatio`     | string      | No       | `1920:1080` | -   | -          | `2112:912`, `1808:768`, `1680:720`, `1920:1080`, `1360:768`, `1280:720`, `1440:1080`, `1168:880`, `960:720`, `1024:1024`, `1080:1080`, `1080:1440`, `720:960`, `720:720`, `720:1280`, `1080:1920` | Aspect ratio for the generated image                                   |
| `seed`            | number      | No       | -           | 0   | 2147483647 | -                                                                                                                                                                                                 | Use a seed for reproducible results. Leave blank to use a random seed. |
