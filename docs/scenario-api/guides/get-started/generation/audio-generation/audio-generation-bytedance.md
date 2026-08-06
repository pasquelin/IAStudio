---
title: Bytedance | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Bytedance** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Seed Audio 1.0](#seed-audio-10)
- [Seed Audio 1.0 Multilingual](#seed-audio-10-multilingual)

---

## Seed Audio 1.0

BytePlus Seed Audio text-to-speech with audio or image references, and fine-grained speech controls.

**Model ID:** `model_byteplus-seed-audio-1-0`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_byteplus-seed-audio-1-0/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                                      | Description                                                                                                                                                                                    |
| ----------------- | ----------- | -------- | ------- | --- | --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `textPrompt`      | string      | Yes      | -       | -   | -   | -                                                   | The text you want spoken aloud, up to 2048 characters. When using audio references, point to each one in your text with @Audio1, @Audio2, or @Audio3.                                          |
| `audioReferences` | file\_array | No       | “       | -   | -   | -                                                   | Up to 3 audio samples to base the voice on. Refer to each one in your text as @Audio1, @Audio2, or @Audio3. Can’t be combined with image reference. Max duration: 30 seconds, Max size: 10 MB. |
| `imageReference`  | file        | No       | -       | -   | -   | -                                                   | A reference image to derive the voice from (JPEG, PNG, or WebP, up to 10MB). Can’t be combined with audio references. Max 10 MB.                                                               |
| `sampleRate`      | number      | No       | `44100` | -   | -   | `8000`, `16000`, `24000`, `32000`, `44100`, `48000` | The audio quality, in samples per second. Higher values sound clearer; 24 kHz is a good default for speech.                                                                                    |
| `speechRate`      | number      | No       | `0`     | -50 | 100 | -                                                   | How fast the voice speaks. 0 is normal speed; higher is faster (100 is double speed), lower is slower (-50 is half speed).                                                                     |
| `loudnessRate`    | number      | No       | `0`     | -50 | 100 | -                                                   | How loud the voice is. 0 is normal; higher is louder (100 is double volume), lower is quieter (-50 is half volume).                                                                            |
| `pitchRate`       | number      | No       | `0`     | -12 | 12  | -                                                   | How high or low the voice sounds, in semitones (-12 to 12). Positive values raise the pitch; negative values lower it.                                                                         |

## Seed Audio 1.0 Multilingual

BytePlus Seed Audio multilingual text-to-speech with 20-language support, audio or image references, subtitles, and fine-grained speech controls.

**Model ID:** `model_byteplus-seed-audio-1-0-multilingual`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_byteplus-seed-audio-1-0-multilingual/markdown>

| Parameter         | Type        | Required | Default | Min | Max | Allowed Values                                      | Description                                                                                                                                                                                    |
| ----------------- | ----------- | -------- | ------- | --- | --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `textPrompt`      | string      | Yes      | -       | -   | -   | -                                                   | The text you want spoken aloud, up to 3000 characters. Language is auto-detected. When using audio references, point to each one in your text with @Audio1, @Audio2, or @Audio3.               |
| `audioReferences` | file\_array | No       | “       | -   | -   | -                                                   | Up to 3 audio samples to base the voice on. Refer to each one in your text as @Audio1, @Audio2, or @Audio3. Can’t be combined with image reference. Max duration: 30 seconds, Max size: 10 MB. |
| `imageReference`  | file        | No       | -       | -   | -   | -                                                   | A reference image to derive the voice from. Can’t be combined with audio references. Max 10 MB.                                                                                                |
| `sampleRate`      | number      | No       | `44100` | -   | -   | `8000`, `16000`, `24000`, `32000`, `44100`, `48000` | The audio quality, in samples per second.                                                                                                                                                      |
| `speechRate`      | number      | No       | `0`     | -50 | 100 | -                                                   | How fast the voice speaks. 0 is normal speed; higher is faster (100 is double speed), lower is slower (-50 is half speed).                                                                     |
| `loudnessRate`    | number      | No       | `0`     | -50 | 100 | -                                                   | How loud the voice is. 0 is normal; higher is louder (100 is double volume), lower is quieter (-50 is half volume).                                                                            |
| `pitchRate`       | number      | No       | `0`     | -12 | 12  | -                                                   | How high or low the voice sounds, in semitones (-12 to 12). Positive values raise the pitch; negative values lower it.                                                                         |
| `enableSubtitle`  | boolean     | No       | `true`  | -   | -   | -                                                   | When on, the response also includes timing data (per word and per line) that can be used to build subtitles.                                                                                   |
