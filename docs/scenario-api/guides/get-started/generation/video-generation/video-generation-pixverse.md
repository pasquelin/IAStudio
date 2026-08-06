---
title: PixVerse | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-16.

This reference lists all available **PixVerse** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Pixverse Lipsync](#pixverse-lipsync)
- [Pixverse Swap](#pixverse-swap)
- [Pixverse V4.5](#pixverse-v45)
- [Pixverse V5](#pixverse-v5)
- [Pixverse V6 I2V](#pixverse-v6-i2v)
- [Pixverse V6 T2V](#pixverse-v6-t2v)

---

## Pixverse Lipsync

Generate realistic lipsync animations from audio using advanced algorithms for high-quality synchronization with PixVerse Lipsync model

**Model ID:** `model_pixverse-lipsync`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixverse-lipsync/markdown>

| Parameter | Type   | Required | Default | Min | Max | Allowed Values                                                                                                                          | Description                                          |
| --------- | ------ | -------- | ------- | --- | --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `video`   | file   | Yes      | -       | -   | -   | -                                                                                                                                       | Input video file                                     |
| `audio`   | file   | No       | -       | -   | -   | -                                                                                                                                       | Input audio file. If not provided, TTS will be used. |
| `text`    | string | No       | -       | -   | -   | -                                                                                                                                       | Text content for TTS when Audio is not provided      |
| `voice`   | string | No       | `Auto`  | -   | -   | `Emily`, `James`, `Isabella`, `Liam`, `Chloe`, `Adrian`, `Harper`, `Ava`, `Sophia`, `Julia`, `Mason`, `Jack`, `Oliver`, `Ethan`, `Auto` | Voice to use for TTS when Audio is not provided      |

## Pixverse Swap

Generate high quality video clips by swapping person, objects and background using Pixverse Swap.

**Model ID:** `model_pixverse-swap`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixverse-swap/markdown>

| Parameter             | Type    | Required | Default | Min | Max | Allowed Values         | Description                                                                                        |
| --------------------- | ------- | -------- | ------- | --- | --- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `video`               | file    | Yes      | -       | -   | -   | -                      | Video to swap person, objects and background from. Video resolution cannot exceed 1920x1920 limit. |
| `image`               | file    | Yes      | -       | -   | -   | -                      | Image to swap person, objects and background to.                                                   |
| `mode`                | string  | No       | -       | -   | -   | `person`, `background` | Mode to swap person, objects and background in.                                                    |
| `resolution`          | string  | No       | `720p`  | -   | -   | `720p`, `540p`, `360p` | Resolution of the swapped video.                                                                   |
| `originalSoundSwitch` | boolean | No       | `true`  | -   | -   | -                      | Enable original sound of the input video.                                                          |

## Pixverse V4.5

Pixverse V4.5 is a high-end video model for complex scene composition and versatile visual production.

**Model ID:** `model_pixverse-v4-5`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixverse-v4-5/markdown>

| Parameter           | Type    | Required | Default  | Min | Max | Allowed Values                                                                                                                                                                                                                                                 | Description                                                                                                                                                                       |
| ------------------- | ------- | -------- | -------- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`            | string  | Yes      | -        | -   | -   | -                                                                                                                                                                                                                                                              | Describe your video                                                                                                                                                               |
| `image`             | file    | No       | -        | -   | -   | -                                                                                                                                                                                                                                                              | Image used as the first frame of the video.                                                                                                                                       |
| `lastFrameImage`    | file    | No       | -        | -   | -   | -                                                                                                                                                                                                                                                              | Used to generate a video that transitions from the first frame to this image. Requires a first frame image.                                                                       |
| `negativePrompt`    | string  | No       | -        | -   | -   | -                                                                                                                                                                                                                                                              | Negative prompt to avoid certain elements in the video                                                                                                                            |
| `soundEffectPrompt` | string  | No       | -        | -   | -   | -                                                                                                                                                                                                                                                              | Sound effect prompt. If not given, a random sound effect will be generated.                                                                                                       |
| `soundEffectSwitch` | boolean | No       | `true`   | -   | -   | -                                                                                                                                                                                                                                                              | Enable background music or sound effects                                                                                                                                          |
| `quality`           | string  | No       | `540p`   | -   | -   | `360p`, `540p`, `720p`, `1080p`                                                                                                                                                                                                                                | Video resolution                                                                                                                                                                  |
| `aspectRatio`       | string  | No       | `16:9`   | -   | -   | `9:16`, `1:1`, `16:9`                                                                                                                                                                                                                                          | Aspect ratio of the video                                                                                                                                                         |
| `duration`          | number  | No       | `5`      | -   | -   | `5`, `8`                                                                                                                                                                                                                                                       | Duration in seconds. (1080p does not support 8 second duration)                                                                                                                   |
| `motionMode`        | string  | No       | `normal` | -   | -   | `normal`, `smooth`                                                                                                                                                                                                                                             | Motion mode for the video. Smooth videos generate more frames, so they cost more. (smooth is only available when using a 5 second duration, 1080p does not support smooth motion) |
| `style`             | string  | No       | `None`   | -   | -   | `None`, `anime`, `3d_animation`, `clay`, `cyberpunk`, `comic`                                                                                                                                                                                                  | Style of the video                                                                                                                                                                |
| `effect`            | string  | No       | `None`   | -   | -   | `None`, `Let's YMCA!`, `Subject 3 Fever`, `Ghibli Live!`, `Suit Swagger`, `Muscle Surge`, `360° Microwave`, `Warmth of Jesus`, `Emergency Beat`, `Anything, Robot`, `Kungfu Club`, `Mint in Box`, `Retro Anime Pop`, `Vogue Walk`, `Mega Dive`, `Evil Trigger` | Special effect to apply to the video                                                                                                                                              |
| `seed`              | number  | No       | -        | -   | -   | -                                                                                                                                                                                                                                                              | Use a seed for reproducible results. Leave blank to use a random seed.                                                                                                            |

## Pixverse V5

**Model ID:** `model_pixverse-v5`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixverse-v5/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                                                                 | Description                                                                                                 |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -   | -                                                                                                                                                                                                                                                              | Describe your video                                                                                         |
| `image`          | file   | No       | -       | -   | -   | -                                                                                                                                                                                                                                                              | Image used as the first frame of the video.                                                                 |
| `lastFrameImage` | file   | No       | -       | -   | -   | -                                                                                                                                                                                                                                                              | Used to generate a video that transitions from the first frame to this image. Requires a first frame image. |
| `quality`        | string | No       | `720p`  | -   | -   | `360p`, `540p`, `720p`, `1080p`                                                                                                                                                                                                                                | Resolution of the video.                                                                                    |
| `aspectRatio`    | string | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9`                                                                                                                                                                                                                                          | Aspect ratio of the video                                                                                   |
| `duration`       | number | No       | `5`     | -   | -   | `5`, `8`                                                                                                                                                                                                                                                       | Duration of the video in seconds.                                                                           |
| `negativePrompt` | string | No       | -       | -   | -   | -                                                                                                                                                                                                                                                              | Negative prompt to avoid certain elements in the video                                                      |
| `effect`         | string | No       | `None`  | -   | -   | `None`, `Let's YMCA!`, `Subject 3 Fever`, `Ghibli Live!`, `Suit Swagger`, `Muscle Surge`, `360° Microwave`, `Warmth of Jesus`, `Emergency Beat`, `Anything, Robot`, `Kungfu Club`, `Mint in Box`, `Retro Anime Pop`, `Vogue Walk`, `Mega Dive`, `Evil Trigger` | Special effect to apply to the video. Does not work when last frame is provided.                            |
| `seed`           | number | No       | -       | -   | -   | -                                                                                                                                                                                                                                                              | Use a seed for reproducible results. Leave blank to use a random seed.                                      |

## Pixverse V6 I2V

PixVerse V6 image-to-video — 360p–1080p, 1–15s, optional BGM/SFX/dialogue and multi-clip camera.

**Model ID:** `model_pixverse-v6-i2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixverse-v6-i2v/markdown>

| Parameter                 | Type    | Required | Default | Min | Max | Allowed Values                                        | Description                                                     |
| ------------------------- | ------- | -------- | ------- | --- | --- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `prompt`                  | string  | Yes      | -       | -   | -   | -                                                     | Describe the motion and scene for the video                     |
| `image`                   | file    | Yes      | -       | -   | -   | -                                                     | Image used as the first frame of the video                      |
| `negativePrompt`          | string  | No       | -       | -   | -   | -                                                     | Content to avoid in the generation                              |
| `resolution`              | string  | No       | `720p`  | -   | -   | `360p`, `540p`, `720p`, `1080p`                       | Resolution of the generated video                               |
| `duration`                | number  | No       | `5`     | 1   | 15  | -                                                     | Duration of the generated video in seconds (1–15)               |
| `style`                   | string  | No       | `anime` | -   | -   | `anime`, `3d_animation`, `clay`, `comic`, `cyberpunk` | Visual style of the generated video                             |
| `generateAudioSwitch`     | boolean | No       | `false` | -   | -   | -                                                     | Enable audio generation (BGM, SFX, dialogue)                    |
| `generateMultiClipSwitch` | boolean | No       | `false` | -   | -   | -                                                     | Enable multi-clip generation with dynamic camera changes        |
| `thinkingType`            | string  | No       | `auto`  | -   | -   | `enabled`, `disabled`, `auto`                         | Prompt optimization: enabled, disabled, or auto (model decides) |
| `seed`                    | number  | No       | -       | -   | -   | -                                                     | Use a seed for reproducible results. Leave blank for random.    |

## Pixverse V6 T2V

PixVerse V6 text-to-video — 360p–1080p, 1–15s, optional BGM/SFX/dialogue and multi-clip camera.

**Model ID:** `model_pixverse-v6-t2v`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_pixverse-v6-t2v/markdown>

| Parameter                 | Type    | Required | Default | Min | Max | Allowed Values                                            | Description                                                     |
| ------------------------- | ------- | -------- | ------- | --- | --- | --------------------------------------------------------- | --------------------------------------------------------------- |
| `prompt`                  | string  | Yes      | -       | -   | -   | -                                                         | Describe the video to generate                                  |
| `negativePrompt`          | string  | No       | -       | -   | -   | -                                                         | Content to avoid in the generation                              |
| `aspectRatio`             | string  | No       | `16:9`  | -   | -   | `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `2:3`, `3:2`, `21:9` | Aspect ratio of the generated video                             |
| `resolution`              | string  | No       | `720p`  | -   | -   | `360p`, `540p`, `720p`, `1080p`                           | Resolution of the generated video                               |
| `duration`                | number  | No       | `5`     | 1   | 15  | -                                                         | Duration of the generated video in seconds (1–15)               |
| `style`                   | string  | No       | `anime` | -   | -   | `anime`, `3d_animation`, `clay`, `comic`, `cyberpunk`     | Visual style of the generated video                             |
| `generateAudioSwitch`     | boolean | No       | `false` | -   | -   | -                                                         | Enable audio generation (BGM, SFX, dialogue)                    |
| `generateMultiClipSwitch` | boolean | No       | `false` | -   | -   | -                                                         | Enable multi-clip generation with dynamic camera changes        |
| `thinkingType`            | string  | No       | `auto`  | -   | -   | `enabled`, `disabled`, `auto`                             | Prompt optimization: enabled, disabled, or auto (model decides) |
| `seed`                    | number  | No       | -       | -   | -   | -                                                         | Use a seed for reproducible results. Leave blank for random.    |
