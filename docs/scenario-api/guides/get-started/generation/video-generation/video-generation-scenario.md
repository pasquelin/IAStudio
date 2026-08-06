---
title: Scenario | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Scenario** video generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [3D Color LUT (Video)](#3d-color-lut-video)
- [Auto Subtitles](#auto-subtitles)
- [Blur (Video)](#blur-video)
- [Chromatic Aberration (Video)](#chromatic-aberration-video)
- [Color Correction (Video)](#color-correction-video)
- [Crystallize (Video)](#crystallize-video)
- [Cubism (Video)](#cubism-video)
- [Desaturate (Video)](#desaturate-video)
- [Dissolve (Video)](#dissolve-video)
- [Dodge & Burn (Video)](#dodge-burn-video)
- [Glow & Bloom (Video)](#glow-bloom-video)
- [Grain (Video)](#grain-video)
- [Oilify (Video)](#oilify-video)
- [Parabolize (Video)](#parabolize-video)
- [Posterize (Video)](#posterize-video)
- [Scenario Caption Studio](#scenario-caption-studio)
- [Scenario Compose Video](#scenario-compose-video)
- [Scenario Image Sequence to Video](#scenario-image-sequence-to-video)
- [Scenario Resize Video](#scenario-resize-video)
- [Scenario Video Concat](#scenario-video-concat)
- [Scenario Video Layers Extractor](#scenario-video-layers-extractor)
- [Scenario Video to Image Sequence](#scenario-video-to-image-sequence)
- [Scenario Video to Mask](#scenario-video-to-mask)
- [Sharpen (Video)](#sharpen-video)
- [Solarize (Video)](#solarize-video)
- [Tint (Video)](#tint-video)
- [Video Cut](#video-cut)
- [Video Split](#video-split)
- [Vignette (Video)](#vignette-video)

---

## 3D Color LUT (Video)

Apply cinematic color grading with 3D LUT presets.

**Model ID:** `model_scenario-postprocessing-lut-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-lut-video/markdown>

| Parameter      | Type   | Required | Default       | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Description                |
| -------------- | ------ | -------- | ------------- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `video`        | file   | Yes      | -             | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Input video                |
| `lutStyle`     | string | No       | `teal_orange` | -   | -   | `teal_orange`, `kodak_portra`, `fuji_velvia`, `bleach_bypass`, `matrix_green`, `cgc_film_emulation_agfa_portrait_xps_160`, `cgc_film_emulation_fuji_astia_100f`, `cgc_film_emulation_fuji_eterna_3513`, `cgc_film_emulation_fuji_eterna_8563`, `cgc_film_emulation_fuji_provia_100f`, `cgc_film_emulation_fuji_sensia_100`, `cgc_film_emulation_fuji_superia_xtra_400`, `cgc_film_emulation_fuji_vivid_8543`, `cgc_film_emulation_kodak_ektachrome_64`, `cgc_film_emulation_kodak_professional_portra_400`, `cgc_film_emulation_kodak_vision_2383`, `cgc_film_emulation_lpp_tetrachrome_400`, `cgc_film_emulation_polaroid_600`, `cgc_log_to_rec709_alexa_logc`, `cgc_log_to_rec709_blackmagic_4.6k_film`, `cgc_log_to_rec709_blackmagic_4k_film`, `cgc_log_to_rec709_blackmagic_cinema_camera_film`, `cgc_log_to_rec709_canon_log`, `cgc_log_to_rec709_canon_log2`, `cgc_log_to_rec709_canon_log3`, `cgc_log_to_rec709_cinelike_d`, `cgc_log_to_rec709_cinestyle_s_curve`, `cgc_log_to_rec709_dji_inspire`, `cgc_log_to_rec709_gopro_protune`, `cgc_log_to_rec709_panasonic_v`, `cgc_log_to_rec709_redlogfilm`, `cgc_log_to_rec709_redwidegamut_log3g10`, `cgc_log_to_rec709_sony_slog2`, `cgc_log_to_rec709_sony_slog3_cine`, `cgc_log_to_rec709_sony_slog3`, `cgc_look_3strip`, `cgc_look_70s`, `cgc_look_amelie`, `cgc_look_aviator`, `cgc_look_blade_runner`, `cgc_look_bleach`, `cgc_look_brooklyn`, `cgc_look_celadon`, `cgc_look_chamoisee`, `cgc_look_cubanismo`, `cgc_look_drive`, `cgc_look_duotone`, `cgc_look_emulsion`, `cgc_look_enemy`, `cgc_look_enhance`, `cgc_look_fashion`, `cgc_look_glacier`, `cgc_look_godfather`, `cgc_look_grand_budapest`, `cgc_look_grime`, `cgc_look_grit`, `cgc_look_hannibal`, `cgc_look_her`, `cgc_look_mad_max`, `cgc_look_matrix_v1`, `cgc_look_matrix_v2`, `cgc_look_mint`, `cgc_look_moonrise_kingdom`, `cgc_look_ochre`, `cgc_look_punch`, `cgc_look_revenant`, `cgc_look_rhythm`, `cgc_look_seven`, `cgc_look_spy`, `cgc_look_stranger_things`, `cgc_look_summer`, `cgc_look_teal and orange`, `cgc_look_thriller`, `cgc_look_vinteo`, `cgc_look_wonder_woman`, `distant_land_basin`, `distant_land_boulder`, `distant_land_butte`, `distant_land_everest`, `distant_land_hopkins`, `distant_land_lochness`, `distant_land_oaxaca`, `distant_land_oslo`, `distant_land_phoenix`, `distant_land_pocatello`, `distant_land_prague`, `distant_land_reykjavik`, `distant_land_santafe`, `distant_land_seattle`, `distant_land_stillwater`, `distant_land_tahoe`, `distant_land_thames`, `pond5_arabica_12`, `pond5_ava_614`, `pond5_azrael_93`, `pond5_bourbon_64`, `pond5_byers_11`, `pond5_celluloid_01_fu_low`, `pond5_chemical_168`, `pond5_clayton_33`, `pond5_clouseau_54`, `pond5_cobi_3`, `pond5_contrail_35`, `pond5_cubicle_99`, `pond5_django_25`, `pond5_domingo_145`, `pond5_faded_47`, `pond5_folger_50`, `pond5_fusion_88`, `pond5_hyla_68`, `pond5_korben_214`, `pond5_lenox_340`, `pond5_lucky_64`, `pond5_mckinnon_75`, `pond5_milo_5`, `pond5_neon_770`, `pond5_paladin_1875`, `pond5_pasadena_21`, `pond5_pitaya_15`, `pond5_reeve_38`, `pond5_remy_24`, `pond5_sprocket_231`, `pond5_teigen_28`, `pond5_trent_18`, `pond5_tweed_71`, `pond5_vireo_37`, `pond5_zed_32`, `pond5_zeke_39`, `rec709_fujifilm_3510_d65`, `rec709_kodak_2383_d65`, `rec709_kodak_2393_d65`, `shutterstock_blue_architecture`, `shutterstock_blue_hour`, `shutterstock_cold_chrome`, `shutterstock_crisp_autumn`, `shutterstock_dark_and_somber`, `shutterstock_hard_boost`, `shutterstock_long_beach_morning`, `shutterstock_lush_green`, `shutterstock_magic_hour`, `shutterstock_natural_boost`, `shutterstock_orange_and_blue`, `shutterstock_soft_black_and_white`, `shutterstock_waves` | Style of grading to apply. |
| `lutIntensity` | number | No       | `1`           | 0   | 1   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Opacity of the LUT effect. |

## Auto Subtitles

Burn subtitles into a video. Auto-transcribes the audio with Whisper.

**Model ID:** `model_scenario-video-subtitles`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-video-subtitles/markdown>

| Parameter                  | Type   | Required | Default      | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ------ | -------- | ------------ | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `video`                    | file   | Yes      | -            | -   | -   | -                                                                                                                                                                                                                                                                                                                 | Input video to add subtitles to.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `initialPrompt`            | string | No       | -            | -   | -   | -                                                                                                                                                                                                                                                                                                                 | \[auto mode] Optional text prompt to bias the model’s style/vocabulary.                                                                                                                                                                                                                                                                                                                                                                                      |
| `fontColor`                | string | No       | `#FFFFFF`    | -   | -   | -                                                                                                                                                                                                                                                                                                                 | Primary font color in #RRGGBB hex (e.g. ‘#FFFFFF’ for white).                                                                                                                                                                                                                                                                                                                                                                                                |
| `outlineColor`             | string | No       | `#000000`    | -   | -   | -                                                                                                                                                                                                                                                                                                                 | Outline color in #RRGGBB hex. Default is black.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `borderStyle`              | string | No       | `opaque-box` | -   | -   | `outline+shadow`, `opaque-box`                                                                                                                                                                                                                                                                                    | How the border color is rendered around the text. ‘Outline + Shadow’: each glyph is stroked with border color and an optional drop shadow; the video behind the letters stays visible. ‘Opaque Box’: a filled rectangle (using border color, tinted by border color transparency) is drawn behind the text, covering the video. Border color transparency mostly matters with ‘Opaque Box’ — with ‘Outline + Shadow’ you usually want a fully opaque stroke. |
| `outlineColorTransparency` | number | No       | `0.2`        | 0   | 1   | -                                                                                                                                                                                                                                                                                                                 | Outline / box transparency: 0.0 = fully opaque, 1.0 = fully transparent.                                                                                                                                                                                                                                                                                                                                                                                     |
| `modelSize`                | string | No       | `small`      | -   | -   | `tiny`, `tiny.en`, `base`, `base.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3`                                                                                                                                                                                                          | \[auto mode] Whisper model size used for transcription.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `language`                 | string | No       | -            | -   | -   | -                                                                                                                                                                                                                                                                                                                 | ISO 639-1 language code (e.g. ‘en’, ‘fr’). Leave empty for auto-detection.                                                                                                                                                                                                                                                                                                                                                                                   |
| `task`                     | string | No       | `transcribe` | -   | -   | `transcribe`, `translate`                                                                                                                                                                                                                                                                                         | \[auto mode] ‘transcribe’ keeps the original language, ‘translate’ targets English.                                                                                                                                                                                                                                                                                                                                                                          |
| `maxSegmentDuration`       | number | No       | -            | 1   | 600 | -                                                                                                                                                                                                                                                                                                                 | Limits the maximum time (in seconds) a single subtitle appears. When splitting long segments, the system uses proportional timing and prioritizes punctuation boundaries (.,!?). Typical: 5–7s. Automatically defined if omitted.                                                                                                                                                                                                                            |
| `maxSegmentChars`          | number | No       | `42`         | 1   | 50  | -                                                                                                                                                                                                                                                                                                                 | Limits the number of characters per subtitle cue. Applied alongside duration limits; the segment will split whenever either threshold is reached. Automatically defined if omitted.                                                                                                                                                                                                                                                                          |
| `fontName`                 | string | No       | `Arial`      | -   | -   | `Andale Mono`, `Arial`, `Arial Black`, `Comic Sans MS`, `Courier New`, `Georgia`, `Impact`, `Times New Roman`, `Trebuchet MS`, `Verdana`, `Avant Garde`, `Bookman`, `Century Schoolbook`, `Helvetica`, `Palatino`, `Noto Sans`, `Noto Serif`, `Noto Sans Mono`, `DejaVu Sans`, `DejaVu Serif`, `DejaVu Sans Mono` | Subtitle font family.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `fontSize`                 | number | No       | `14`         | 8   | 96  | -                                                                                                                                                                                                                                                                                                                 | Subtitle font size in points.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `compressionLevel`         | number | No       | `23`         | 15  | 51  | -                                                                                                                                                                                                                                                                                                                 | Video compression quality (CRF, lower = higher quality).                                                                                                                                                                                                                                                                                                                                                                                                     |

## Blur (Video)

Apply blur effects to video.

**Model ID:** `model_scenario-postprocessing-blur-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-blur-video/markdown>

| Parameter    | Type   | Required | Default    | Min | Max | Allowed Values         | Description              |
| ------------ | ------ | -------- | ---------- | --- | --- | ---------------------- | ------------------------ |
| `video`      | file   | Yes      | -          | -   | -   | -                      | Input video              |
| `blurType`   | string | No       | `gaussian` | -   | -   | `gaussian`, `kuwahara` | Type of blur to apply.   |
| `blurRadius` | number | No       | `3`        | 0   | 31  | -                      | Blur radius.             |
| `blurSigma`  | number | No       | `1`        | 0.1 | 10  | -                      | Sigma for Gaussian blur. |

## Chromatic Aberration (Video)

Create chromatic aberration by shifting color channels.

**Model ID:** `model_scenario-postprocessing-chromatic-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-chromatic-video/markdown>

| Parameter        | Type   | Required | Default      | Min | Max | Allowed Values           | Description                    |
| ---------------- | ------ | -------- | ------------ | --- | --- | ------------------------ | ------------------------------ |
| `video`          | file   | Yes      | -            | -   | -   | -                        | Input video                    |
| `redShift`       | number | No       | `0`          | -20 | 20  | -                        | Red channel shift amount.      |
| `greenShift`     | number | No       | `0`          | -20 | 20  | -                        | Green channel shift amount.    |
| `blueShift`      | number | No       | `0`          | -20 | 20  | -                        | Blue channel shift amount.     |
| `redDirection`   | string | No       | `horizontal` | -   | -   | `horizontal`, `vertical` | Red channel shift direction.   |
| `greenDirection` | string | No       | `horizontal` | -   | -   | `horizontal`, `vertical` | Green channel shift direction. |
| `blueDirection`  | string | No       | `horizontal` | -   | -   | `horizontal`, `vertical` | Blue channel shift direction.  |

## Color Correction (Video)

Adjust color, brightness, contrast, and exposure.

**Model ID:** `model_scenario-postprocessing-color-correction-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-color-correction-video/markdown>

| Parameter                 | Type   | Required | Default | Min  | Max | Allowed Values | Description                                 |
| ------------------------- | ------ | -------- | ------- | ---- | --- | -------------- | ------------------------------------------- |
| `video`                   | file   | Yes      | -       | -    | -   | -              | Input video                                 |
| `temperature`             | number | No       | `0`     | -100 | 100 | -              | Color temperature adjustment (-100 to 100). |
| `brightness`              | number | No       | `0`     | -100 | 100 | -              | Brightness adjustment (-100 to 100).        |
| `contrast`                | number | No       | `0`     | -100 | 100 | -              | Contrast adjustment (-100 to 100).          |
| `saturation`              | number | No       | `0`     | -100 | 100 | -              | Saturation adjustment (-100 to 100).        |
| `gamma`                   | number | No       | `1`     | 0.2  | 2.2 | -              | Gamma adjustment (0.2-2.2).                 |
| `exposure`                | number | No       | `0`     | -5   | 5   | -              | Exposure adjustment (-5.0 to 5.0).          |
| `shadows`                 | number | No       | `0`     | -100 | 100 | -              | Shadows adjustment (-100 to 100).           |
| `highlights`              | number | No       | `0`     | -100 | 100 | -              | Highlights adjustment (-100 to 100).        |
| `shadowsHighlightsRadius` | number | No       | `50`    | 0    | 100 | -              | Shadows/Highlights radius (0 to 100).       |

## Crystallize (Video)

Create crystallized superpixel mosaic effect.

**Model ID:** `model_scenario-postprocessing-crystallize-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-crystallize-video/markdown>

| Parameter           | Type   | Required | Default | Min | Max | Allowed Values | Description                                        |
| ------------------- | ------ | -------- | ------- | --- | --- | -------------- | -------------------------------------------------- |
| `video`             | file   | Yes      | -       | -   | -   | -              | Input video                                        |
| `crystallizeRadius` | number | No       | `10`    | 1   | 100 | -              | Approximate size/number of the superpixel regions. |

## Cubism (Video)

Transform video with abstract cubist art style.

**Model ID:** `model_scenario-postprocessing-cubism-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-cubism-video/markdown>

| Parameter              | Type   | Required | Default | Min | Max | Allowed Values | Description                         |
| ---------------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------- |
| `video`                | file   | Yes      | -       | -   | -   | -              | Input video                         |
| `cubismTileSize`       | number | No       | `10`    | 1   | 100 | -              | Average tile size.                  |
| `cubismTileSaturation` | number | No       | `1`     | 0   | 10  | -              | Tile saturation (expansion factor). |

## Desaturate (Video)

Remove or reduce color saturation in video.

**Model ID:** `model_scenario-postprocessing-desaturate-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-desaturate-video/markdown>

| Parameter          | Type   | Required | Default               | Min | Max | Allowed Values                                                       | Description          |
| ------------------ | ------ | -------- | --------------------- | --- | --- | -------------------------------------------------------------------- | -------------------- |
| `video`            | file   | Yes      | -                     | -   | -   | -                                                                    | Input video          |
| `desaturateMethod` | string | No       | `luminance (Rec.709)` | -   | -   | `average`, `luminance (Rec.709)`, `luminance (Rec.601)`, `lightness` | Desaturation method. |
| `desaturateFactor` | number | No       | `1`                   | 0   | 1   | -                                                                    | Desaturation factor. |

## Dissolve (Video)

Blend video with an image using dissolve transition.

**Model ID:** `model_scenario-postprocessing-dissolve-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-dissolve-video/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description             |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------- |
| `video`          | file   | Yes      | -       | -   | -   | -              | Input video             |
| `dissolveImage`  | file   | No       | -       | -   | -   | -              | Image to dissolve with. |
| `dissolveFactor` | number | No       | `0.5`   | 0   | 1   | -              | Dissolve blend factor.  |

## Dodge & Burn (Video)

Apply dodge and burn photographic techniques.

**Model ID:** `model_scenario-postprocessing-dodge-burn-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-dodge-burn-video/markdown>

| Parameter            | Type   | Required | Default | Min | Max | Allowed Values                                                                                                  | Description           |
| -------------------- | ------ | -------- | ------- | --- | --- | --------------------------------------------------------------------------------------------------------------- | --------------------- |
| `video`              | file   | Yes      | -       | -   | -   | -                                                                                                               | Input video           |
| `dodgeBurnMode`      | string | No       | `dodge` | -   | -   | `dodge`, `burn`, `dodge_and_burn`, `burn_and_dodge`, `color_dodge`, `color_burn`, `linear_dodge`, `linear_burn` | Dodge/Burn mode.      |
| `dodgeBurnIntensity` | number | No       | `0.5`   | 0   | 1   | -                                                                                                               | Dodge/Burn intensity. |

## Glow & Bloom (Video)

Add glow and bloom lighting effects to video.

**Model ID:** `model_scenario-postprocessing-glow-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-glow-video/markdown>

| Parameter       | Type   | Required | Default | Min | Max | Allowed Values | Description       |
| --------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------- |
| `video`         | file   | Yes      | -       | -   | -   | -              | Input video       |
| `glowRadius`    | number | No       | `5`     | 1   | 50  | -              | Glow blur radius. |
| `glowIntensity` | number | No       | `1`     | 0   | 5   | -              | Glow intensity.   |

## Grain (Video)

Add film grain texture with various film stock profiles.

**Model ID:** `model_scenario-postprocessing-grain-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-grain-video/markdown>

| Parameter        | Type    | Required | Default            | Min  | Max   | Allowed Values                                                                                                                                                                                                                                                                                                                                                                         | Description                                                           |
| ---------------- | ------- | -------- | ------------------ | ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `video`          | file    | Yes      | -                  | -    | -     | -                                                                                                                                                                                                                                                                                                                                                                                      | Input video                                                           |
| `grainProfile`   | string  | No       | `kodak_portra_400` | -    | -     | `cine_still_800t`, `fuji_pro_400h`, `fuji_provia_100f`, `fuji_superia_400`, `fuji_velvia_50`, `ilford_hp5_plus`, `kodak_ektachrome_e100`, `kodak_ektar_100`, `kodak_gold_200`, `kodak_portra_400`, `kodak_tri_x_400`, `lomography_color_negative_400`, `modern`, `analog`, `cinematic`, `newspaper`, `vintage`, `bleach_bypass`, `infrared_bw`, `night_vision`, `sepia`, `old_fashion` | Film grain profile to use. Determines grain, color distribution, etc. |
| `grainColorTemp` | number  | No       | `6500`             | 2000 | 10000 | -                                                                                                                                                                                                                                                                                                                                                                                      | Color temperature adjustment for grain.                               |
| `crossProcess`   | boolean | No       | `false`            | -    | -     | -                                                                                                                                                                                                                                                                                                                                                                                      | Enable cross-processing effect.                                       |

## Oilify (Video)

Transform video with oil painting artistic effect.

**Model ID:** `model_scenario-postprocessing-oilify-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-oilify-video/markdown>

| Parameter         | Type   | Required | Default | Min | Max | Allowed Values | Description                                                       |
| ----------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------- |
| `video`           | file   | Yes      | -       | -   | -   | -              | Input video                                                       |
| `oilifyRadius`    | number | No       | `4`     | 1   | 50  | -              | Radius of the oil painting effect (neighborhood size).            |
| `oilifyIntensity` | number | No       | `1`     | 1   | 20  | -              | Dynamic ratio of the oil painting effect (degree of abstraction). |

## Parabolize (Video)

Apply parabolic distortion effect to video.

**Model ID:** `model_scenario-postprocessing-parabolize-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-parabolize-video/markdown>

| Parameter         | Type   | Required | Default | Min | Max | Allowed Values | Description             |
| ----------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------- |
| `video`           | file   | Yes      | -       | -   | -   | -              | Input video             |
| `parabolizeCoeff` | number | No       | `1`     | -10 | 10  | -              | Parabolize coefficient. |
| `vertexX`         | number | No       | `0.5`   | 0   | 1   | -              | Vertex X position.      |
| `vertexY`         | number | No       | `0.5`   | 0   | 1   | -              | Vertex Y position.      |

## Posterize (Video)

Reduce color depth for a poster art effect.

**Model ID:** `model_scenario-postprocessing-posterize-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-posterize-video/markdown>

| Parameter            | Type   | Required | Default | Min | Max | Allowed Values | Description          |
| -------------------- | ------ | -------- | ------- | --- | --- | -------------- | -------------------- |
| `video`              | file   | Yes      | -       | -   | -   | -              | Input video          |
| `posterizeThreshold` | number | No       | `0.5`   | 0   | 1   | -              | Posterize threshold. |

## Scenario Caption Studio

Transcribe, style, and burn captions into any video. Auto-generate subtitles or upload your own SRT, translate into 18 languages, then customize every detail of the finished cut.

**Model ID:** `model_scenario-caption-studio`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-caption-studio/markdown>

| Parameter             | Type    | Required | Default       | Min | Max | Allowed Values                                                                                                            | Description                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ------- | -------- | ------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `video`               | file    | Yes      | -             | -   | -   | -                                                                                                                         | The video you want to caption.                                                                                                                                                                                                                                                                                                                                           |
| `subtitles`           | file    | No       | -             | -   | -   | -                                                                                                                         | Optional. Upload an existing subtitle file (.srt) to use. Leave it empty and the audio will be transcribed automatically.                                                                                                                                                                                                                                                |
| `targetLanguage`      | string  | No       | `auto`        | -   | -   | `auto`, `en`, `zh`, `hi`, `es`, `ar`, `fr`, `de`, `pt`, `ru`, `id`, `bn`, `ja`, `pl`, `nl`, `tr`, `vi`, `ko`, `it`        | Translate captions into this language. Leave on Auto to keep the original spoken language.                                                                                                                                                                                                                                                                               |
| `stylePreset`         | string  | No       | -             | -   | -   | “, `modern-chip`, `tiktok-bouncy`, `minimal-underline`, `karaoke-fill`, `karaoke-underline`, `cinematic-fade`, `word-pop` | Pick a ready-made caption style (TikTok Bouncy, Karaoke Fill, Cinematic Fade, and more). Leave empty for the default look.                                                                                                                                                                                                                                               |
| `themeTsx`            | string  | No       | -             | -   | -   | -                                                                                                                         | Advanced: supply your own custom caption theme to fully replace the preset. If you also add a Style Prompt, it refines this theme.                                                                                                                                                                                                                                       |
| `stylePrompt`         | string  | No       | -             | -   | -   | -                                                                                                                         | Describe the caption look you want in plain words and the model will build a matching style.                                                                                                                                                                                                                                                                             |
| `maxSegmentDuration`  | number  | No       | -             | 0.1 | 600 | -                                                                                                                         | The longest a single caption can stay on screen, in seconds.                                                                                                                                                                                                                                                                                                             |
| `maxSegmentChars`     | number  | No       | -             | 1   | 500 | -                                                                                                                         | The most characters a caption can hold before it splits into the next one.                                                                                                                                                                                                                                                                                               |
| `maxSegmentWords`     | number  | No       | -             | 1   | 100 | -                                                                                                                         | The most words per caption. Set to 1 to show one word at a time, great for karaoke-style captions.                                                                                                                                                                                                                                                                       |
| `fontColor`           | string  | No       | `#FFFFFF`     | -   | -   | -                                                                                                                         | Main text colour, as a hex code (e.g. #FFFFFF for white).                                                                                                                                                                                                                                                                                                                |
| `accentColorStart`    | string  | No       | `#FF8A3D`     | -   | -   | -                                                                                                                         | Colour used to highlight or animate words (e.g. karaoke and pop styles). This is where the gradient begins. Hex code, e.g. #FF8A3D.                                                                                                                                                                                                                                      |
| `accentColorEnd`      | string  | No       | `#FF3D8A`     | -   | -   | -                                                                                                                         | The colour the accent gradient ends on. Set it to a different colour from the start to create a gradient. Hex code, e.g. #FF3D8A.                                                                                                                                                                                                                                        |
| `textPosition`        | string  | No       | `bottom`      | -   | -   | `top`, `middle`, `bottom`                                                                                                 | Where captions sit on screen — top, middle, or bottom.                                                                                                                                                                                                                                                                                                                   |
| `fontSizePx`          | number  | No       | -             | 12  | 200 | -                                                                                                                         | Caption font size in pixels. Leave empty to size automatically.                                                                                                                                                                                                                                                                                                          |
| `maxLines`            | number  | No       | `2`           | 1   | 6   | -                                                                                                                         | The most lines a caption can wrap onto.                                                                                                                                                                                                                                                                                                                                  |
| `textWidthPct`        | number  | No       | -             | 10  | 100 | -                                                                                                                         | How much of the screen width captions can fill, as a percentage.                                                                                                                                                                                                                                                                                                         |
| `transcriptionPrompt` | string  | No       | -             | -   | -   | -                                                                                                                         | Optional hint to improve transcription — list names, brands, or technical terms used in the video so they’re spelled correctly.                                                                                                                                                                                                                                          |
| `modelSize`           | string  | No       | `medium`      | -   | -   | `tiny`, `tiny.en`, `base`, `base.en`, `small`, `small.en`, `medium`, `medium.en`, `large-v2`, `large-v3`                  | Transcription quality. Larger sizes are more accurate but slower and cost more.                                                                                                                                                                                                                                                                                          |
| `compressionLevel`    | number  | No       | `23`          | 15  | 51  | -                                                                                                                         | Output quality. Lower numbers mean higher quality and larger files.                                                                                                                                                                                                                                                                                                      |
| `outputVideo`         | boolean | No       | `true`        | -   | -   | -                                                                                                                         | Return the finished video with captions burned in.                                                                                                                                                                                                                                                                                                                       |
| `outputSrt`           | boolean | No       | `false`       | -   | -   | -                                                                                                                         | Also return the captions as a separate .srt file you can reuse or edit.                                                                                                                                                                                                                                                                                                  |
| `outputTsx`           | boolean | No       | `false`       | -   | -   | -                                                                                                                         | Advanced: also return the caption theme used to render the video.                                                                                                                                                                                                                                                                                                        |
| `outputSubtitles`     | string  | No       | `video_image` | -   | -   | `video_image`, `video_data`                                                                                               | How captions appear in the video. Burn Into Video bakes the styled captions permanently into the picture, so they always show and keep their style — but can’t be turned off. Soft Subtitle Track adds captions as a separate track the viewer can switch on or off; it’s faster, but shows plain text without the preset styling. Only applies when Output Video is on. |

## Scenario Compose Video

Compose multiple images, videos, and audio into a single video with layers, transforms, effects, transitions, and blending modes.

**Model ID:** `model_scenario-compose-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-compose-video/markdown>

| Parameter           | Type          | Required | Default   | Min | Max  | Allowed Values              | Description                                                                               |
| ------------------- | ------------- | -------- | --------- | --- | ---- | --------------------------- | ----------------------------------------------------------------------------------------- |
| `layers`            | inputs\_array | Yes      | -         | -   | -    | -                           | Array of layers to compose (images, videos, audio). At least one video layer is required. |
| `canvasMode`        | string        | No       | `auto`    | -   | -    | `auto`, `custom`            | Canvas size mode. ‘auto’ computes from layers, ‘custom’ uses specified dimensions.        |
| `canvasWidth`       | number        | No       | -         | 1   | 7680 | -                           | Output canvas width in pixels (required when canvas\_mode=‘custom’)                       |
| `canvasHeight`      | number        | No       | -         | 1   | 4320 | -                           | Output canvas height in pixels (required when canvas\_mode=‘custom’)                      |
| `backgroundColor`   | string        | No       | `#000000` | -   | -    | -                           | Canvas background color (hex format #RRGGBB) or ‘transparent’                             |
| `durationMode`      | string        | No       | `auto`    | -   | -    | `auto`, `custom`            | Duration mode. ‘auto’ calculates from layers, ‘custom’ uses specified duration.           |
| `duration`          | number        | No       | -         | 0.1 | -    | -                           | Total duration in seconds (required when duration\_mode=‘custom’)                         |
| `fps`               | number        | No       | `30`      | 1   | 120  | -                           | Output frame rate (fps)                                                                   |
| `videoOutputFormat` | string        | No       | `mp4`     | -   | -    | `mp4`, `mov`, `webm`, `gif` | Output video format                                                                       |
| `compressionLevel`  | number        | No       | `23`      | 15  | 51   | -                           | Compression quality (CRF value, lower = higher quality, 15-51)                            |

## Scenario Image Sequence to Video

**Model ID:** `model_scenario-image-seq-to-video`

**Capabilities:** `img2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-image-seq-to-video/markdown>

| Parameter          | Type        | Required | Default | Min | Max | Allowed Values | Description                                                       |
| ------------------ | ----------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------- |
| `images`           | file\_array | Yes      | -       | -   | -   | -              | List of images to convert to video sequence                       |
| `audio`            | file        | No       | -       | -   | -   | -              | Optional audio file to add to video                               |
| `outputFormat`     | string      | No       | `mp4`   | -   | -   | `mp4`, `gif`   | Output video format                                               |
| `fps`              | number      | No       | `24`    | 1   | 120 | -              | Frames per second for the output video                            |
| `compressionLevel` | number      | No       | `20`    | 15  | 30  | -              | Compression quality (CRF value, lower = higher quality)           |
| `loopCount`        | number      | No       | `0`     | 0   | 100 | -              | Number of loops (0 = no loop for video formats, infinite for gif) |
| `pingpong`         | boolean     | No       | `false` | -   | -   | -              | Play sequence forward then backward                               |

## Scenario Resize Video

Resize a video to a specified width and height or a maximum size while preserving aspect ratio.

**Model ID:** `model_scenario-resize-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-resize-video/markdown>

| Parameter             | Type        | Required | Default | Min | Max | Allowed Values              | Description                                                                                                                                                                                         |
| --------------------- | ----------- | -------- | ------- | --- | --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`               | file\_array | Yes      | -       | -   | -   | -                           | Video to resize                                                                                                                                                                                     |
| `width`               | number      | No       | -       | 1   | -   | -                           | Target width in pixels. If only width is specified, height is calculated to preserve aspect ratio.                                                                                                  |
| `height`              | number      | No       | -       | 1   | -   | -                           | Target height in pixels. If only height is specified, width is calculated to preserve aspect ratio.                                                                                                 |
| `maxSizeMb`           | number      | No       | -       | 0.1 | -   | -                           | Maximum output file size in megabytes. The file will be resized iteratively to meet this constraint while preserving aspect ratio.                                                                  |
| `preserveAspectRatio` | boolean     | No       | `true`  | -   | -   | -                           | Whether to preserve the original aspect ratio. When True (default), the output fits within the specified dimensions. When False, the output is stretched to exactly match the specified dimensions. |
| `videoOutputFormat`   | string      | No       | `mp4`   | -   | -   | `mp4`, `mov`, `webm`, `gif` | Output format for videos (mp4, mov, webm, gif). If not specified, the original format is preserved.                                                                                                 |
| `frameRate`           | number      | No       | -       | 1   | 120 | -                           | Target frame rate for video output. If not specified, the original frame rate is preserved.                                                                                                         |
| `preserveAudio`       | boolean     | No       | `true`  | -   | -   | -                           | Whether to preserve audio from the input video. Default is True.                                                                                                                                    |

## Scenario Video Concat

Concatenates multiple videos into a single video with optional transitions between clips.

**Model ID:** `model_scenario-video-concat`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-video-concat/markdown>

| Parameter          | Type          | Required | Default | Min | Max | Allowed Values              | Description                                                                                                                       |
| ------------------ | ------------- | -------- | ------- | --- | --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `videos`           | file\_array   | Yes      | -       | -   | -   | -                           | List of videos to concatenate (minimum 2)                                                                                         |
| `preserveAudio`    | boolean       | No       | `true`  | -   | -   | -                           | Whether to preserve audio from the input videos                                                                                   |
| `transitions`      | inputs\_array | No       | -       | -   | -   | -                           | List of transitions between videos. Length must be number of videos - 1. If not provided, videos are concatenated with hard cuts. |
| `outputFormat`     | string        | No       | `mp4`   | -   | -   | `mp4`, `mov`, `webm`, `gif` | Output video format                                                                                                               |
| `compressionLevel` | number        | No       | `23`    | 15  | 51  | -                           | Compression quality (CRF value, lower = higher quality, 15-51)                                                                    |

## Scenario Video Layers Extractor

Automatically splits a video into separate, editable layers — the moving foreground objects plus the background — each saved with transparency so you can reposition or edit them on their own.

**Model ID:** `model_scenario-video-layers-extractor`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-video-layers-extractor/markdown>

| Parameter               | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                                                              |
| ----------------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `video`                 | file   | Yes      | -       | -   | -   | -              | The video you want to separate into layers.                                                                                                                                                                              |
| `separationInstruction` | string | Yes      | -       | -   | -   | -              | Tell the tool how to divide the video — describe the objects or the rule for splitting them, not the scene itself. For example: ‘split the foreground people from the background scenery’ or ‘isolate the main subject’. |
| `maxLayers`             | number | No       | `6`     | 1   | 10  | -              | The most layers the tool will produce. It may stop sooner if it decides nothing else is worth separating, or if it can’t find the objects you described. More layers means a higher cost.                                |

## Scenario Video to Image Sequence

**Model ID:** `model_scenario-video-to-image-seq`

**Capabilities:** `video2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-video-to-image-seq/markdown>

| Parameter          | Type    | Required | Default | Min | Max | Allowed Values | Description                                                 |
| ------------------ | ------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------- |
| `video`            | file    | Yes      | -       | -   | -   | -              | Input video to extract frames from                          |
| `extractAllFrames` | boolean | No       | `false` | -   | -   | -              | If true, extract all frames; if false, use frame interval   |
| `frameInterval`    | number  | No       | `24`    | 1   | -   | -              | Extract every Nth frame when extract all frames is disabled |

## Scenario Video to Mask

Convert a video to a single-channel grayscale mask video (white = visible, black = transparent).

**Model ID:** `model_scenario-convert-to-mask-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-convert-to-mask-video/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values               | Description                                                                                                                                                                                                                           |
| --------------- | ------- | -------- | ------- | --- | --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`          | file    | Yes      | -       | -   | -   | -                            | Video to convert into a mask                                                                                                                                                                                                          |
| `sourceChannel` | string  | No       | `auto`  | -   | -   | `auto`, `alpha`, `luminance` | Which source channel to use as the mask. ‘auto’ picks alpha when the input has a non-trivial alpha channel, otherwise falls back to luminance. ‘alpha’ requires a video with an alpha channel. ‘luminance’ converts RGB to grayscale. |
| `threshold`     | number  | No       | -       | 0   | 255 | -                            | Optional binarization threshold (0-255). When set, pixels >= threshold become 255 and pixels < threshold become 0. Leave empty to keep the continuous mask.                                                                           |
| `invert`        | boolean | No       | `false` | -   | -   | -                            | Invert the mask (255 - value). Useful when the source is darker for ‘keep’.                                                                                                                                                           |

## Sharpen (Video)

Enhance video sharpness and detail.

**Model ID:** `model_scenario-postprocessing-sharpen-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-sharpen-video/markdown>

| Parameter              | Type   | Required | Default | Min | Max | Allowed Values          | Description                        |
| ---------------------- | ------ | -------- | ------- | --- | --- | ----------------------- | ---------------------------------- |
| `video`                | file   | Yes      | -       | -   | -   | -                       | Input video                        |
| `sharpenMode`          | string | No       | `basic` | -   | -   | `basic`, `smart`, `cas` | Type of sharpening to apply.       |
| `preserveEdges`        | number | No       | `0.75`  | 0   | 1   | -                       | Edge preservation factor.          |
| `sharpenRadius`        | number | No       | `1`     | 1   | 15  | -                       | Sharpen radius (for basic mode).   |
| `sharpenAlpha`         | number | No       | `1`     | 0.1 | 5   | -                       | Sharpen strength (for basic mode). |
| `smartSharpenStrength` | number | No       | `5`     | 0   | 25  | -                       | Smart sharpen strength.            |
| `smartSharpenRatio`    | number | No       | `0.5`   | 0   | 1   | -                       | Smart sharpen blend ratio.         |
| `noiseRadius`          | number | No       | `7`     | 1   | 25  | -                       | Noise radius for smart sharpen.    |
| `casAmount`            | number | No       | `0.8`   | 0   | 1   | -                       | CAS sharpening amount.             |

## Solarize (Video)

Create solarization effect by inverting colors above threshold.

**Model ID:** `model_scenario-postprocessing-solarize-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-solarize-video/markdown>

| Parameter           | Type   | Required | Default | Min | Max | Allowed Values | Description         |
| ------------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------- |
| `video`             | file   | Yes      | -       | -   | -   | -              | Input video         |
| `solarizeThreshold` | number | No       | `0.5`   | 0   | 1   | -              | Solarize threshold. |

## Tint (Video)

Apply color tint overlays to video.

**Model ID:** `model_scenario-postprocessing-tint-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-tint-video/markdown>

| Parameter      | Type   | Required | Default | Min | Max | Allowed Values                                                                                                                                                                      | Description      |
| -------------- | ------ | -------- | ------- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `video`        | file   | Yes      | -       | -   | -   | -                                                                                                                                                                                   | Input video      |
| `tintMode`     | string | No       | `sepia` | -   | -   | `sepia`, `red`, `green`, `blue`, `cyan`, `magenta`, `yellow`, `purple`, `orange`, `warm`, `cool`, `lime`, `navy`, `vintage`, `rose`, `teal`, `maroon`, `peach`, `lavender`, `olive` | Tint color mode. |
| `tintStrength` | number | No       | `1`     | 0.1 | 1   | -                                                                                                                                                                                   | Tint strength.   |

## Video Cut

Trim a video to a precise time range with frame-accurate cutting.

**Model ID:** `model_scenario-video-cut`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-video-cut/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values                 | Description                                                      |
| --------------- | ------- | -------- | ------- | --- | --- | ------------------------------ | ---------------------------------------------------------------- |
| `video`         | file    | Yes      | -       | -   | -   | -                              | Video to cut/trim                                                |
| `startTime`     | number  | No       | `0`     | 0   | -   | -                              | Start time in seconds (default 0 = beginning of video)           |
| `endTime`       | number  | No       | -       | 0   | -   | -                              | End time in seconds. Leave empty to cut to the end of the video. |
| `preserveAudio` | boolean | No       | `true`  | -   | -   | -                              | Whether to preserve audio from the input video                   |
| `outputFormat`  | string  | No       | -       | -   | -   | “, `mp4`, `mov`, `webm`, `gif` | Output video format. Leave empty to preserve the input format.   |

## Video Split

Split a video at one or more timestamps into ordered segments.

**Model ID:** `model_scenario-video-split`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-video-split/markdown>

| Parameter       | Type          | Required | Default | Min | Max | Allowed Values                 | Description                                                                                                                                        |
| --------------- | ------------- | -------- | ------- | --- | --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `video`         | file          | Yes      | -       | -   | -   | -                              | Video file URI to split                                                                                                                            |
| `cutPoints`     | number\_array | No       | “       | 0   | -   | -                              | Sorted timestamps (seconds) at which to split the video. N cut points produce N+1 segments. Leave empty for one segment containing the full video. |
| `preserveAudio` | boolean       | No       | `true`  | -   | -   | -                              | Whether to preserve audio in all output segments                                                                                                   |
| `outputFormat`  | string        | No       | -       | -   | -   | “, `mp4`, `mov`, `webm`, `gif` | Output format for all segments (mp4, mov, webm, gif). If not specified, the source format is preserved.                                            |
| `strict`        | boolean       | No       | `false` | -   | -   | -                              | If enabled, reject malformed cut points (unsorted, duplicates, out of range, or empty). If disabled, cut points are normalized automatically.      |

## Vignette (Video)

Darken edges of video to create a vignette effect.

**Model ID:** `model_scenario-postprocessing-vignette-video`

**Capabilities:** `video2video`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-vignette-video/markdown>

| Parameter          | Type   | Required | Default | Min | Max | Allowed Values | Description        |
| ------------------ | ------ | -------- | ------- | --- | --- | -------------- | ------------------ |
| `video`            | file   | Yes      | -       | -   | -   | -              | Input video        |
| `vignetteStrength` | number | No       | `0.5`   | 0   | 1   | -              | Vignette strength. |
