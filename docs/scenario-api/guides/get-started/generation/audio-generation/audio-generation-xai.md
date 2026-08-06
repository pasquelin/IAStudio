---
title: xAI | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **xAI** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [xAI Grok TTS](#xai-grok-tts)

---

## xAI Grok TTS

Convert text to natural-sounding speech using xAI’s Grok TTS with multiple voices, codecs, and multilingual support including speech tags like \[pause] and \<whisper>.

**Model ID:** `model_xai-grok-tts`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_xai-grok-tts/markdown>

| Parameter    | Type   | Required | Default | Min | Max | Allowed Values                                                                                         | Description                                                                                              |
| ------------ | ------ | -------- | ------- | --- | --- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `text`       | string | Yes      | -       | -   | -   | -                                                                                                      | Text to synthesize. Max 15,000 characters. Supports speech tags like \[pause], \<whisper>text\</whisper> |
| `voice`      | string | No       | `eve`   | -   | -   | `ara`, `eve`, `leo`, `rex`, `sal`                                                                      | Voice to use for synthesis                                                                               |
| `language`   | string | No       | `auto`  | -   | -   | `auto`, `ar`, `bn`, `zh`, `en`, `fr`, `de`, `hi`, `id`, `it`, `ja`, `ko`, `pt`, `ru`, `es`, `tr`, `vi` | Language code (BCP-47) or ‘auto’ for automatic detection                                                 |
| `sampleRate` | number | No       | `44100` | -   | -   | `8000`, `16000`, `22050`, `24000`, `44100`, `48000`                                                    | Audio sample rate in Hz                                                                                  |
