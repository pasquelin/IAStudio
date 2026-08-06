---
title: Pixa | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Pixa** background removal models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Pixa Background Removal](#pixa-background-removal)

---

## Pixa Background Removal

Fast, ultra high-quality background removal from images. Perfect for e-commerce and image editing workflows.

**Model ID:** `model_pixa-background-removal`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixa-background-removal/markdown>

| Parameter      | Type   | Required | Default | Min | Max | Allowed Values  | Description                           |
| -------------- | ------ | -------- | ------- | --- | --- | --------------- | ------------------------------------- |
| `image`        | file   | Yes      | -       | -   | -   | -               | Input image                           |
| `outputFormat` | string | No       | `rgba`  | -   | -   | `rgba`, `alpha` | Output format for the processed image |
