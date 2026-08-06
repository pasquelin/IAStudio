---
title: Bria | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-03.

This reference lists all available **Bria** background removal models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Bria Remove Background](#bria-remove-background)

---

## Bria Remove Background

**Model ID:** `model_bria-remove-background`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bria-remove-background/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                                       |
| --------------- | ------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `image`         | file    | Yes      | -       | -   | -   | -              | Image file                                                                                                        |
| `preserveAlpha` | boolean | No       | `true`  | -   | -   | -              | Preserve alpha channel in output. When true, maintains original transparency. When false, output is fully opaque. |
