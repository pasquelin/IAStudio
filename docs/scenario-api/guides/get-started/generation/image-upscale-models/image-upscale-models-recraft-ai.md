---
title: Recraft AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Recraft AI** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Recraft Creative Upscale](#recraft-creative-upscale)
- [Recraft Crisp Upscale](#recraft-crisp-upscale)

---

## Recraft Creative Upscale

Recraft Creative upscales image with a creative style.

**Model ID:** `model_recraft-creative-upscale`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-creative-upscale/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description      |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ---------------- |
| `image`   | file | Yes      | -       | -   | -   | -              | Image to upscale |

## Recraft Crisp Upscale

Recraft Crisp Upscale increases overall quality, making visuals suitable for web use or print-ready materials

**Model ID:** `model_recraft-crisp-upscale`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-crisp-upscale/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description      |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ---------------- |
| `image`   | file | Yes      | -       | -   | -   | -              | Image to upscale |
