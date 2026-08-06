---
title: Pruna AI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Pruna AI** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [P-Video](#p-video)
- [P-Video Animate](#p-video-animate)
- [P-Video Replace](#p-video-replace)
- [Pruna P-Avatar](#pruna-p-avatar)

---

## P-Video

P-Video is a video generation model that uses a text prompt to generate a video.

**Model ID:** `model_p-video`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_p-video/markdown>

| Parameter          | Type    | Required | Default | Min | Max | Allowed Values                                    | Description                                                              |
| ------------------ | ------- | -------- | ------- | --- | --- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `prompt`           | string  | Yes      | -       | -   | -   | -                                                 | Text prompt for video generation.                                        |
| `image`            | file    | No       | -       | -   | -   | -                                                 | Input image to generate video from.                                      |
| `lastFrameImage`   | file    | No       | -       | -   | -   | -                                                 | Input image to generate video from.                                      |
| `audio`            | file    | No       | -       | -   | -   | -                                                 | Input audio to condition video generation.                               |
| `duration`         | number  | No       | `5`     | 1   | 20  | -                                                 | Duration of the video in seconds (1-20). Ignored when audio is provided. |
| `aspectRatio`      | string  | No       | `16:9`  | -   | -   | `16:9`, `4:3`, `3:2`, `1:1`, `2:3`, `3:4`, `9:16` | Aspect ratio of the video. Ignored when an input image is provided.      |
| `resolution`       | string  | No       | `720p`  | -   | -   | `720p`, `1080p`                                   | Resolution of the video.                                                 |
| `fps`              | number  | No       | `24`    | -   | -   | `24`, `48`                                        | Frames per second of the video.                                          |
| `draft`            | boolean | No       | `false` | -   | -   | -                                                 | Draft mode. Generates a lower-quality preview of the video.              |
| `promptUpsampling` | boolean | No       | `true`  | -   | -   | -                                                 | Use prompt upsampling to enhance the prompt.                             |
| `saveAudio`        | boolean | No       | `true`  | -   | -   | -                                                 | Save the video with audio.                                               |
| `seed`             | number  | No       | -       | -   | -   | -                                                 | Random seed. Set for reproducible generation.                            |

## P-Video Animate

Animate a reference subject image using the motion from a source video.

**Model ID:** `model_pruna-p-video-animate`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pruna-p-video-animate/markdown>

| Parameter           | Type    | Required | Default    | Min | Max        | Allowed Values         | Description                                                              |
| ------------------- | ------- | -------- | ---------- | --- | ---------- | ---------------------- | ------------------------------------------------------------------------ |
| `video`             | file    | Yes      | -          | -   | -          | -                      | Source RGB video used for motion. Supports mp4.                          |
| `image`             | file    | Yes      | -          | -   | -          | -                      | Reference subject image to animate.                                      |
| `instructionPrompt` | string  | No       | -          | -   | -          | -                      | Instructions for animating the reference subject from the source motion. |
| `resolution`        | string  | No       | `1080p`    | -   | -          | `720p`, `1080p`        | Target resolution of the output video.                                   |
| `saveAudio`         | boolean | No       | `true`     | -   | -          | -                      | Save the generated video with audio.                                     |
| `targetFps`         | string  | No       | `original` | -   | -          | `original`, `24`, `48` | Target FPS for the working video.                                        |
| `seed`              | number  | No       | -          | 0   | 4294967295 | -                      | Random seed for reproducible generation.                                 |

## P-Video Replace

Place one to four reference identities into a source video scene.

**Model ID:** `model_pruna-p-video-replace`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pruna-p-video-replace/markdown>

| Parameter           | Type        | Required | Default    | Min | Max        | Allowed Values         | Description                                                          |
| ------------------- | ----------- | -------- | ---------- | --- | ---------- | ---------------------- | -------------------------------------------------------------------- |
| `video`             | file        | Yes      | -          | -   | -          | -                      | Source RGB video scene. Supports mp4.                                |
| `images`            | file\_array | Yes      | -          | -   | -          | -                      | One to four identity reference images to place into the video.       |
| `instructionPrompt` | string      | No       | -          | -   | -          | -                      | Instructions for placing reference identities into the source scene. |
| `resolution`        | string      | No       | `1080p`    | -   | -          | `720p`, `1080p`        | Target resolution of the output video.                               |
| `saveAudio`         | boolean     | No       | `true`     | -   | -          | -                      | Save the generated video with audio.                                 |
| `targetFps`         | string      | No       | `original` | -   | -          | `original`, `24`, `48` | Target FPS for the working video.                                    |
| `seed`              | number      | No       | -          | 0   | 4294967295 | -                      | Random seed for reproducible generation.                             |

## Pruna P-Avatar

Generate talking-avatar videos from a portrait image with either a voice script or uploaded audio.

**Model ID:** `model_pruna-p-avatar`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pruna-p-avatar/markdown>

| Parameter                 | Type    | Required | Default           | Min | Max        | Allowed Values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Description                                                                                                                                                                  |
| ------------------------- | ------- | -------- | ----------------- | --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`                   | file    | Yes      | -                 | -   | -          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Portrait image URI (URL, S3, or data URI). Supports jpg, jpeg, png, webp.                                                                                                    |
| `voiceScript`             | string  | No       | -                 | -   | -          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Script for the avatar to speak when no audio is uploaded.                                                                                                                    |
| `audio`                   | file    | No       | -                 | -   | -          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Uploaded audio used for speech. If both audio and voice script are provided, audio is used.                                                                                  |
| `videoPrompt`             | string  | No       | -                 | -   | -          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Optional prompt for the video. Pruna defaults if omitted.                                                                                                                    |
| `voicePrompt`             | string  | No       | -                 | -   | -          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Optional speaking style, tone, pacing, and emotion instructions.                                                                                                             |
| `negativePrompt`          | string  | No       | -                 | -   | -          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Optional description of what to avoid in the video. Pruna defaults if omitted.                                                                                               |
| `voice`                   | string  | No       | `Zephyr (Female)` | -   | -          | `Zephyr (Female)`, `Puck (Male)`, `Charon (Male)`, `Kore (Female)`, `Fenrir (Male)`, `Leda (Female)`, `Orus (Male)`, `Aoede (Female)`, `Callirrhoe (Female)`, `Autonoe (Female)`, `Enceladus (Male)`, `Iapetus (Male)`, `Umbriel (Male)`, `Algenib (Male)`, `Despina (Female)`, `Erinome (Female)`, `Laomedeia (Female)`, `Achernar (Female)`, `Algieba (Male)`, `Schedar (Male)`, `Gacrux (Female)`, `Pulcherrima (Female)`, `Achird (Male)`, `Zubenelgenubi (Male)`, `Vindemiatrix (Female)`, `Sadachbia (Male)`, `Sadaltager (Male)`, `Sulafat (Female)`, `Alnilam (Male)`, `Rasalgethi (Male)` | Voice for generated speech.                                                                                                                                                  |
| `voiceLanguage`           | string  | No       | `English (US)`    | -   | -          | `English (US)`, `English (UK)`, `Spanish`, `French`, `German`, `Italian`, `Portuguese (Brazil)`, `Japanese`, `Korean`, `Hindi`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Output language for generated speech.                                                                                                                                        |
| `resolution`              | string  | No       | `720p`            | -   | -          | `720p`, `1080p`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Resolution of the generated video. Please note that 1080p portrait videos may experience color artifacts. For optimal quality in portrait mode, we recommend selecting 720p. |
| `disablePromptUpsampling` | boolean | No       | `false`           | -   | -          | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Disable Prompt Upsampling                                                                                                                                                    |
| `strengthNegativePrompt`  | number  | No       | `15`              | 0   | 100        | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Strength of the negative prompt on a 0-100 scale. Pruna defaults if omitted.                                                                                                 |
| `seed`                    | number  | No       | -                 | 0   | 4294967295 | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Random seed for reproducible generation.                                                                                                                                     |
