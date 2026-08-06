---
title: Bytedance | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Bytedance** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [OmniHuman 1.5](#omnihuman-15)
- [Seedance 1 Pro](#seedance-1-pro)
- [Seedance 1 Pro Fast](#seedance-1-pro-fast)
- [Seedance 1.5 Pro](#seedance-15-pro)
- [Seedance 2.0](#seedance-20)
- [Seedance 2.0 Fast](#seedance-20-fast)
- [Seedance 2.0 Mini](#seedance-20-mini)

---

## OmniHuman 1.5

New advanced and improved human generation model. Generates video using an image of a human figure paired with an audio file.

**Model ID:** `model_bytedance-omni-human-1-5`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-omni-human-1-5/markdown>

| Parameter  | Type | Required | Default | Min | Max | Allowed Values | Description                                                   |
| ---------- | ---- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------- |
| `imageUrl` | file | Yes      | -       | -   | -   | -              | Input image containing a human subject, face or character.    |
| `audioUrl` | file | Yes      | -       | -   | -   | -              | Input audio file. Audio must be under 30s long and under 5MB. |

## Seedance 1 Pro

Video model tuned for stable detail and fluid motion.

**Model ID:** `model_bytedance-seedance-1-pro`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedance-1-pro/markdown>

| Parameter        | Type    | Required | Default | Min | Max | Allowed Values                                                  | Description                                                                                  |
| ---------------- | ------- | -------- | ------- | --- | --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `prompt`         | string  | Yes      | -       | -   | -   | -                                                               | Describe your video                                                                          |
| `image`          | file    | No       | -       | -   | -   | -                                                               | Image used as the first frame of the video.                                                  |
| `lastFrameImage` | file    | No       | -       | -   | -   | -                                                               | Input image for last frame generation. This only works if an image start frame is given too. |
| `duration`       | number  | No       | `5`     | 2   | 12  | -                                                               | Duration in seconds                                                                          |
| `resolution`     | string  | No       | `1080p` | -   | -   | `480p`, `720p`, `1080p`                                         | Output video resolution                                                                      |
| `aspectRatio`    | string  | No       | `16:9`  | -   | -   | `9:21`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9`, `adaptive` | Aspect ratio of the video. Ignored if first frame is provided.                               |
| `cameraFixed`    | boolean | No       | `false` | -   | -   | -                                                               | Whether to fix camera position                                                               |
| `seed`           | number  | No       | -       | -   | -   | -                                                               | Use a seed for reproducible results. Leave blank to use a random seed.                       |

## Seedance 1 Pro Fast

Balanced video model tuned for fast stable detail and fluid motion.

**Model ID:** `model_bytedance-seedance-1-pro-fast`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedance-1-pro-fast/markdown>

| Parameter     | Type    | Required | Default | Min | Max | Allowed Values                                                  | Description                                                            |
| ------------- | ------- | -------- | ------- | --- | --- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `prompt`      | string  | Yes      | -       | -   | -   | -                                                               | Describe your video                                                    |
| `image`       | file    | No       | -       | -   | -   | -                                                               | Image used as the first frame of the video.                            |
| `duration`    | number  | No       | `5`     | 2   | 12  | -                                                               | Duration in seconds                                                    |
| `resolution`  | string  | No       | `1080p` | -   | -   | `480p`, `720p`, `1080p`                                         | Output video resolution                                                |
| `aspectRatio` | string  | No       | `16:9`  | -   | -   | `9:21`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9`, `adaptive` | Aspect ratio of the video. Ignored if first frame is provided.         |
| `cameraFixed` | boolean | No       | `false` | -   | -   | -                                                               | Whether to fix camera position                                         |
| `seed`        | number  | No       | -       | -   | -   | -                                                               | Use a seed for reproducible results. Leave blank to use a random seed. |

## Seedance 1.5 Pro

Generate videos with audio with Seedance 1.5 (supports start & end frame)

**Model ID:** `model_bytedance-seedance-1-5-pro`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedance-1-5-pro/markdown>

| Parameter        | Type    | Required | Default | Min | Max | Allowed Values                                          | Description                                                                                  |
| ---------------- | ------- | -------- | ------- | --- | --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `prompt`         | string  | Yes      | -       | -   | -   | -                                                       | Describe your video                                                                          |
| `image`          | file    | No       | -       | -   | -   | -                                                       | Image used as the first frame of the video.                                                  |
| `lastFrameImage` | file    | No       | -       | -   | -   | -                                                       | Input image for last frame generation. This only works if an image start frame is given too. |
| `duration`       | number  | No       | `5`     | 4   | 12  | -                                                       | Duration in seconds                                                                          |
| `resolution`     | string  | No       | `720p`  | -   | -   | `480p`, `720p`, `1080p`                                 | Output video resolution                                                                      |
| `aspectRatio`    | string  | No       | `16:9`  | -   | -   | `21:9`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `adaptive` | Aspect ratio of the video.                                                                   |
| `cameraFixed`    | boolean | No       | `false` | -   | -   | -                                                       | Whether to fix camera position                                                               |
| `generateAudio`  | boolean | No       | `true`  | -   | -   | -                                                       | Whether to generate audio for the video                                                      |
| `seed`           | number  | No       | -       | -   | -   | -                                                       | Use a seed for reproducible results. Leave blank to use a random seed.                       |

## Seedance 2.0

BytePlus Seedance 2.0 video generation: text, first/last frame, or multimodal references (images, videos, optional audio).

**Model ID:** `model_bytedance-seedance-2-0`

**Capabilities:** `txt2video`, `img2video`, `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedance-2-0/markdown>

| Parameter         | Type        | Required | Default    | Min | Max        | Allowed Values                                                         | Description                                                                                                                                                                                       |
| ----------------- | ----------- | -------- | ---------- | --- | ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | No       | -          | -   | -          | -                                                                      | Text prompt for video generation. Use ”@” such as “@image1” or “@video1” to quickly reference selected images/videos. Prompt is optional if you provide a first frame or reference images/videos. |
| `image`           | file        | No       | -          | -   | -          | -                                                                      | First frame image (frame mode). Mutually exclusive with reference images/videos.                                                                                                                  |
| `lastFrameImage`  | file        | No       | -          | -   | -          | -                                                                      | Last frame image. Only valid when a first frame image is provided.                                                                                                                                |
| `referenceImages` | file\_array | No       | -          | -   | -          | -                                                                      | Reference images for multimodal mode (up to 9). Mutually exclusive with first frame.                                                                                                              |
| `referenceVideos` | file\_array | No       | -          | -   | -          | -                                                                      | Reference videos for multimodal mode (up to 3). Mutually exclusive with first frame.                                                                                                              |
| `referenceAudio`  | file\_array | No       | -          | -   | -          | -                                                                      | Reference audio tracks (up to 3). Requires at least one reference image or video.                                                                                                                 |
| `duration`        | number      | No       | `-1`       | -   | -          | `-1`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | Duration in seconds (4–15), or Auto: with reference videos, bill at the longest reference clip length (clamped 4–15s).                                                                            |
| `resolution`      | string      | No       | `720p`     | -   | -          | `480p`, `720p`, `1080p`, `4k`                                          | Output video resolution                                                                                                                                                                           |
| `aspectRatio`     | string      | No       | `adaptive` | -   | -          | `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`, `adaptive`                | Output aspect ratio                                                                                                                                                                               |
| `generateAudio`   | boolean     | No       | `true`     | -   | -          | -                                                                      | Whether to generate audio for the video                                                                                                                                                           |
| `seed`            | number      | No       | -          | 0   | 4294967295 | -                                                                      | Optional seed for reproducible results (0–4294967295).                                                                                                                                            |

## Seedance 2.0 Fast

Faster BytePlus Seedance 2.0 video generation: text, first/last frame, or multimodal references (images, videos, optional audio).

**Model ID:** `model_bytedance-seedance-2-0-fast`

**Capabilities:** `txt2video`, `img2video`, `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedance-2-0-fast/markdown>

| Parameter         | Type        | Required | Default    | Min | Max        | Allowed Values                                                         | Description                                                                                                                                                                                       |
| ----------------- | ----------- | -------- | ---------- | --- | ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | No       | -          | -   | -          | -                                                                      | Text prompt for video generation. Use ”@” such as “@image1” or “@video1” to quickly reference selected images/videos. Prompt is optional if you provide a first frame or reference images/videos. |
| `image`           | file        | No       | -          | -   | -          | -                                                                      | First frame image (frame mode). Mutually exclusive with reference images/videos.                                                                                                                  |
| `lastFrameImage`  | file        | No       | -          | -   | -          | -                                                                      | Last frame image. Only valid when a first frame image is provided.                                                                                                                                |
| `referenceImages` | file\_array | No       | -          | -   | -          | -                                                                      | Reference images for multimodal mode (up to 9). Mutually exclusive with first frame.                                                                                                              |
| `referenceVideos` | file\_array | No       | -          | -   | -          | -                                                                      | Reference videos for multimodal mode (up to 3). Mutually exclusive with first frame.                                                                                                              |
| `referenceAudio`  | file\_array | No       | -          | -   | -          | -                                                                      | Reference audio tracks (up to 3). Requires at least one reference image or video.                                                                                                                 |
| `duration`        | number      | No       | `-1`       | -   | -          | `-1`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | Duration in seconds (4–15), or Auto: with reference videos, bill at the longest reference clip length (clamped 4–15s).                                                                            |
| `resolution`      | string      | No       | `720p`     | -   | -          | `480p`, `720p`                                                         | Output video resolution                                                                                                                                                                           |
| `aspectRatio`     | string      | No       | `adaptive` | -   | -          | `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `adaptive`                | Output aspect ratio                                                                                                                                                                               |
| `generateAudio`   | boolean     | No       | `true`     | -   | -          | -                                                                      | Whether to generate audio for the video                                                                                                                                                           |
| `seed`            | number      | No       | -          | 0   | 4294967295 | -                                                                      | Optional seed for reproducible results (0–4294967295).                                                                                                                                            |

## Seedance 2.0 Mini

Budget BytePlus Seedance 2.0 video generation (up to 720p): text, first/last frame, or multimodal references.

**Model ID:** `model_bytedance-seedance-2-0-mini`

**Capabilities:** `txt2video`, `img2video`, `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_bytedance-seedance-2-0-mini/markdown>

| Parameter         | Type        | Required | Default    | Min | Max        | Allowed Values                                                         | Description                                                                                                                                                                                                                          |
| ----------------- | ----------- | -------- | ---------- | --- | ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt`          | string      | No       | -          | -   | -          | -                                                                      | Describe the video you want. You can point to your uploaded files with ”@” - for example, “@image1” or “@video1” - to reference them directly in your description. Optional if you provide a first frame or reference images/videos. |
| `image`           | file        | No       | -          | -   | -          | -                                                                      | An image to use as the video’s opening frame. Can’t be combined with reference images or videos.                                                                                                                                     |
| `lastFrameImage`  | file        | No       | -          | -   | -          | -                                                                      | An image to use as the video’s closing frame. Only works when a first frame is also set.                                                                                                                                             |
| `referenceImages` | file\_array | No       | -          | -   | -          | -                                                                      | Images to guide the video’s subjects and style (up to 9). Can’t be combined with a first frame.                                                                                                                                      |
| `referenceVideos` | file\_array | No       | -          | -   | -          | -                                                                      | Videos to guide the motion and style (up to 3). Can’t be combined with a first frame.                                                                                                                                                |
| `referenceAudio`  | file\_array | No       | -          | -   | -          | -                                                                      | Audio tracks to guide the video (up to 3). Requires at least one reference image or video.                                                                                                                                           |
| `duration`        | number      | No       | `-1`       | -   | -          | `-1`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | How long the video lasts, in seconds (4–15). Auto matches the length of your longest reference video (kept within 4–15s).                                                                                                            |
| `resolution`      | string      | No       | `720p`     | -   | -          | `480p`, `720p`                                                         | The output quality. Higher resolution is sharper but costs more (this model supports up to 720p).                                                                                                                                    |
| `aspectRatio`     | string      | No       | `adaptive` | -   | -          | `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `adaptive`                | The shape of the video. Auto picks a fitting shape based on your inputs.                                                                                                                                                             |
| `generateAudio`   | boolean     | No       | `true`     | -   | -          | -                                                                      | Adds a generated soundtrack to the video. On by default.                                                                                                                                                                             |
| `seed`            | number      | No       | -          | 0   | 4294967295 | -                                                                      | A number that makes results repeatable. Reusing the same seed and settings produces the same video; leave it empty for a different result each time.                                                                                 |
