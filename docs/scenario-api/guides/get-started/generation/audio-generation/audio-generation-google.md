---
title: Google | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-16.

This reference lists all available **Google** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Gemini 2.5 Flash TTS](#gemini-25-flash-tts)
- [Gemini 2.5 Pro TTS](#gemini-25-pro-tts)
- [Gemini 3.1 Flash TTS](#gemini-31-flash-tts)
- [Google Lyria 2](#google-lyria-2)
- [Google Lyria 3 Clip](#google-lyria-3-clip)
- [Google Lyria 3 Pro](#google-lyria-3-pro)

---

## Gemini 2.5 Flash TTS

Convert text to natural-sounding speech using Google’s Gemini 2.5 Flash model with multiple voice presets.

**Model ID:** `model_google-gemini-2-5-flash-tts`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-gemini-2-5-flash-tts/markdown>

| Parameter  | Type   | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                                                       | Description                                                    |
| ---------- | ------ | -------- | ------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `text`     | string | Yes      | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                    | Text to convert to speech                                      |
| `voice`    | string | No       | `Puck`  | -   | -   | `Achernar`, `Achird`, `Algenib`, `Algieba`, `Alnilam`, `Aoede`, `Autonoe`, `Callirrhoe`, `Charon`, `Despina`, `Enceladus`, `Erinome`, `Fenrir`, `Gacrux`, `Iapetus`, `Kore`, `Laomedeia`, `Leda`, `Orus`, `Pulcherrima`, `Puck`, `Rasalgethi`, `Sadachbia`, `Sadaltager`, `Schedar`, `Sulafat`, `Umbriel`, `Vindemiatrix`, `Zephyr`, `Zubenelgenubi` | Voice preset to use for speech synthesis                       |
| `language` | string | No       | `en-US` | -   | -   | `ar-EG`, `bn-BD`, `de-DE`, `en-IN`, `en-US`, `es-US`, `fr-FR`, `hi-IN`, `id-ID`, `it-IT`, `ja-JP`, `ko-KR`, `mr-IN`, `nl-NL`, `pl-PL`, `pt-BR`, `ro-RO`, `ru-RU`, `ta-IN`, `te-IN`, `th-TH`, `tr-TR`, `uk-UA`, `vi-VN`                                                                                                                               | Language for speech synthesis (auto-detected if not specified) |

## Gemini 2.5 Pro TTS

Convert text to natural-sounding speech using Google’s Gemini 2.5 Pro model with multiple voice presets.

**Model ID:** `model_google-gemini-2-5-pro-tts`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-gemini-2-5-pro-tts/markdown>

| Parameter  | Type   | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                                                       | Description                                                    |
| ---------- | ------ | -------- | ------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `text`     | string | Yes      | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                    | Text to convert to speech                                      |
| `voice`    | string | No       | `Puck`  | -   | -   | `Achernar`, `Achird`, `Algenib`, `Algieba`, `Alnilam`, `Aoede`, `Autonoe`, `Callirrhoe`, `Charon`, `Despina`, `Enceladus`, `Erinome`, `Fenrir`, `Gacrux`, `Iapetus`, `Kore`, `Laomedeia`, `Leda`, `Orus`, `Pulcherrima`, `Puck`, `Rasalgethi`, `Sadachbia`, `Sadaltager`, `Schedar`, `Sulafat`, `Umbriel`, `Vindemiatrix`, `Zephyr`, `Zubenelgenubi` | Voice preset to use for speech synthesis                       |
| `language` | string | No       | `en-US` | -   | -   | `ar-EG`, `bn-BD`, `de-DE`, `en-IN`, `en-US`, `es-US`, `fr-FR`, `hi-IN`, `id-ID`, `it-IT`, `ja-JP`, `ko-KR`, `mr-IN`, `nl-NL`, `pl-PL`, `pt-BR`, `ro-RO`, `ru-RU`, `ta-IN`, `te-IN`, `th-TH`, `tr-TR`, `uk-UA`, `vi-VN`                                                                                                                               | Language for speech synthesis (auto-detected if not specified) |

## Gemini 3.1 Flash TTS

Convert text to natural-sounding speech using Google’s Gemini 3.1 Flash model with multiple voice presets.

**Model ID:** `model_google-gemini-3-1-flash-tts`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_google-gemini-3-1-flash-tts/markdown>

| Parameter            | Type          | Required | Default | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                                                                       | Description                                                                                                                                                                                                          |
| -------------------- | ------------- | -------- | ------- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`               | string        | Yes      | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                    | Text to convert to speech                                                                                                                                                                                            |
| `voice`              | string        | No       | `Puck`  | -   | -   | `Achernar`, `Achird`, `Algenib`, `Algieba`, `Alnilam`, `Aoede`, `Autonoe`, `Callirrhoe`, `Charon`, `Despina`, `Enceladus`, `Erinome`, `Fenrir`, `Gacrux`, `Iapetus`, `Kore`, `Laomedeia`, `Leda`, `Orus`, `Pulcherrima`, `Puck`, `Rasalgethi`, `Sadachbia`, `Sadaltager`, `Schedar`, `Sulafat`, `Umbriel`, `Vindemiatrix`, `Zephyr`, `Zubenelgenubi` | Voice preset to use for speech synthesis. Ignore if you are using multi-speaker config.                                                                                                                              |
| `multiSpeakerConfig` | inputs\_array | No       | -       | -   | -   | -                                                                                                                                                                                                                                                                                                                                                    | Map names in your script (e.g. Alice: … Bob: …) to voices. Up to 2 speakers. Leave empty to use the single Voice option above. Omit empty name; each row must set Speaker name (non-empty) when using multi-speaker. |
| `language`           | string        | No       | `en-US` | -   | -   | `ar-EG`, `bn-BD`, `de-DE`, `en-IN`, `en-US`, `es-US`, `fr-FR`, `hi-IN`, `id-ID`, `it-IT`, `ja-JP`, `ko-KR`, `mr-IN`, `nl-NL`, `pl-PL`, `pt-BR`, `ro-RO`, `ru-RU`, `ta-IN`, `te-IN`, `th-TH`, `tr-TR`, `uk-UA`, `vi-VN`                                                                                                                               | Language for speech synthesis (auto-detected if not specified)                                                                                                                                                       |

## Google Lyria 2

**Model ID:** `model_lyria-2`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_lyria-2/markdown>

| Parameter        | Type   | Required | Default | Min | Max | Allowed Values | Description                                                            |
| ---------------- | ------ | -------- | ------- | --- | --- | -------------- | ---------------------------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -   | -              | Text prompt for audio generation                                       |
| `negativePrompt` | string | No       | -       | -   | -   | -              | Description of what to exclude from the generated audio                |
| `seed`           | number | No       | -       | -   | -   | -              | Use a seed for reproducible results. Leave blank to use a random seed. |

## Google Lyria 3 Clip

Fast 30-second music clips with vocals and optional image-to-music. MP3 output.

**Model ID:** `model_lyria-3-clip`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_lyria-3-clip/markdown>

| Parameter | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                             |
| --------- | ----------- | -------- | ------- | --- | --- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `prompt`  | string      | No       | -       | -   | -   | -              | Describe the music: genre, instruments, tempo (BPM), key, mood, and structure tags like \[Verse], \[Chorus], \[Bridge]. |
| `images`  | file\_array | No       | -       | -   | -   | -              | Optional reference images (up to 10).                                                                                   |

## Google Lyria 3 Pro

Full-length song generation (up to \~2 minutes) with structure, vocals, and optional image-to-music. MP3 or WAV output.

**Model ID:** `model_lyria-3-pro`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_lyria-3-pro/markdown>

| Parameter | Type        | Required | Default | Min | Max | Allowed Values | Description                                                                                                                       |
| --------- | ----------- | -------- | ------- | --- | --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`  | string      | No       | -       | -   | -   | -              | Describe the music: genre, instruments, tempo (BPM), key, mood, duration, and structure tags like \[Verse], \[Chorus], \[Bridge]. |
| `images`  | file\_array | No       | -       | -   | -   | -              | Optional reference images (up to 10).                                                                                             |
