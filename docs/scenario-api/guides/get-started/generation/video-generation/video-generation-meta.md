---
title: Meta | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Meta** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [SAM 3.1 Video](#sam-31-video)

---

## SAM 3.1 Video

Segment videos with Meta SAM 3.1. Text prompt initializes detection; optional per-frame points, box, or mask refine tracking.

**Model ID:** `model_meta-sam-3-1-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_meta-sam-3-1-video/markdown>

| Parameter                 | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                                                        |
| ------------------------- | ------- | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `video`                   | file    | Yes      | -       | -   | -   | -              | Video to segment                                                                                                                   |
| `videoPromptingText`      | string  | Yes      | -       | -   | -   | -              | Text prompt. Use a short noun phrase (e.g. ‘red car’), not a full sentence: prompts are capped at 120 characters (about 20 words). |
| `applyMask`               | boolean | No       | `false` | -   | -   | -              | When enabled, returns the source video with the mask applied (masked-out region painted black) instead of binary mask outputs.     |
| `videoMaxNumObjects`      | number  | No       | `16`    | 1   | 16  | -              | Maximum objects to track                                                                                                           |
| `videoDetectionThreshold` | number  | No       | `0.5`   | 0   | 1   | -              | Detection confidence threshold for SAM 3.1 (lower = more detections, less precise).                                                |
