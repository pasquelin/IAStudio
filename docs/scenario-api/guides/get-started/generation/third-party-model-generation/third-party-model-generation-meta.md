---
title: Meta | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Meta** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [SAM 3.1 Image](#sam-31-image)

---

## SAM 3.1 Image

Segment images with Meta SAM 3.1: text and/or box prompting, or interactive tracking (points, box, mask).

**Model ID:** `model_meta-sam-3-1-image`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meta-sam-3-1-image/markdown>

| Parameter             | Type          | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                                                                                                                         |
| --------------------- | ------------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`               | file          | Yes      | -       | -   | -   | -              | Image to segment                                                                                                                                                                                                                                                                    |
| `imagePromptingText`  | string        | No       | -       | -   | -   | -              | Text prompt for prompt-based segmentation. Provide this and/or bounding boxes under Image prompt boxes. Omit when using only tracking (points, box, or mask). Use a short noun phrase (e.g. ‘red car’), not a full sentence: prompts are capped at 120 characters (about 20 words). |
| `imagePromptingBoxes` | inputs\_array | No       | -       | -   | -   | -              | Bounding boxes with labels for prompt-based segmentation. Omit entirely when using only text or tracking. When you add a row, set all four bounds (x min/max, y min/max); partial rows may be rejected by the segment service.                                                      |
| `applyMask`           | boolean       | No       | `false` | -   | -   | -              | When enabled, returns the source image with the mask applied (PNG alpha channel, transparent background) instead of binary mask outputs.                                                                                                                                            |
