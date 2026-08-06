---
title: Luma Labs | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-06-15.

This reference lists all available **Luma Labs** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Luma Modify Video](#luma-modify-video)
- [Luma Ray 2 Flash - 540p](#luma-ray-2-flash---540p)
- [Luma Ray 2 Flash - 720p](#luma-ray-2-flash---720p)
- [Luma Ray 3.2](#luma-ray-32)
- [Luma Ray 3.2 Edit](#luma-ray-32-edit)
- [Luma Ray 3.2 Reframe](#luma-ray-32-reframe)
- [Luma Video Reframe](#luma-video-reframe)

---

## Luma Modify Video

**Model ID:** `model_luma-modify-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-modify-video/markdown>

| Parameter    | Type   | Required | Default    | Min | Max | Allowed Values                                                                                                | Description                                                                                                                                                                                                                                                |
| ------------ | ------ | -------- | ---------- | --- | --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`      | file   | Yes      | -          | -   | -   | -                                                                                                             | The video to modify. Maximum video size is 100mb. Maximum video duration is 30 seconds.                                                                                                                                                                    |
| `firstFrame` | file   | No       | -          | -   | -   | -                                                                                                             | An optional first frame of the video to modify. This should be a modified version of the original first frame, it will be used to guide the video modification.                                                                                            |
| `prompt`     | string | No       | -          | -   | -   | -                                                                                                             | A prompt to guide the video modification                                                                                                                                                                                                                   |
| `mode`       | string | No       | `adhere_1` | -   | -   | `adhere_1`, `adhere_2`, `adhere_3`, `flex_1`, `flex_2`, `flex_3`, `reimagine_1`, `reimagine_2`, `reimagine_3` | How closely the output should follow the source video. Adhere: very close, for subtle enhancements. Flex: allows more stylistic change while keeping recognizable elements. Reimagine: loosely follows the source, for dramatic or transformative changes. |

## Luma Ray 2 Flash - 540p

Luma Ray Flash 2 520p quickly generates bold videos in 30–60 seconds for impactful content creation.

**Model ID:** `model_luma-ray-flash-2-540p`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-ray-flash-2-540p/markdown>

| Parameter     | Type          | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Description                                                                                                 |
| ------------- | ------------- | -------- | ------- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `prompt`      | string        | Yes      | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Describe your video                                                                                         |
| `image`       | file          | No       | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Image used as the first frame of the video                                                                  |
| `endImage`    | file          | No       | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Used to generate a video that transitions from the first frame to this image. Requires a first frame image. |
| `duration`    | number        | No       | `5`     | -   | -   | `5`, `9`                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Duration in seconds                                                                                         |
| `aspectRatio` | string        | No       | `16:9`  | -   | -   | `9:21`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9`                                                                                                                                                                                                                                                                                                                                                                                                               | Aspect ratio of the generated video                                                                         |
| `loop`        | boolean       | No       | `false` | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Matches the first and last frames for smooth, seamless looping.                                             |
| `concepts`    | string\_array | No       | -       | -   | -   | `truck_left`, `pan_right`, `pedestal_down`, `low_angle`, `pedestal_up`, `selfie`, `pan_left`, `roll_right`, `zoom_in`, `over_the_shoulder`, `orbit_right`, `orbit_left`, `static`, `tiny_planet`, `high_angle`, `bolt_cam`, `dolly_zoom`, `overhead`, `zoom_out`, `handheld`, `roll_left`, `pov`, `aerial_drone`, `push_in`, `crane_down`, `truck_right`, `tilt_down`, `elevator_doors`, `tilt_up`, `ground_level`, `pull_out`, `aerial`, `crane_up`, `eye_level` | List of camera concepts to apply to the video generation.                                                   |

## Luma Ray 2 Flash - 720p

Luma Ray Flash 2 720p quickly generates bold videos in 30–60 seconds for impactful content creation.

**Model ID:** `model_luma-ray-flash-2-720p`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-ray-flash-2-720p/markdown>

| Parameter     | Type          | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Description                                                                                                 |
| ------------- | ------------- | -------- | ------- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `prompt`      | string        | Yes      | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Describe your video                                                                                         |
| `image`       | file          | No       | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Image used as the first frame of the video.e                                                                |
| `endImage`    | file          | No       | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Used to generate a video that transitions from the first frame to this image. Requires a first frame image. |
| `duration`    | number        | No       | `5`     | -   | -   | `5`, `9`                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Duration in seconds                                                                                         |
| `aspectRatio` | string        | No       | `16:9`  | -   | -   | `9:21`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9`                                                                                                                                                                                                                                                                                                                                                                                                               | Aspect ratio of the generated video                                                                         |
| `loop`        | boolean       | No       | `false` | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Matches the first and last frames for smooth, seamless looping.                                             |
| `concepts`    | string\_array | No       | -       | -   | -   | `truck_left`, `pan_right`, `pedestal_down`, `low_angle`, `pedestal_up`, `selfie`, `pan_left`, `roll_right`, `zoom_in`, `over_the_shoulder`, `orbit_right`, `orbit_left`, `static`, `tiny_planet`, `high_angle`, `bolt_cam`, `dolly_zoom`, `overhead`, `zoom_out`, `handheld`, `roll_left`, `pov`, `aerial_drone`, `push_in`, `crane_down`, `truck_right`, `tilt_down`, `elevator_doors`, `tilt_up`, `ground_level`, `pull_out`, `aerial`, `crane_up`, `eye_level` | List of camera concepts to apply to the video generation.                                                   |

## Luma Ray 3.2

Generate videos from a text prompt or anchor images with Luma Labs Ray 3.2, with control over aspect ratio, resolution, duration, HDR, and looping.

**Model ID:** `model_luma-ray-3-2`

**Capabilities:** `txt2video`, `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-ray-3-2/markdown>

| Parameter     | Type    | Required | Default | Min | Max | Allowed Values                              | Description                                                                                                                                         |
| ------------- | ------- | -------- | ------- | --- | --- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string  | Yes      | -       | -   | -   | -                                           | Describe the video you want to generate. Include motion, mood, style, and setting for best results.                                                 |
| `startFrame`  | file    | No       | -       | -   | -   | -                                           | An image to use as the first frame of the generated video. The model animates forward from this starting point.                                     |
| `endFrame`    | file    | No       | -       | -   | -   | -                                           | An image to use as the last frame of the generated video. Requires a first frame. The model animates between the two.                               |
| `duration`    | string  | No       | `5s`    | -   | -   | `5s`, `10s`                                 | How long the generated video should be. 10 seconds is not available with Loop, HDR, or anchor frames.                                               |
| `resolution`  | string  | No       | `720p`  | -   | -   | `540p`, `720p`, `1080p`                     | The vertical resolution of the output. Higher resolutions cost more. HDR requires 720p or 1080p.                                                    |
| `aspectRatio` | string  | No       | `16:9`  | -   | -   | `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9` | The width-to-height ratio of the generated video. Defaults to 16:9; set to match your target platform or format.                                    |
| `loop`        | boolean | No       | `false` | -   | -   | -                                           | Generates a video that plays back seamlessly in a continuous loop.                                                                                  |
| `hdr`         | boolean | No       | `false` | -   | -   | -                                           | Produces a high dynamic range video with richer contrast and color. Requires 720p or 1080p resolution, and is not available at 10 seconds duration. |

## Luma Ray 3.2 Edit

Edit an existing video with Luma Labs Ray 3.2 while preserving motion and timing, with automatic controls or manual edit strength presets.

**Model ID:** `model_luma-ray-3-2-edit`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-ray-3-2-edit/markdown>

| Parameter                    | Type          | Required | Default    | Min | Max | Allowed Values                                                                                                | Description                                                                                                                                                                                                                                 |
| ---------------------------- | ------------- | -------- | ---------- | --- | --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                     | string        | Yes      | -          | -   | -   | -                                                                                                             | Describe the visual changes to apply to the source video while preserving its motion and timing.                                                                                                                                            |
| `video`                      | file          | Yes      | -          | -   | -   | -                                                                                                             | The source video to edit.                                                                                                                                                                                                                   |
| `startFrame`                 | file          | No       | -          | -   | -   | -                                                                                                             | Single guide-frame image for the edit. Mutually exclusive with multi-anchor keyframes.                                                                                                                                                      |
| `keyframes`                  | inputs\_array | No       | -          | -   | -   | -                                                                                                             | Multi-anchor guide-frame images for the edit. Provide matching Keyframe Indexes; mutually exclusive with Guide Frame.                                                                                                                       |
| `resolution`                 | string        | No       | `720p`     | -   | -   | `540p`, `720p`, `1080p`                                                                                       | The vertical resolution of the output. Higher resolutions cost more.                                                                                                                                                                        |
| `editStrength`               | string        | No       | `adhere_1` | -   | -   | `adhere_1`, `adhere_2`, `adhere_3`, `flex_1`, `flex_2`, `flex_3`, `reimagine_1`, `reimagine_2`, `reimagine_3` | Controls how much the model changes the source video. Adhere presets stay close to the original; Flex presets allow moderate changes; Reimagine presets produce a more creative transformation. Cannot be used together with Auto Controls. |
| `faceControlEnabled`         | boolean       | No       | -          | -   | -   | -                                                                                                             | Enable face-identity conditioning for the edit.                                                                                                                                                                                             |
| `poseControlEnabled`         | boolean       | No       | -          | -   | -   | -                                                                                                             | Enable pose or skeleton conditioning for the edit.                                                                                                                                                                                          |
| `poseControlStrength`        | string        | No       | `precise`  | -   | -   | `precise`, `coarse`                                                                                           | Pose-conditioning strength.                                                                                                                                                                                                                 |
| `depthControlEnabled`        | boolean       | No       | -          | -   | -   | -                                                                                                             | Enable depth or scene-geometry conditioning for the edit.                                                                                                                                                                                   |
| `depthControlBlur`           | number        | No       | -          | 0   | 1   | -                                                                                                             | Depth-map blur from 0 to 1. Higher values allow more geometric freedom.                                                                                                                                                                     |
| `normalsControlEnabled`      | boolean       | No       | -          | -   | -   | -                                                                                                             | Enable surface-normals conditioning for the edit.                                                                                                                                                                                           |
| `normalsControlAugmentation` | number        | No       | -          | 0   | 1   | -                                                                                                             | Normals augmentation from 0 to 1. Higher values reinterpret geometry more.                                                                                                                                                                  |
| `trajectoryControlEnabled`   | boolean       | No       | -          | -   | -   | -                                                                                                             | Enable motion-trajectory conditioning for the edit.                                                                                                                                                                                         |
| `trajectoryControlSparsity`  | number        | No       | -          | 0   | 1   | -                                                                                                             | Trajectory sparsity from 0 to 1. Higher values use fewer motion anchors.                                                                                                                                                                    |
| `hdr`                        | boolean       | No       | `false`    | -   | -   | -                                                                                                             | Produces a high dynamic range edited video with richer contrast and color. Requires 720p or 1080p resolution.                                                                                                                               |
| `autoControls`               | boolean       | No       | -          | -   | -   | -                                                                                                             | Lets the model automatically determine the best edit settings based on your source video and prompt. Disable to set Edit Strength manually.                                                                                                 |

## Luma Ray 3.2 Reframe

Re-crop a source video to a new aspect ratio with Luma Labs Ray 3.2, with optional prompt guidance and source positioning.

**Model ID:** `model_luma-ray-3-2-reframe`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-ray-3-2-reframe/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                              | Description                                                    |
| ------------- | ------ | -------- | ------- | --- | --- | ------------------------------------------- | -------------------------------------------------------------- |
| `prompt`      | string | Yes      | -       | -   | -   | -                                           | A text description of how the new canvas area should be filled |
| `video`       | file   | Yes      | -       | -   | -   | -                                           | Video to reframe to a new aspect ratio.                        |
| `aspectRatio` | string | Yes      | `16:9`  | -   | -   | `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9` | Target aspect ratio for the reframed video.                    |
| `resolution`  | string | No       | `720p`  | -   | -   | `540p`, `720p`, `1080p`                     | Output resolution.                                             |

## Luma Video Reframe

**Model ID:** `model_luma-reframe-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_luma-reframe-video/markdown>

| Parameter     | Type   | Required | Default | Min | Max | Allowed Values                                      | Description                                                 |
| ------------- | ------ | -------- | ------- | --- | --- | --------------------------------------------------- | ----------------------------------------------------------- |
| `video`       | file   | Yes      | -       | -   | -   | -                                                   | The video to reframe. Maximum video duration is 10 seconds. |
| `aspectRatio` | string | No       | `16:9`  | -   | -   | `9:21`, `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9` | Aspect ratio of the output                                  |
| `prompt`      | string | No       | -       | -   | -   | -                                                   | A prompt to guide the reframing generation                  |
