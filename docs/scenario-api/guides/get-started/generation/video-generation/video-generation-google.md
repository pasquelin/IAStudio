---
title: Google | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Google** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Gemini Omni Flash](#gemini-omni-flash)
- [Gemini Omni Flash Edit](#gemini-omni-flash-edit)
- [Gemini Omni Flash Reference to Video](#gemini-omni-flash-reference-to-video)
- [Google Veo 3.1](#google-veo-31)
- [Google Veo 3.1 Extend Video](#google-veo-31-extend-video)
- [Google Veo 3.1 Fast](#google-veo-31-fast)
- [Google Veo 3.1 Lite](#google-veo-31-lite)

---

## Gemini Omni Flash

Gemini Omni Flash generates 720p video with native audio from a text prompt or an input image.

**Model ID:** `model_google-omni-flash`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-omni-flash/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                               |
| ----------------- | ----------- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | No       | -       | -   | -   | -              | Describe the video you want to create — the scene, action, and mood. Optional if you provide a first-frame image instead. |
| `image`           | file        | No       | -       | -   | -   | -              | An optional image to animate. The video starts from this frame. Leave it empty to generate purely from your prompt.       |
| `referenceImages` | file\_array | No       | -       | -   | -   | -              | Up to 7 reference images of the subjects you want in the video.                                                           |
| `duration`        | number      | No       | `8`     | 3   | 10  | -              | The duration of the video in seconds.                                                                                     |
| `aspectRatio`     | string      | No       | `16:9`  | -   | -   | `16:9`, `9:16` | The shape of the video — widescreen (16:9) or vertical (9:16).                                                            |

## Gemini Omni Flash Edit

Edit an existing video with natural-language instructions using Gemini Omni Flash — preserves motion while applying visual changes, with optional reference images (1–5) and native audio.

**Model ID:** `model_google-omni-flash-edit`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-omni-flash-edit/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                               |
| ----------------- | ----------- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -   | -              | Describe the change you want to make to the video — for example, “make it look like winter” or “change the car to red.” The motion stays the same; only the look changes. |
| `video`           | file        | Yes      | -       | -   | -   | -              | The video you want to edit.                                                                                                                                               |
| `referenceImages` | file\_array | No       | -       | -   | -   | -              | Optional reference images (1–5) injected into the edit for subject or look consistency.                                                                                   |

## Gemini Omni Flash Reference to Video

Gemini Omni Flash generates subject-consistent 720p video with native audio from 1–7 reference images and an optional prompt.

**Model ID:** `model_google-omni-flash-r2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-omni-flash-r2v/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                                           |
| ----------------- | ----------- | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | No       | -       | -   | -   | -              | Optionally describe the scene, action, or mood you want. Your reference subjects appear in the video whether or not you add a prompt. |
| `referenceImages` | file\_array | Yes      | -       | -   | -   | -              | 1 to 7 reference images of the subjects you want in the video.                                                                        |
| `duration`        | number      | No       | `8`     | 3   | 10  | -              | The duration of the video in seconds.                                                                                                 |
| `aspectRatio`     | string      | No       | `16:9`  | -   | -   | `16:9`, `9:16` | The shape of the video - widescreen (16:9) or vertical (9:16).                                                                        |

## Google Veo 3.1

Veo 3.1 is a realistic physics video model for simulating natural phenomena and physical interactions. Veo 3.1 can also generate sound and music.

**Model ID:** `model_veo3-1`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_veo3-1/markdown>

| Parameter             | Type        | Required | Default | Min | Max | Allowed Values   | Description                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ----------- | -------- | ------- | --- | --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`              | string      | No       | -       | -   | -   | -                | Describe your video                                                                                                                                                                                                                                                                                                                                                                                                               |
| `image`               | file        | No       | -       | -   | -   | -                | Image used as the first frame of the video. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose. First Frame and Reference Images cannot be both set.                                                                                                                                                                                                                                |
| `lastFrameImage`      | file        | No       | -       | -   | -   | -                | Last frame of the video to start generating from. When provided with an input image, creates a transition between the two images.                                                                                                                                                                                                                                                                                                 |
| `referenceImages`     | file\_array | No       | -       | -   | -   | -                | 1 to 3 reference images for subject-consistent generation (reference-to-video, or R2V). First Frame and Reference Images cannot be both set.                                                                                                                                                                                                                                                                                      |
| `referenceImagesType` | string      | No       | `ASSET` | -   | -   | `ASSET`, `STYLE` | The type of the reference image, which defines how the reference image will be used to generate the video. ASSET is a reference image that provides assets to the generated video, such as the scene, an object, a character, etc. STYLE is A reference image that provides aesthetics including colors, lighting, texture, etc., to be used as the style of the generated video, such as ‘anime’, ‘photography’, ‘origami’, etc. |
| `negativePrompt`      | string      | No       | -       | -   | -   | -                | Description of what to discourage in the generated video                                                                                                                                                                                                                                                                                                                                                                          |
| `resolution`          | string      | No       | `720p`  | -   | -   | `720p`, `1080p`  | Resolution of the generated video                                                                                                                                                                                                                                                                                                                                                                                                 |
| `generateAudio`       | boolean     | Yes      | `true`  | -   | -   | -                | Generate audio for the video                                                                                                                                                                                                                                                                                                                                                                                                      |
| `aspectRatio`         | string      | No       | `16:9`  | -   | -   | `16:9`, `9:16`   | Aspect ratio for the generated video. If the aspect ratio of the input image does not match the selected video ratio, the model may crop the image to fit.                                                                                                                                                                                                                                                                        |
| `duration`            | number      | No       | `8`     | -   | -   | `4`, `6`, `8`    | Video duration. With Reference Images, only 8s duration is supported.                                                                                                                                                                                                                                                                                                                                                             |
| `seed`                | number      | No       | -       | -   | -   | -                | Use a seed for reproducible results. Leave blank to use a random seed.                                                                                                                                                                                                                                                                                                                                                            |

## Google Veo 3.1 Extend Video

Use Veo 3.1 to extend videos that you previously generated with Veo by 7 seconds and up to 20 times.

**Model ID:** `model_veo3-1-extend-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_veo3-1-extend-video/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                                |
| --------------- | ------- | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| `prompt`        | string  | No       | -       | -   | -   | -              | Describe your video                                                                                        |
| `video`         | file    | Yes      | -       | -   | -   | -              | Input video to extend. Must be a clip in 16:9 aspect ratio, with a short-side resolution of 720p or 1080p. |
| `generateAudio` | boolean | Yes      | `true`  | -   | -   | -              | Generate audio for the video                                                                               |
| `seed`          | number  | No       | -       | -   | -   | -              | Use a seed for reproducible results. Leave blank to use a random seed.                                     |

## Google Veo 3.1 Fast

Veo 3.1 Fast is a faster, more affordable version of Veo 3.1, Google’s realistic physics video model for simulating natural phenomena and physical interactions. Veo 3.1 Fast can also generate sound and music.

**Model ID:** `model_veo3-1-fast`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_veo3-1-fast/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values  | Description                                                                                                                                                                                        |
| ----------------- | ----------- | -------- | ------- | --- | --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | No       | -       | -   | -   | -               | Describe your video                                                                                                                                                                                |
| `image`           | file        | No       | -       | -   | -   | -               | Image used as the first frame of the video. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose. First Frame and Reference Images cannot be both set. |
| `lastFrameImage`  | file        | No       | -       | -   | -   | -               | Last frame of the video to start generating from. When provided with an input image, creates a transition between the two images.                                                                  |
| `referenceImages` | file\_array | No       | -       | -   | -   | -               | 1 to 3 reference images for subject-consistent generation (reference-to-video, or R2V). First Frame and Reference Images cannot be both set.                                                       |
| `negativePrompt`  | string      | No       | -       | -   | -   | -               | Description of what to discourage in the generated video                                                                                                                                           |
| `resolution`      | string      | No       | `720p`  | -   | -   | `720p`, `1080p` | Resolution of the generated video                                                                                                                                                                  |
| `generateAudio`   | boolean     | Yes      | `true`  | -   | -   | -               | Generate audio for the video                                                                                                                                                                       |
| `aspectRatio`     | string      | No       | `16:9`  | -   | -   | `16:9`, `9:16`  | Aspect ratio for the generated video. If the aspect ratio of the input image does not match the selected video ratio, the model may crop the image to fit.                                         |
| `duration`        | number      | No       | `8`     | -   | -   | `4`, `6`, `8`   | Video duration. With Reference Images, only 8s duration is supported.                                                                                                                              |
| `seed`            | number      | No       | -       | -   | -   | -               | Use a seed for reproducible results. Leave blank to use a random seed.                                                                                                                             |

## Google Veo 3.1 Lite

Veo 3.1 Lite is a lite version of Veo 3.1, Google’s realistic physics video model for simulating natural phenomena and physical interactions. Veo 3.1 Lite can also generate sound and music.

**Model ID:** `model_veo3-1-lite`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_veo3-1-lite/markdown>

| Parameter        | Type    | Required | Default | Min | Max | Allowed Values  | Description                                                                                                                                                |
| ---------------- | ------- | -------- | ------- | --- | --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string  | No       | -       | -   | -   | -               | Describe your video                                                                                                                                        |
| `image`          | file    | No       | -       | -   | -   | -               | Image used as the first frame of the video. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose.              |
| `lastFrameImage` | file    | No       | -       | -   | -   | -               | Last frame of the video to start generating from. When provided with an input image, creates a transition between the two images.                          |
| `negativePrompt` | string  | No       | -       | -   | -   | -               | Description of what to discourage in the generated video                                                                                                   |
| `resolution`     | string  | No       | `720p`  | -   | -   | `720p`, `1080p` | Resolution of the generated video                                                                                                                          |
| `generateAudio`  | boolean | Yes      | `true`  | -   | -   | -               | Generate audio for the video                                                                                                                               |
| `aspectRatio`    | string  | No       | `16:9`  | -   | -   | `16:9`, `9:16`  | Aspect ratio for the generated video. If the aspect ratio of the input image does not match the selected video ratio, the model may crop the image to fit. |
| `duration`       | number  | No       | `8`     | -   | -   | `4`, `6`, `8`   | Video duration                                                                                                                                             |
| `seed`           | number  | No       | -       | -   | -   | -               | Use a seed for reproducible results. Leave blank to use a random seed.                                                                                     |
