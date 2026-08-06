---
title: Sourceful | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Sourceful** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Riverflow 2.0 REFSR](#riverflow-20-refsr)
- [Riverflow 2.5 Fast](#riverflow-25-fast)
- [Riverflow 2.5 Pro](#riverflow-25-pro)

---

## Riverflow 2.0 REFSR

Render product images with 100% accuracy and environmental blending

**Model ID:** `model_sourceful-riverflow-2-0-refsr`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sourceful-riverflow-2-0-refsr/markdown>

| Parameter                   | Type        | Required | Default | Min | Max | Allowed Values | Description                                     |
| --------------------------- | ----------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------- |
| `referenceImage`            | file        | Yes      | -       | -   | -   | -              | The base image to apply super resolution to.    |
| `superResolutionReferences` | file\_array | Yes      | -       | -   | -   | -              | Reference images for super resolution guidance. |

## Riverflow 2.5 Fast

Speed-optimized agentic image model for production and latency-sensitive workflows.

**Model ID:** `model_sourceful-riverflow-2-5-fast`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sourceful-riverflow-2-5-fast/markdown>

| Parameter         | Type          | Required | Default    | Min | Max | Allowed Values                                                                  | Description                                                                                                                             |
| ----------------- | ------------- | -------- | ---------- | --- | --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string        | Yes      | -          | -   | -   | -                                                                               | Describe what to create or how to edit your reference images. At least 2 characters.                                                    |
| `referenceImages` | file\_array   | No       | -          | -   | -   | -                                                                               | Optional images to edit or build from. Add up to 4.                                                                                     |
| `resolution`      | string        | No       | `1K`       | -   | -   | `1K`, `2K`                                                                      | The output detail level. 2K is sharper but costs more than 1K.                                                                          |
| `aspectRatio`     | string        | No       | `auto`     | -   | -   | `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` | The shape of the output. Auto picks a fitting ratio for you.                                                                            |
| `thinkingLevel`   | string        | No       | `medium`   | -   | -   | `low`, `medium`, `high`                                                         | How much effort the model spends refining the result. Higher levels improve quality but take longer.                                    |
| `fontUrls`        | string\_array | No       | -          | -   | -   | -                                                                               | Optional links to your own font files (TTF, OTF, WOFF, or WOFF2) to use for text in the image. Add up to 2. Each font adds to the cost. |
| `fontTexts`       | string\_array | No       | -          | -   | -   | -                                                                               | The text to render in each font above, in the same order. The first entry uses the first font, and so on (up to 300 characters each).   |
| `background`      | string        | No       | `original` | -   | -   | `original`, `transparent`, `solid`                                              | How to handle the background. Original keeps it as-is, Transparent removes it, or Solid fills it with a color you choose.               |
| `backgroundColor` | string        | No       | `#ffffff`  | -   | -   | -                                                                               | The fill color when Background is set to Solid, as a hex code (for example, #ffffff for white).                                         |
| `scoringPrompt`   | string        | No       | -          | -   | -   | -                                                                               | Optional instructions telling the model how to judge and pick the best result among its candidates.                                     |
| `scoringRubric`   | string        | No       | -          | -   | -   | -                                                                               | Optional detailed scoring criteria, given as a JSON list of 1–8 dimensions (each with a key, label, description, and weight).           |
| `enhancePrompt`   | boolean       | No       | `false`    | -   | -   | -                                                                               | Lets the model expand and improve your instruction before generating.                                                                   |

## Riverflow 2.5 Pro

Top-quality agentic image model with multi-step reasoning, candidate scoring, and adjustable thinking effort.

**Model ID:** `model_sourceful-riverflow-2-5-pro`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sourceful-riverflow-2-5-pro/markdown>

| Parameter         | Type          | Required | Default    | Min | Max | Allowed Values                                                                  | Description                                                                                                                             |
| ----------------- | ------------- | -------- | ---------- | --- | --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string        | Yes      | -          | -   | -   | -                                                                               | Describe what to create or how to edit your reference images. At least 2 characters.                                                    |
| `referenceImages` | file\_array   | No       | -          | -   | -   | -                                                                               | Optional images to edit or build from. Add up to 10.                                                                                    |
| `resolution`      | string        | No       | `1K`       | -   | -   | `1K`, `2K`, `4K`                                                                | The output detail level. Higher resolutions are sharper; 4K costs more than 1K and 2K.                                                  |
| `aspectRatio`     | string        | No       | `auto`     | -   | -   | `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16` | The shape of the output. Auto picks a fitting ratio for you.                                                                            |
| `thinkingLevel`   | string        | No       | `medium`   | -   | -   | `low`, `medium`, `high`, `xhigh`                                                | How much effort the model spends refining the result. Higher levels improve quality but take longer.                                    |
| `fontUrls`        | string\_array | No       | -          | -   | -   | -                                                                               | Optional links to your own font files (TTF, OTF, WOFF, or WOFF2) to use for text in the image. Add up to 2. Each font adds to the cost. |
| `fontTexts`       | string\_array | No       | -          | -   | -   | -                                                                               | The text to render in each font above, in the same order. The first entry uses the first font, and so on (up to 300 characters each).   |
| `background`      | string        | No       | `original` | -   | -   | `original`, `transparent`, `solid`                                              | How to handle the background. Original keeps it as-is, Transparent removes it, or Solid fills it with a color you choose.               |
| `backgroundColor` | string        | No       | `#ffffff`  | -   | -   | -                                                                               | The fill color when Background is set to Solid, as a hex code (for example, #ffffff for white).                                         |
| `scoringPrompt`   | string        | No       | -          | -   | -   | -                                                                               | Optional instructions telling the model how to judge and pick the best result among its candidates.                                     |
| `scoringRubric`   | string        | No       | -          | -   | -   | -                                                                               | Optional detailed scoring criteria, given as a JSON list of 1–8 dimensions (each with a key, label, description, and weight).           |
| `enhancePrompt`   | boolean       | No       | `false`    | -   | -   | -                                                                               | Lets the model expand and improve your instruction before generating.                                                                   |
