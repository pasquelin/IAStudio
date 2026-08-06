---
title: Shengshu Technology | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Shengshu Technology** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Vidu 2.0 I2V](#vidu-20-i2v)
- [Vidu 2.0 Reference2V](#vidu-20-reference2v)
- [Vidu Q1 Classic I2V](#vidu-q1-classic-i2v)
- [Vidu Q1 I2V](#vidu-q1-i2v)
- [Vidu Q1 Reference2V](#vidu-q1-reference2v)
- [Vidu Q1 T2V](#vidu-q1-t2v)
- [Vidu Q2 Pro Fast I2V](#vidu-q2-pro-fast-i2v)
- [Vidu Q2 Pro I2V](#vidu-q2-pro-i2v)
- [Vidu Q2 Pro Reference2V](#vidu-q2-pro-reference2v)
- [Vidu Q2 Reference2V](#vidu-q2-reference2v)
- [Vidu Q2 T2V](#vidu-q2-t2v)
- [Vidu Q2 Turbo I2V](#vidu-q2-turbo-i2v)
- [Vidu Q3 Pro I2V](#vidu-q3-pro-i2v)
- [Vidu Q3 Pro T2V](#vidu-q3-pro-t2v)
- [Vidu Q3 Turbo I2V](#vidu-q3-turbo-i2v)
- [Vidu Q3 Turbo T2V](#vidu-q3-turbo-t2v)

---

## Vidu 2.0 I2V

Vidu 2.0 image-to-video generation. 4s (360p/720p/1080p) or 8s (720p only).

**Model ID:** `model_vidu-i2v-2-0`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-i2v-2-0/markdown>

| Parameter           | Type        | Required | Default          | Min | Max | Allowed Values                         | Description                                                                                                                                   |
| ------------------- | ----------- | -------- | ---------------- | --- | --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `generationType`    | string      | Yes      | `image_to_video` | -   | -   | `image_to_video`, `start_end_to_video` | Select the type of video generation. For Image to Video, use only one image. For Start/End to Video, use two images.                          |
| `images`            | file\_array | Yes      | -                | -   | -   | -                                      | For Image to Video, use only one image. For Start/End to Video, use two images: the first as the start frame and the second as the end frame. |
| `prompt`            | string      | No       | -                | -   | -   | -                                      | Text prompt describing the desired video generation                                                                                           |
| `duration`          | number      | No       | `8`              | 4   | 8   | `4`, `8`                               | Video duration in seconds. 4s supports all resolutions, 8s only supports 720p.                                                                |
| `resolution`        | string      | No       | `720p`           | -   | -   | `360p`, `720p`, `1080p`                | Video resolution. Note: 8s duration only supports 720p.                                                                                       |
| `movementAmplitude` | string      | No       | `auto`           | -   | -   | `auto`, `small`, `medium`, `large`     | Movement amplitude of objects in the frame                                                                                                    |
| `audio`             | boolean     | No       | `false`          | -   | -   | -                                      | Whether to add background music to the generated video                                                                                        |
| `seed`              | number      | No       | -                | -   | -   | -                                      | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Vidu 2.0 Reference2V

Vidu 2.0 references-to-video generation. 4 seconds, 360p/720p.

**Model ID:** `model_vidu-reference2v-2-0`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-reference2v-2-0/markdown>

| Parameter           | Type        | Required | Default | Min | Max | Allowed Values                     | Description                                                            |
| ------------------- | ----------- | -------- | ------- | --- | --- | ---------------------------------- | ---------------------------------------------------------------------- |
| `images`            | file\_array | Yes      | -       | -   | -   | -                                  | Add up to 7 reference images for your video.                           |
| `prompt`            | string      | Yes      | -       | -   | -   | -                                  | Text prompt describing the desired video generation                    |
| `resolution`        | string      | No       | `360p`  | -   | -   | `360p`, `720p`                     | Video resolution                                                       |
| `aspectRatio`       | string      | No       | `16:9`  | -   | -   | `16:9`, `1:1`, `9:16`              | Aspect ratio of the output video                                       |
| `movementAmplitude` | string      | No       | `auto`  | -   | -   | `auto`, `small`, `medium`, `large` | Movement amplitude of objects in the frame                             |
| `audio`             | boolean     | No       | `false` | -   | -   | -                                  | Whether to add background music to the generated video                 |
| `seed`              | number      | No       | -       | -   | -   | -                                  | Use a seed for reproducible results. Leave blank to use a random seed. |

## Vidu Q1 Classic I2V

Vidu Q1 Classic image-to-video generation. 5 seconds, 1080p only.

**Model ID:** `model_vidu-i2v-q1-classic`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-i2v-q1-classic/markdown>

| Parameter           | Type        | Required | Default          | Min | Max | Allowed Values                         | Description                                                                                                                                   |
| ------------------- | ----------- | -------- | ---------------- | --- | --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `generationType`    | string      | Yes      | `image_to_video` | -   | -   | `image_to_video`, `start_end_to_video` | Select the type of video generation. For Image to Video, use only one image. For Start/End to Video, use two images.                          |
| `images`            | file\_array | Yes      | -                | -   | -   | -                                      | For Image to Video, use only one image. For Start/End to Video, use two images: the first as the start frame and the second as the end frame. |
| `prompt`            | string      | No       | -                | -   | -   | -                                      | Text prompt describing the desired video generation                                                                                           |
| `style`             | string      | No       | `general`        | -   | -   | `general`, `anime`                     | Style of the output video                                                                                                                     |
| `movementAmplitude` | string      | No       | `auto`           | -   | -   | `auto`, `small`, `medium`, `large`     | Movement amplitude of objects in the frame                                                                                                    |
| `audio`             | boolean     | No       | `false`          | -   | -   | -                                      | Whether to add background music to the generated video                                                                                        |
| `seed`              | number      | No       | -                | -   | -   | -                                      | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Vidu Q1 I2V

Vidu Q1 image-to-video generation. 5 seconds, 1080p only.

**Model ID:** `model_vidu-i2v-q1`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-i2v-q1/markdown>

| Parameter           | Type        | Required | Default          | Min | Max | Allowed Values                         | Description                                                                                                                                   |
| ------------------- | ----------- | -------- | ---------------- | --- | --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `generationType`    | string      | Yes      | `image_to_video` | -   | -   | `image_to_video`, `start_end_to_video` | Select the type of video generation. For Image to Video, use only one image. For Start/End to Video, use two images.                          |
| `images`            | file\_array | Yes      | -                | -   | -   | -                                      | For Image to Video, use only one image. For Start/End to Video, use two images: the first as the start frame and the second as the end frame. |
| `prompt`            | string      | No       | -                | -   | -   | -                                      | Text prompt describing the desired video generation                                                                                           |
| `style`             | string      | No       | `general`        | -   | -   | `general`, `anime`                     | Style of the output video                                                                                                                     |
| `movementAmplitude` | string      | No       | `auto`           | -   | -   | `auto`, `small`, `medium`, `large`     | Movement amplitude of objects in the frame                                                                                                    |
| `audio`             | boolean     | No       | `false`          | -   | -   | -                                      | Whether to add background music to the generated video                                                                                        |
| `seed`              | number      | No       | -                | -   | -   | -                                      | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Vidu Q1 Reference2V

Vidu Q1 references-to-video generation. 5 seconds, 1080p only.

**Model ID:** `model_vidu-reference2v-q1`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-reference2v-q1/markdown>

| Parameter           | Type        | Required | Default | Min | Max | Allowed Values                     | Description                                                            |
| ------------------- | ----------- | -------- | ------- | --- | --- | ---------------------------------- | ---------------------------------------------------------------------- |
| `images`            | file\_array | Yes      | -       | -   | -   | -                                  | Add up to 7 reference images for your video.                           |
| `prompt`            | string      | Yes      | -       | -   | -   | -                                  | Text prompt describing the desired video generation                    |
| `aspectRatio`       | string      | No       | `16:9`  | -   | -   | `16:9`, `1:1`, `9:16`              | Aspect ratio of the output video                                       |
| `movementAmplitude` | string      | No       | `auto`  | -   | -   | `auto`, `small`, `medium`, `large` | Movement amplitude of objects in the frame                             |
| `audio`             | boolean     | No       | `false` | -   | -   | -                                  | Whether to add background music to the generated video                 |
| `seed`              | number      | No       | -       | -   | -   | -                                  | Use a seed for reproducible results. Leave blank to use a random seed. |

## Vidu Q1 T2V

Vidu Q1 text-to-video generation. 5 seconds, 1080p only.

**Model ID:** `model_vidu-t2v-q1`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-t2v-q1/markdown>

| Parameter           | Type    | Required | Default   | Min | Max | Allowed Values                     | Description                                                            |
| ------------------- | ------- | -------- | --------- | --- | --- | ---------------------------------- | ---------------------------------------------------------------------- |
| `prompt`            | string  | No       | -         | -   | -   | -                                  | Text prompt describing the desired video generation                    |
| `style`             | string  | No       | `general` | -   | -   | `general`, `anime`                 | Style of the output video                                              |
| `aspectRatio`       | string  | No       | `16:9`    | -   | -   | `16:9`, `9:16`, `1:1`              | Aspect ratio of the output video                                       |
| `movementAmplitude` | string  | No       | `auto`    | -   | -   | `auto`, `small`, `medium`, `large` | Movement amplitude of objects in the frame                             |
| `audio`             | boolean | No       | `false`   | -   | -   | -                                  | Whether to add background music to the generated video                 |
| `seed`              | number  | No       | -         | -   | -   | -                                  | Use a seed for reproducible results. Leave blank to use a random seed. |

## Vidu Q2 Pro Fast I2V

Vidu Q2 Pro Fast image-to-video generation. Fast speed, low cost. 1-10 seconds, 720p/1080p.

**Model ID:** `model_vidu-i2v-q2-pro-fast`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-i2v-q2-pro-fast/markdown>

| Parameter        | Type        | Required | Default          | Min | Max | Allowed Values                         | Description                                                                                                                                   |
| ---------------- | ----------- | -------- | ---------------- | --- | --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `generationType` | string      | Yes      | `image_to_video` | -   | -   | `image_to_video`, `start_end_to_video` | Select the type of video generation. For Image to Video, use only one image. For Start/End to Video, use two images.                          |
| `images`         | file\_array | Yes      | -                | -   | -   | -                                      | For Image to Video, use only one image. For Start/End to Video, use two images: the first as the start frame and the second as the end frame. |
| `prompt`         | string      | No       | -                | -   | -   | -                                      | Text prompt describing the desired video generation                                                                                           |
| `duration`       | number      | No       | `5`              | 1   | 10  | -                                      | Video duration in seconds (1-10 for image-to-video, 1-8 for start-end)                                                                        |
| `resolution`     | string      | No       | `720p`           | -   | -   | `720p`, `1080p`                        | Video resolution                                                                                                                              |
| `audio`          | boolean     | No       | `false`          | -   | -   | -                                      | Whether to add background music to the generated video. Does not take effect for 9 or 10 seconds.                                             |
| `seed`           | number      | No       | -                | -   | -   | -                                      | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Vidu Q2 Pro I2V

Vidu Q2 Pro image-to-video generation. Excellent quality. 1-10 seconds, 540p/720p/1080p.

**Model ID:** `model_vidu-i2v-q2-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-i2v-q2-pro/markdown>

| Parameter        | Type        | Required | Default          | Min | Max | Allowed Values                         | Description                                                                                                                                   |
| ---------------- | ----------- | -------- | ---------------- | --- | --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `generationType` | string      | Yes      | `image_to_video` | -   | -   | `image_to_video`, `start_end_to_video` | Select the type of video generation. For Image to Video, use only one image. For Start/End to Video, use two images.                          |
| `images`         | file\_array | Yes      | -                | -   | -   | -                                      | For Image to Video, use only one image. For Start/End to Video, use two images: the first as the start frame and the second as the end frame. |
| `prompt`         | string      | No       | -                | -   | -   | -                                      | Text prompt describing the desired video generation                                                                                           |
| `duration`       | number      | No       | `5`              | 1   | 10  | -                                      | Video duration in seconds (1-10 for image-to-video, 1-8 for start-end)                                                                        |
| `resolution`     | string      | No       | `720p`           | -   | -   | `720p`, `1080p`                        | Video resolution                                                                                                                              |
| `audio`          | boolean     | No       | `false`          | -   | -   | -                                      | Whether to add background music to the generated video. Does not take effect for 9 or 10 seconds.                                             |
| `seed`           | number      | No       | -                | -   | -   | -                                      | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Vidu Q2 Pro Reference2V

Vidu Q2 references-to-video generation. Supports video reference, video editing, and video replacement

**Model ID:** `model_vidu-reference2v-q2-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-reference2v-q2-pro/markdown>

| Parameter     | Type        | Required | Default | Min | Max | Allowed Values          | Description                                                                                                                                                                                                                                                          |
| ------------- | ----------- | -------- | ------- | --- | --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`      | file\_array | No       | -       | -   | -   | -                       | Add up to 7 reference images for your video.                                                                                                                                                                                                                         |
| `videos`      | file\_array | No       | -       | -   | -   | -                       | Add up to 2 reference videos for your video. Must provide either this or images. Supports uploading at most 1 video of 8s or 2 videos of 5s. Video resolution cannot be less than 128\*128, aspect ratio must be between 1:4 and 4:1, and size must not exceed 100M. |
| `prompt`      | string      | Yes      | -       | -   | -   | -                       | Text prompt describing the desired video generation                                                                                                                                                                                                                  |
| `duration`    | number      | No       | `5`     | 1   | 10  | -                       | Video duration in seconds (1-10)                                                                                                                                                                                                                                     |
| `resolution`  | string      | No       | `1080p` | -   | -   | `540p`, `720p`, `1080p` | Video resolution                                                                                                                                                                                                                                                     |
| `aspectRatio` | string      | No       | `16:9`  | -   | -   | `16:9`, `1:1`, `9:16`   | Aspect ratio of the output video.                                                                                                                                                                                                                                    |
| `audio`       | boolean     | No       | `false` | -   | -   | -                       | Whether to add background music to the generated video                                                                                                                                                                                                               |
| `seed`        | number      | No       | -       | -   | -   | -                       | Use a seed for reproducible results. Leave blank to use a random seed.                                                                                                                                                                                               |

## Vidu Q2 Reference2V

Vidu Q2 references-to-video generation. 1-10 seconds, 540p/720p/1080p.

**Model ID:** `model_vidu-reference2v-q2`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-reference2v-q2/markdown>

| Parameter     | Type        | Required | Default | Min | Max | Allowed Values                      | Description                                                                                       |
| ------------- | ----------- | -------- | ------- | --- | --- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `images`      | file\_array | Yes      | -       | -   | -   | -                                   | Add up to 7 reference images for your video.                                                      |
| `prompt`      | string      | Yes      | -       | -   | -   | -                                   | Text prompt describing the desired video generation                                               |
| `duration`    | number      | No       | `5`     | 1   | 10  | -                                   | Video duration in seconds (1-10)                                                                  |
| `resolution`  | string      | No       | `1080p` | -   | -   | `540p`, `720p`, `1080p`             | Video resolution                                                                                  |
| `aspectRatio` | string      | No       | `16:9`  | -   | -   | `16:9`, `4:3`, `1:1`, `9:16`, `3:4` | Aspect ratio of the output video.                                                                 |
| `audio`       | boolean     | No       | `false` | -   | -   | -                                   | Whether to add background music to the generated video. Does not take effect for 9 or 10 seconds. |
| `seed`        | number      | No       | -       | -   | -   | -                                   | Use a seed for reproducible results. Leave blank to use a random seed.                            |

## Vidu Q2 T2V

Vidu Q2 text-to-video generation. 1-10 seconds, 540p/720p/1080p.

**Model ID:** `model_vidu-t2v-q2`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-t2v-q2/markdown>

| Parameter     | Type    | Required | Default | Min | Max | Allowed Values                      | Description                                                            |
| ------------- | ------- | -------- | ------- | --- | --- | ----------------------------------- | ---------------------------------------------------------------------- |
| `prompt`      | string  | No       | -       | -   | -   | -                                   | Text prompt describing the desired video generation                    |
| `resolution`  | string  | No       | `720p`  | -   | -   | `540p`, `720p`, `1080p`             | Video resolution                                                       |
| `duration`    | number  | No       | `5`     | 1   | 10  | -                                   | Video duration in seconds                                              |
| `aspectRatio` | string  | No       | `16:9`  | -   | -   | `16:9`, `9:16`, `1:1`, `3:4`, `4:3` | Aspect ratio of the output video                                       |
| `audio`       | boolean | No       | `false` | -   | -   | -                                   | Whether to add background music to the generated video                 |
| `seed`        | number  | No       | -       | -   | -   | -                                   | Use a seed for reproducible results. Leave blank to use a random seed. |

## Vidu Q2 Turbo I2V

Vidu Q2 Turbo image-to-video generation. Good quality, fast. 1-10 seconds, 540p/720p/1080p.

**Model ID:** `model_vidu-i2v-q2-turbo`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-i2v-q2-turbo/markdown>

| Parameter        | Type        | Required | Default          | Min | Max | Allowed Values                         | Description                                                                                                                                   |
| ---------------- | ----------- | -------- | ---------------- | --- | --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `generationType` | string      | Yes      | `image_to_video` | -   | -   | `image_to_video`, `start_end_to_video` | Select the type of video generation. For Image to Video, use only one image. For Start/End to Video, use two images.                          |
| `images`         | file\_array | Yes      | -                | -   | -   | -                                      | For Image to Video, use only one image. For Start/End to Video, use two images: the first as the start frame and the second as the end frame. |
| `prompt`         | string      | No       | -                | -   | -   | -                                      | Text prompt describing the desired video generation                                                                                           |
| `duration`       | number      | No       | `5`              | 1   | 10  | -                                      | Video duration in seconds (1-10 for image-to-video, 1-8 for start-end)                                                                        |
| `resolution`     | string      | No       | `720p`           | -   | -   | `720p`, `1080p`                        | Video resolution                                                                                                                              |
| `audio`          | boolean     | No       | `false`          | -   | -   | -                                      | Whether to add background music to the generated video. Does not take effect for 9 or 10 seconds.                                             |
| `seed`           | number      | No       | -                | -   | -   | -                                      | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Vidu Q3 Pro I2V

Vidu Q3 Pro image-to-video generation. Excellent quality. 1-10 seconds, 540p/720p/1080p.

**Model ID:** `model_vidu-i2v-q3-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-i2v-q3-pro/markdown>

| Parameter        | Type        | Required | Default          | Min | Max | Allowed Values                         | Description                                                                                                                                   |
| ---------------- | ----------- | -------- | ---------------- | --- | --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `generationType` | string      | Yes      | `image_to_video` | -   | -   | `image_to_video`, `start_end_to_video` | Select the type of video generation. For Image to Video, use only one image. For Start/End to Video, use two images.                          |
| `images`         | file\_array | Yes      | -                | -   | -   | -                                      | For Image to Video, use only one image. For Start/End to Video, use two images: the first as the start frame and the second as the end frame. |
| `prompt`         | string      | No       | -                | -   | -   | -                                      | Text prompt describing the desired video generation                                                                                           |
| `duration`       | number      | No       | `5`              | 1   | 16  | -                                      | Video duration in seconds                                                                                                                     |
| `resolution`     | string      | No       | `720p`           | -   | -   | `540p`, `720p`, `1080p`                | Video resolution                                                                                                                              |
| `audio`          | boolean     | No       | `false`          | -   | -   | -                                      | Whether to add background music to the generated video                                                                                        |
| `seed`           | number      | No       | -                | -   | -   | -                                      | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Vidu Q3 Pro T2V

Vidu Q3 Pro text-to-video generation. Supports audio-visual synchronization, supports video shot segmentation.

**Model ID:** `model_vidu-t2v-q3-pro`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-t2v-q3-pro/markdown>

| Parameter     | Type    | Required | Default | Min | Max | Allowed Values                      | Description                                                            |
| ------------- | ------- | -------- | ------- | --- | --- | ----------------------------------- | ---------------------------------------------------------------------- |
| `prompt`      | string  | No       | -       | -   | -   | -                                   | Text prompt describing the desired video generation                    |
| `resolution`  | string  | No       | `720p`  | -   | -   | `540p`, `720p`, `1080p`             | Video resolution                                                       |
| `duration`    | number  | No       | `5`     | 1   | 16  | -                                   | Video duration in seconds                                              |
| `aspectRatio` | string  | No       | `16:9`  | -   | -   | `16:9`, `9:16`, `1:1`, `3:4`, `4:3` | Aspect ratio of the output video                                       |
| `audio`       | boolean | No       | `false` | -   | -   | -                                   | Whether to add background music to the generated video                 |
| `seed`        | number  | No       | -       | -   | -   | -                                   | Use a seed for reproducible results. Leave blank to use a random seed. |

## Vidu Q3 Turbo I2V

Vidu Q3 Turbo image-to-video generation. Good quality, fast. 1-10 seconds, 540p/720p/1080p.

**Model ID:** `model_vidu-i2v-q3-turbo`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-i2v-q3-turbo/markdown>

| Parameter        | Type        | Required | Default          | Min | Max | Allowed Values                         | Description                                                                                                                                   |
| ---------------- | ----------- | -------- | ---------------- | --- | --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `generationType` | string      | Yes      | `image_to_video` | -   | -   | `image_to_video`, `start_end_to_video` | Select the type of video generation. For Image to Video, use only one image. For Start/End to Video, use two images.                          |
| `images`         | file\_array | Yes      | -                | -   | -   | -                                      | For Image to Video, use only one image. For Start/End to Video, use two images: the first as the start frame and the second as the end frame. |
| `prompt`         | string      | No       | -                | -   | -   | -                                      | Text prompt describing the desired video generation                                                                                           |
| `duration`       | number      | No       | `5`              | 1   | 16  | -                                      | Video duration in seconds                                                                                                                     |
| `resolution`     | string      | No       | `720p`           | -   | -   | `540p`, `720p`, `1080p`                | Video resolution                                                                                                                              |
| `audio`          | boolean     | No       | `false`          | -   | -   | -                                      | Whether to add background music to the generated video                                                                                        |
| `seed`           | number      | No       | -                | -   | -   | -                                      | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Vidu Q3 Turbo T2V

Vidu Q3 Turbo text-to-video generation. Compared to viduq3-pro, the generation speed is faster

**Model ID:** `model_vidu-t2v-q3-turbo`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_vidu-t2v-q3-turbo/markdown>

| Parameter     | Type    | Required | Default | Min | Max | Allowed Values                      | Description                                                            |
| ------------- | ------- | -------- | ------- | --- | --- | ----------------------------------- | ---------------------------------------------------------------------- |
| `prompt`      | string  | No       | -       | -   | -   | -                                   | Text prompt describing the desired video generation                    |
| `resolution`  | string  | No       | `720p`  | -   | -   | `540p`, `720p`, `1080p`             | Video resolution                                                       |
| `duration`    | number  | No       | `5`     | 1   | 16  | -                                   | Video duration in seconds                                              |
| `aspectRatio` | string  | No       | `16:9`  | -   | -   | `16:9`, `9:16`, `1:1`, `3:4`, `4:3` | Aspect ratio of the output video                                       |
| `audio`       | boolean | No       | `false` | -   | -   | -                                   | Whether to add background music to the generated video                 |
| `seed`        | number  | No       | -       | -   | -   | -                                   | Use a seed for reproducible results. Leave blank to use a random seed. |
