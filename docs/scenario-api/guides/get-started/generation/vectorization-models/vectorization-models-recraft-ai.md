---
title: Recraft AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Recraft AI** vectorization models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Recraft Vectorize](#recraft-vectorize)

---

## Recraft Vectorize

Converts a given raster image to SVG format using Recraft model.

**Model ID:** `model_recraft-vectorize`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_recraft-vectorize/markdown>

| Parameter        | Type | Required | Default | Min | Max | Allowed Values | Description                                       |
| ---------------- | ---- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------- |
| `referenceImage` | file | Yes      | -       | -   | -   | -              | The image to convert to SVG format. 5mb max size. |
