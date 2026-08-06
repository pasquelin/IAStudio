---
title: World Labs | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **World Labs** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Marble 1.0 Draft — World Generation](#marble-10-draft-world-generation)
- [Marble 1.1 — World Generation](#marble-11-world-generation)
- [Marble 1.1 Plus — World Generation](#marble-11-plus-world-generation)

---

## Marble 1.0 Draft — World Generation

Generate a navigable 3D Gaussian-splat world with World Labs Marble (1.0 Draft: fastest & cheapest, lowest quality). Provide exactly one input: a text prompt, a single image (or 360° panorama), 2–8 images, or a video. Returns a compact .spz splat ready to preview and download.

**Model ID:** `model_worldlabs-marble-1-0-draft`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_worldlabs-marble-1-0-draft/markdown>

| Parameter          | Type        | Required | Default | Min | Max        | Allowed Values         | Description                                                                                                                                |
| ------------------ | ----------- | -------- | ------- | --- | ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt`           | string      | No       | -       | -   | -          | -                      | Text describing the world. Required for text-to-world; optional extra guidance when an image, images, or a video is provided.              |
| `images`           | file\_array | No       | -       | -   | -          | -                      | One image for image-to-world (toggle Panorama for a 360° equirectangular image), or 2–8 images of the same scene for multi-image-to-world. |
| `video`            | file        | No       | -       | -   | -          | -                      | A video panning across a scene (video-to-world). Use instead of images when you have a walk-through clip.                                  |
| `disableRecaption` | boolean     | No       | `false` | -   | -          | -                      | Skip Marble’s automatic prompt rewriting and use the prompt exactly as written.                                                            |
| `isPano`           | boolean     | No       | `false` | -   | -          | -                      | Treat a single input image as a 360° equirectangular panorama (only applies when one image is provided).                                   |
| `splatResolution`  | string      | No       | `full`  | -   | -          | `100k`, `500k`, `full` | Which Marble splat tier to store: 100k or 500k Gaussians, or full resolution.                                                              |
| `seed`             | number      | No       | -       | 0   | 4294967295 | -                      | Seed for reproducible results; leave blank for random.                                                                                     |

## Marble 1.1 — World Generation

Generate a navigable 3D Gaussian-splat world with World Labs Marble (1.1: standard quality). Provide exactly one input: a text prompt, a single image (or 360° panorama), 2–8 images, or a video. Returns a compact .spz splat ready to preview and download.

**Model ID:** `model_worldlabs-marble-1-1`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_worldlabs-marble-1-1/markdown>

| Parameter          | Type        | Required | Default | Min | Max        | Allowed Values         | Description                                                                                                                                |
| ------------------ | ----------- | -------- | ------- | --- | ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt`           | string      | No       | -       | -   | -          | -                      | Text describing the world. Required for text-to-world; optional extra guidance when an image, images, or a video is provided.              |
| `images`           | file\_array | No       | -       | -   | -          | -                      | One image for image-to-world (toggle Panorama for a 360° equirectangular image), or 2–8 images of the same scene for multi-image-to-world. |
| `video`            | file        | No       | -       | -   | -          | -                      | A video panning across a scene (video-to-world). Use instead of images when you have a walk-through clip.                                  |
| `disableRecaption` | boolean     | No       | `false` | -   | -          | -                      | Skip Marble’s automatic prompt rewriting and use the prompt exactly as written.                                                            |
| `isPano`           | boolean     | No       | `false` | -   | -          | -                      | Treat a single input image as a 360° equirectangular panorama (only applies when one image is provided).                                   |
| `splatResolution`  | string      | No       | `full`  | -   | -          | `100k`, `500k`, `full` | Which Marble splat tier to store: 100k or 500k Gaussians, or full resolution.                                                              |
| `seed`             | number      | No       | -       | 0   | 4294967295 | -                      | Seed for reproducible results; leave blank for random.                                                                                     |

## Marble 1.1 Plus — World Generation

Generate a navigable 3D Gaussian-splat world with World Labs Marble (1.1 Plus: dynamic world sizing, highest quality). Provide exactly one input: a text prompt, a single image (or 360° panorama), 2–8 images, or a video. Returns a compact .spz splat ready to preview and download.

**Model ID:** `model_worldlabs-marble-1-1-plus`

**Capabilities:** `img23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_worldlabs-marble-1-1-plus/markdown>

| Parameter          | Type        | Required | Default | Min | Max        | Allowed Values         | Description                                                                                                                                |
| ------------------ | ----------- | -------- | ------- | --- | ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt`           | string      | No       | -       | -   | -          | -                      | Text describing the world. Required for text-to-world; optional extra guidance when an image, images, or a video is provided.              |
| `images`           | file\_array | No       | -       | -   | -          | -                      | One image for image-to-world (toggle Panorama for a 360° equirectangular image), or 2–8 images of the same scene for multi-image-to-world. |
| `video`            | file        | No       | -       | -   | -          | -                      | A video panning across a scene (video-to-world). Use instead of images when you have a walk-through clip.                                  |
| `disableRecaption` | boolean     | No       | `false` | -   | -          | -                      | Skip Marble’s automatic prompt rewriting and use the prompt exactly as written.                                                            |
| `isPano`           | boolean     | No       | `false` | -   | -          | -                      | Treat a single input image as a 360° equirectangular panorama (only applies when one image is provided).                                   |
| `splatResolution`  | string      | No       | `full`  | -   | -          | `100k`, `500k`, `full` | Which Marble splat tier to store: 100k or 500k Gaussians, or full resolution.                                                              |
| `seed`             | number      | No       | -       | 0   | 4294967295 | -                      | Seed for reproducible results; leave blank for random.                                                                                     |
