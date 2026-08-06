---
title: LongCat | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **LongCat** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [LongCat Image Editing](#longcat-image-editing)

---

## LongCat Image Editing

LongCat image Edit is a 6B parameter image editing model excelling at multilingual text rendering, photorealism and deployment efficiency.

**Model ID:** `model_longcat-image-editing`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_longcat-image-editing/markdown>

| Parameter           | Type   | Required | Default | Min | Max        | Allowed Values | Description                                                      |
| ------------------- | ------ | -------- | ------- | --- | ---------- | -------------- | ---------------------------------------------------------------- |
| `referenceImage`    | file   | Yes      | -       | -   | -          | -              | Reference image to use for editing.                              |
| `prompt`            | string | Yes      | -       | -   | -          | -              | A textual prompt to guide model generation.                      |
| `numInferenceSteps` | number | No       | `28`    | 1   | 50         | -              | Number of inference steps.                                       |
| `guidanceScale`     | number | No       | `4.5`   | 1   | 20         | -              | Guidance scale. Higher values adhere more closely to the prompt. |
| `numOutputs`        | number | No       | `1`     | 1   | 4          | -              | Number of images to generate.                                    |
| `seed`              | number | No       | -       | 0   | 2147483647 | -              | Seed for random number generation.                               |
