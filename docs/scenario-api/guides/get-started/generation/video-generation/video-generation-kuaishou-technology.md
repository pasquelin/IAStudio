---
title: Kuaishou Technology | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Kuaishou Technology** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Kling AI Avatar V2 Pro](#kling-ai-avatar-v2-pro)
- [Kling Lipsync](#kling-lipsync)
- [Kling O1 - Reference Images](#kling-o1---reference-images)
- [Kling O1 - Reference Video](#kling-o1---reference-video)
- [Kling O1 - Video Editing](#kling-o1---video-editing)
- [Kling O1 I2V](#kling-o1-i2v)
- [Kling V1.6 - 720p](#kling-v16---720p)
- [Kling V1.6 Pro](#kling-v16-pro)
- [Kling V2.1](#kling-v21)
- [Kling V2.1 Master](#kling-v21-master)
- [Kling V2.1 Pro](#kling-v21-pro)
- [Kling V2.5 I2V Pro](#kling-v25-i2v-pro)
- [Kling V2.5 I2V Standard](#kling-v25-i2v-standard)
- [Kling V2.5 T2V Pro](#kling-v25-t2v-pro)
- [Kling V2.6 I2V Pro](#kling-v26-i2v-pro)
- [Kling V2.6 Motion Control](#kling-v26-motion-control)
- [Kling V2.6 T2V Pro](#kling-v26-t2v-pro)
- [Kling V3 I2V 4K](#kling-v3-i2v-4k)
- [Kling V3 I2V Pro](#kling-v3-i2v-pro)
- [Kling V3 I2V Standard](#kling-v3-i2v-standard)
- [Kling V3 Omni Video](#kling-v3-omni-video)
- [Kling V3 Pro - Motion Control](#kling-v3-pro---motion-control)
- [Kling V3 Standard - Motion Control](#kling-v3-standard---motion-control)
- [Kling V3 T2V 4K](#kling-v3-t2v-4k)
- [Kling V3 T2V Pro](#kling-v3-t2v-pro)
- [Kling V3 T2V Standard](#kling-v3-t2v-standard)
- [Kling Video to Audio](#kling-video-to-audio)

---

## Kling AI Avatar V2 Pro

Kling AI Avatar v2 Pro: The premium endpoint for creating avatar videos with realistic humans, animals, cartoons, or stylized characters

**Model ID:** `model_kling-video-ai-avatar-v2-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-video-ai-avatar-v2-pro/markdown>

| Parameter | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                          |
| --------- | ------ | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `image`   | file   | Yes      | -       | -   | -   | -              | Image to use as your avatar                                                                          |
| `audio`   | file   | Yes      | -       | -   | -   | -              | Audio file to use for your avatar                                                                    |
| `text`    | string | No       | -       | -   | -   | -              | Describe the action or emotion for your avatar (e.g., ‘speaking enthusiastically’, ‘smiling warmly’) |

## Kling Lipsync

**Model ID:** `model_kling-lip-sync`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-lip-sync/markdown>

| Parameter    | Type   | Required | Default  | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Description                                                                                                                                   |
| ------------ | ------ | -------- | -------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `videoUrl`   | file   | Yes      | -        | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Video for lip syncing. It should be less than 100MB, with a duration of 2-10 seconds, and a resolution of 720p-1080p (720-1920px dimensions). |
| `audioFile`  | file   | No       | -        | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Audio file for lip sync. Must be less than 5MB.                                                                                               |
| `text`       | string | No       | -        | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Text content for lip sync (if not using audio)                                                                                                |
| `voiceId`    | string | No       | `en_AOT` | -   | -   | `en_AOT`, `en_oversea_male1`, `en_girlfriend_4_speech02`, `en_chat_0407_5-1`, `en_uk_boy1`, `en_PeppaPig_platform`, `en_ai_huangzhong_712`, `en_calm_story1`, `en_uk_man2`, `en_reader_en_m-v1`, `en_commercial_lady_en_f-v1`, `zh_genshin_vindi2`, `zh_zhinen_xuesheng`, `zh_tiyuxi_xuedi`, `zh_ai_shatang`, `zh_genshin_klee2`, `zh_genshin_kirara`, `zh_ai_kaiya`, `zh_tiexin_nanyou`, `zh_ai_chenjiahao_712`, `zh_girlfriend_1_speech02`, `zh_chat1_female_new-3`, `zh_girlfriend_2_speech02`, `zh_cartoon-boy-07`, `zh_cartoon-girl-01`, `zh_ai_huangyaoshi_712`, `zh_you_pingjing`, `zh_ai_laoguowang_712`, `zh_chengshu_jiejie`, `zh_zhuxi_speech02`, `zh_uk_oldman3`, `zh_laopopo_speech02`, `zh_heainainai_speech02`, `zh_dongbeilaotie_speech02`, `zh_chongqingxiaohuo_speech02`, `zh_chuanmeizi_speech02`, `zh_chaoshandashu_speech02`, `zh_ai_taiwan_man2_speech02`, `zh_xianzhanggui_speech02`, `zh_tianjinjiejie_speech02`, `zh_diyinnansang_DB_CN_M_04-v2`, `zh_yizhipiannan-v1`, `zh_guanxiaofang-v2`, `zh_tianmeixuemei-v1`, `zh_daopianyansang-v1`, `zh_mengwa-v1` | Voice ID for speech synthesis (if using Text and not Audio)                                                                                   |
| `voiceSpeed` | number | No       | `1`      | 0.8 | 2   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Speech rate (only used if using text and not audio)                                                                                           |

## Kling O1 - Reference Images

Transform images, elements, and text into consistent, high-quality video scenes, ensuring stable character identity, object details, and environments.

**Model ID:** `model_kling-o1-r2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-o1-r2v/markdown>

| Parameter     | Type          | Required | Default | Min | Max | Allowed Values                          | Description                                                                                                                                                           |
| ------------- | ------------- | -------- | ------- | --- | --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | string        | Yes      | -       | -   | -   | -                                       | A textual prompt to guide model generation.                                                                                                                           |
| `images`      | file\_array   | No       | -       | -   | -   | -                                       | Additional reference images for style/appearance. Reference in prompt as @Image1, @Image2, etc. Maximum 7 total (elements + reference images + start image).          |
| `duration`    | string        | No       | `5`     | -   | -   | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10` | The duration of the generated video in seconds.                                                                                                                       |
| `aspectRatio` | string        | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9`                   | Aspect ratio of the video. Ignored if first frame is provided.                                                                                                        |
| `elements`    | inputs\_array | No       | -       | -   | -   | -                                       | Elements (characters/objects) to include in the video. Reference in prompt as @Element1, @Element2, etc. Maximum 7 total (elements + reference images + start image). |

## Kling O1 - Reference Video

Kling O1 Omni generates new shots guided by an input reference video, preserving cinematic language such as motion, and camera style to produce seamless scene continuity.

**Model ID:** `model_kling-o1-video-reference`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-o1-video-reference/markdown>

| Parameter     | Type          | Required | Default | Min | Max | Allowed Values                          | Description                                                                                                                                                                                |
| ------------- | ------------- | -------- | ------- | --- | --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt`      | string        | Yes      | -       | -   | -   | -                                       | Use @Element1, @Element2 to reference elements and @Image1, @Image2 to reference images in order.                                                                                          |
| `video`       | file          | Yes      | -       | -   | -   | -                                       | Reference video URL. Only .mp4/.mov formats supported, 3-10 seconds duration, 720-2160px resolution, max 200MB.                                                                            |
| `images`      | file\_array   | No       | -       | -   | -   | -                                       | Reference images for style/appearance. Reference in prompt as @Image1, @Image2, etc. Maximum 4 total (elements + reference images) when using video.                                       |
| `duration`    | string        | No       | `5`     | -   | -   | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10` | The duration of the generated video in seconds.                                                                                                                                            |
| `aspectRatio` | string        | No       | `auto`  | -   | -   | `auto`, `9:16`, `1:1`, `16:9`           | The aspect ratio of the generated video frame. If ‘auto’, the aspect ratio will be determined automatically based on the input video, and the closest aspect ratio to the it will be used. |
| `keepAudio`   | boolean       | No       | `true`  | -   | -   | -                                       | Keep the original audio of the reference video.                                                                                                                                            |
| `elements`    | inputs\_array | No       | -       | -   | -   | -                                       | Elements (characters/objects) to include. Reference in prompt as @Element1, @Element2, etc. Maximum 4 total (elements + reference images) when using video.                                |

## Kling O1 - Video Editing

Edit an existing video using natural-language instructions, transforming subjects, settings, and style while retaining the original motion structure.

**Model ID:** `model_kling-o1-video-edit`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-o1-video-edit/markdown>

| Parameter   | Type          | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                 |
| ----------- | ------------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`    | string        | Yes      | -       | -   | -   | -              | Use @Element1, @Element2 to reference elements and @Image1, @Image2 to reference images in order.                                                           |
| `video`     | file          | Yes      | -       | -   | -   | -              | Reference video URL. Only .mp4/.mov formats supported, 3-10 seconds duration, 720-2160px resolution, max 200MB.                                             |
| `images`    | file\_array   | No       | -       | -   | -   | -              | Reference images for style/appearance. Reference in prompt as @Image1, @Image2, etc. Maximum 4 total (elements + reference images) when using video.        |
| `keepAudio` | boolean       | No       | `true`  | -   | -   | -              | Keep the original audio of the reference video.                                                                                                             |
| `elements`  | inputs\_array | No       | -       | -   | -   | -              | Elements (characters/objects) to include. Reference in prompt as @Element1, @Element2, etc. Maximum 4 total (elements + reference images) when using video. |

## Kling O1 I2V

Generate a video by taking a start frame and an end frame, animating the transition between them while following exctext-driven style and scene guidance.

**Model ID:** `model_kling-o1-i2v`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-o1-i2v/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description                                           |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -   | -              | A textual prompt to guide model generation.           |
| `image`          | file   | Yes      | -       | -   | -   | -              | Image used as the first frame of the video. Max 10mb. |
| `lastFrameImage` | file   | No       | -       | -   | -   | -              | Image used as the last frame of the video. Max 10mb.  |
| `duration`       | string | No       | `5`     | -   | -   | `5`, `10`      | The duration of the generated video in seconds.       |

## Kling V1.6 - 720p

Kling 1.6 pro 720p is an i2v model by Kwaivgi, currently in progress.

**Model ID:** `model_kling-v1-6-standard`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v1-6-standard/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values        | Description                                                                                                             |
| ----------------- | ----------- | -------- | ------- | --- | --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -   | -                     | Describe your video                                                                                                     |
| `startImage`      | file        | No       | -       | -   | -   | -                     | Image used as the first frame of the video.                                                                             |
| `negativePrompt`  | string      | No       | -       | -   | -   | -                     | Things you do not want to see in the video                                                                              |
| `referenceImages` | file\_array | No       | -       | -   | -   | -                     | Use up to 4 reference images (scene elements) for video generation. Start/end images are ignored when using references. |
| `aspectRatio`     | string      | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9` | Aspect ratio of the video. Ignored if first frame is provided.                                                          |
| `cfgScale`        | number      | No       | `0.5`   | 0   | 1   | -                     | Higher values follow the prompt more closely, lower values are more creative                                            |
| `duration`        | number      | No       | `5`     | -   | -   | `5`, `10`             | Duration in seconds                                                                                                     |

## Kling V1.6 Pro

Kling 1.6 pro is a high-quality 1080p i2v integration currently in progress.

**Model ID:** `model_kling-v1-6-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v1-6-pro/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values        | Description                                                                                                             |
| ----------------- | ----------- | -------- | ------- | --- | --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -   | -                     | Describe your video                                                                                                     |
| `startImage`      | file        | No       | -       | -   | -   | -                     | Image used as the first frame of the video.                                                                             |
| `endImage`        | file        | No       | -       | -   | -   | -                     | Used to generate a video that transitions from the first frame to this image. Requires a first frame image.             |
| `negativePrompt`  | string      | No       | -       | -   | -   | -                     | Things you do not want to see in the video                                                                              |
| `referenceImages` | file\_array | No       | -       | -   | -   | -                     | Use up to 4 reference images (scene elements) for video generation. Start/end images are ignored when using references. |
| `aspectRatio`     | string      | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9` | Aspect ratio of the video. Ignored if first frame is provided.                                                          |
| `cfgScale`        | number      | No       | `0.5`   | 0   | 1   | -                     | Higher values follow the prompt more closely, lower values are more creative                                            |
| `duration`        | number      | No       | `5`     | -   | -   | `5`, `10`             | Duration in seconds                                                                                                     |

## Kling V2.1

**Model ID:** `model_kling-v2-1`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-1/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description                                 |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -   | -              | Describe your video                         |
| `startImage`     | file   | Yes      | -       | -   | -   | -              | Image used as the first frame of the video. |
| `negativePrompt` | string | No       | -       | -   | -   | -              | Things you do not want to see in the video  |
| `duration`       | number | No       | `5`     | -   | -   | `5`, `10`      | Duration in seconds                         |

## Kling V2.1 Master

**Model ID:** `model_kling-v2-1-master`

**Capabilities:** `img2video`, `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-1-master/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values        | Description                                                    |
| ---------------- | ------ | -------- | ------- | --- | --- | --------------------- | -------------------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -   | -                     | Describe your video                                            |
| `startImage`     | file   | No       | -       | -   | -   | -                     | Image used as the first frame of the video.                    |
| `negativePrompt` | string | No       | -       | -   | -   | -                     | Things you do not want to see in the video                     |
| `aspectRatio`    | string | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9` | Aspect ratio of the video. Ignored if first frame is provided. |
| `duration`       | number | No       | `5`     | -   | -   | `5`, `10`             | Duration in seconds                                            |

## Kling V2.1 Pro

Kling 2.1 Pro is an advanced endpoint for the Kling 2.1 model, offering professional-grade videos with enhanced visual fidelity, precise camera movements, and dynamic motion control, perfect for cinematic storytelling.

**Model ID:** `model_kling-v2-1-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-1-pro/markdown>

| Parameter        | Type   | Required | Default                          | Min | Max | Allowed Values | Description                                                                  |
| ---------------- | ------ | -------- | -------------------------------- | --- | --- | -------------- | ---------------------------------------------------------------------------- |
| `prompt`         | string | Yes      | -                                | -   | -   | -              | A textual prompt to guide model generation.                                  |
| `startImage`     | file   | Yes      | -                                | -   | -   | -              | Image used as the first frame of the video.                                  |
| `endImage`       | file   | No       | -                                | -   | -   | -              | Image used as the end frame of the video.                                    |
| `duration`       | string | No       | `5`                              | -   | -   | `5`, `10`      | The duration of the generated video in seconds.                              |
| `negativePrompt` | string | No       | `blur, distort, and low quality` | -   | -   | -              | Negative prompt used to guide the model away from undesirable features.      |
| `cfgScale`       | number | No       | `0.5`                            | 0   | 1   | -              | Higher values follow the prompt more closely, lower values are more creative |

## Kling V2.5 I2V Pro

Top-tier image-to-video generation with unparalleled motion fluidity, cinematic visuals, and exceptional prompt precision.

**Model ID:** `model_kling-v2-5-i2v-turbo-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-5-i2v-turbo-pro/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                      |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------ |
| `prompt`         | string | Yes      | -       | -   | -   | -              | A textual prompt to guide model generation.                                                      |
| `imageUrl`       | file   | Yes      | -       | -   | -   | -              | Image used as the first frame of the video.                                                      |
| `lastFrame`      | file   | No       | -       | -   | -   | -              | Image used as the last frame of the video.                                                       |
| `negativePrompt` | string | No       | -       | -   | -   | -              | Negative prompt used to guide the model away from undesirable features.                          |
| `duration`       | string | No       | `5`     | -   | -   | `5`, `10`      | The duration of the generated video in seconds.                                                  |
| `cfgScale`       | number | No       | `0.5`   | 0   | 1   | -              | Higher values follow the input image and the prompt more closely, lower values are more creative |

## Kling V2.5 I2V Standard

Top-tier image-to-video generation with unparalleled motion fluidity, cinematic visuals, and exceptional prompt precision.

**Model ID:** `model_kling-v2-5-i2v-turbo-standard`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-5-i2v-turbo-standard/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                      |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------ |
| `prompt`         | string | Yes      | -       | -   | -   | -              | A textual prompt to guide model generation.                                                      |
| `image`          | file   | Yes      | -       | -   | -   | -              | Image used as the first frame of the video.                                                      |
| `negativePrompt` | string | No       | -       | -   | -   | -              | Negative prompt used to guide the model away from undesirable features.                          |
| `duration`       | string | No       | `5`     | -   | -   | `5`, `10`      | The duration of the generated video in seconds.                                                  |
| `cfgScale`       | number | No       | `0.5`   | 0   | 1   | -              | Higher values follow the input image and the prompt more closely, lower values are more creative |

## Kling V2.5 T2V Pro

Top-tier text-to-video generation with unparalleled motion fluidity, cinematic visuals, and exceptional prompt precision.

**Model ID:** `model_kling-v2-5-t2v-turbo-pro`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-5-t2v-turbo-pro/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values        | Description                                                             |
| ---------------- | ------ | -------- | ------- | --- | --- | --------------------- | ----------------------------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -   | -                     | A textual prompt to guide model generation.                             |
| `duration`       | string | No       | `5`     | -   | -   | `5`, `10`             | The duration of the generated video in seconds.                         |
| `aspectRatio`    | string | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9` | Aspect ratio of the video.                                              |
| `negativePrompt` | string | No       | -       | -   | -   | -                     | Negative prompt used to guide the model away from undesirable features. |

## Kling V2.6 I2V Pro

Kling 2.6 Pro: Top-tier image-to-video with cinematic visuals, fluid motion, and native audio generation.

**Model ID:** `model_kling-v2-6-i2v-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-6-i2v-pro/markdown>

| Parameter        | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                                                                                                                            |
| ---------------- | ------- | -------- | ------- | --- | --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string  | Yes      | -       | -   | -   | -              | A textual prompt to guide model generation.                                                                                                                                                                                                                                            |
| `image`          | file    | Yes      | -       | -   | -   | -              | Image used as the first frame of the video.                                                                                                                                                                                                                                            |
| `lastFrameImage` | file    | No       | -       | -   | -   | -              | Image used as the last frame of the video.                                                                                                                                                                                                                                             |
| `generateAudio`  | boolean | No       | `false` | -   | -   | -              | Whether to generate native audio for the video. Supports Chinese and English voice output. Other languages are automatically translated to English. For English speech, use lowercase letters; for acronyms or proper nouns, use uppercase. Not supported when Last Frame is provided. |
| `duration`       | string  | No       | `5`     | -   | -   | `5`, `10`      | The duration of the generated video in seconds.                                                                                                                                                                                                                                        |
| `negativePrompt` | string  | No       | -       | -   | -   | -              | Negative prompt used to guide the model away from undesirable features.                                                                                                                                                                                                                |

## Kling V2.6 Motion Control

Transfer movements from a reference video to any character image. Pro mode delivers higher quality output, ideal for complex dance moves and gestures.

**Model ID:** `model_kling-v2-6-motion-control`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-6-motion-control/markdown>

| Parameter              | Type    | Required | Default | Min | Max | Allowed Values   | Description                                                                                                                                                                                                                                                                                                   |
| ---------------------- | ------- | -------- | ------- | --- | --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`               | string  | No       | -       | -   | -   | -                | A textual prompt to guide model generation.                                                                                                                                                                                                                                                                   |
| `image`                | file    | Yes      | -       | -   | -   | -                | The characters, backgrounds, and other elements in the generated video are based on this reference image. Characters should have clear body proportions, avoid occlusion, and occupy more than 5% of the image area. Max 10MB, dimensions 340px-3850px, aspect ratio 1:2.5 to 2.5:1.                          |
| `video`                | file    | Yes      | -       | -   | -   | -                | The character actions in the generated video will be consistent with this reference video. Should contain a realistic style character with entire body or upper body visible, including head, without obstruction. Duration limit depends on Character Orientation: 10s max for ‘Image’, 30s max for ‘Video’. |
| `characterOrientation` | string  | No       | `image` | -   | -   | `image`, `video` | The orientation of the character in the reference video. ‘Image’ means the character is in the reference image, ‘Video’ means the character is in the reference video.                                                                                                                                        |
| `mode`                 | string  | No       | `pro`   | -   | -   | `pro`, `std`     | The mode of the model. ‘pro’ means the model will use the pro mode, ‘standard’ means the model will use the standard mode.                                                                                                                                                                                    |
| `keepOriginalSound`    | boolean | No       | `true`  | -   | -   | -                | Whether to keep the original sound from the reference video.                                                                                                                                                                                                                                                  |

## Kling V2.6 T2V Pro

Kling 2.6 Pro: Top-tier text-to-video with cinematic visuals, fluid motion, and native audio generation.

**Model ID:** `model_kling-v2-6-t2v-pro`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v2-6-t2v-pro/markdown>

| Parameter        | Type    | Required | Default | Min | Max | Allowed Values        | Description                                                                                                                                                                                                                                 |
| ---------------- | ------- | -------- | ------- | --- | --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string  | Yes      | -       | -   | -   | -                     | A textual prompt to guide model generation.                                                                                                                                                                                                 |
| `generateAudio`  | boolean | No       | `true`  | -   | -   | -                     | Whether to generate native audio for the video. Supports Chinese and English voice output. Other languages are automatically translated to English. For English speech, use lowercase letters; for acronyms or proper nouns, use uppercase. |
| `duration`       | string  | No       | `5`     | -   | -   | `5`, `10`             | The duration of the generated video in seconds.                                                                                                                                                                                             |
| `aspectRatio`    | string  | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9` | Aspect ratio of the video.                                                                                                                                                                                                                  |
| `cfgScale`       | number  | No       | `0.5`   | 0   | 1   | -                     | Higher values follow the prompt more closely, lower values are more creative                                                                                                                                                                |
| `negativePrompt` | string  | No       | -       | -   | -   | -                     | Negative prompt used to guide the model away from undesirable features.                                                                                                                                                                     |

## Kling V3 I2V 4K

Kling 3.0 native 4K image-to-video: animate stills to delivery-ready 4K with optional end frame, elements (@Element1, …), and native audio.

**Model ID:** `model_kling-v3-i2v-4k`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-i2v-4k/markdown>

| Parameter        | Type          | Required | Default     | Min | Max | Allowed Values                                                        | Description                                                                                                                                                                                                    |
| ---------------- | ------------- | -------- | ----------- | --- | --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string        | No       | -           | -   | -   | -                                                                     | Text prompt for video generation. Either Prompt or Multi Prompt must be provided, but not both.                                                                                                                |
| `multiPrompt`    | inputs\_array | No       | -           | -   | -   | -                                                                     | Multi-shot prompts with per-shot durations. If provided, overrides the single prompt. Shot Type is required when using Multi Prompt.                                                                           |
| `startImage`     | file          | Yes      | -           | -   | -   | -                                                                     | Image used as the first frame of the video.                                                                                                                                                                    |
| `endImage`       | file          | No       | -           | -   | -   | -                                                                     | Image used as the last frame of the video.                                                                                                                                                                     |
| `duration`       | string        | No       | `5`         | -   | -   | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | The duration of the generated video in seconds.                                                                                                                                                                |
| `generateAudio`  | boolean       | No       | `true`      | -   | -   | -                                                                     | Whether to generate native audio for the video. Supports Chinese and English voice output. Other languages are automatically translated to English. Billing is per second of video regardless of this setting. |
| `shotType`       | string        | No       | `customize` | -   | -   | `customize`, `intelligent`                                            | Multi-shot mode. Required when Multi Prompt is provided.                                                                                                                                                       |
| `cfgScale`       | number        | No       | `0.5`       | 0   | 1   | -                                                                     | Higher values follow the prompt more closely, lower values are more creative.                                                                                                                                  |
| `elements`       | inputs\_array | No       | -           | -   | -   | -                                                                     | Elements (characters/objects) to include. Provide either images (frontal + reference) or a video for each element. Reference in prompt as @Element1, @Element2, etc.                                           |
| `negativePrompt` | string        | No       | -           | -   | -   | -                                                                     | Negative prompt used to guide the model away from undesirable features.                                                                                                                                        |

## Kling V3 I2V Pro

Kling 3.0 Pro: Top-tier image-to-video with cinematic visuals, fluid motion, and native audio generation, with custom element support.

**Model ID:** `model_kling-v3-i2v-pro`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-i2v-pro/markdown>

| Parameter        | Type          | Required | Default | Min | Max | Allowed Values                                                        | Description                                                                                                                                                          |
| ---------------- | ------------- | -------- | ------- | --- | --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string        | No       | -       | -   | -   | -                                                                     | Text prompt for video generation. Either Prompt or Multi Prompt must be provided, but not both.                                                                      |
| `multiPrompt`    | inputs\_array | No       | -       | -   | -   | -                                                                     | Multi-shot prompts with per-shot durations. If provided, overrides the single prompt.                                                                                |
| `startImage`     | file          | Yes      | -       | -   | -   | -                                                                     | Image used as the first frame of the video.                                                                                                                          |
| `endImage`       | file          | No       | -       | -   | -   | -                                                                     | Image used as the last frame of the video.                                                                                                                           |
| `duration`       | string        | No       | `5`     | -   | -   | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | The duration of the generated video in seconds.                                                                                                                      |
| `generateAudio`  | boolean       | No       | `true`  | -   | -   | -                                                                     | Whether to generate native audio for the video. Supports Chinese and English voice output. Other languages are automatically translated to English.                  |
| `elements`       | inputs\_array | No       | -       | -   | -   | -                                                                     | Elements (characters/objects) to include. Provide either images (frontal + reference) or a video for each element. Reference in prompt as @Element1, @Element2, etc. |
| `aspectRatio`    | string        | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9`                                                 | Aspect ratio of the video.                                                                                                                                           |
| `cfgScale`       | number        | No       | `0.5`   | 0   | 1   | -                                                                     | Higher values follow the prompt more closely, lower values are more creative.                                                                                        |
| `negativePrompt` | string        | No       | -       | -   | -   | -                                                                     | Negative prompt used to guide the model away from undesirable features.                                                                                              |

## Kling V3 I2V Standard

Kling 3.0 Standard: Top-tier image-to-video with cinematic visuals, fluid motion, and native audio generation, with custom element support.

**Model ID:** `model_kling-v3-i2v-standard`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-i2v-standard/markdown>

| Parameter        | Type          | Required | Default | Min | Max | Allowed Values                                                        | Description                                                                                                                                                          |
| ---------------- | ------------- | -------- | ------- | --- | --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string        | No       | -       | -   | -   | -                                                                     | Text prompt for video generation. Either Prompt or Multi Prompt must be provided, but not both.                                                                      |
| `multiPrompt`    | inputs\_array | No       | -       | -   | -   | -                                                                     | Multi-shot prompts with per-shot durations. If provided, overrides the single prompt.                                                                                |
| `startImage`     | file          | Yes      | -       | -   | -   | -                                                                     | Image used as the first frame of the video.                                                                                                                          |
| `endImage`       | file          | No       | -       | -   | -   | -                                                                     | Image used as the last frame of the video.                                                                                                                           |
| `duration`       | string        | No       | `5`     | -   | -   | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | The duration of the generated video in seconds.                                                                                                                      |
| `generateAudio`  | boolean       | No       | `true`  | -   | -   | -                                                                     | Whether to generate native audio for the video. Supports Chinese and English voice output. Other languages are automatically translated to English.                  |
| `elements`       | inputs\_array | No       | -       | -   | -   | -                                                                     | Elements (characters/objects) to include. Provide either images (frontal + reference) or a video for each element. Reference in prompt as @Element1, @Element2, etc. |
| `aspectRatio`    | string        | No       | `16:9`  | -   | -   | `9:16`, `1:1`, `16:9`                                                 | Aspect ratio of the video.                                                                                                                                           |
| `cfgScale`       | number        | No       | `0.5`   | 0   | 1   | -                                                                     | Higher values follow the prompt more closely, lower values are more creative.                                                                                        |
| `negativePrompt` | string        | No       | -       | -   | -   | -                                                                     | Negative prompt used to guide the model away from undesirable features.                                                                                              |

## Kling V3 Omni Video

Kling V3 Omni Video: Top-tier video generation with cinematic visuals, fluid motion, and native audio generation, with multi-shot support.

**Model ID:** `model_kling-v3-omni-video`

**Capabilities:** `txt2video`, `img2video`, `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-omni-video/markdown>

| Parameter            | Type        | Required | Default   | Min | Max | Allowed Values          | Description                                                                                                                                                                                                                                           |
| -------------------- | ----------- | -------- | --------- | --- | --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`             | string      | Yes      | -         | -   | -   | -                       | Text prompt for video generation. Supports <<\<image\_1>>>, <<\<video\_1>>> template references. Max 2500 characters.                                                                                                                                 |
| `startImage`         | file        | No       | -         | -   | -   | -                       | First frame image. Max 10MB, min 300px, aspect ratio 1:2.5 to 2.5:1.                                                                                                                                                                                  |
| `endImage`           | file        | No       | -         | -   | -   | -                       | Last frame image. Requires a Start Image. Max 10MB, min 300px.                                                                                                                                                                                        |
| `referenceImages`    | file\_array | No       | -         | -   | -   | -                       | Reference images for elements, scenes, or styles. Max 7 without video, 4 with video.                                                                                                                                                                  |
| `referenceVideo`     | file        | No       | -         | -   | -   | -                       | Reference video. Duration 3-10s, resolution 720-2160px per side, max 200MB. Not supported with 4K.                                                                                                                                                    |
| `videoReferenceType` | string      | No       | `feature` | -   | -   | `feature`, `base`       | How to use reference video: ‘Feature’ for style/camera reference, ‘Base’ for video editing.                                                                                                                                                           |
| `keepOriginalSound`  | boolean     | No       | `true`    | -   | -   | -                       | Keep original sound from reference video.                                                                                                                                                                                                             |
| `generateAudio`      | boolean     | No       | `false`   | -   | -   | -                       | Generate native audio. Mutually exclusive with reference video.                                                                                                                                                                                       |
| `mode`               | string      | No       | `pro`     | -   | -   | `standard`, `pro`, `4k` | ’Standard’ generates 720p, ‘Pro’ generates 1080p, ‘4k’ generates 4K. 4K mode does not support reference video.                                                                                                                                        |
| `aspectRatio`        | string      | No       | `16:9`    | -   | -   | `16:9`, `1:1`, `9:16`   | Aspect ratio. Required when not using start frame or video editing.                                                                                                                                                                                   |
| `duration`           | number      | No       | `5`       | 3   | 15  | -                       | Video duration in seconds (3-15). Ignored for video editing (base).                                                                                                                                                                                   |
| `multiPrompt`        | string      | No       | -         | -   | -   | -                       | JSON array of shot definitions for multi-shot mode. Each shot: {“prompt”: ”…”, “duration”: N}. Max 6 shots, min duration 1s per shot, total must equal duration. Example: \[{“prompt”:“A cat jumps”,“duration”:3},{“prompt”:“It lands”,“duration”:2}] |

## Kling V3 Pro - Motion Control

Transfer movements from a reference video to any character image. Pro mode delivers higher quality output, ideal for complex dance moves and gestures. Cost-effective motion transfer, perfect for portraits and simple animations.

**Model ID:** `model_kling-v3-pro-motion-control`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-pro-motion-control/markdown>

| Parameter              | Type          | Required | Default | Min | Max | Allowed Values   | Description                                                                                                                                     |
| ---------------------- | ------------- | -------- | ------- | --- | --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`               | string        | No       | -       | -   | -   | -                | Text prompt describing the desired motion or action.                                                                                            |
| `image`                | file          | Yes      | -       | -   | -   | -                | Character image. The character in this image will perform the movements from the reference video.                                               |
| `video`                | file          | Yes      | -       | -   | -   | -                | Reference video with the motion to transfer. Only .mp4/.mov/webm/m4v/gif formats supported.                                                     |
| `characterOrientation` | string        | No       | `image` | -   | -   | `image`, `video` | The orientation of the character. ‘Image’ means the character is in the reference image, ‘Video’ means the character is in the reference video. |
| `keepOriginalSound`    | boolean       | No       | `true`  | -   | -   | -                | Whether to keep the original sound from the reference video.                                                                                    |
| `elements`             | inputs\_array | No       | -       | -   | -   | -                | Optional elements with additional reference images. Reference in prompt as @Element1, @Element2, etc.                                           |

## Kling V3 Standard - Motion Control

Transfer movements from a reference video to any character image. Standard mode offers cost-effective motion transfer, perfect for portraits and simple animations.

**Model ID:** `model_kling-v3-standard-motion-control`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-standard-motion-control/markdown>

| Parameter              | Type          | Required | Default | Min | Max | Allowed Values   | Description                                                                                                                                     |
| ---------------------- | ------------- | -------- | ------- | --- | --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`               | string        | No       | -       | -   | -   | -                | Text prompt describing the desired motion or action.                                                                                            |
| `image`                | file          | Yes      | -       | -   | -   | -                | Character image. The character in this image will perform the movements from the reference video.                                               |
| `video`                | file          | Yes      | -       | -   | -   | -                | Reference video with the motion to transfer. Only .mp4/.mov/webm/m4v/gif formats supported.                                                     |
| `characterOrientation` | string        | No       | `video` | -   | -   | `image`, `video` | The orientation of the character. ‘Image’ means the character is in the reference image, ‘Video’ means the character is in the reference video. |
| `keepOriginalSound`    | boolean       | No       | `true`  | -   | -   | -                | Whether to keep the original sound from the reference video.                                                                                    |
| `elements`             | inputs\_array | No       | -       | -   | -   | -                | Optional elements with additional reference images. Reference in prompt as @Element1, @Element2, etc.                                           |

## Kling V3 T2V 4K

Kling 3.0 native 4K text-to-video: cinema-grade 4K in one step, no upscaling, with native audio and multi-shot support.

**Model ID:** `model_kling-v3-t2v-4k`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-t2v-4k/markdown>

| Parameter        | Type          | Required | Default     | Min | Max | Allowed Values                                                        | Description                                                                                                                                                                                                    |
| ---------------- | ------------- | -------- | ----------- | --- | --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string        | No       | -           | -   | -   | -                                                                     | Text prompt for video generation. Either Prompt or Multi Prompt must be provided, but not both.                                                                                                                |
| `multiPrompt`    | inputs\_array | No       | -           | -   | -   | -                                                                     | Multi-shot prompts with per-shot durations. If provided, overrides the single prompt.                                                                                                                          |
| `duration`       | string        | No       | `5`         | -   | -   | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | The duration of the generated video in seconds.                                                                                                                                                                |
| `generateAudio`  | boolean       | No       | `true`      | -   | -   | -                                                                     | Whether to generate native audio for the video. Supports Chinese and English voice output. Other languages are automatically translated to English. Billing is per second of video regardless of this setting. |
| `shotType`       | string        | No       | `customize` | -   | -   | `customize`, `intelligent`                                            | The type of multi-shot video generation.                                                                                                                                                                       |
| `aspectRatio`    | string        | No       | `16:9`      | -   | -   | `9:16`, `1:1`, `16:9`                                                 | Aspect ratio of the video.                                                                                                                                                                                     |
| `cfgScale`       | number        | No       | `0.5`       | 0   | 1   | -                                                                     | Higher values follow the prompt more closely, lower values are more creative.                                                                                                                                  |
| `negativePrompt` | string        | No       | -           | -   | -   | -                                                                     | Negative prompt used to guide the model away from undesirable features.                                                                                                                                        |

## Kling V3 T2V Pro

Kling 3.0 Pro: Top-tier text-to-video with cinematic visuals, fluid motion, and native audio generation, with multi-shot support.

**Model ID:** `model_kling-v3-t2v-pro`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-t2v-pro/markdown>

| Parameter        | Type          | Required | Default     | Min | Max | Allowed Values                                                        | Description                                                                                                                                         |
| ---------------- | ------------- | -------- | ----------- | --- | --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string        | No       | -           | -   | -   | -                                                                     | Text prompt for video generation. Either Prompt or Multi Prompt must be provided, but not both.                                                     |
| `multiPrompt`    | inputs\_array | No       | -           | -   | -   | -                                                                     | Multi-shot prompts with per-shot durations. If provided, overrides the single prompt.                                                               |
| `duration`       | string        | No       | `5`         | -   | -   | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | The duration of the generated video in seconds.                                                                                                     |
| `generateAudio`  | boolean       | No       | `true`      | -   | -   | -                                                                     | Whether to generate native audio for the video. Supports Chinese and English voice output. Other languages are automatically translated to English. |
| `shotType`       | string        | No       | `customize` | -   | -   | `customize`, `intelligent`                                            | The type of multi-shot video generation.                                                                                                            |
| `aspectRatio`    | string        | No       | `16:9`      | -   | -   | `9:16`, `1:1`, `16:9`                                                 | Aspect ratio of the video.                                                                                                                          |
| `cfgScale`       | number        | No       | `0.5`       | 0   | 1   | -                                                                     | Higher values follow the prompt more closely, lower values are more creative.                                                                       |
| `negativePrompt` | string        | No       | -           | -   | -   | -                                                                     | Negative prompt used to guide the model away from undesirable features.                                                                             |

## Kling V3 T2V Standard

Kling 3.0 Standard: Top-tier text-to-video with cinematic visuals, fluid motion, and native audio generation, with multi-shot support.

**Model ID:** `model_kling-v3-t2v-standard`

**Capabilities:** `txt2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-v3-t2v-standard/markdown>

| Parameter        | Type          | Required | Default     | Min | Max | Allowed Values                                                        | Description                                                                                                                                         |
| ---------------- | ------------- | -------- | ----------- | --- | --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`         | string        | No       | -           | -   | -   | -                                                                     | Text prompt for video generation. Either Prompt or Multi Prompt must be provided, but not both.                                                     |
| `multiPrompt`    | inputs\_array | No       | -           | -   | -   | -                                                                     | Multi-shot prompts with per-shot durations. If provided, overrides the single prompt.                                                               |
| `duration`       | string        | No       | `5`         | -   | -   | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | The duration of the generated video in seconds.                                                                                                     |
| `generateAudio`  | boolean       | No       | `true`      | -   | -   | -                                                                     | Whether to generate native audio for the video. Supports Chinese and English voice output. Other languages are automatically translated to English. |
| `shotType`       | string        | No       | `customize` | -   | -   | `customize`, `intelligent`                                            | The type of multi-shot video generation.                                                                                                            |
| `aspectRatio`    | string        | No       | `16:9`      | -   | -   | `9:16`, `1:1`, `16:9`                                                 | Aspect ratio of the video.                                                                                                                          |
| `cfgScale`       | number        | No       | `0.5`       | 0   | 1   | -                                                                     | Higher values follow the prompt more closely, lower values are more creative.                                                                       |
| `negativePrompt` | string        | No       | -           | -   | -   | -                                                                     | Negative prompt used to guide the model away from undesirable features.                                                                             |

## Kling Video to Audio

Generate synchronized sound effects and background music from a short video using Kling, and receive both an MP3 and a dubbed MP4.

**Model ID:** `model_kling-video-to-audio`

**Capabilities:** `video2audio`, `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_kling-video-to-audio/markdown>

| Parameter               | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                                                     |
| ----------------------- | ------- | -------- | ------- | --- | --- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| `video`                 | file    | Yes      | -       | -   | -   | -              | The video you want to add sound to. Must be 3–20 seconds long and under 100MB.                                  |
| `soundEffectPrompt`     | string  | No       | -       | -   | -   | -              | Describe the sound effects you want — for example, “footsteps on gravel, birds chirping.” Up to 200 characters. |
| `backgroundMusicPrompt` | string  | No       | -       | -   | -   | -              | Describe the background music you want — for example, “calm acoustic guitar.” Up to 200 characters.             |
| `asmrMode`              | boolean | No       | `false` | -   | -   | -              | Emphasizes fine, close-up sound details for a more immersive, tactile result.                                   |
