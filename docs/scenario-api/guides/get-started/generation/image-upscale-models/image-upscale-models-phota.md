---
title: Phota | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Phota** image upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Phota Enhance](#phota-enhance)

---

## Phota Enhance

Enhance images while preserving identity with optional profile guidance.

**Model ID:** `model_phota-enhance`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_phota-enhance/markdown>

| Parameter    | Type   | Required | Default | Min | Max | Allowed Values | Description                            |
| ------------ | ------ | -------- | ------- | --- | --- | -------------- | -------------------------------------- |
| `image`      | file   | Yes      | -       | -   | -   | -              | Image to enhance.                      |
| `numOutputs` | number | No       | `1`     | 1   | 4   | -              | Number of enhanced images to generate. |
