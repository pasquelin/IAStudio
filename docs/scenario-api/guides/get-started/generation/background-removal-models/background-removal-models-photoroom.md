---
title: Photoroom | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Photoroom** background removal models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Photoroom Background Removal](#photoroom-background-removal)
- [Photoroom Background Replacer](#photoroom-background-replacer)

---

## Photoroom Background Removal

Remove backgrounds from images with high-quality results using Photoroom’s background removal service.

**Model ID:** `model_photoroom-background-removal`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_photoroom-background-removal/markdown>

| Parameter                  | Type    | Required | Default | Min | Max | Allowed Values                | Description                                                                                                                                                                         |
| -------------------------- | ------- | -------- | ------- | --- | --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`                    | file    | Yes      | -       | -   | -   | -                             | Input image file                                                                                                                                                                    |
| `backgroundColor`          | string  | No       | -       | -   | -   | -                             | Background color (hex without # or HTML color name). No value means transparent.                                                                                                    |
| `shadowMode`               | string  | No       | -       | -   | -   | “, `soft`, `hard`, `floating` | Automatically generates a realistic shadow to ‘ground’ your subject. Choose Soft for a professional studio look, Hard for direct sunlight, or Floating to create a 3D hover effect. |
| `hdBackgroundRemoval`      | boolean | No       | `false` | -   | -   | -                             | Enable HD background removal for images >= 2K resolution                                                                                                                            |
| `keepExistingTransparency` | string  | No       | `never` | -   | -   | `auto`, `never`               | Keep existing transparency from the input image                                                                                                                                     |

## Photoroom Background Replacer

Replace backgrounds in images with AI-generated backgrounds using Photoroom’s background replacer service.

**Model ID:** `model_photoroom-background-replacer`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_photoroom-background-replacer/markdown>

| Parameter                | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                   |
| ------------------------ | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------- |
| `image`                  | file   | Yes      | -       | -   | -   | -              | Input image file                                                              |
| `prompt`                 | string | No       | -       | -   | -   | -              | Text prompt for background generation                                         |
| `referenceImage`         | file   | No       | -       | -   | -   | -              | Reference image for background guidance                                       |
| `referenceImageGuidance` | number | No       | `0.6`   | 0   | 1   | -              | How closely the generated background matches the reference image (0.0 to 1.0) |
| `seed`                   | number | No       | -       | 0   | -   | -              | Seed for background generation                                                |
