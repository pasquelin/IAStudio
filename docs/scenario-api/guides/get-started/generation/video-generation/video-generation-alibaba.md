---
title: Alibaba | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Alibaba** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Happy Horse 1.1](#happy-horse-11)
- [Happy Horse 1.1 R2V](#happy-horse-11-r2v)
- [Happy Horse Video Edit](#happy-horse-video-edit)
- [Wan 2.1 - 1.3b](#wan-21---13b)
- [Wan 2.2 - I2V](#wan-22---i2v)
- [Wan 2.2 - T2V](#wan-22---t2v)
- [Wan 2.2 Animate - Move](#wan-22-animate---move)
- [Wan 2.2 Animate - Replace](#wan-22-animate---replace)
- [Wan 2.2 Outpainting](#wan-22-outpainting)
- [Wan 2.2 Reframe](#wan-22-reframe)
- [Wan 2.5 - I2V](#wan-25---i2v)
- [Wan 2.5 - T2V](#wan-25---t2v)
- [Wan 2.6 I2V](#wan-26-i2v)
- [Wan 2.6 T2V](#wan-26-t2v)
- [Wan 2.7 I2V](#wan-27-i2v)
- [Wan 2.7 T2V](#wan-27-t2v)
- [Wan 2.7 VideoEdit](#wan-27-videoedit)

---

## Happy Horse 1.1

Alibaba Happy Horse 1.1 on Scenario — Text to Video or Image to Video (first frame). Quality upgrade over 1.0; equirectangular-style output with native audio; resolution 720P/1080P; duration 3–15s. Omit the image for T2V.

**Model ID:** `model_alibaba-happy-horse-1.1`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_alibaba-happy-horse-1.1/markdown>

| Parameter     | Type   | Required | Default | Min | Max        | Allowed Values                                                    | Description                                                                                                                                          |
| ------------- | ------ | -------- | ------- | --- | ---------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string | Yes      | -       | -   | -          | -                                                                 | Describe the video you want to create — the scene, action, mood, and any movement.                                                                   |
| `image`       | file   | No       | -       | -   | -          | -                                                                 | An optional image to start the video from. The clip animates forward from this frame. Leave it empty to generate purely from your prompt.            |
| `aspectRatio` | string | No       | `16:9`  | -   | -          | `16:9`, `4:3`, `1:1`, `9:16`, `3:4`, `4:5`, `5:4`, `9:21`, `21:9` | The shape of the video. If you provide a first-frame image, the result may follow that image’s shape instead.                                        |
| `resolution`  | string | No       | `1080P` | -   | -          | `720P`, `1080P`                                                   | The output quality. 1080P is sharper than 720P but costs more.                                                                                       |
| `duration`    | number | No       | `5`     | 3   | 15         | -                                                                 | How long the clip lasts, in seconds (3–15). Longer clips cost more.                                                                                  |
| `seed`        | number | No       | -       | 0   | 2147483647 | -                                                                 | A number that makes results repeatable. Reusing the same seed and settings produces the same video; leave it empty for a different result each time. |

## Happy Horse 1.1 R2V

Alibaba Happy Horse 1.1 on Scenario — Reference to Video from a prompt plus 1–9 reference images (character1…character9 in the prompt, order matches images). Quality upgrade over 1.0; native audio; 720P/1080P; 3–15s.

**Model ID:** `model_alibaba-happy-horse-reference-to-video-1.1`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_alibaba-happy-horse-reference-to-video-1.1/markdown>

| Parameter         | Type        | Required | Default | Min | Max        | Allowed Values                                                    | Description                                                                                                                                                                                                                                                     |
| ----------------- | ----------- | -------- | ------- | --- | ---------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -          | -                                                                 | Describe the video you want. To place your reference subjects in the scene, refer to them as character1, character2, and so on — the numbers match the order of your reference images (character1 is the first image, character2 the second, etc.).             |
| `referenceImages` | file\_array | Yes      | -       | -   | -          | -                                                                 | The subjects to feature in the video — for example, characters or objects you want to appear. Add 1 to 9 images; their order sets which is character1, character2, and so on. For best results, use images at least 400px on the shortest side (max 10MB each). |
| `aspectRatio`     | string      | No       | `16:9`  | -   | -          | `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `4:5`, `5:4`, `9:21`, `21:9` | The shape of the video.                                                                                                                                                                                                                                         |
| `resolution`      | string      | No       | `1080P` | -   | -          | `720P`, `1080P`                                                   | The output quality. 1080P is sharper than 720P but costs more.                                                                                                                                                                                                  |
| `duration`        | number      | No       | `5`     | 3   | 15         | -                                                                 | How long the clip lasts, in seconds (3–15). Longer clips cost more.                                                                                                                                                                                             |
| `seed`            | number      | No       | -       | 0   | 2147483647 | -                                                                 | A number that makes results repeatable. Reusing the same seed and settings produces the same video; leave it empty for a different result each time.                                                                                                            |

## Happy Horse Video Edit

Alibaba Happy Horse 1.0 on Scenario — Video Editing with natural-language instructions; optional reference images (0–5, Image1…Image5). Output follows input length, capped at 15s billed.

**Model ID:** `model_alibaba-happy-horse-video-editing`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_alibaba-happy-horse-video-editing/markdown>

| Parameter         | Type        | Required | Default | Min | Max        | Allowed Values   | Description                                                                                   |
| ----------------- | ----------- | -------- | ------- | --- | ---------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `video`           | file        | Yes      | -       | -   | -          | -                | Source video. Output duration follows the input, truncated to 15s for processing.             |
| `prompt`          | string      | Yes      | -       | -   | -          | -                | Edit instructions. Optional references: @Image1 … @Image5 when reference images are provided. |
| `referenceImages` | file\_array | No       | -       | -   | -          | -                | Optional reference image URIs (up to 5) for style or look.                                    |
| `resolution`      | string      | No       | `1080P` | -   | -          | `720P`, `1080P`  | Output resolution tier.                                                                       |
| `audioSetting`    | string      | No       | `auto`  | -   | -          | `auto`, `origin` | Auto: model may regenerate audio; Origin: preserve input audio.                               |
| `seed`            | number      | No       | -       | 0   | 2147483647 | -                | Optional seed for reproducibility.                                                            |

## Wan 2.1 - 1.3b

Wan 2.1 1.3b is a text-to-video model that ensures detail and accuracy in animations.

**Model ID:** `model_wan-2-1-1-3b`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-1-1-3b/markdown>

| Parameter          | Type   | Required | Default | Min | Max | Allowed Values               | Description                                                                  |
| ------------------ | ------ | -------- | ------- | --- | --- | ---------------------------- | ---------------------------------------------------------------------------- |
| `prompt`           | string | Yes      | -       | -   | -   | -                            | Describe your video                                                          |
| `aspectRatio`      | string | No       | `16:9`  | -   | -   | `16:9`, `9:16`               | Video aspect ratio                                                           |
| `frameNum`         | number | No       | `81`    | -   | -   | `17`, `33`, `49`, `65`, `81` | Video duration in frames (based on standard 16fps playback)                  |
| `sampleSteps`      | number | No       | `30`    | 10  | 50  | -                            | Number of sampling steps (higher = better quality but slower)                |
| `sampleGuideScale` | number | No       | `6`     | 0   | 20  | -                            | Higher values follow the prompt more closely, lower values are more creative |
| `sampleShift`      | number | No       | `8`     | 0   | 20  | -                            | Sampling shift factor for flow matching (recommended range: 8-12)            |
| `seed`             | number | No       | -       | -   | -   | -                            | Use a seed for reproducible results. Leave blank to use a random seed.       |

## Wan 2.2 - I2V

Wan 2.2 A14B is a image-to-video model at 720p and 480p resolutions

**Model ID:** `model_wan-2-2-i2v-a14b`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-2-i2v-a14b/markdown>

| Parameter         | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                   |
| ----------------- | ------ | -------- | ------- | --- | --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string | Yes      | -       | -   | -   | -              | Describe your video                                                                                                                           |
| `image`           | file   | No       | -       | -   | -   | -              | Image used as the first frame of the video. Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, depending on the aspect ratio you choose. |
| `lastFrameImage`  | file   | No       | -       | -   | -   | -              | Input image for last frame generation. This only works if an image start frame is given too.                                                  |
| `resolution`      | string | No       | `720p`  | -   | -   | `720p`, `480p` | Video resolution                                                                                                                              |
| `numFrames`       | number | No       | `81`    | 81  | 100 | -              | Number of video frames. 81 frames give the best results                                                                                       |
| `framesPerSecond` | number | No       | `16`    | 5   | 24  | -              | Frames per second.                                                                                                                            |
| `sampleSteps`     | number | No       | `30`    | 1   | 50  | -              | Number of generation steps. Fewer steps means faster generation, at the expensive of output quality. 30 steps is sufficient for most prompts  |
| `sampleShift`     | number | No       | `5`     | 1   | 20  | -              | Controls how much motion is added between video frames. Higher values create faster motion, lower values result in smoother, slower changes.  |
| `seed`            | number | No       | -       | -   | -   | -              | Use a seed for reproducible results. Leave blank to use a random seed.                                                                        |

## Wan 2.2 - T2V

Wan 2.2 A14B text-to-video

**Model ID:** `model_wan-2-2-t2v`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-2-t2v/markdown>

| Parameter         | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                  |
| ----------------- | ------ | -------- | ------- | --- | --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string | Yes      | -       | -   | -   | -              | Describe your video                                                                                                                          |
| `resolution`      | string | No       | `720p`  | -   | -   | `720p`, `480p` | Video resolution                                                                                                                             |
| `numFrames`       | number | No       | `81`    | 81  | 121 | -              | Number of video frames. 81 frames give the best results                                                                                      |
| `framesPerSecond` | number | No       | `16`    | 5   | 30  | -              | Frames per second.                                                                                                                           |
| `sampleShift`     | number | No       | `5`     | 1   | 20  | -              | Controls how much motion is added between video frames. Higher values create faster motion, lower values result in smoother, slower changes. |
| `seed`            | number | No       | -       | -   | -   | -              | Use a seed for reproducible results. Leave blank to use a random seed.                                                                       |

## Wan 2.2 Animate - Move

Wan-Animate is a video model that generates high-fidelity character videos by replicating the expressions and movements of characters from reference videos.

**Model ID:** `model_wan-2-2-14b-animate-move`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-2-14b-animate-move/markdown>

| Parameter           | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                               |
| ------------------- | ------- | -------- | ------- | --- | --- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `videoUrl`          | file    | Yes      | -       | -   | -   | -              | Input video                                                                                               |
| `imageUrl`          | file    | Yes      | -       | -   | -   | -              | Input image. If the input image does not match the chosen aspect ratio, it is resized and center cropped. |
| `resolution`        | string  | No       | `720p`  | -   | -   | `720p`, `480p` | Output video resolution                                                                                   |
| `mergeAudio`        | boolean | No       | `true`  | -   | -   | -              | Merge audio from input video into output                                                                  |
| `numInferenceSteps` | number  | No       | `12`    | 1   | 40  | -              | Number of inference steps. Higher values improve quality but slow generation                              |
| `guidanceScale`     | number  | No       | `1`     | 1   | 20  | -              | Guidance scale for generation                                                                             |
| `seed`              | number  | No       | -       | -   | -   | -              | Random seed for reproducibility. If None, a random seed is chosen.                                        |

## Wan 2.2 Animate - Replace

Wan-Animate Replace is a model that can integrate animated characters into reference videos, replacing the original character while preserving the scene’s lighting and color tone for seamless environmental integration.

**Model ID:** `model_wan-2-2-14b-animate-replace`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-2-14b-animate-replace/markdown>

| Parameter           | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                               |
| ------------------- | ------- | -------- | ------- | --- | --- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `videoUrl`          | file    | Yes      | -       | -   | -   | -              | Input video                                                                                               |
| `imageUrl`          | file    | Yes      | -       | -   | -   | -              | Input image. If the input image does not match the chosen aspect ratio, it is resized and center cropped. |
| `resolution`        | string  | No       | `720p`  | -   | -   | `720p`, `480p` | Output video resolution                                                                                   |
| `mergeAudio`        | boolean | No       | `true`  | -   | -   | -              | Merge audio from input video into output                                                                  |
| `numInferenceSteps` | number  | No       | `12`    | 1   | 40  | -              | Number of inference steps. Higher values improve quality but slow generation                              |
| `guidanceScale`     | number  | No       | `1`     | 1   | 20  | -              | Guidance scale for generation                                                                             |
| `seed`              | number  | No       | -       | -   | -   | -              | Random seed for reproducibility. If None, a random seed is chosen.                                        |

## Wan 2.2 Outpainting

VACE Fun for Wan 2.2 A14B from Alibaba-PAI

**Model ID:** `model_wan-2-2-vace-fun-a14b-outpainting`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-2-vace-fun-a14b-outpainting/markdown>

| Parameter                   | Type        | Required | Default    | Min | Max | Allowed Values                     | Description                                                                                                                                                               |
| --------------------------- | ----------- | -------- | ---------- | --- | --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                    | string      | Yes      | -          | -   | -   | -                                  | Text prompt for video generation                                                                                                                                          |
| `videoUrl`                  | file        | Yes      | -          | -   | -   | -                                  | Input video for outpainting                                                                                                                                               |
| `expandLeft`                | boolean     | No       | `true`     | -   | -   | -                                  | Expand video to the left                                                                                                                                                  |
| `expandRight`               | boolean     | No       | `true`     | -   | -   | -                                  | Expand video to the right                                                                                                                                                 |
| `expandTop`                 | boolean     | No       | `true`     | -   | -   | -                                  | Expand video to the top                                                                                                                                                   |
| `expandBottom`              | boolean     | No       | `true`     | -   | -   | -                                  | Expand video to the bottom                                                                                                                                                |
| `expandRatio`               | number      | No       | `0.25`     | 0   | 1   | -                                  | Amount of expansion. This is a float value between 0 and 1, where 0.25 adds 25% to the original video size on the specified sides.                                        |
| `negativePrompt`            | string      | No       | -          | -   | -   | -                                  | Text negative prompt for video generation                                                                                                                                 |
| `refImageUrls`              | file\_array | No       | “          | -   | -   | -                                  | Reference images                                                                                                                                                          |
| `matchInputNumFrames`       | boolean     | No       | `false`    | -   | -   | -                                  | Match the number of frames from input video                                                                                                                               |
| `numFrames`                 | number      | No       | `81`       | 81  | 241 | -                                  | Number of frames to generate                                                                                                                                              |
| `matchInputFramesPerSecond` | boolean     | No       | `false`    | -   | -   | -                                  | If true, the frames per second of the generated video will match the input video. If false, the frames per second will be determined by the Frames Per Seconds parameter. |
| `framesPerSecond`           | number      | No       | `16`       | 5   | 30  | -                                  | Frames per second of the generated video. Ignored if match\_input\_frames\_per\_second is true. Default value: 16                                                         |
| `resolution`                | string      | No       | `720p`     | -   | -   | `720p`, `580p`, `480p`             | Output video resolution                                                                                                                                                   |
| `aspectRatio`               | string      | No       | `auto`     | -   | -   | `auto`, `16:9`, `1:1`, `9:16`      | Aspect ratio for output video                                                                                                                                             |
| `numInferenceSteps`         | number      | No       | `30`       | 2   | 50  | -                                  | Number of inference steps                                                                                                                                                 |
| `guidanceScale`             | number      | No       | `5`        | 1   | 10  | -                                  | Guidance scale for generation                                                                                                                                             |
| `enablePromptExpansion`     | boolean     | No       | `false`    | -   | -   | -                                  | Enable prompt expansion                                                                                                                                                   |
| `acceleration`              | string      | No       | `regular`  | -   | -   | `regular`, `none`                  | Processing acceleration mode                                                                                                                                              |
| `videoQuality`              | string      | No       | `high`     | -   | -   | `maximum`, `high`, `medium`, `low` | Output video quality                                                                                                                                                      |
| `videoWriteMode`            | string      | No       | `balanced` | -   | -   | `balanced`, `fast`, `small`        | Video writing mode                                                                                                                                                        |
| `numInterpolatedFrames`     | number      | No       | `1`        | 0   | 5   | -                                  | Number of frames to interpolate between the original frames. A value of 0 means no interpolation                                                                          |
| `interpolatorModel`         | string      | No       | `film`     | -   | -   | `film`, `rife`                     | Interpolator model to use                                                                                                                                                 |
| `seed`                      | number      | No       | -          | -   | -   | -                                  | Random seed for reproducibility. If None, a random seed is chosen.                                                                                                        |

## Wan 2.2 Reframe

VACE Fun for Wan 2.2 A14B from Alibaba-PAI

**Model ID:** `model_wan-2-2-vace-fun-a14b-reframe`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-2-vace-fun-a14b-reframe/markdown>

| Parameter                   | Type    | Required | Default    | Min | Max | Allowed Values                     | Description                                                                                                                                                                                                                                 |
| --------------------------- | ------- | -------- | ---------- | --- | --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `videoUrl`                  | file    | Yes      | -          | -   | -   | -                                  | Input video for reframe                                                                                                                                                                                                                     |
| `prompt`                    | string  | No       | -          | -   | -   | -                                  | Text prompt for video generation                                                                                                                                                                                                            |
| `negativePrompt`            | string  | No       | -          | -   | -   | -                                  | Text negative prompt for video generation                                                                                                                                                                                                   |
| `matchInputNumFrames`       | boolean | No       | `false`    | -   | -   | -                                  | Match the number of frames from input video                                                                                                                                                                                                 |
| `numFrames`                 | number  | No       | `81`       | 81  | 241 | -                                  | Number of frames to generate                                                                                                                                                                                                                |
| `matchInputFramesPerSecond` | boolean | No       | `false`    | -   | -   | -                                  | If true, the frames per second of the generated video will match the input video. If false, the frames per second will be determined by the Frames Per Seconds parameter.                                                                   |
| `framesPerSecond`           | number  | No       | `16`       | 5   | 30  | -                                  | Frames per second of the generated video. Ignored if match\_input\_frames\_per\_second is true. Default value: 16                                                                                                                           |
| `resolution`                | string  | No       | `720p`     | -   | -   | `720p`, `580p`, `480p`             | Output video resolution                                                                                                                                                                                                                     |
| `aspectRatio`               | string  | No       | `auto`     | -   | -   | `auto`, `16:9`, `1:1`, `9:16`      | Aspect ratio for output video                                                                                                                                                                                                               |
| `numInferenceSteps`         | number  | No       | `30`       | 2   | 50  | -                                  | Number of inference steps                                                                                                                                                                                                                   |
| `guidanceScale`             | number  | No       | `5`        | 1   | 10  | -                                  | Guidance scale for generation                                                                                                                                                                                                               |
| `enablePromptExpansion`     | boolean | No       | `false`    | -   | -   | -                                  | Enable prompt expansion                                                                                                                                                                                                                     |
| `acceleration`              | string  | No       | `regular`  | -   | -   | `regular`, `none`                  | Processing acceleration mode                                                                                                                                                                                                                |
| `videoQuality`              | string  | No       | `high`     | -   | -   | `maximum`, `high`, `medium`, `low` | Output video quality                                                                                                                                                                                                                        |
| `videoWriteMode`            | string  | No       | `balanced` | -   | -   | `balanced`, `fast`, `small`        | Video writing mode                                                                                                                                                                                                                          |
| `numInterpolatedFrames`     | number  | No       | `1`        | 0   | 5   | -                                  | Number of frames to interpolate between the original frames. A value of 0 means no interpolation                                                                                                                                            |
| `interpolatorModel`         | string  | No       | `film`     | -   | -   | `film`, `rife`                     | Interpolator model to use                                                                                                                                                                                                                   |
| `zoomFactor`                | number  | No       | `0`        | 0   | 0.9 | -                                  | Zoom factor for the video. When this value is greater than 0, the video will be zoomed in by this factor (in relation to the canvas size,) cutting off the edges of the video. A value of 0 means no zoom.                                  |
| `trimBorders`               | boolean | No       | `true`     | -   | -   | -                                  | Whether to trim borders from the video.                                                                                                                                                                                                     |
| `temporalDownsampleFactor`  | number  | No       | `0`        | 0   | 5   | -                                  | Temporal downsample factor for the video. This is an integer value that determines how many frames to skip in the video. A value of 0 means no downsampling. For each downsample factor, one upsample factor will automatically be applied. |
| `seed`                      | number  | No       | -          | -   | -   | -                                  | Random seed for reproducibility. If None, a random seed is chosen.                                                                                                                                                                          |

## Wan 2.5 - I2V

Wan 2.5 image-to-video model.

**Model ID:** `model_wan-2-5-i2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-5-i2v/markdown>

| Parameter               | Type    | Required | Default | Min | Max | Allowed Values  | Description                                                             |
| ----------------------- | ------- | -------- | ------- | --- | --- | --------------- | ----------------------------------------------------------------------- |
| `image`                 | file    | Yes      | -       | -   | -   | -               | Image to use for your video                                             |
| `prompt`                | string  | Yes      | -       | -   | -   | -               | A textual prompt to guide model generation.                             |
| `audio`                 | file    | No       | -       | -   | -   | -               | Audio file for voice/music synchronization. 3-30s, ≤15MB.               |
| `negativePrompt`        | string  | No       | -       | -   | -   | -               | Negative prompt used to guide the model away from undesirable features. |
| `resolution`            | string  | No       | `720p`  | -   | -   | `720p`, `1080p` | Video resolution.                                                       |
| `duration`              | number  | No       | `5`     | -   | -   | `5`, `10`       | Duration of the generated video in seconds.                             |
| `enablePromptExpansion` | boolean | No       | `true`  | -   | -   | -               | Whether to enable prompt rewriting using LLM.                           |
| `seed`                  | number  | No       | -       | -   | -   | -               | Random seed for reproducibility. If None, a random seed is chosen.      |

## Wan 2.5 - T2V

Wan 2.5 text-to-video model.

**Model ID:** `model_wan-2-5-t2v`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-5-t2v/markdown>

| Parameter               | Type    | Required | Default    | Min | Max | Allowed Values                                   | Description                                                             |
| ----------------------- | ------- | -------- | ---------- | --- | --- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `prompt`                | string  | Yes      | -          | -   | -   | -                                                | A textual prompt to guide model generation.                             |
| `audio`                 | file    | No       | -          | -   | -   | -                                                | Audio file for voice/music synchronization. 3-30s, ≤15MB.               |
| `negativePrompt`        | string  | No       | -          | -   | -   | -                                                | Negative prompt used to guide the model away from undesirable features. |
| `size`                  | string  | No       | `1280*720` | -   | -   | `1280*720`, `720*1280`, `1920*1080`, `1080*1920` | Video resolution and aspect ratio.                                      |
| `duration`              | number  | No       | `5`        | -   | -   | `5`, `10`                                        | Duration of the generated video in seconds.                             |
| `enablePromptExpansion` | boolean | No       | `true`     | -   | -   | -                                                | Whether to enable prompt rewriting using LLM.                           |
| `seed`                  | number  | No       | -          | -   | -   | -                                                | Random seed for reproducibility. If None, a random seed is chosen.      |

## Wan 2.6 I2V

Alibaba Wan 2.6 image to video generation model

**Model ID:** `model_wan-2-6-i2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-6-i2v/markdown>

| Parameter               | Type    | Required | Default | Min | Max | Allowed Values  | Description                                                                                                                                                                    |
| ----------------------- | ------- | -------- | ------- | --- | --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`                 | file    | Yes      | -       | -   | -   | -               | Input image for video generation                                                                                                                                               |
| `prompt`                | string  | Yes      | -       | -   | -   | -               | Text prompt for video generation                                                                                                                                               |
| `audio`                 | file    | No       | -       | -   | -   | -               | Audio file (3-30s, ≤15MB) for voice/music synchronization                                                                                                                      |
| `negativePrompt`        | string  | No       | -       | -   | -   | -               | Negative prompt to avoid certain elements                                                                                                                                      |
| `resolution`            | string  | No       | `720p`  | -   | -   | `720p`, `1080p` | Video resolution                                                                                                                                                               |
| `duration`              | number  | No       | `5`     | -   | -   | `5`, `10`, `15` | Duration of the generated video in seconds                                                                                                                                     |
| `enablePromptExpansion` | boolean | No       | `true`  | -   | -   | -               | If set to true, the prompt optimizer will be enabled                                                                                                                           |
| `multiShots`            | boolean | No       | `true`  | -   | -   | -               | Enable intelligent multi-shot segmentation (only active when ‘Enable Prompt Expansion’ is enabled). True enables multi-shot segmentation, false generates single-shot content. |
| `seed`                  | number  | No       | -       | -   | -   | -               | Random seed for reproducible generation                                                                                                                                        |

## Wan 2.6 T2V

Alibaba Wan 2.6 text to video generation model

**Model ID:** `model_wan-2-6-t2v`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-6-t2v/markdown>

| Parameter               | Type    | Required | Default    | Min | Max | Allowed Values                                   | Description                                                                                                                                                                    |
| ----------------------- | ------- | -------- | ---------- | --- | --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt`                | string  | Yes      | -          | -   | -   | -                                                | Text prompt for video generation                                                                                                                                               |
| `audio`                 | file    | No       | -          | -   | -   | -                                                | Audio file (3-30s, ≤15MB) for voice/music synchronization                                                                                                                      |
| `negativePrompt`        | string  | No       | -          | -   | -   | -                                                | Negative prompt to avoid certain elements                                                                                                                                      |
| `size`                  | string  | No       | `1280*720` | -   | -   | `1280*720`, `720*1280`, `1920*1080`, `1080*1920` | Video resolution and aspect ratio                                                                                                                                              |
| `duration`              | number  | No       | `5`        | -   | -   | `5`, `10`, `15`                                  | Duration of the generated video in seconds                                                                                                                                     |
| `enablePromptExpansion` | boolean | No       | `true`     | -   | -   | -                                                | If set to true, the prompt optimizer will be enabled                                                                                                                           |
| `multiShots`            | boolean | No       | `true`     | -   | -   | -                                                | Enable intelligent multi-shot segmentation (only active when ‘Enable Prompt Expansion’ is enabled). True enables multi-shot segmentation, false generates single-shot content. |
| `seed`                  | number  | No       | -          | -   | -   | -                                                | Random seed for reproducible generation                                                                                                                                        |

## Wan 2.7 I2V

Alibaba Wan 2.7 image-to-video — animate a first frame, first/last frame, or continue a clip; 720p/1080p, 2–15s.

**Model ID:** `model_wan-2-7-i2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-7-i2v/markdown>

| Parameter               | Type    | Required | Default | Min | Max | Allowed Values  | Description                                                                    |
| ----------------------- | ------- | -------- | ------- | --- | --- | --------------- | ------------------------------------------------------------------------------ |
| `prompt`                | string  | Yes      | -       | -   | -   | -               | Describe the motion and action to generate                                     |
| `image`                 | file    | No       | -       | -   | -   | -               | First frame to animate. Do not combine with clip continuation video.           |
| `video`                 | file    | No       | -       | -   | -   | -               | Video to extend. Cannot be combined with start image.                          |
| `endImage`              | file    | No       | -       | -   | -   | -               | Optional last frame for first-and-last-frame generation (requires start image) |
| `audio`                 | file    | No       | -       | -   | -   | -               | Optional audio. Omit for auto-generated audio                                  |
| `negativePrompt`        | string  | No       | -       | -   | -   | -               | Content that should not appear in the video                                    |
| `resolution`            | string  | No       | `1080p` | -   | -   | `720p`, `1080p` | Output video resolution                                                        |
| `duration`              | number  | No       | `5`     | 2   | 15  | -               | Duration in seconds (2–15)                                                     |
| `enablePromptExpansion` | boolean | No       | `true`  | -   | -   | -               | Expand short prompts for better results (adds latency)                         |
| `seed`                  | number  | No       | -       | -   | -   | -               | Random seed for reproducible generation                                        |

## Wan 2.7 T2V

Alibaba Wan 2.7 text-to-video — 720p/1080p, 2–15s, optional synced audio, prompt expansion.

**Model ID:** `model_wan-2-7-t2v`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-7-t2v/markdown>

| Parameter               | Type    | Required | Default | Min | Max | Allowed Values                      | Description                                            |
| ----------------------- | ------- | -------- | ------- | --- | --- | ----------------------------------- | ------------------------------------------------------ |
| `prompt`                | string  | Yes      | -       | -   | -   | -                                   | Text description of the video to generate              |
| `audio`                 | file    | No       | -       | -   | -   | -                                   | Optional audio. Omit for auto-generated audio          |
| `negativePrompt`        | string  | No       | -       | -   | -   | -                                   | Content that should not appear in the video            |
| `resolution`            | string  | No       | `1080p` | -   | -   | `720p`, `1080p`                     | Output video resolution                                |
| `aspectRatio`           | string  | No       | `16:9`  | -   | -   | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` | Aspect ratio of the generated video                    |
| `duration`              | number  | No       | `5`     | 2   | 15  | -                                   | Duration in seconds (2–15)                             |
| `enablePromptExpansion` | boolean | No       | `true`  | -   | -   | -                                   | Expand short prompts for better results (adds latency) |
| `seed`                  | number  | No       | -       | -   | -   | -                                   | Random seed for reproducible generation                |

## Wan 2.7 VideoEdit

Alibaba Wan 2.7 instruction-based video editing — edit existing clips while preserving motion; 720p/1080p, 2–10s output.

**Model ID:** `model_wan-2-7-videoedit`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_wan-2-7-videoedit/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values                              | Description                                                                                        |
| ---------------- | ------ | -------- | ------- | --- | --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `video`          | file   | Yes      | -       | -   | -   | -                                           | Video to edit (mp4/mov, 2–10s)                                                                     |
| `prompt`         | string | Yes      | -       | -   | -   | -                                           | Editing instructions (what to change: background, lighting, style, clothing, etc.)                 |
| `referenceImage` | file   | No       | -       | -   | -   | -                                           | Optional reference for style or look.                                                              |
| `resolution`     | string | No       | `1080p` | -   | -   | `720p`, `1080p`                             | Output resolution                                                                                  |
| `aspectRatio`    | string | No       | `auto`  | -   | -   | `auto`, `16:9`, `9:16`, `1:1`, `4:3`, `3:4` | Output aspect ratio; auto matches the input video                                                  |
| `audioSetting`   | string | No       | `auto`  | -   | -   | `auto`, `origin`                            | auto: model may regenerate audio; origin: keep original audio                                      |
| `duration`       | number | No       | -       | 2   | 10  | -                                           | Output duration in seconds (2–10). If not set, matches input video duration. Use this to truncate. |
| `seed`           | number | No       | -       | -   | -   | -                                           | Random seed for reproducible generation                                                            |
