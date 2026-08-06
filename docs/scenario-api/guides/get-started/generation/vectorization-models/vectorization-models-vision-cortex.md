---
title: Vision Cortex | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Vision Cortex** vectorization models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [VTracer](#vtracer)

---

## VTracer

Converts raster images to SVG format using VisionCortex VTracer with customizable vectorization parameters.

**Model ID:** `model_visioncortex-vtracer`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_visioncortex-vtracer/markdown>

| Parameter         | Type   | Required | Default   | Min | Max | Allowed Values                       | Description                                                                                                                                                  |
| ----------------- | ------ | -------- | --------- | --- | --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`           | file   | Yes      | -         | -   | -   | -                                    | Image to vectorize                                                                                                                                           |
| `presetName`      | string | No       | `poster`  | -   | -   | `bw`, `poster`, `photo`, `custom`    | Preset configuration. When using a preset, custom parameters are ignored.                                                                                    |
| `colorMode`       | string | No       | `color`   | -   | -   | `color`, `binary`                    | Color mode: ‘color’ or ‘binary’. Only used with preset is Custom.                                                                                            |
| `colorPrecision`  | number | No       | `6`       | 1   | 8   | -                                    | Number of significant bits for RGB channels (1-8). Higher values preserve more color detail. Phoenix param: colorPrecision. Only used with preset is Custom. |
| `layerDifference` | number | No       | `16`      | 0   | 255 | -                                    | Color difference between gradient layers (0-255). Phoenix param: layerDifference. Only used with preset is Custom.                                           |
| `hierarchical`    | string | No       | `stacked` | -   | -   | `stacked`, `cutout`                  | Hierarchical clustering mode: ‘stacked’ or ‘cutout’. Only used with preset is Custom.                                                                        |
| `mode`            | string | No       | `spline`  | -   | -   | `spline`, `polygon`, `pixel`, `none` | Curve fitting mode: ‘spline’ (smooth curves), ‘polygon’ (straight lines), ‘pixel’ (pixelated), or ‘none’. Only used with preset=‘custom’.                    |
| `filterSpeckle`   | number | No       | `4`       | 0   | 128 | -                                    | Discard patches smaller than X pixels. Only used with preset is Custom.                                                                                      |
| `cornerThreshold` | number | No       | `60`      | 0   | 180 | -                                    | Minimum angle (degrees) to be considered a corner (0-180). Only used with preset is Custom.                                                                  |
| `lengthThreshold` | number | No       | `4`       | 3.5 | 10  | -                                    | Maximum segment length for curve smoothing (3.5-10). Only used with preset is Custom.                                                                        |
| `spliceThreshold` | number | No       | `45`      | 0   | 180 | -                                    | Minimum angle displacement for splines (0-180 degrees). Only used with preset is Custom.                                                                     |
