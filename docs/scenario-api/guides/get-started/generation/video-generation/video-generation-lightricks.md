---
title: Lightricks | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Lightricks** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [LTX 2.3 Quality Render to Real](#ltx-23-quality-render-to-real)
- [LTX-2 19b](#ltx-2-19b)
- [LTX-2 19b Extend Video](#ltx-2-19b-extend-video)
- [LTX-2 19b Fast](#ltx-2-19b-fast)
- [LTX-2 19b Keyframes to Video](#ltx-2-19b-keyframes-to-video)
- [LTX-2 19b Video to Video](#ltx-2-19b-video-to-video)
- [LTX-2 Fast](#ltx-2-fast)
- [LTX-2 Pro](#ltx-2-pro)
- [LTX-2 Retake](#ltx-2-retake)
- [LTX-2.3 22b](#ltx-23-22b)
- [LTX-2.3 22b Audio to Video](#ltx-23-22b-audio-to-video)
- [LTX-2.3 22b Extend Video](#ltx-23-22b-extend-video)
- [LTX-2.3 22b Fast](#ltx-23-22b-fast)
- [LTX-2.3 22b HQ](#ltx-23-22b-hq)
- [LTX-2.3 22b Keyframes to Video](#ltx-23-22b-keyframes-to-video)
- [LTX-2.3 22b Retake](#ltx-23-22b-retake)
- [LTX-2.3 22b Video to Video](#ltx-23-22b-video-to-video)
- [LTX-2.3 Fast](#ltx-23-fast)
- [LTX-2.3 Pro](#ltx-23-pro)
- [LTX-2.3 Pro Audio to Video](#ltx-23-pro-audio-to-video)
- [LTX-2.3 Pro Extend Video](#ltx-23-pro-extend-video)
- [LTX-2.3 Pro Retake](#ltx-23-pro-retake)

---

## LTX 2.3 Quality Render to Real

Transform 3D/CG/game renders into photorealistic video with optional first-frame anchoring.

**Model ID:** `model_ltx-2-3-quality-render-to-real`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-quality-render-to-real/markdown>

| Parameter               | Type    | Required | Default     | Min | Max | Allowed Values                     | Description                                                                                                                                                                   |
| ----------------------- | ------- | -------- | ----------- | --- | --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`                 | file    | Yes      | -           | -   | -   | -                                  | The 3D, CG, or game render you want to make look photorealistic.                                                                                                              |
| `image`                 | file    | No       | -           | -   | -   | -                                  | An optional photo to set the realistic look of the opening frame. The rest of the video follows from it.                                                                      |
| `prompt`                | string  | No       | -           | -   | -   | -                                  | Describe the photorealistic result you want.                                                                                                                                  |
| `negativePrompt`        | string  | No       | -           | -   | -   | -                                  | Things to steer the result away from unwanted artifacts, styles, or defects. Comes pre-filled with common ones you can edit.                                                  |
| `intensity`             | string  | No       | `strong-v2` | -   | -   | `light`, `strong`, `strong-v2`     | How hard to push the render toward realism. Light keeps more of the original render’s look; Strong pushes further; Strong V2 is the newest, improved version.                 |
| `resolution`            | string  | No       | `720p`      | -   | -   | `480p`, `720p`                     | The output quality (measured on the shorter side), keeping your source’s proportions. 720p supports clips up to \~6s; 480p up to \~15s. Higher resolution costs more.         |
| `numFrames`             | number  | No       | `121`       | 1   | 361 | -                                  | The total number of frames in the output. The video’s length is this divided by the frame rate (for example, 121 frames at 24 fps is about 5 seconds). More frames cost more. |
| `framesPerSecond`       | number  | No       | `24`        | 1   | 60  | -                                  | How many frames play per second. Higher values look smoother.                                                                                                                 |
| `enableDetailRefine`    | boolean | No       | `false`     | -   | -   | -                                  | Adds a second pass for a sharper, higher-detail result. This doubles the width and height (four times the pixels), so it’s slower and costs about 4× as much.                 |
| `detailRefineStrength`  | number  | No       | `0.75`      | 0   | 1   | -                                  | How much the refine pass reworks the image. Higher values regenerate more detail. Only applies when Detail Refine is on.                                                      |
| `generateAudio`         | boolean | No       | `true`      | -   | -   | -                                  | Includes a soundtrack in the returned video. On by default.                                                                                                                   |
| `enablePromptExpansion` | boolean | No       | `false`     | -   | -   | -                                  | Automatically expands your prompt into a richer description before generating. The “3DREAL” trigger is always kept.                                                           |
| `numInferenceSteps`     | number  | No       | `15`        | 8   | 30  | -                                  | How many refinement passes the model makes (8-30). More can improve quality but take longer.                                                                                  |
| `guidanceScale`         | number  | No       | `1`         | 0   | 20  | -                                  | How closely the result follows your prompt. Higher values stick to it more strictly.                                                                                          |
| `videoQuality`          | string  | No       | `high`      | -   | -   | `low`, `medium`, `high`, `maximum` | The overall quality preset for the output video.                                                                                                                              |
| `videoWriteMode`        | string  | No       | `balanced`  | -   | -   | `fast`, `balanced`, `small`        | How the video file is saved: Fast prioritizes speed, Small prioritizes a smaller file, Balanced sits between.                                                                 |
| `seed`                  | number  | No       | -           | 0   | -   | -                                  | A number that makes results repeatable. Reusing the same seed and settings produces the same video; leave it empty for a different result each time.                          |

## LTX-2 19b

High-quality image-to-video and text-to-video with synchronized audio.

**Model ID:** `model_ltx-2-19b`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-19b/markdown>

| Parameter              | Type    | Required | Default | Min | Max  | Allowed Values                                                                               | Description                                                                          |
| ---------------------- | ------- | -------- | ------- | --- | ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `prompt`               | string  | Yes      | -       | -   | -    | -                                                                                            | Text prompt for video generation (1-5000 characters)                                 |
| `image`                | file    | No       | -       | -   | -    | -                                                                                            | Input image for image-to-video (applied at frame 0). Leave empty for text-to-video.  |
| `imageStrength`        | number  | No       | `1`     | 0   | 1    | -                                                                                            | Image conditioning strength (0-1) for image-to-video.                                |
| `negativePrompt`       | string  | No       | -       | -   | -    | -                                                                                            | What to avoid in generation                                                          |
| `duration`             | number  | No       | `6`     | 3   | 20   | -                                                                                            | Video duration in seconds. Durations below 6s may produce lower quality.             |
| `aspectRatio`          | string  | No       | `auto`  | -   | -    | `auto`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9`                                          | Video aspect ratio. ‘Match Input’ detects from input image.                          |
| `resolution`           | string  | No       | `1080p` | -   | -    | `720p`, `1080p`, `1440p`, `2160p`                                                            | Video resolution. Ignored if width and height are provided.                          |
| `width`                | number  | No       | -       | 64  | 4096 | -                                                                                            | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64. |
| `height`               | number  | No       | -       | 64  | 4096 | -                                                                                            | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64. |
| `fps`                  | number  | No       | `25`    | 1   | 60   | -                                                                                            | Frame rate in frames per second (1-60)                                               |
| `cameraMotion`         | string  | No       | `none`  | -   | -    | `none`, `static`, `dolly_in`, `dolly_out`, `dolly_left`, `dolly_right`, `jib_up`, `jib_down` | Camera movement type in the generated video                                          |
| `cameraMotionStrength` | number  | No       | `1`     | 0   | 2    | -                                                                                            | Strength of camera motion (0-2)                                                      |
| `numInferenceSteps`    | number  | No       | `40`    | 1   | 100  | -                                                                                            | Number of inference steps. Higher = better quality, slower.                          |
| `guidanceScale`        | number  | No       | `3`     | 1   | 20   | -                                                                                            | Guidance scale. Higher = stronger prompt adherence.                                  |
| `generateAudio`        | boolean | No       | `true`  | -   | -    | -                                                                                            | Whether to generate synchronized audio                                               |
| `enhancePrompt`        | boolean | No       | `false` | -   | -    | -                                                                                            | Enhance the prompt for better video generation                                       |
| `seed`                 | number  | No       | -       | 0   | -    | -                                                                                            | Random seed for reproducibility. Leave blank for random.                             |

## LTX-2 19b Extend Video

Extend videos by generating continuation frames. Input a video and describe how it should continue.

**Model ID:** `model_ltx-2-19b-extend-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-19b-extend-video/markdown>

| Parameter              | Type    | Required | Default | Min | Max  | Allowed Values                                                                               | Description                                                                                    |
| ---------------------- | ------- | -------- | ------- | --- | ---- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `prompt`               | string  | Yes      | -       | -   | -    | -                                                                                            | Text prompt describing how the video should continue                                           |
| `video`                | file    | Yes      | -       | -   | -    | -                                                                                            | Input video to extend. The model generates continuation frames based on this video.            |
| `videoStrength`        | number  | No       | `1`     | 0   | 1    | -                                                                                            | Video conditioning strength. Higher = more faithful to input video motion/style.               |
| `extendDuration`       | number  | No       | `4`     | 1   | 20   | -                                                                                            | Duration of new video to generate in seconds. Additional duration added after the input video. |
| `contextDuration`      | number  | No       | -       | 0.1 | -    | -                                                                                            | Seconds from input video to use as context. Leave empty to use entire video.                   |
| `aspectRatio`          | string  | No       | `auto`  | -   | -    | `auto`, `21:9`, `16:9`, `4:3`, `3:4`, `1:1`, `9:16`                                          | Video aspect ratio. ‘Match Input’ detects from input video.                                    |
| `resolution`           | string  | No       | `auto`  | -   | -    | `auto`, `720p`, `1080p`, `1440p`, `2160p`                                                    | Video resolution. ‘Match Input’ replicates input video dimensions (recommended for extend).    |
| `width`                | number  | No       | -       | 64  | 4096 | -                                                                                            | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.           |
| `height`               | number  | No       | -       | 64  | 4096 | -                                                                                            | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.           |
| `fps`                  | number  | No       | -       | 1   | 60   | -                                                                                            | Output frame rate (1-60 fps). Leave empty to match input video.                                |
| `numInferenceSteps`    | number  | No       | `40`    | 1   | 100  | -                                                                                            | Number of denoising steps (more = higher quality, slower)                                      |
| `guidanceScale`        | number  | No       | `3`     | 1   | 20   | -                                                                                            | Classifier-free guidance scale (higher = more prompt adherence)                                |
| `cameraMotion`         | string  | No       | `none`  | -   | -    | `none`, `static`, `dolly_in`, `dolly_out`, `dolly_left`, `dolly_right`, `jib_up`, `jib_down` | Camera movement type in the generated continuation                                             |
| `cameraMotionStrength` | number  | No       | `1`     | 0   | 2    | -                                                                                            | Strength of camera motion                                                                      |
| `generateAudio`        | boolean | No       | `true`  | -   | -    | -                                                                                            | Whether to generate synchronized audio                                                         |
| `audioStrength`        | number  | No       | `1`     | 0   | 1    | -                                                                                            | Audio conditioning strength (0-1). Higher preserves more input audio characteristics.          |
| `enhancePrompt`        | boolean | No       | `false` | -   | -    | -                                                                                            | Enhance the prompt for better video generation                                                 |
| `seed`                 | number  | No       | -       | 0   | -    | -                                                                                            | Random seed for reproducibility. Leave blank for random.                                       |
| `negativePrompt`       | string  | No       | -       | -   | -    | -                                                                                            | What to avoid in generation                                                                    |

## LTX-2 19b Fast

Fast tier (8 steps) for rapid iteration with synchronized audio.

**Model ID:** `model_ltx-2-19b-fast`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-19b-fast/markdown>

| Parameter              | Type    | Required | Default | Min | Max  | Allowed Values                                                                               | Description                                                                                               |
| ---------------------- | ------- | -------- | ------- | --- | ---- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `prompt`               | string  | Yes      | -       | -   | -    | -                                                                                            | Text prompt for video generation (1-5000 characters)                                                      |
| `image`                | file    | No       | -       | -   | -    | -                                                                                            | Input image for image-to-video (applied at frame 0). Leave empty for text-to-video.                       |
| `imageStrength`        | number  | No       | `1`     | 0   | 1    | -                                                                                            | Image conditioning strength (0-1) for image-to-video.                                                     |
| `duration`             | number  | No       | `6`     | 3   | 20   | -                                                                                            | Video duration in seconds (3-20). Durations below 6s may produce lower quality. >10s only at 1080p/25fps. |
| `aspectRatio`          | string  | No       | `auto`  | -   | -    | `auto`, `21:9`, `16:9`, `4:3`, `3:4`, `1:1`, `9:16`                                          | Video aspect ratio. ‘Match Input’ detects from input image.                                               |
| `resolution`           | string  | No       | `1080p` | -   | -    | `720p`, `1080p`, `1440p`, `2160p`                                                            | Video resolution. Ignored if width and height are provided.                                               |
| `width`                | number  | No       | -       | 64  | 4096 | -                                                                                            | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.                      |
| `height`               | number  | No       | -       | 64  | 4096 | -                                                                                            | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.                      |
| `fps`                  | number  | No       | `25`    | 1   | 60   | -                                                                                            | Frame rate in frames per second (1-60)                                                                    |
| `cameraMotion`         | string  | No       | `none`  | -   | -    | `none`, `static`, `dolly_in`, `dolly_out`, `dolly_left`, `dolly_right`, `jib_up`, `jib_down` | Camera movement type in the generated video                                                               |
| `cameraMotionStrength` | number  | No       | `1`     | 0   | 2    | -                                                                                            | Strength of camera motion (0-2)                                                                           |
| `generateAudio`        | boolean | No       | `true`  | -   | -    | -                                                                                            | Whether to generate synchronized audio                                                                    |
| `enhancePrompt`        | boolean | No       | `false` | -   | -    | -                                                                                            | Enhance the prompt for better video generation                                                            |
| `seed`                 | number  | No       | -       | 0   | -    | -                                                                                            | Random seed for reproducibility. Leave blank for random.                                                  |

## LTX-2 19b Keyframes to Video

Interpolate between multiple keyframe images to generate smooth video transitions with synchronized audio.

**Model ID:** `model_ltx-2-19b-keyframes-to-video`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-19b-keyframes-to-video/markdown>

| Parameter              | Type          | Required | Default | Min | Max  | Allowed Values                                                                               | Description                                                                                             |
| ---------------------- | ------------- | -------- | ------- | --- | ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `prompt`               | string        | Yes      | -       | -   | -    | -                                                                                            | Text prompt describing the video content and transitions (1-5000 characters)                            |
| `keyframes`            | inputs\_array | Yes      | -       | -   | -    | -                                                                                            | List of keyframe images with timestamps and strengths. At least 2 keyframes required for interpolation. |
| `negativePrompt`       | string        | No       | -       | -   | -    | -                                                                                            | Negative prompt to guide what to avoid in generation                                                    |
| `resolution`           | string        | No       | `1080p` | -   | -    | `720p`, `1080p`, `1440p`, `2160p`                                                            | Video resolution. Ignored if width and height are provided.                                             |
| `width`                | number        | No       | -       | 64  | 4096 | -                                                                                            | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.                    |
| `height`               | number        | No       | -       | 64  | 4096 | -                                                                                            | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.                    |
| `cameraMotion`         | string        | No       | `none`  | -   | -    | `none`, `static`, `dolly_in`, `dolly_out`, `dolly_left`, `dolly_right`, `jib_up`, `jib_down` | Camera movement type in the generated video                                                             |
| `cameraMotionStrength` | number        | No       | `1`     | 0   | 2    | -                                                                                            | Strength of camera motion (0-2). Higher values = stronger effect.                                       |
| `duration`             | number        | No       | `6`     | 3   | 20   | -                                                                                            | Video duration in seconds (3-20). Durations below 6s may produce lower quality.                         |
| `aspectRatio`          | string        | No       | `auto`  | -   | -    | `auto`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9`                                          | Video aspect ratio. ‘Match Input’ detects from first keyframe image.                                    |
| `fps`                  | number        | No       | `25`    | 1   | 60   | -                                                                                            | Frame rate in frames per second (1-60)                                                                  |
| `numInferenceSteps`    | number        | No       | `40`    | 1   | 100  | -                                                                                            | Number of inference steps. Higher = better quality, slower.                                             |
| `guidanceScale`        | number        | No       | `3`     | 1   | 20   | -                                                                                            | CFG guidance scale. Higher = stronger prompt adherence.                                                 |
| `generateAudio`        | boolean       | No       | `true`  | -   | -    | -                                                                                            | Whether to generate synchronized audio                                                                  |
| `enhancePrompt`        | boolean       | No       | `false` | -   | -    | -                                                                                            | Use Gemma to enhance the prompt for better video generation                                             |
| `seed`                 | number        | No       | -       | 0   | -    | -                                                                                            | Random seed for reproducibility. Leave blank for random.                                                |

## LTX-2 19b Video to Video

Transform videos with text prompts. Input a reference video and describe the desired output. Supports IC-LoRA control (canny, depth, pose, detailer) and optional first-frame conditioning.

**Model ID:** `model_ltx-2-19b-video-to-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-19b-video-to-video/markdown>

| Parameter              | Type    | Required | Default    | Min | Max  | Allowed Values                                                                               | Description                                                                                                                                       |
| ---------------------- | ------- | -------- | ---------- | --- | ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`               | string  | Yes      | -          | -   | -    | -                                                                                            | Text prompt for video generation                                                                                                                  |
| `video`                | file    | No       | -          | -   | -    | -                                                                                            | Reference video. Used as the conditioning source and preprocessed based on the selected modality. Overridden if a conditioning video is provided. |
| `videoStrength`        | number  | No       | `1`        | 0   | 1    | -                                                                                            | Reference video conditioning strength (0-1). Higher = more faithful to input video structure.                                                     |
| `image`                | file    | No       | -          | -   | -    | -                                                                                            | Optional first-frame image. Applied at frame 0 for additional conditioning.                                                                       |
| `imageStrength`        | number  | No       | `1`        | 0   | 1    | -                                                                                            | First-frame image conditioning strength (0-1).                                                                                                    |
| `negativePrompt`       | string  | No       | -          | -   | -    | -                                                                                            | Negative prompt to guide what to avoid in generation                                                                                              |
| `resolution`           | string  | No       | `auto`     | -   | -    | `auto`, `720p`, `1080p`, `1440p`, `2160p`                                                    | Video resolution. ‘Match Input’ replicates input video dimensions (recommended).                                                                  |
| `width`                | number  | No       | -          | 64  | 4096 | -                                                                                            | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.                                                              |
| `height`               | number  | No       | -          | 64  | 4096 | -                                                                                            | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.                                                              |
| `cameraMotion`         | string  | No       | `none`     | -   | -    | `none`, `static`, `dolly_in`, `dolly_out`, `dolly_left`, `dolly_right`, `jib_up`, `jib_down` | Camera movement type in the generated video.                                                                                                      |
| `cameraMotionStrength` | number  | No       | `1`        | 0   | 2    | -                                                                                            | Strength of camera motion (0-2). Higher values = stronger effect.                                                                                 |
| `duration`             | number  | No       | -          | 3   | 20   | -                                                                                            | Output video duration in seconds (3-20). Leave empty to match input video.                                                                        |
| `aspectRatio`          | string  | No       | `auto`     | -   | -    | `auto`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`                                          | Video aspect ratio. ‘Match Input’ detects from input video (recommended).                                                                         |
| `fps`                  | number  | No       | -          | 1   | 60   | -                                                                                            | Output frame rate (1-60 fps). Leave empty to match input video.                                                                                   |
| `audioSource`          | string  | No       | `original` | -   | -    | `original`, `generate`, `none`                                                               | Audio for output: copy from input, generate new, or none.                                                                                         |
| `modality`             | string  | No       | `none`     | -   | -    | `none`, `canny`, `depth`, `pose`, `detailer`                                                 | IC-LoRA control: canny (edges), depth, pose (skeleton), detailer, or none.                                                                        |
| `modalityStrength`     | number  | No       | `1`        | 0   | 2    | -                                                                                            | Strength of IC-LoRA modality (0-2). Higher values = stronger control.                                                                             |
| `conditioningVideo`    | file    | No       | -          | -   | -    | -                                                                                            | Pre-processed conditioning video (canny/depth/pose). Use with matching modality.                                                                  |
| `numInferenceSteps`    | number  | No       | `40`       | 1   | 100  | -                                                                                            | Number of inference steps. Higher = better quality, slower.                                                                                       |
| `guidanceScale`        | number  | No       | `3`        | 1   | 20   | -                                                                                            | Classifier-free guidance scale. Higher = stronger prompt adherence.                                                                               |
| `enhancePrompt`        | boolean | No       | `false`    | -   | -    | -                                                                                            | Use Gemma to enhance the prompt for better video generation                                                                                       |
| `seed`                 | number  | No       | -          | 0   | -    | -                                                                                            | Random seed for reproducibility. Leave blank for random.                                                                                          |

## LTX-2 Fast

Ideal for rapid ideation and mobile workflows. Perfect for creators who need instant feedback, real-time previews, or high-throughput content.

**Model ID:** `model_ltx-2-fast`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-fast/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values                               | Description                                  |
| --------------- | ------- | -------- | ------- | --- | --- | -------------------------------------------- | -------------------------------------------- |
| `prompt`        | string  | Yes      | -       | -   | -   | -                                            | Text prompt describing the video to generate |
| `image`         | file    | No       | -       | -   | -   | -                                            | Input image for image-to-video generation    |
| `resolution`    | string  | No       | `1080p` | -   | -   | `1080p`, `2k`, `4k`                          | Resolution quality of the generated video    |
| `duration`      | number  | No       | `6`     | -   | -   | `6`, `8`, `10`, `12`, `14`, `16`, `18`, `20` | Duration of the video in seconds             |
| `generateAudio` | boolean | No       | `false` | -   | -   | -                                            | Generate audio for the video                 |

## LTX-2 Pro

Delivers high visual fidelity with fast turnaround. Great for daily content creation, marketing teams, and iterative creative workflows.

**Model ID:** `model_ltx-2-pro`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-pro/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values      | Description                                  |
| --------------- | ------- | -------- | ------- | --- | --- | ------------------- | -------------------------------------------- |
| `prompt`        | string  | Yes      | -       | -   | -   | -                   | Text prompt describing the video to generate |
| `image`         | file    | No       | -       | -   | -   | -                   | Input image for image-to-video generation    |
| `resolution`    | string  | No       | `1080p` | -   | -   | `1080p`, `2k`, `4k` | Resolution quality of the generated video    |
| `duration`      | number  | No       | `6`     | -   | -   | `6`, `8`, `10`      | Duration of the video in seconds             |
| `generateAudio` | boolean | No       | `false` | -   | -   | -                   | Generate audio for the video                 |

## LTX-2 Retake

**Model ID:** `model_ltx-2-retake`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-retake/markdown>

| Parameter   | Type   | Required | Default         | Min | Max | Allowed Values                                              | Description                               |
| ----------- | ------ | -------- | --------------- | --- | --- | ----------------------------------------------------------- | ----------------------------------------- |
| `video`     | file   | Yes      | -               | -   | -   | -                                                           | Input video to edit                       |
| `prompt`    | string | Yes      | -               | -   | -   | -                                                           | Text prompt describing the edit           |
| `mode`      | string | No       | `replace_video` | -   | -   | `replace_audio`, `replace_video`, `replace_audio_and_video` | Mode of operation                         |
| `startTime` | number | No       | `0`             | 0   | -   | -                                                           | Start time of the edit in seconds         |
| `duration`  | number | No       | `6`             | 2   | 16  | -                                                           | Duration of the edited section in seconds |

## LTX-2.3 22b

High-quality image-to-video and text-to-video with synchronized audio. Supports last-frame conditioning for interpolation.

**Model ID:** `model_ltx-2-3-22b`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-22b/markdown>

| Parameter                | Type    | Required | Default | Min | Max  | Allowed Values                                      | Description                                                                          |
| ------------------------ | ------- | -------- | ------- | --- | ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `prompt`                 | string  | Yes      | -       | -   | -    | -                                                   | Text prompt for video generation (1-5000 characters)                                 |
| `image`                  | file    | No       | -       | -   | -    | -                                                   | Input image for image-to-video (applied at frame 0). Leave empty for text-to-video.  |
| `imageStrength`          | number  | No       | `1`     | 0   | 1    | -                                                   | Image conditioning strength (0-1) for image-to-video.                                |
| `lastFrameImage`         | file    | No       | -       | -   | -    | -                                                   | Optional end frame image. Conditions the generation to end on this image.            |
| `lastFrameImageStrength` | number  | No       | `1`     | 0   | 1    | -                                                   | Last frame conditioning strength (0-1).                                              |
| `negativePrompt`         | string  | No       | -       | -   | -    | -                                                   | What to avoid in generation                                                          |
| `duration`               | number  | No       | `6`     | 3   | 20   | -                                                   | Video duration in seconds. Durations below 6s may produce lower quality.             |
| `aspectRatio`            | string  | No       | `auto`  | -   | -    | `auto`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9` | Video aspect ratio. ‘Match Input’ detects from input image.                          |
| `resolution`             | string  | No       | `1080p` | -   | -    | `720p`, `1080p`, `1440p`, `2160p`                   | Video resolution. Ignored if width and height are provided.                          |
| `width`                  | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64. |
| `height`                 | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64. |
| `fps`                    | number  | No       | `24`    | 1   | 60   | -                                                   | Frame rate in frames per second (1-60)                                               |
| `numInferenceSteps`      | number  | No       | `30`    | 1   | 100  | -                                                   | Number of inference steps. Higher = better quality, slower.                          |
| `guidanceScale`          | number  | No       | `3`     | 1   | 20   | -                                                   | Guidance scale. Higher = stronger prompt adherence.                                  |
| `generateAudio`          | boolean | No       | `true`  | -   | -    | -                                                   | Whether to generate synchronized audio                                               |
| `enhancePrompt`          | boolean | No       | `true`  | -   | -    | -                                                   | Enhance the prompt for better video generation                                       |
| `seed`                   | number  | No       | -       | 0   | -    | -                                                   | Random seed for reproducibility. Leave blank for random.                             |

## LTX-2.3 22b Audio to Video

Generate video driven by an audio file. Speech cadence controls pacing, musical energy influences motion.

**Model ID:** `model_ltx-2-3-22b-audio-to-video`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-22b-audio-to-video/markdown>

| Parameter           | Type    | Required | Default | Min | Max  | Allowed Values                                      | Description                                                                                                               |
| ------------------- | ------- | -------- | ------- | --- | ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `prompt`            | string  | Yes      | -       | -   | -    | -                                                   | Text prompt for video generation (1-5000 characters)                                                                      |
| `audio`             | file    | Yes      | -       | -   | -    | -                                                   | Audio file that drives the video generation.                                                                              |
| `image`             | file    | No       | -       | -   | -    | -                                                   | Optional image to use as the first frame.                                                                                 |
| `imageStrength`     | number  | No       | `1`     | 0   | 1    | -                                                   | Image conditioning strength (0-1) for image-to-video.                                                                     |
| `negativePrompt`    | string  | No       | -       | -   | -    | -                                                   | What to avoid in generation                                                                                               |
| `maxDuration`       | number  | No       | -       | 3   | 20   | -                                                   | Maximum video duration in seconds (3-20). Video will be shorter if audio is shorter. Leave empty to match audio duration. |
| `audioStartTime`    | number  | No       | `0`     | 0   | -    | -                                                   | Start time in the audio file to use (seconds).                                                                            |
| `aspectRatio`       | string  | No       | `auto`  | -   | -    | `auto`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9` | Video aspect ratio. ‘Match Input’ detects from input image.                                                               |
| `resolution`        | string  | No       | `1080p` | -   | -    | `720p`, `1080p`, `1440p`, `2160p`                   | Video resolution. Ignored if width and height are provided.                                                               |
| `width`             | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.                                      |
| `height`            | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.                                      |
| `fps`               | number  | No       | `24`    | 1   | 60   | -                                                   | Frame rate in frames per second (1-60)                                                                                    |
| `numInferenceSteps` | number  | No       | `30`    | 1   | 100  | -                                                   | Number of inference steps. Higher = better quality, slower.                                                               |
| `guidanceScale`     | number  | No       | `3`     | 1   | 20   | -                                                   | Guidance scale. Higher = stronger prompt adherence.                                                                       |
| `enhancePrompt`     | boolean | No       | `true`  | -   | -    | -                                                   | Enhance the prompt for better video generation                                                                            |
| `seed`              | number  | No       | -       | 0   | -    | -                                                   | Random seed for reproducibility. Leave blank for random.                                                                  |

## LTX-2.3 22b Extend Video

Extend videos by generating continuation frames. Input a video and describe how it should continue.

**Model ID:** `model_ltx-2-3-22b-extend-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-22b-extend-video/markdown>

| Parameter           | Type    | Required | Default | Min | Max  | Allowed Values                                      | Description                                                                                    |
| ------------------- | ------- | -------- | ------- | --- | ---- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `prompt`            | string  | Yes      | -       | -   | -    | -                                                   | Text prompt describing how the video should continue                                           |
| `video`             | file    | Yes      | -       | -   | -    | -                                                   | Input video to extend. The model generates continuation frames based on this video.            |
| `videoStrength`     | number  | No       | `1`     | 0   | 1    | -                                                   | Video conditioning strength. Higher = more faithful to input video motion/style.               |
| `extendDuration`    | number  | No       | `4`     | 1   | 20   | -                                                   | Duration of new video to generate in seconds. Additional duration added after the input video. |
| `contextDuration`   | number  | No       | -       | 0.1 | -    | -                                                   | Seconds from input video to use as context. Leave empty to use entire video.                   |
| `aspectRatio`       | string  | No       | `auto`  | -   | -    | `auto`, `21:9`, `16:9`, `4:3`, `3:4`, `1:1`, `9:16` | Video aspect ratio. ‘Match Input’ detects from input video.                                    |
| `resolution`        | string  | No       | `auto`  | -   | -    | `auto`, `720p`, `1080p`, `1440p`, `2160p`           | Video resolution. ‘Match Input’ replicates input video dimensions (recommended for extend).    |
| `width`             | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.           |
| `height`            | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.           |
| `fps`               | number  | No       | -       | 1   | 60   | -                                                   | Output frame rate (1-60 fps). Leave empty to match input video.                                |
| `numInferenceSteps` | number  | No       | `30`    | 1   | 100  | -                                                   | Number of denoising steps (more = higher quality, slower)                                      |
| `guidanceScale`     | number  | No       | `3`     | 1   | 20   | -                                                   | Classifier-free guidance scale (higher = more prompt adherence)                                |
| `negativePrompt`    | string  | No       | -       | -   | -    | -                                                   | What to avoid in generation                                                                    |
| `generateAudio`     | boolean | No       | `true`  | -   | -    | -                                                   | Whether to generate synchronized audio                                                         |
| `audioStrength`     | number  | No       | `1`     | 0   | 1    | -                                                   | Audio conditioning strength (0-1). Higher preserves more input audio characteristics.          |
| `enhancePrompt`     | boolean | No       | `true`  | -   | -    | -                                                   | Enhance the prompt for better video generation                                                 |
| `seed`              | number  | No       | -       | 0   | -    | -                                                   | Random seed for reproducibility. Leave blank for random.                                       |

## LTX-2.3 22b Fast

Fast tier (8 distilled steps) for rapid iteration with synchronized audio. Supports last-frame conditioning.

**Model ID:** `model_ltx-2-3-22b-fast`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-22b-fast/markdown>

| Parameter                | Type    | Required | Default | Min | Max  | Allowed Values                                      | Description                                                                                               |
| ------------------------ | ------- | -------- | ------- | --- | ---- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `prompt`                 | string  | Yes      | -       | -   | -    | -                                                   | Text prompt for video generation (1-5000 characters)                                                      |
| `image`                  | file    | No       | -       | -   | -    | -                                                   | Input image for image-to-video (applied at frame 0). Leave empty for text-to-video.                       |
| `imageStrength`          | number  | No       | `1`     | 0   | 1    | -                                                   | Image conditioning strength (0-1) for image-to-video.                                                     |
| `lastFrameImage`         | file    | No       | -       | -   | -    | -                                                   | Optional end frame image. Conditions the generation to end on this image.                                 |
| `lastFrameImageStrength` | number  | No       | `1`     | 0   | 1    | -                                                   | Last frame conditioning strength (0-1).                                                                   |
| `duration`               | number  | No       | `6`     | 3   | 20   | -                                                   | Video duration in seconds (3-20). Durations below 6s may produce lower quality. >10s only at 1080p/25fps. |
| `aspectRatio`            | string  | No       | `auto`  | -   | -    | `auto`, `21:9`, `16:9`, `4:3`, `3:4`, `1:1`, `9:16` | Video aspect ratio. ‘Match Input’ detects from input image.                                               |
| `resolution`             | string  | No       | `1080p` | -   | -    | `720p`, `1080p`, `1440p`, `2160p`                   | Video resolution. Ignored if width and height are provided.                                               |
| `width`                  | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.                      |
| `height`                 | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.                      |
| `fps`                    | number  | No       | `24`    | 1   | 60   | -                                                   | Frame rate in frames per second (1-60)                                                                    |
| `generateAudio`          | boolean | No       | `true`  | -   | -    | -                                                   | Whether to generate synchronized audio                                                                    |
| `enhancePrompt`          | boolean | No       | `true`  | -   | -    | -                                                   | Enhance the prompt for better video generation                                                            |
| `seed`                   | number  | No       | -       | 0   | -    | -                                                   | Random seed for reproducibility. Leave blank for random.                                                  |

## LTX-2.3 22b HQ

Highest quality tier using Res2s sampler (15 steps). Best visual fidelity with last-frame conditioning support.

**Model ID:** `model_ltx-2-3-22b-hq`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-22b-hq/markdown>

| Parameter                | Type    | Required | Default | Min | Max  | Allowed Values                                      | Description                                                                          |
| ------------------------ | ------- | -------- | ------- | --- | ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `prompt`                 | string  | Yes      | -       | -   | -    | -                                                   | Text prompt for video generation (1-5000 characters)                                 |
| `image`                  | file    | No       | -       | -   | -    | -                                                   | Input image for image-to-video (applied at frame 0). Leave empty for text-to-video.  |
| `imageStrength`          | number  | No       | `1`     | 0   | 1    | -                                                   | Image conditioning strength (0-1) for image-to-video.                                |
| `lastFrameImage`         | file    | No       | -       | -   | -    | -                                                   | Optional end frame image. Conditions the generation to end on this image.            |
| `lastFrameImageStrength` | number  | No       | `1`     | 0   | 1    | -                                                   | Last frame conditioning strength (0-1).                                              |
| `negativePrompt`         | string  | No       | -       | -   | -    | -                                                   | What to avoid in generation                                                          |
| `duration`               | number  | No       | `6`     | 3   | 20   | -                                                   | Video duration in seconds. Durations below 6s may produce lower quality.             |
| `aspectRatio`            | string  | No       | `auto`  | -   | -    | `auto`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9` | Video aspect ratio. ‘Match Input’ detects from input image.                          |
| `resolution`             | string  | No       | `1080p` | -   | -    | `720p`, `1080p`, `1440p`, `2160p`                   | Video resolution. Ignored if width and height are provided.                          |
| `width`                  | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64. |
| `height`                 | number  | No       | -       | 64  | 4096 | -                                                   | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64. |
| `fps`                    | number  | No       | `24`    | 1   | 60   | -                                                   | Frame rate in frames per second (1-60)                                               |
| `numInferenceSteps`      | number  | No       | `15`    | 1   | 100  | -                                                   | Number of HQ inference steps (Res2s sampler). Default 15.                            |
| `guidanceScale`          | number  | No       | `3`     | 1   | 20   | -                                                   | Guidance scale. Higher = stronger prompt adherence.                                  |
| `generateAudio`          | boolean | No       | `true`  | -   | -    | -                                                   | Whether to generate synchronized audio                                               |
| `enhancePrompt`          | boolean | No       | `true`  | -   | -    | -                                                   | Enhance the prompt for better video generation                                       |
| `seed`                   | number  | No       | -       | 0   | -    | -                                                   | Random seed for reproducibility. Leave blank for random.                             |

## LTX-2.3 22b Keyframes to Video

Interpolate between multiple keyframe images to generate smooth video transitions with synchronized audio.

**Model ID:** `model_ltx-2-3-22b-keyframes-to-video`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-22b-keyframes-to-video/markdown>

| Parameter           | Type          | Required | Default | Min | Max  | Allowed Values                                      | Description                                                                                             |
| ------------------- | ------------- | -------- | ------- | --- | ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `prompt`            | string        | Yes      | -       | -   | -    | -                                                   | Text prompt describing the video content and transitions (1-5000 characters)                            |
| `keyframes`         | inputs\_array | Yes      | -       | -   | -    | -                                                   | List of keyframe images with timestamps and strengths. At least 2 keyframes required for interpolation. |
| `negativePrompt`    | string        | No       | -       | -   | -    | -                                                   | Negative prompt to guide what to avoid in generation                                                    |
| `resolution`        | string        | No       | `1080p` | -   | -    | `720p`, `1080p`, `1440p`, `2160p`                   | Video resolution. Ignored if width and height are provided.                                             |
| `width`             | number        | No       | -       | 64  | 4096 | -                                                   | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.                    |
| `height`            | number        | No       | -       | 64  | 4096 | -                                                   | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.                    |
| `duration`          | number        | No       | `6`     | 3   | 20   | -                                                   | Video duration in seconds (3-20). Durations below 6s may produce lower quality.                         |
| `aspectRatio`       | string        | No       | `auto`  | -   | -    | `auto`, `16:9`, `9:16`, `4:3`, `3:4`, `1:1`, `21:9` | Video aspect ratio. ‘Match Input’ detects from first keyframe image.                                    |
| `fps`               | number        | No       | `24`    | 1   | 60   | -                                                   | Frame rate in frames per second (1-60)                                                                  |
| `numInferenceSteps` | number        | No       | `30`    | 1   | 100  | -                                                   | Number of inference steps. Higher = better quality, slower.                                             |
| `guidanceScale`     | number        | No       | `3`     | 1   | 20   | -                                                   | CFG guidance scale. Higher = stronger prompt adherence.                                                 |
| `generateAudio`     | boolean       | No       | `true`  | -   | -    | -                                                   | Whether to generate synchronized audio                                                                  |
| `enhancePrompt`     | boolean       | No       | `true`  | -   | -    | -                                                   | Use Gemma to enhance the prompt for better video generation                                             |
| `seed`              | number        | No       | -       | 0   | -    | -                                                   | Random seed for reproducibility. Leave blank for random.                                                |

## LTX-2.3 22b Retake

Re-generate a temporal region of an existing video. Replace audio, video, or both.

**Model ID:** `model_ltx-2-3-22b-retake`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-22b-retake/markdown>

| Parameter           | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                        |
| ------------------- | ------- | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------------- |
| `video`             | file    | Yes      | -       | -   | -   | -              | Input video to edit. The model regenerates a temporal region of this video.        |
| `prompt`            | string  | Yes      | -       | -   | -   | -              | Text prompt describing the desired output for the regenerated region               |
| `startTime`         | number  | No       | `0`     | 0   | -   | -              | Start time in seconds for the region to regenerate.                                |
| `endTime`           | number  | Yes      | -       | 0.1 | -   | -              | End time in seconds for the region to regenerate. Must be greater than start time. |
| `negativePrompt`    | string  | No       | -       | -   | -   | -              | What to avoid in generation                                                        |
| `replaceVideo`      | boolean | No       | `true`  | -   | -   | -              | Replace the video.                                                                 |
| `replaceAudio`      | boolean | No       | `true`  | -   | -   | -              | Replace the audio.                                                                 |
| `distilled`         | boolean | No       | `false` | -   | -   | -              | Use distilled mode (8 steps, no CFG) for faster generation.                        |
| `numInferenceSteps` | number  | No       | `30`    | 1   | 100 | -              | Number of denoising steps. Ignored in distilled mode.                              |
| `guidanceScale`     | number  | No       | `3`     | 1   | 20  | -              | CFG guidance scale. Ignored in distilled mode.                                     |
| `enhancePrompt`     | boolean | No       | `true`  | -   | -   | -              | Enhance the prompt for better video generation                                     |
| `seed`              | number  | No       | -       | 0   | -   | -              | Random seed for reproducibility. Leave blank for random.                           |

## LTX-2.3 22b Video to Video

Transform videos with text prompts. Supports optional first-frame conditioning.

**Model ID:** `model_ltx-2-3-22b-video-to-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-22b-video-to-video/markdown>

| Parameter                       | Type    | Required | Default    | Min | Max  | Allowed Values                                                       | Description                                                                                                                                                                                                           |
| ------------------------------- | ------- | -------- | ---------- | --- | ---- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                        | string  | Yes      | -          | -   | -    | -                                                                    | Text prompt for video generation                                                                                                                                                                                      |
| `video`                         | file    | Yes      | -          | -   | -    | -                                                                    | Reference video. The model generates output conditioned on this video’s structure.                                                                                                                                    |
| `videoStrength`                 | number  | No       | `1`        | 0   | 1    | -                                                                    | Reference video conditioning strength (0-1). Higher = more faithful to input video structure.                                                                                                                         |
| `image`                         | file    | No       | -          | -   | -    | -                                                                    | Optional first-frame image. Applied at frame 0 for additional conditioning.                                                                                                                                           |
| `imageStrength`                 | number  | No       | `1`        | 0   | 1    | -                                                                    | First-frame image conditioning strength (0-1).                                                                                                                                                                        |
| `resolution`                    | string  | No       | `auto`     | -   | -    | `auto`, `720p`, `1080p`, `1440p`, `2160p`                            | Video resolution. ‘Match Input’ replicates input video dimensions (recommended).                                                                                                                                      |
| `width`                         | number  | No       | -          | 64  | 4096 | -                                                                    | Explicit video width in pixels. Must be used with height. Rounded to multiple of 64.                                                                                                                                  |
| `height`                        | number  | No       | -          | 64  | 4096 | -                                                                    | Explicit video height in pixels. Must be used with width. Rounded to multiple of 64.                                                                                                                                  |
| `duration`                      | number  | No       | -          | 3   | 20   | -                                                                    | Output video duration in seconds (3-20). Leave empty to match input video.                                                                                                                                            |
| `aspectRatio`                   | string  | No       | `auto`     | -   | -    | `auto`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`                  | Video aspect ratio. ‘Match Input’ detects from input video (recommended).                                                                                                                                             |
| `fps`                           | number  | No       | -          | 1   | 60   | -                                                                    | Output frame rate (1-60 fps). Leave empty to match input video.                                                                                                                                                       |
| `audioSource`                   | string  | No       | `original` | -   | -    | `original`, `generate`, `none`                                       | Audio for output: copy from input, generate new, or none.                                                                                                                                                             |
| `modality`                      | string  | No       | `none`     | -   | -    | `none`, `canny`, `depth`, `pose`, `detailer`, `motion_track_control` | IC-LoRA control mode. The input video is preprocessed according to the selected modality (canny extracts edges, depth estimates depth, pose detects skeletons, detailer and motion\_track\_control are pass-through). |
| `modalityStrength`              | number  | No       | `1`        | 0   | 2    | -                                                                    | Strength of IC-LoRA modality (0-2). Higher values = stronger control.                                                                                                                                                 |
| `conditioningAttentionStrength` | number  | No       | `1`        | 0   | 1    | -                                                                    | How closely the model follows the reference video structure (0-1). Lower = more creative freedom.                                                                                                                     |
| `conditioningVideo`             | file    | No       | -          | -   | -    | -                                                                    | Override the default preprocessing by providing your own pre-processed video. If not provided, the input video is automatically preprocessed using the selected modality.                                             |
| `enhancePrompt`                 | boolean | No       | `true`     | -   | -    | -                                                                    | Use Gemma to enhance the prompt for better video generation                                                                                                                                                           |
| `seed`                          | number  | No       | -          | 0   | -    | -                                                                    | Random seed for reproducibility. Leave blank for random.                                                                                                                                                              |

## LTX-2.3 Fast

Speed-optimized LTX-2.3 video generation. Generates videos with synchronized audio faster than real-time — ideal for rapid prototyping, mobile workflows, and high-volume production.

**Model ID:** `model_ltx-2-3-fast`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-fast/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values                                                                                              | Description                                                                                          |
| --------------- | ------- | -------- | ------- | --- | --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `prompt`        | string  | Yes      | -       | -   | -   | -                                                                                                           | Text prompt describing the video to generate                                                         |
| `startImage`    | file    | No       | -       | -   | -   | -                                                                                                           | First frame image for image-to-video generation                                                      |
| `endImage`      | file    | No       | -       | -   | -   | -                                                                                                           | End frame for interpolation (requires first frame). Video interpolates between first and last frame. |
| `resolution`    | string  | No       | `1080p` | -   | -   | `1080p`, `2k`, `4k`                                                                                         | Video resolution. Durations longer than 10 seconds only at 1080p with 24 or 25 FPS.                  |
| `duration`      | number  | No       | `6`     | -   | -   | `6`, `8`, `10`, `12`, `14`, `16`, `18`, `20`                                                                | Duration of the video in seconds                                                                     |
| `aspectRatio`   | string  | No       | `16:9`  | -   | -   | `16:9`, `9:16`                                                                                              | Aspect ratio of the generated video                                                                  |
| `fps`           | number  | No       | `25`    | -   | -   | `24`, `25`, `48`, `50`                                                                                      | Frame rate in frames per second                                                                      |
| `cameraMotion`  | string  | No       | `none`  | -   | -   | `none`, `dolly_in`, `dolly_out`, `dolly_left`, `dolly_right`, `jib_up`, `jib_down`, `static`, `focus_shift` | Camera motion effect to apply to the generated video                                                 |
| `generateAudio` | boolean | No       | `true`  | -   | -   | -                                                                                                           | Generate synchronized audio for the video                                                            |

## LTX-2.3 Pro

High-fidelity LTX-2.3 video generation. Produces higher visual quality than LTX 2.3 Fast. Supports text-to-video, image-to-video with optional end frame interpolation.

**Model ID:** `model_ltx-2-3-pro`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-pro/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values                                                                                              | Description                                                                            |
| --------------- | ------- | -------- | ------- | --- | --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `prompt`        | string  | Yes      | -       | -   | -   | -                                                                                                           | Text prompt describing the video to generate                                           |
| `startImage`    | file    | No       | -       | -   | -   | -                                                                                                           | First frame image for image-to-video.                                                  |
| `endImage`      | file    | No       | -       | -   | -   | -                                                                                                           | Optional end frame for interpolation. Video interpolates between first and last frame. |
| `resolution`    | string  | No       | `1080p` | -   | -   | `1080p`, `2k`, `4k`                                                                                         | Video resolution (audio\_to\_video, retake, extend are 1080p only)                     |
| `duration`      | number  | No       | `6`     | -   | -   | `6`, `8`, `10`                                                                                              | Duration of the video in seconds                                                       |
| `aspectRatio`   | string  | No       | `16:9`  | -   | -   | `16:9`, `9:16`                                                                                              | Aspect ratio of the generated video                                                    |
| `fps`           | number  | No       | `25`    | -   | -   | `24`, `25`, `48`, `50`                                                                                      | Frame rate in frames per second                                                        |
| `cameraMotion`  | string  | No       | `none`  | -   | -   | `none`, `dolly_in`, `dolly_out`, `dolly_left`, `dolly_right`, `jib_up`, `jib_down`, `static`, `focus_shift` | Camera motion effect to apply to the generated video                                   |
| `generateAudio` | boolean | No       | `true`  | -   | -   | -                                                                                                           | Generate synchronized audio for the video                                              |

## LTX-2.3 Pro Audio to Video

Generate video driven by an audio file. Speech cadence controls pacing, musical energy influences motion. $0.10/sec via fal.ai.

**Model ID:** `model_ltx-2-3-pro-audio-to-video`

**Capabilities:** `audio2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-pro-audio-to-video/markdown>

| Parameter       | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                      |
| --------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------ |
| `audio`         | file   | Yes      | -       | -   | -   | -              | Audio file (2-20 seconds). Drives the video generation.                                          |
| `image`         | file   | No       | -       | -   | -   | -              | Optional image to use as the first frame. If not provided, prompt is required.                   |
| `prompt`        | string | No       | -       | -   | -   | -              | Text description of how the video should be generated. Required if image is not provided.        |
| `guidanceScale` | number | No       | `5`     | 1   | 50  | -              | Higher values make output follow the prompt more closely. Default 5 for text-only, 9 with image. |

## LTX-2.3 Pro Extend Video

Add duration to the beginning or end of a video using LTX 2.3 Pro. Extend existing clips with high-fidelity continuation.

**Model ID:** `model_ltx-2-3-pro-extend-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-pro-extend-video/markdown>

| Parameter    | Type   | Required | Default | Min | Max | Allowed Values | Description                                          |
| ------------ | ------ | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------- |
| `video`      | file   | Yes      | -       | -   | -   | -              | Input video to extend                                |
| `prompt`     | string | Yes      | -       | -   | -   | -              | Text prompt describing how the video should continue |
| `duration`   | number | No       | `6`     | -   | -   | `6`, `8`, `10` | Duration of the video in seconds                     |
| `extendMode` | string | No       | `end`   | -   | -   | `start`, `end` | Where to add the new duration                        |

## LTX-2.3 Pro Retake

Re-generate a section of an existing video. Replace audio, video, or both with LTX 2.3 Pro. 1080p only.

**Model ID:** `model_ltx-2-3-pro-retake`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_ltx-2-3-pro-retake/markdown>

| Parameter    | Type   | Required | Default                   | Min | Max | Allowed Values                                              | Description                                  |
| ------------ | ------ | -------- | ------------------------- | --- | --- | ----------------------------------------------------------- | -------------------------------------------- |
| `video`      | file   | Yes      | -                         | -   | -   | -                                                           | Input video to edit                          |
| `prompt`     | string | Yes      | -                         | -   | -   | -                                                           | Text prompt describing the edit              |
| `retakeMode` | string | No       | `replace_audio_and_video` | -   | -   | `replace_audio`, `replace_video`, `replace_audio_and_video` | What to replace in the section               |
| `startTime`  | number | No       | `0`                       | 0   | -   | -                                                           | Start time in seconds of section to edit     |
| `duration`   | number | No       | `2`                       | 2   | -   | -                                                           | Duration in seconds of section to edit (≥2s) |
