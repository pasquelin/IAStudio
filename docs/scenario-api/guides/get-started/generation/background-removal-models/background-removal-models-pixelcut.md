---
title: Pixelcut | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Pixelcut** background removal models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Pixelcut Background Removal](#pixelcut-background-removal)

---

## Pixelcut Background Removal

Fast, ultra high-quality background removal from images. Perfect for e-commerce and image editing workflows.

**Model ID:** `model_pixa-background-removal`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixa-background-removal/markdown>

| Parameter      | Type   | Required | Default | Min | Max | Allowed Values  | Description                           |
| -------------- | ------ | -------- | ------- | --- | --- | --------------- | ------------------------------------- |
| `image`        | file   | Yes      | -       | -   | -   | -               | Input image                           |
| `outputFormat` | string | No       | `rgba`  | -   | -   | `rgba`, `alpha` | Output format for the processed image |
