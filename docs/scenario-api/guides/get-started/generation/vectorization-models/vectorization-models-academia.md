---
title: Academia | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Academia** vectorization models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [VecGlypher](#vecglypher)
- [VecGlypher Image to SVG](#vecglypher-image-to-svg)

---

## VecGlypher

Generate SVG glyphs directly from text prompts with controllable typography and styling.

**Model ID:** `model_vecglypher`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vecglypher/markdown>

| Parameter           | Type   | Required | Default                                          | Min | Max        | Allowed Values | Description                                                       |
| ------------------- | ------ | -------- | ------------------------------------------------ | --- | ---------- | -------------- | ----------------------------------------------------------------- |
| `prompt`            | string | Yes      | -                                                | -   | -          | -              | The target text to generate as vector glyphs.                     |
| `styleDescription`  | string | No       | `italic style, 400 weight, serif, text, elegant` | -   | -          | -              | Typography style guidance such as weight, style, and category.    |
| `outputSize`        | number | No       | `512`                                            | 64  | 4096       | -              | Maximum output dimension in pixels while preserving aspect ratio. |
| `fillColor`         | string | No       | `black`                                          | -   | -          | -              | SVG/CSS fill color for generated glyphs.                          |
| `strokeColor`       | string | No       | -                                                | -   | -          | -              | Optional outline color for generated glyph paths.                 |
| `strokeWidth`       | number | No       | `1`                                              | 0.1 | 50         | -              | Outline width in SVG units when a stroke color is set.            |
| `temperature`       | number | No       | `0.1`                                            | 0   | 2          | -              | Sampling temperature.                                             |
| `topP`              | number | No       | `0.95`                                           | 0   | 1          | -              | Top-p (nucleus) sampling parameter.                               |
| `topK`              | number | No       | `5`                                              | -1  | 100        | -              | Top-k sampling parameter.                                         |
| `repetitionPenalty` | number | No       | `1`                                              | 0   | 2          | -              | Penalty to reduce repeated SVG path segments.                     |
| `maxTokens`         | number | No       | `8192`                                           | 256 | 16384      | -              | Maximum number of tokens to generate.                             |
| `seed`              | number | No       | -                                                | 0   | 2147483647 | -              | Random seed for reproducibility.                                  |

## VecGlypher Image to SVG

Generate SVG glyphs from a text prompt while matching the style of reference glyph images.

**Model ID:** `model_vecglypher-image-to-svg`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vecglypher-image-to-svg/markdown>

| Parameter           | Type        | Required | Default | Min | Max        | Allowed Values | Description                                                       |
| ------------------- | ----------- | -------- | ------- | --- | ---------- | -------------- | ----------------------------------------------------------------- |
| `referenceImages`   | file\_array | Yes      | -       | -   | -          | -              | Reference glyph images to match style from (1 to 8 images).       |
| `prompt`            | string      | Yes      | -       | -   | -          | -              | Target text to generate as vector glyphs.                         |
| `outputSize`        | number      | No       | `512`   | 64  | 4096       | -              | Maximum output dimension in pixels while preserving aspect ratio. |
| `fillColor`         | string      | No       | `black` | -   | -          | -              | SVG/CSS fill color for generated glyphs.                          |
| `strokeColor`       | string      | No       | -       | -   | -          | -              | Optional outline color for generated glyph paths.                 |
| `strokeWidth`       | number      | No       | `1`     | 0.1 | 50         | -              | Outline width in SVG units when a stroke color is set.            |
| `temperature`       | number      | No       | `0.1`   | 0   | 2          | -              | Sampling temperature.                                             |
| `topP`              | number      | No       | `0.95`  | 0   | 1          | -              | Top-p (nucleus) sampling parameter.                               |
| `topK`              | number      | No       | `5`     | -1  | 100        | -              | Top-k sampling parameter.                                         |
| `repetitionPenalty` | number      | No       | `1`     | 0   | 2          | -              | Penalty to reduce repeated SVG path segments.                     |
| `maxTokens`         | number      | No       | `8192`  | 256 | 16384      | -              | Maximum number of tokens to generate.                             |
| `seed`              | number      | No       | -       | 0   | 2147483647 | -              | Random seed for reproducibility.                                  |
