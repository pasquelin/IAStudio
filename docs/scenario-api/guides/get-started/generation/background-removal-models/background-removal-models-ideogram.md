---
title: Ideogram | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-05-20.

This reference lists all available **Ideogram** background removal models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Ideogram Remove Background](#ideogram-remove-background)

---

## Ideogram Remove Background

Remove backgrounds from images with Ideogram. Isolates the subject on a transparent background for compositing and reuse.

**Model ID:** `model_ideogram-remove-background`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ideogram-remove-background/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                                                                                                  |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `image`   | file | Yes      | -       | -   | -   | -              | Image whose background should be removed (up to 10MB). The subject is preserved on a transparent background. |
