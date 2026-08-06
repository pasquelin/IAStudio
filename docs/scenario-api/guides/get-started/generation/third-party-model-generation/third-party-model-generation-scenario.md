---
title: Scenario | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-01.

This reference lists all available **Scenario** image generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [3D Color LUT](#3d-color-lut)
- [Blur](#blur)
- [Chromatic Aberration](#chromatic-aberration)
- [Color Correction](#color-correction)
- [Crystallize](#crystallize)
- [Cubism](#cubism)
- [Desaturate](#desaturate)
- [Dissolve](#dissolve)
- [Dodge & Burn](#dodge-burn)
- [Glow & Bloom](#glow-bloom)
- [Grain](#grain)
- [Oilify](#oilify)
- [Parabolize](#parabolize)
- [Pixelate](#pixelate)
- [Posterize](#posterize)
- [Scenario Compose Image](#scenario-compose-image)
- [Scenario Detection](#scenario-detection)
- [Scenario Gemini Reframe](#scenario-gemini-reframe)
- [Scenario Grid Maker](#scenario-grid-maker)
- [Scenario Image Layers Extractor](#scenario-image-layers-extractor)
- [Scenario Image Slicer](#scenario-image-slicer)
- [Scenario Image to Mask](#scenario-image-to-mask)
- [Scenario Padding Remover](#scenario-padding-remover)
- [Scenario Resize Image](#scenario-resize-image)
- [Scenario Skybox GPT](#scenario-skybox-gpt)
- [Scenario Smart Reframe](#scenario-smart-reframe)
- [Scenario Texture](#scenario-texture)
- [Scenario Texture Converter](#scenario-texture-converter)
- [Sharpen](#sharpen)
- [Solarize](#solarize)
- [Tint](#tint)
- [Vignette](#vignette)

---

## 3D Color LUT

**Model ID:** `model_scenario-postprocessing-lut`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-lut/markdown>

| Parameter      | Type   | Required | Default       | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Description                |
| -------------- | ------ | -------- | ------------- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `image`        | file   | Yes      | -             | -   | -   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Input image                |
| `lutStyle`     | string | No       | `teal_orange` | -   | -   | `teal_orange`, `kodak_portra`, `fuji_velvia`, `bleach_bypass`, `matrix_green`, `cgc_film_emulation_agfa_portrait_xps_160`, `cgc_film_emulation_fuji_astia_100f`, `cgc_film_emulation_fuji_eterna_3513`, `cgc_film_emulation_fuji_eterna_8563`, `cgc_film_emulation_fuji_provia_100f`, `cgc_film_emulation_fuji_sensia_100`, `cgc_film_emulation_fuji_superia_xtra_400`, `cgc_film_emulation_fuji_vivid_8543`, `cgc_film_emulation_kodak_ektachrome_64`, `cgc_film_emulation_kodak_professional_portra_400`, `cgc_film_emulation_kodak_vision_2383`, `cgc_film_emulation_lpp_tetrachrome_400`, `cgc_film_emulation_polaroid_600`, `cgc_log_to_rec709_alexa_logc`, `cgc_log_to_rec709_blackmagic_4.6k_film`, `cgc_log_to_rec709_blackmagic_4k_film`, `cgc_log_to_rec709_blackmagic_cinema_camera_film`, `cgc_log_to_rec709_canon_log`, `cgc_log_to_rec709_canon_log2`, `cgc_log_to_rec709_canon_log3`, `cgc_log_to_rec709_cinelike_d`, `cgc_log_to_rec709_cinestyle_s_curve`, `cgc_log_to_rec709_dji_inspire`, `cgc_log_to_rec709_gopro_protune`, `cgc_log_to_rec709_panasonic_v`, `cgc_log_to_rec709_redlogfilm`, `cgc_log_to_rec709_redwidegamut_log3g10`, `cgc_log_to_rec709_sony_slog2`, `cgc_log_to_rec709_sony_slog3_cine`, `cgc_log_to_rec709_sony_slog3`, `cgc_look_3strip`, `cgc_look_70s`, `cgc_look_amelie`, `cgc_look_aviator`, `cgc_look_blade_runner`, `cgc_look_bleach`, `cgc_look_brooklyn`, `cgc_look_celadon`, `cgc_look_chamoisee`, `cgc_look_cubanismo`, `cgc_look_drive`, `cgc_look_duotone`, `cgc_look_emulsion`, `cgc_look_enemy`, `cgc_look_enhance`, `cgc_look_fashion`, `cgc_look_glacier`, `cgc_look_godfather`, `cgc_look_grand_budapest`, `cgc_look_grime`, `cgc_look_grit`, `cgc_look_hannibal`, `cgc_look_her`, `cgc_look_mad_max`, `cgc_look_matrix_v1`, `cgc_look_matrix_v2`, `cgc_look_mint`, `cgc_look_moonrise_kingdom`, `cgc_look_ochre`, `cgc_look_punch`, `cgc_look_revenant`, `cgc_look_rhythm`, `cgc_look_seven`, `cgc_look_spy`, `cgc_look_stranger_things`, `cgc_look_summer`, `cgc_look_teal and orange`, `cgc_look_thriller`, `cgc_look_vinteo`, `cgc_look_wonder_woman`, `distant_land_basin`, `distant_land_boulder`, `distant_land_butte`, `distant_land_everest`, `distant_land_hopkins`, `distant_land_lochness`, `distant_land_oaxaca`, `distant_land_oslo`, `distant_land_phoenix`, `distant_land_pocatello`, `distant_land_prague`, `distant_land_reykjavik`, `distant_land_santafe`, `distant_land_seattle`, `distant_land_stillwater`, `distant_land_tahoe`, `distant_land_thames`, `pond5_arabica_12`, `pond5_ava_614`, `pond5_azrael_93`, `pond5_bourbon_64`, `pond5_byers_11`, `pond5_celluloid_01_fu_low`, `pond5_chemical_168`, `pond5_clayton_33`, `pond5_clouseau_54`, `pond5_cobi_3`, `pond5_contrail_35`, `pond5_cubicle_99`, `pond5_django_25`, `pond5_domingo_145`, `pond5_faded_47`, `pond5_folger_50`, `pond5_fusion_88`, `pond5_hyla_68`, `pond5_korben_214`, `pond5_lenox_340`, `pond5_lucky_64`, `pond5_mckinnon_75`, `pond5_milo_5`, `pond5_neon_770`, `pond5_paladin_1875`, `pond5_pasadena_21`, `pond5_pitaya_15`, `pond5_reeve_38`, `pond5_remy_24`, `pond5_sprocket_231`, `pond5_teigen_28`, `pond5_trent_18`, `pond5_tweed_71`, `pond5_vireo_37`, `pond5_zed_32`, `pond5_zeke_39`, `rec709_fujifilm_3510_d65`, `rec709_kodak_2383_d65`, `rec709_kodak_2393_d65`, `shutterstock_blue_architecture`, `shutterstock_blue_hour`, `shutterstock_cold_chrome`, `shutterstock_crisp_autumn`, `shutterstock_dark_and_somber`, `shutterstock_hard_boost`, `shutterstock_long_beach_morning`, `shutterstock_lush_green`, `shutterstock_magic_hour`, `shutterstock_natural_boost`, `shutterstock_orange_and_blue`, `shutterstock_soft_black_and_white`, `shutterstock_waves` | Style of grading to apply. |
| `lutIntensity` | number | No       | `1`           | 0   | 1   | -                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Opacity of the LUT effect. |

## Blur

**Model ID:** `model_scenario-postprocessing-blur`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-blur/markdown>

| Parameter    | Type   | Required | Default    | Min | Max | Allowed Values         | Description              |
| ------------ | ------ | -------- | ---------- | --- | --- | ---------------------- | ------------------------ |
| `image`      | file   | Yes      | -          | -   | -   | -                      | Input image              |
| `blurType`   | string | No       | `gaussian` | -   | -   | `gaussian`, `kuwahara` | Type of blur to apply.   |
| `blurRadius` | number | No       | `3`        | 0   | 31  | -                      | Blur radius.             |
| `blurSigma`  | number | No       | `1`        | 0.1 | 10  | -                      | Sigma for Gaussian blur. |

## Chromatic Aberration

**Model ID:** `model_scenario-postprocessing-chromatic`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-chromatic/markdown>

| Parameter        | Type   | Required | Default      | Min | Max | Allowed Values           | Description                    |
| ---------------- | ------ | -------- | ------------ | --- | --- | ------------------------ | ------------------------------ |
| `image`          | file   | Yes      | -            | -   | -   | -                        | Input image                    |
| `redShift`       | number | No       | `0`          | -20 | 20  | -                        | Red channel shift amount.      |
| `greenShift`     | number | No       | `0`          | -20 | 20  | -                        | Green channel shift amount.    |
| `blueShift`      | number | No       | `0`          | -20 | 20  | -                        | Blue channel shift amount.     |
| `redDirection`   | string | No       | `horizontal` | -   | -   | `horizontal`, `vertical` | Red channel shift direction.   |
| `greenDirection` | string | No       | `horizontal` | -   | -   | `horizontal`, `vertical` | Green channel shift direction. |
| `blueDirection`  | string | No       | `horizontal` | -   | -   | `horizontal`, `vertical` | Blue channel shift direction.  |

## Color Correction

**Model ID:** `model_scenario-postprocessing-color-correction`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-color-correction/markdown>

| Parameter                 | Type   | Required | Default | Min  | Max | Allowed Values | Description                                 |
| ------------------------- | ------ | -------- | ------- | ---- | --- | -------------- | ------------------------------------------- |
| `image`                   | file   | Yes      | -       | -    | -   | -              | Input image                                 |
| `temperature`             | number | No       | `0`     | -100 | 100 | -              | Color temperature adjustment (-100 to 100). |
| `brightness`              | number | No       | `0`     | -100 | 100 | -              | Brightness adjustment (-100 to 100).        |
| `contrast`                | number | No       | `0`     | -100 | 100 | -              | Contrast adjustment (-100 to 100).          |
| `saturation`              | number | No       | `0`     | -100 | 100 | -              | Saturation adjustment (-100 to 100).        |
| `gamma`                   | number | No       | `1`     | 0.2  | 2.2 | -              | Gamma adjustment (0.2-2.2).                 |
| `exposure`                | number | No       | `0`     | -5   | 5   | -              | Exposure adjustment (-5.0 to 5.0).          |
| `shadows`                 | number | No       | `0`     | -100 | 100 | -              | Shadows adjustment (-100 to 100).           |
| `highlights`              | number | No       | `0`     | -100 | 100 | -              | Highlights adjustment (-100 to 100).        |
| `shadowsHighlightsRadius` | number | No       | `50`    | 0    | 100 | -              | Shadows/Highlights radius (0 to 100).       |

## Crystallize

**Model ID:** `model_scenario-postprocessing-crystallize`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-crystallize/markdown>

| Parameter           | Type   | Required | Default | Min | Max | Allowed Values | Description                                        |
| ------------------- | ------ | -------- | ------- | --- | --- | -------------- | -------------------------------------------------- |
| `image`             | file   | Yes      | -       | -   | -   | -              | Input image                                        |
| `crystallizeRadius` | number | No       | `10`    | 1   | 100 | -              | Approximate size/number of the superpixel regions. |

## Cubism

**Model ID:** `model_scenario-postprocessing-cubism`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-cubism/markdown>

| Parameter              | Type   | Required | Default | Min | Max | Allowed Values | Description                         |
| ---------------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------- |
| `image`                | file   | Yes      | -       | -   | -   | -              | Input image                         |
| `cubismTileSize`       | number | No       | `20`    | 1   | 100 | -              | Average tile size.                  |
| `cubismTileSaturation` | number | No       | `2.5`   | 0   | 10  | -              | Tile saturation (expansion factor). |

## Desaturate

**Model ID:** `model_scenario-postprocessing-desaturate`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-desaturate/markdown>

| Parameter          | Type   | Required | Default               | Min | Max | Allowed Values                                                       | Description          |
| ------------------ | ------ | -------- | --------------------- | --- | --- | -------------------------------------------------------------------- | -------------------- |
| `image`            | file   | Yes      | -                     | -   | -   | -                                                                    | Input image          |
| `desaturateMethod` | string | No       | `luminance (Rec.709)` | -   | -   | `average`, `luminance (Rec.709)`, `luminance (Rec.601)`, `lightness` | Desaturation method. |
| `desaturateFactor` | number | No       | `1`                   | 0   | 1   | -                                                                    | Desaturation factor. |

## Dissolve

**Model ID:** `model_scenario-postprocessing-dissolve`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-dissolve/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description             |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------- |
| `image`          | file   | Yes      | -       | -   | -   | -              | Input image             |
| `dissolveImage`  | file   | No       | -       | -   | -   | -              | Image to dissolve with. |
| `dissolveFactor` | number | No       | `0.5`   | 0   | 1   | -              | Dissolve blend factor.  |

## Dodge & Burn

**Model ID:** `model_scenario-postprocessing-dodge-burn`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-dodge-burn/markdown>

| Parameter            | Type   | Required | Default | Min | Max | Allowed Values                                                                                                  | Description           |
| -------------------- | ------ | -------- | ------- | --- | --- | --------------------------------------------------------------------------------------------------------------- | --------------------- |
| `image`              | file   | Yes      | -       | -   | -   | -                                                                                                               | Input image           |
| `dodgeBurnMode`      | string | No       | `dodge` | -   | -   | `dodge`, `burn`, `dodge_and_burn`, `burn_and_dodge`, `color_dodge`, `color_burn`, `linear_dodge`, `linear_burn` | Dodge/Burn mode.      |
| `dodgeBurnIntensity` | number | No       | `0.5`   | 0   | 1   | -                                                                                                               | Dodge/Burn intensity. |

## Glow & Bloom

**Model ID:** `model_scenario-postprocessing-glow`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-glow/markdown>

| Parameter       | Type   | Required | Default | Min | Max | Allowed Values | Description       |
| --------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------- |
| `image`         | file   | Yes      | -       | -   | -   | -              | Input image       |
| `glowRadius`    | number | No       | `5`     | 1   | 50  | -              | Glow blur radius. |
| `glowIntensity` | number | No       | `1`     | 0   | 5   | -              | Glow intensity.   |

## Grain

**Model ID:** `model_scenario-postprocessing-grain`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-grain/markdown>

| Parameter        | Type    | Required | Default            | Min  | Max   | Allowed Values                                                                                                                                                                                                                                                                                                                                                                         | Description                                                           |
| ---------------- | ------- | -------- | ------------------ | ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `image`          | file    | Yes      | -                  | -    | -     | -                                                                                                                                                                                                                                                                                                                                                                                      | Input image                                                           |
| `grainProfile`   | string  | No       | `kodak_portra_400` | -    | -     | `cine_still_800t`, `fuji_pro_400h`, `fuji_provia_100f`, `fuji_superia_400`, `fuji_velvia_50`, `ilford_hp5_plus`, `kodak_ektachrome_e100`, `kodak_ektar_100`, `kodak_gold_200`, `kodak_portra_400`, `kodak_tri_x_400`, `lomography_color_negative_400`, `modern`, `analog`, `cinematic`, `newspaper`, `vintage`, `bleach_bypass`, `infrared_bw`, `night_vision`, `sepia`, `old_fashion` | Film grain profile to use. Determines grain, color distribution, etc. |
| `grainColorTemp` | number  | No       | `6500`             | 2000 | 10000 | -                                                                                                                                                                                                                                                                                                                                                                                      | Color temperature adjustment for grain.                               |
| `crossProcess`   | boolean | No       | `false`            | -    | -     | -                                                                                                                                                                                                                                                                                                                                                                                      | Enable cross-processing effect.                                       |

## Oilify

**Model ID:** `model_scenario-postprocessing-oilify`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-oilify/markdown>

| Parameter         | Type   | Required | Default | Min | Max | Allowed Values | Description                                                       |
| ----------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------- |
| `image`           | file   | Yes      | -       | -   | -   | -              | Input image                                                       |
| `oilifyRadius`    | number | No       | `4`     | 1   | 50  | -              | Radius of the oil painting effect (neighborhood size).            |
| `oilifyIntensity` | number | No       | `1`     | 1   | 20  | -              | Dynamic ratio of the oil painting effect (degree of abstraction). |

## Parabolize

**Model ID:** `model_scenario-postprocessing-parabolize`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-parabolize/markdown>

| Parameter         | Type   | Required | Default | Min | Max | Allowed Values | Description             |
| ----------------- | ------ | -------- | ------- | --- | --- | -------------- | ----------------------- |
| `image`           | file   | Yes      | -       | -   | -   | -              | Input image             |
| `parabolizeCoeff` | number | No       | `1`     | -10 | 10  | -              | Parabolize coefficient. |
| `vertexX`         | number | No       | `0.5`   | 0   | 1   | -              | Vertex X position.      |
| `vertexY`         | number | No       | `0.5`   | 0   | 1   | -              | Vertex Y position.      |

## Pixelate

Classic pixel art effect: downscale-upscale with color correction and optional palette quantization.

**Model ID:** `model_sc-pixelate`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sc-pixelate/markdown>

| Parameter          | Type          | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                     |
| ------------------ | ------------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`            | file          | Yes      | -       | -   | -   | -              | The image you want to turn into pixel art.                                                                                                      |
| `pixelBlockSize`   | number        | No       | `16`    | 1   | 512 | -              | Size of each pixel block in pixels. Larger values make bigger, blockier pixels; smaller values keep more detail.                                |
| `removeNoise`      | boolean       | No       | `false` | -   | -   | -              | Smooths out specks and grain before pixelating, for a cleaner result. Helpful for noisy or low-quality images.                                  |
| `colorPalette`     | string\_array | No       | -       | -   | -   | -              | An optional custom set of colors as hex strings (for example, \[“#000000”, “#FFFFFF”]). When set, the image is redrawn using only these colors. |
| `colorPaletteSize` | number        | No       | -       | 2   | 256 | -              | Reduces the image to this many colors (2–256) for a retro look. Used only when no custom palette is provided.                                   |

## Posterize

**Model ID:** `model_scenario-postprocessing-posterize`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-posterize/markdown>

| Parameter            | Type   | Required | Default | Min | Max | Allowed Values | Description          |
| -------------------- | ------ | -------- | ------- | --- | --- | -------------- | -------------------- |
| `image`              | file   | Yes      | -       | -   | -   | -              | Input image          |
| `posterizeThreshold` | number | No       | `0.5`   | 0   | 1   | -              | Posterize threshold. |

## Scenario Compose Image

Compose multiple images into a single image with layers, transforms, effects, and blending modes.

**Model ID:** `model_scenario-compose-image`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-compose-image/markdown>

| Parameter           | Type          | Required | Default   | Min | Max  | Allowed Values       | Description                                                                        |
| ------------------- | ------------- | -------- | --------- | --- | ---- | -------------------- | ---------------------------------------------------------------------------------- |
| `layers`            | inputs\_array | Yes      | -         | -   | -    | -                    | Array of image layers to compose                                                   |
| `canvasMode`        | string        | No       | `auto`    | -   | -    | `auto`, `custom`     | Canvas size mode. ‘auto’ computes from layers, ‘custom’ uses specified dimensions. |
| `canvasWidth`       | number        | No       | -         | 1   | 7680 | -                    | Output canvas width in pixels (required when canvas\_mode=‘custom’)                |
| `canvasHeight`      | number        | No       | -         | 1   | 4320 | -                    | Output canvas height in pixels (required when canvas\_mode=‘custom’)               |
| `backgroundColor`   | string        | No       | `#000000` | -   | -    | -                    | Canvas background color (hex format #RRGGBB) or ‘transparent’                      |
| `imageOutputFormat` | string        | No       | `png`     | -   | -    | `png`, `jpg`, `webp` | Output image format                                                                |
| `imageQuality`      | number        | No       | `95`      | 1   | 100  | -                    | Image quality for lossy formats (jpg, webp). 1-100, higher is better.              |

## Scenario Detection

Run ControlNet-style detection maps: Canny, depth, grayscale, line art, MLSD, normal, pose, scribble, segmentation, sketch, and more.

**Model ID:** `model_scenario-detection`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-detection/markdown>

| Parameter           | Type    | Required | Default | Min | Max | Allowed Values                                                                                                 | Description                                          |
| ------------------- | ------- | -------- | ------- | --- | --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `image`             | file    | Yes      | -       | -   | -   | -                                                                                                              | Input image                                          |
| `modality`          | string  | Yes      | `canny` | -   | -   | `canny`, `depth`, `grayscale`, `lineart_anime`, `mlsd`, `normal`, `pose`, `scribble`, `segmentation`, `sketch` | Map / detector to run                                |
| `lowThreshold`      | number  | No       | `100`   | 0   | 255 | -                                                                                                              | Low threshold for Canny edge detector (hysteresis).  |
| `highThreshold`     | number  | No       | `200`   | 0   | 255 | -                                                                                                              | High threshold for Canny edge detector (hysteresis). |
| `factor`            | number  | No       | `5`     | 0   | -   | -                                                                                                              | Contrast factor for the grayscale detector.          |
| `thresholdMin`      | number  | No       | `10`    | 0   | 100 | -                                                                                                              | Minimum threshold for grayscale conversion.          |
| `thresholdMax`      | number  | No       | `90`    | 0   | 100 | -                                                                                                              | Maximum threshold for grayscale conversion.          |
| `removeBackground`  | boolean | No       | `true`  | -   | -   | -                                                                                                              | Remove background before grayscale processing.       |
| `keypointThreshold` | number  | No       | `0.3`   | 0   | 1   | -                                                                                                              | Score threshold for pose keypoint detection (0–1).   |

## Scenario Gemini Reframe

**Model ID:** `model_scenario-gemini-reframe`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-gemini-reframe/markdown>

| Parameter       | Type   | Required | Default  | Min | Max        | Allowed Values                                                                                                   | Description                                                                                                                                   |
| --------------- | ------ | -------- | -------- | --- | ---------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`         | file   | Yes      | -        | -   | -          | -                                                                                                                | Input image                                                                                                                                   |
| `prompt`        | string | No       | -        | -   | -          | -                                                                                                                | User prompt for image expansion                                                                                                               |
| `aspectRatio`   | string | No       | `auto`   | -   | -          | `21:9`, `16:9`, `4:3`, `3:2`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `auto`                                  | Aspect ratio for the output canvas                                                                                                            |
| `resolution`    | string | No       | `2K`     | -   | -          | `1K`, `2K`, `4K`                                                                                                 | Resolution for the output (1K, 2K, 4K)                                                                                                        |
| `xStart`        | number | No       | -        | 0   | -          | -                                                                                                                | Top-left x coordinate for crop bounds (in original image pixels)                                                                              |
| `yStart`        | number | No       | -        | 0   | -          | -                                                                                                                | Top-left y coordinate for crop bounds (in original image pixels)                                                                              |
| `xEnd`          | number | No       | -        | 0   | -          | -                                                                                                                | Bottom-right x coordinate for crop bounds (in original image pixels)                                                                          |
| `yEnd`          | number | No       | -        | 0   | -          | -                                                                                                                | Bottom-right y coordinate for crop bounds (in original image pixels)                                                                          |
| `resizedWidth`  | number | No       | -        | 1   | -          | -                                                                                                                | Width of source image after scaling (in output canvas pixels)                                                                                 |
| `resizedHeight` | number | No       | -        | 1   | -          | -                                                                                                                | Height of source image after scaling (in output canvas pixels)                                                                                |
| `gridPositionX` | number | No       | -        | 0   | -          | -                                                                                                                | Grid offset x for image position (exclusive with position)                                                                                    |
| `gridPositionY` | number | No       | -        | 0   | -          | -                                                                                                                | Grid offset y for image position (exclusive with position)                                                                                    |
| `position`      | string | No       | `center` | -   | -          | `center`, `top`, `bottom`, `center-left`, `center-right`, `top-left`, `top-right`, `bottom-left`, `bottom-right` | Position enum (exclusive with grid\_position): center, top, bottom, center-left, center-right, top-left, top-right, bottom-left, bottom-right |
| `seed`          | number | No       | -        | 0   | 2147483647 | -                                                                                                                | Seed for Gemini generation                                                                                                                    |

## Scenario Grid Maker

**Model ID:** `model_scenario-grid-maker`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-grid-maker/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                                                           | Description                                                                    |
| ----------------- | ----------- | -------- | ------- | --- | --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `images`          | file\_array | Yes      | -       | -   | -   | -                                                                        | List of images to arrange in a grid                                            |
| `columns`         | number      | No       | `3`     | 1   | 20  | -                                                                        | Number of columns in the grid                                                  |
| `rows`            | number      | No       | -       | 1   | 20  | -                                                                        | Number of rows in the grid. If not set, computed from images count and columns |
| `padding`         | number      | No       | `0`     | 0   | 50  | -                                                                        | Padding between images in pixels                                               |
| `backgroundColor` | string      | No       | `white` | -   | -   | -                                                                        | Background color: hex string, ‘transparent’, ‘black’ or ‘white’                |
| `cellRatio`       | string      | No       | `auto`  | -   | -   | `9:16`, `2:3`, `3:4`, `1:1`, `5:4`, `4:3`, `3:2`, `16:9`, `21:9`, `auto` | Cell aspect ratio                                                              |

## Scenario Image Layers Extractor

Automatically splits a picture into separate, editable layers — the foreground objects plus a clean filled-in background — so you can move or edit each part on its own.

**Model ID:** `model_scenario-image-layers-extractor`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-image-layers-extractor/markdown>

| Parameter               | Type   | Required | Default       | Min | Max | Allowed Values                               | Description                                                                                                                                                                                                                                            |
| ----------------------- | ------ | -------- | ------------- | --- | --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`                 | file   | Yes      | -             | -   | -   | -                                            | The image you want to separate into layers.                                                                                                                                                                                                            |
| `separationInstruction` | string | Yes      | -             | -   | -   | -                                            | Tell the tool how to divide the image — describe the objects or the rule for splitting them, not the scene itself. For example: ‘isolate the main subject’, ‘extract every object on the table’, or ‘separate each person from their clothes’.         |
| `maxLayers`             | number | No       | `6`           | 1   | 10  | -                                            | The most layers the tool will produce. It may stop sooner if it decides nothing else is worth separating, or if it can’t find the objects you described. More layers means a higher cost. The result will be your layers + the background.             |
| `inpaintModel`          | string | No       | `gpt-image-2` | -   | -   | `flux2-klein-9b`, `flux2-dev`, `gpt-image-2` | After each layer is cut out it leaves a hole in the background; this picks the AI that fills those holes back in. FLUX.2 Klein 9b is the fastest, FLUX.2 Dev is slower but higher quality, and GPT Image 2 uses OpenAI’s model. This affects the cost. |
| `inpaintPrompt`         | string | No       | -             | -   | -   | -                                            | Optional extra guidance for filling in the background holes — e.g. a note about what the background should look like. Leave blank to use the default.                                                                                                  |

## Scenario Image Slicer

**Model ID:** `model_scenario-image-slicer`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-image-slicer/markdown>

| Parameter       | Type   | Required | Default | Min | Max | Allowed Values | Description                             |
| --------------- | ------ | -------- | ------- | --- | --- | -------------- | --------------------------------------- |
| `image`         | file   | Yes      | -       | -   | -   | -              | Image to slice                          |
| `xSubdivisions` | number | No       | `2`     | 1   | 6   | -              | Number of subdivisions along the X axis |
| `ySubdivisions` | number | No       | `2`     | 1   | 6   | -              | Number of subdivisions along the Y axis |

## Scenario Image to Mask

Convert an image to a single-channel grayscale mask (white = visible, black = transparent).

**Model ID:** `model_scenario-convert-to-mask-image`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-convert-to-mask-image/markdown>

| Parameter       | Type    | Required | Default | Min | Max | Allowed Values               | Description                                                                                                                                                                                                                            |
| --------------- | ------- | -------- | ------- | --- | --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`          | file    | Yes      | -       | -   | -   | -                            | Image to convert into a mask                                                                                                                                                                                                           |
| `sourceChannel` | string  | No       | `auto`  | -   | -   | `auto`, `alpha`, `luminance` | Which source channel to use as the mask. ‘auto’ picks alpha when the input has a non-trivial alpha channel, otherwise falls back to luminance. ‘alpha’ requires an image with an alpha channel. ‘luminance’ converts RGB to grayscale. |
| `threshold`     | number  | No       | -       | 0   | 255 | -                            | Optional binarization threshold (0-255). When set, pixels >= threshold become 255 and pixels < threshold become 0. Leave empty to keep the continuous mask.                                                                            |
| `invert`        | boolean | No       | `false` | -   | -   | -                            | Invert the mask (255 - value). Useful when the source is darker for ‘keep’.                                                                                                                                                            |

## Scenario Padding Remover

Automatically detects and removes uniform color borders/padding from images and videos.

**Model ID:** `model_scenario-padding-remover`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-padding-remover/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description                                                                                                                           |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `image`          | file   | Yes      | -       | -   | -   | -              | Image to remove padding from                                                                                                          |
| `color`          | string | No       | -       | -   | -   | -              | Hex color of the border to remove (e.g., ‘FFFFFF’ or ‘#FFFFFF’). If not specified, the color is auto-detected from the image corners. |
| `colorTolerance` | number | No       | `0.4`   | 0   | 1   | -              | Color matching tolerance as a percentage (0.0-1.0). Higher values match more similar colors.                                          |
| `width`          | number | No       | -       | 0   | -   | -              | Width of the border to remove on all sides (in pixels). If not set, the border width is auto-detected.                                |

## Scenario Resize Image

Resize an image to a specified width and height or a maximum size while preserving aspect ratio.

**Model ID:** `model_scenario-resize-image`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-resize-image/markdown>

| Parameter             | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                                                                                                         |
| --------------------- | ----------- | -------- | ------- | --- | --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`              | file\_array | Yes      | -       | -   | -   | -              | Images to resize                                                                                                                                                                                    |
| `width`               | number      | No       | -       | 1   | -   | -              | Target width in pixels. If only width is specified, height is calculated to preserve aspect ratio.                                                                                                  |
| `height`              | number      | No       | -       | 1   | -   | -              | Target height in pixels. If only height is specified, width is calculated to preserve aspect ratio.                                                                                                 |
| `maxSizeMb`           | number      | No       | -       | 0.1 | -   | -              | Maximum output file size in megabytes. The file will be resized iteratively to meet this constraint while preserving aspect ratio.                                                                  |
| `preserveAspectRatio` | boolean     | No       | `true`  | -   | -   | -              | Whether to preserve the original aspect ratio. When True (default), the output fits within the specified dimensions. When False, the output is stretched to exactly match the specified dimensions. |

## Scenario Skybox GPT

Generates an equirectangular skybox from a text prompt, optionally erasing the left/right seam so it tiles horizontally.

**Model ID:** `model_scenario-skybox-gpt`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-skybox-gpt/markdown>

| Parameter         | Type        | Required | Default | Min | Max  | Allowed Values                  | Description                                                                                                                                                                                             |
| ----------------- | ----------- | -------- | ------- | --- | ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`          | string      | Yes      | -       | -   | -    | -                               | Describe the scene you want to see all around you — a mountain pass at dusk, a cathedral interior, an alien landscape. The model automatically formats your prompt to produce a seamless 360° panorama. |
| `referenceImages` | file\_array | No       | -       | -   | -    | -                               | Upload one or more images to guide the style, mood, or content of the skybox. The model draws inspiration from them while still following your prompt. Up to 10 images accepted.                        |
| `width`           | number      | No       | `2048`  | 16  | 3840 | -                               | Width of the generated panorama in pixels, must be a multiple of 16. A 2:1 width-to-height ratio is recommended for correct 360° viewing.                                                               |
| `height`          | number      | No       | `1024`  | 16  | 3840 | -                               | Height of the generated panorama in pixels, must be a multiple of 16. A 2:1 width-to-height ratio is recommended for correct 360° viewing.                                                              |
| `quality`         | string      | No       | `high`  | -   | -    | `auto`, `high`, `medium`, `low` | Controls the detail and generation time of the output. High produces the best results; Medium and Low are faster and more cost-efficient. Auto lets the model decide based on your input.               |
| `seed`            | number      | No       | -       | 0   | -    | -                               | A number that locks in the randomness of the generation. Copy the seed from a result you liked to reproduce it exactly, or leave blank for a new result each time.                                      |

## Scenario Smart Reframe

AI-powered recomposition + outpainting that reframes any image to exact (width, height) while preserving art style, subject identity, on-image text, brand assets, camera angle, color palette, and design language. Two-call pipeline kicks in when the target aspect ratio is non-native.

**Model ID:** `model_scenario-smart-reframe`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-smart-reframe/markdown>

| Parameter       | Type   | Required | Default  | Min | Max        | Allowed Values    | Description                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------ | -------- | -------- | --- | ---------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`         | file   | Yes      | -        | -   | -          | -                 | Source image to reframe.                                                                                                                                                                                                                                                                                                                     |
| `width`         | number | Yes      | `1280`   | 64  | 6336       | -                 | Target output width in pixels. Combined with height, the pixel budget must not exceed the underlying renderer’s per-aspect-ratio 4K capacity (max \~17M pixels). Targets too far from any supported aspect ratio (gap > 50%) are rejected.                                                                                                   |
| `height`        | number | Yes      | `720`    | 64  | 5504       | -                 | Target output height in pixels. See width for combined constraints.                                                                                                                                                                                                                                                                          |
| `prompt`        | string | No       | -        | -   | -          | -                 | Optional art-direction hint folded into the recomposition prompt.                                                                                                                                                                                                                                                                            |
| `textDensity`   | string | No       | `SPARSE` | -   | -          | `SPARSE`, `DENSE` | On-image text density of the source. SPARSE (default) routes to a single-stage art-direction pipeline for hero shots, character ads, and simple banners (logo + tagline). DENSE adds a structured layout-decomposition step for product infographics, dashboards, and multi-zone layouts packed with text blocks; substantially higher cost. |
| `numOutputs`    | number | No       | `1`      | 1   | 8          | -                 | Number of output variants per request. Shared art-direction stages run once and only the render stage repeats per variant.                                                                                                                                                                                                                   |
| `thinkingLevel` | string | No       | `HIGH`   | -   | -          | `HIGH`, `MINIMAL` | Reasoning budget applied to the art-direction LLM calls. HIGH (default) gives more reasoning capacity per call; MINIMAL is cheaper and faster, with the biggest savings in DENSE mode (the decomposition step is the main swing factor).                                                                                                     |
| `seed`          | number | No       | -        | 0   | 2147483647 | -                 | Seed for reproducibility. With multiple variants, variants use seed, seed+1, …, seed + numOutputs - 1.                                                                                                                                                                                                                                       |

## Scenario Texture

Generates a tileable texture from a text prompt, optionally erasing both the left/right and top/bottom seams so it tiles in 2D.

**Model ID:** `model_scenario-texture`

**Capabilities:** `txt2img`, `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-texture/markdown>

| Parameter         | Type        | Required | Default | Min | Max  | Allowed Values                  | Description                                                                                                                                                        |
| ----------------- | ----------- | -------- | ------- | --- | ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt`          | string      | Yes      | -       | -   | -    | -                               | Text description of the desired texture. A tileable-top-down hint is appended automatically so the generator aims for seam-continuous output.                      |
| `referenceImages` | file\_array | No       | -       | -   | -    | -                               | Optional reference images passed to gpt-image-2 edit mode. When present, the prompt is rewrapped to tell the model to draw inspiration from the attached image(s). |
| `width`           | number      | No       | `1024`  | 16  | 3840 | -                               | Output width in pixels. Must be a multiple of 16.                                                                                                                  |
| `height`          | number      | No       | `1024`  | 16  | 3840 | -                               | Output height in pixels. Must be a multiple of 16.                                                                                                                 |
| `quality`         | string      | No       | `high`  | -   | -    | `auto`, `high`, `medium`, `low` | Generation quality.                                                                                                                                                |
| `eraseSeam`       | boolean     | No       | `false` | -   | -    | -                               | When enabled, the generated image is piped to remove both the left/right and top/bottom discontinuities.                                                           |
| `overlap`         | number      | No       | `128`   | 16  | 1024 | -                               | Half-width (in pixels) of the inpainting band centered on each seam. Only used when Erase Seam is enabled.                                                         |
| `featherRadius`   | number      | No       | `64`    | 0   | 1024 | -                               | Width (in pixels) of the outward linear blend ring around the inpainting band. 0 disables feathering (hard edge). Only used when Erase Seam is enabled.            |
| `seed`            | number      | No       | -       | 0   | -    | -                               | Seed for generation                                                                                                                                                |

## Scenario Texture Converter

Converts an image texture to PBR texture maps (height, normal, smoothness, metallic, edge, AO).

**Model ID:** `model_sc-texture-converter`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_sc-texture-converter/markdown>

| Parameter           | Type    | Required | Default | Min | Max | Allowed Values | Description                                                                   |
| ------------------- | ------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------- |
| `texture`           | file    | Yes      | -       | -   | -   | -              | Image to convert                                                              |
| `raised`            | number  | No       | `0.5`   | 0   | 1   | -              | How raised is the surface? 0 is flat like water, 1 is like a very rough rock  |
| `shiny`             | number  | No       | `0.5`   | 0   | 1   | -              | How shiny is the surface? 0 is like a matte surface, 1 is like a diamond      |
| `polished`          | number  | No       | `0.5`   | 0   | 1   | -              | How polished is the surface? 0 is like a rough surface, 1 is like a mirror    |
| `angular`           | number  | No       | `0.5`   | 0   | 1   | -              | How angular is the surface? 0 is like a sphere, 1 is like a mechanical object |
| `invert`            | boolean | No       | `false` | -   | -   | -              | Invert the relief                                                             |
| `defaultParameters` | boolean | No       | `false` | -   | -   | -              | If true, use the default parameters                                           |

## Sharpen

**Model ID:** `model_scenario-postprocessing-sharpen`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-sharpen/markdown>

| Parameter              | Type   | Required | Default | Min | Max | Allowed Values          | Description                        |
| ---------------------- | ------ | -------- | ------- | --- | --- | ----------------------- | ---------------------------------- |
| `image`                | file   | Yes      | -       | -   | -   | -                       | Input image                        |
| `sharpenMode`          | string | No       | `basic` | -   | -   | `basic`, `smart`, `cas` | Type of sharpening to apply.       |
| `preserveEdges`        | number | No       | `0.75`  | 0   | 1   | -                       | Edge preservation factor.          |
| `sharpenRadius`        | number | No       | `1`     | 1   | 15  | -                       | Sharpen radius (for basic mode).   |
| `sharpenAlpha`         | number | No       | `1`     | 0.1 | 5   | -                       | Sharpen strength (for basic mode). |
| `smartSharpenStrength` | number | No       | `5`     | 0   | 25  | -                       | Smart sharpen strength.            |
| `smartSharpenRatio`    | number | No       | `0.5`   | 0   | 1   | -                       | Smart sharpen blend ratio.         |
| `noiseRadius`          | number | No       | `7`     | 1   | 25  | -                       | Noise radius for smart sharpen.    |
| `casAmount`            | number | No       | `0.8`   | 0   | 1   | -                       | CAS sharpening amount.             |

## Solarize

**Model ID:** `model_scenario-postprocessing-solarize`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-solarize/markdown>

| Parameter           | Type   | Required | Default | Min | Max | Allowed Values | Description         |
| ------------------- | ------ | -------- | ------- | --- | --- | -------------- | ------------------- |
| `image`             | file   | Yes      | -       | -   | -   | -              | Input image         |
| `solarizeThreshold` | number | No       | `0.5`   | 0   | 1   | -              | Solarize threshold. |

## Tint

**Model ID:** `model_scenario-postprocessing-tint`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-tint/markdown>

| Parameter      | Type   | Required | Default | Min | Max | Allowed Values                                                                                                                                                                      | Description      |
| -------------- | ------ | -------- | ------- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `image`        | file   | Yes      | -       | -   | -   | -                                                                                                                                                                                   | Input image      |
| `tintMode`     | string | No       | `sepia` | -   | -   | `sepia`, `red`, `green`, `blue`, `cyan`, `magenta`, `yellow`, `purple`, `orange`, `warm`, `cool`, `lime`, `navy`, `vintage`, `rose`, `teal`, `maroon`, `peach`, `lavender`, `olive` | Tint color mode. |
| `tintStrength` | number | No       | `1`     | 0.1 | 1   | -                                                                                                                                                                                   | Tint strength.   |

## Vignette

**Model ID:** `model_scenario-postprocessing-vignette`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_scenario-postprocessing-vignette/markdown>

| Parameter          | Type   | Required | Default | Min | Max | Allowed Values | Description        |
| ------------------ | ------ | -------- | ------- | --- | --- | -------------- | ------------------ |
| `image`            | file   | Yes      | -       | -   | -   | -              | Input image        |
| `vignetteStrength` | number | No       | `0.5`   | 0   | 1   | -              | Vignette strength. |
