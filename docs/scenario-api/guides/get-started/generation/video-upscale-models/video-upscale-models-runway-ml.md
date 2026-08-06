---
title: Runway ML | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Runway ML** video upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Runway Upscale V1](#runway-upscale-v1)

---

## Runway Upscale V1

Upscale videos by 4x, up to a maximum of 4k

**Model ID:** `model_runway-upscale-v1`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_runway-upscale-v1/markdown>

| Parameter | Type | Required | Default | Min | Max | Allowed Values | Description                                                                           |
| --------- | ---- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------- |
| `video`   | file | Yes      | -       | -   | -   | -              | Video file to upscale. Videos must be shorter than 40s and less than 4096px per side. |
