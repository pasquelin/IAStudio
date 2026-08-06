---
title: MiniMax | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **MiniMax** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Minimax Image 01](#minimax-image-01)

---

## Minimax Image 01

**Model ID:** `model_minimax-image-01`

**Capabilities:** `txt2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_minimax-image-01/markdown>

| Parameter          | Type    | Required | Default | Min | Max | Allowed Values                                            | Description                                                                                         |
| ------------------ | ------- | -------- | ------- | --- | --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `prompt`           | string  | Yes      | -       | -   | -   | -                                                         | Text prompt for generation                                                                          |
| `aspectRatio`      | string  | No       | `4:3`   | -   | -   | `9:16`, `2:3`, `3:4`, `1:1`, `3:2`, `4:3`, `16:9`, `21:9` | Image aspect ratio                                                                                  |
| `numOutputs`       | number  | No       | `1`     | 1   | 9   | -                                                         | Number of images to generate                                                                        |
| `promptOptimizer`  | boolean | No       | `true`  | -   | -   | -                                                         | Use prompt optimizer                                                                                |
| `subjectReference` | file    | No       | -       | -   | -   | -                                                         | An optional character reference image (human face) to use as the subject in the generated image(s). |
