---
title: Clarity AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Clarity AI** video upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Crystal Video Upscaler](#crystal-video-upscaler)

---

## Crystal Video Upscaler

High-precision video upscaler optimized for portraits, faces and products.

**Model ID:** `model_crystal-video-upscaler`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_crystal-video-upscaler/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values | Description                                                          |
| ------------- | ------ | -------- | ------- | --- | --- | -------------- | -------------------------------------------------------------------- |
| `video`       | file   | Yes      | -       | -   | -   | -              | An input video for upscaling                                         |
| `scaleFactor` | number | No       | `2`     | 1   | 200 | -              | Scale factor for upscaling (will be capped if output will exceed 4K) |
