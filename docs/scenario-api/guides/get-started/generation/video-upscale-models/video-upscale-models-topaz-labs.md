---
title: Topaz Labs | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Topaz Labs** video upscale models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Topaz Video Upscale](#topaz-video-upscale)

---

## Topaz Video Upscale

Topazlabs Video Upscale is a tool for enhancing video quality using advanced AI techniques.

**Model ID:** `model_topazlabs-video-upscale`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_topazlabs-video-upscale/markdown>

| Parameter    | Type   | Required | Default | Min | Max | Allowed Values        | Description             |
| ------------ | ------ | -------- | ------- | --- | --- | --------------------- | ----------------------- |
| `video`      | file   | Yes      | -       | -   | -   | -                     | Video file to upscale   |
| `resolution` | string | No       | `1080p` | -   | -   | `720p`, `1080p`, `4k` | Target resolution       |
| `fps`        | number | No       | `60`    | 15  | 60  | -                     | Target Frame-Per-Second |
