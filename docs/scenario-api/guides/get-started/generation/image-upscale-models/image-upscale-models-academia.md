---
title: Academia | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Academia** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Pixel Snapper](#pixel-snapper)

---

## Pixel Snapper

**Model ID:** `model_pixel-snapper`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixel-snapper/markdown>

| Parameter | Type   | Required | Default | Min | Max        | Allowed Values | Description                                       |
| --------- | ------ | -------- | ------- | --- | ---------- | -------------- | ------------------------------------------------- |
| `image`   | file   | Yes      | -       | -   | -          | -              | Image to process                                  |
| `colors`  | number | No       | `16`    | 8   | 256        | -              | Number of colors to use in the color quantization |
| `seed`    | number | No       | -       | 0   | 2147483647 | -              | Seed for reproducibility                          |
