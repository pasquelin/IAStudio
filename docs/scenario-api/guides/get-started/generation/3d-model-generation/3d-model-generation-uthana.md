---
title: Uthana | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Uthana** 3d generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Uthana Character Rigging](#uthana-character-rigging)
- [Uthana Text to Motion](#uthana-text-to-motion)
- [Uthana Text to Motion 3.0](#uthana-text-to-motion-30)
- [Uthana Video to Motion](#uthana-video-to-motion)
- [Uthana Video to Motion 2.1](#uthana-video-to-motion-21)

---

## Uthana Character Rigging

Upload a 3D model and auto-rig it with Uthana. Returns a rigged character.

**Model ID:** `model_uthana-character-rigging`

**Capabilities:** `3d23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_uthana-character-rigging/markdown>

| Parameter            | Type    | Required | Default | Min | Max | Allowed Values | Description                                                    |
| -------------------- | ------- | -------- | ------- | --- | --- | -------------- | -------------------------------------------------------------- |
| `characterFile`      | file    | Yes      | -       | -   | -   | -              | 3D model to auto-rig as a new character. 30mb max size.        |
| `autoRigFrontFacing` | boolean | No       | `true`  | -   | -   | -              | Whether the model is front-facing (improves auto-rig accuracy) |

## Uthana Text to Motion

Generate character animation from a text prompt with Uthana, retargeted to your character. Outputs GLB or FBX.

**Model ID:** `model_uthana-text-to-motion-bucmd`

**Capabilities:** `txt23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_uthana-text-to-motion-bucmd/markdown>

| Parameter       | Type    | Required | Default | Min  | Max   | Allowed Values   | Description                                                         |
| --------------- | ------- | -------- | ------- | ---- | ----- | ---------------- | ------------------------------------------------------------------- |
| `prompt`        | string  | Yes      | -       | -    | -     | -                | Text description of desired animation                               |
| `characterFile` | file    | No       | -       | -    | -     | -                | Optional 3D model to auto-rig and use as the retargeting character. |
| `fps`           | number  | No       | `30`    | -    | -     | `24`, `30`, `60` | Frame rate for the output file: 24, 30, or 60                       |
| `animationOnly` | boolean | No       | `false` | -    | -     | -                | If true, download animation without character mesh                  |
| `footIk`        | boolean | No       | -       | -    | -     | -                | Enable foot IK for better foot placement                            |
| `steps`         | number  | No       | `50`    | 1    | 150   | -                | Diffusion iterations.                                               |
| `cfgScale`      | number  | No       | `2`     | 0    | 10    | -                | Guidance scale.                                                     |
| `length`        | number  | No       | `5`     | 0.25 | 10    | -                | Duration in seconds.                                                |
| `retargetingIk` | boolean | No       | `true`  | -    | -     | -                | Enable inverse kinematics for retargeting.                          |
| `seed`          | number  | No       | -       | 1    | 99999 | -                | Random seed for reproducibility                                     |

## Uthana Text to Motion 3.0

Generate high-quality character animation from a text prompt with Uthana text-to-motion 3.0. Retargeted to your character.

**Model ID:** `model_uthana-text-to-motion-3.0`

**Capabilities:** `txt23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_uthana-text-to-motion-3.0/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values   | Description                                                           |
| --------------- | ------- | -------- | ------- | --- | --- | ---------------- | --------------------------------------------------------------------- |
| `prompt`        | string  | Yes      | -       | -   | -   | -                | Text description of desired animation                                 |
| `characterFile` | file    | No       | -       | -   | -   | -                | Optional 3D model to auto-rig and use as the retargeting character.   |
| `fps`           | number  | No       | `30`    | -   | -   | `24`, `30`, `60` | Frame rate for the output file: 24, 30, or 60                         |
| `animationOnly` | boolean | No       | `false` | -   | -   | -                | If true, download animation without character mesh                    |
| `length`        | number  | No       | `8`     | 4   | 10  | -                | Duration in seconds (rounded to 4–10).                                |
| `rewritePrompt` | boolean | No       | `true`  | -   | -   | -                | Auto-rewrite the prompt into physical motion directions for accuracy. |

## Uthana Video to Motion

Extract motion from a reference video and retarget it to your character with Uthana. Outputs GLB or FBX.

**Model ID:** `model_uthana-video-to-motion-v2`

**Capabilities:** `video23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_uthana-video-to-motion-v2/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values   | Description                                                         |
| --------------- | ------- | -------- | ------- | --- | --- | ---------------- | ------------------------------------------------------------------- |
| `video`         | file    | Yes      | -       | -   | -   | -                | Input video.                                                        |
| `characterFile` | file    | No       | -       | -   | -   | -                | Optional 3D model to auto-rig and use as the retargeting character. |
| `fps`           | number  | No       | `30`    | -   | -   | `24`, `30`, `60` | Frame rate for the output file: 24, 30, or 60                       |
| `animationOnly` | boolean | No       | `false` | -   | -   | -                | If true, download animation without character mesh                  |

## Uthana Video to Motion 2.1

Extract motion from a reference video and retarget it to your character with Uthana video-to-motion 2.1.

**Model ID:** `model_uthana-video-to-motion-2.1`

**Capabilities:** `video23d`

**LLM Markdown:** <https://app.scenario.com/api/models/model_uthana-video-to-motion-2.1/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values   | Description                                                         |
| --------------- | ------- | -------- | ------- | --- | --- | ---------------- | ------------------------------------------------------------------- |
| `video`         | file    | Yes      | -       | -   | -   | -                | Input video.                                                        |
| `characterFile` | file    | No       | -       | -   | -   | -                | Optional 3D model to auto-rig and use as the retargeting character. |
| `fps`           | number  | No       | `30`    | -   | -   | `24`, `30`, `60` | Frame rate for the output file: 24, 30, or 60                       |
| `animationOnly` | boolean | No       | `false` | -   | -   | -                | If true, download animation without character mesh                  |
