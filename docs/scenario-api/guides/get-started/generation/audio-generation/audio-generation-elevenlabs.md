---
title: ElevenLabs | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **ElevenLabs** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [ElevenLabs Multilingual v2](#elevenlabs-multilingual-v2)
- [ElevenLabs Music Advanced v2](#elevenlabs-music-advanced-v2)
- [ElevenLabs Music v2](#elevenlabs-music-v2)
- [ElevenLabs Sound Effects v2](#elevenlabs-sound-effects-v2)
- [ElevenLabs Speech to Speech](#elevenlabs-speech-to-speech)
- [ElevenLabs Turbo v2.5](#elevenlabs-turbo-v25)
- [ElevenLabs v3](#elevenlabs-v3)
- [ElevenLabs Voice Changer](#elevenlabs-voice-changer)
- [ElevenLabs Voice Isolator](#elevenlabs-voice-isolator)

---

## ElevenLabs Multilingual v2

Life-like, emotionally rich text-to-speech model supporting 29 languages.

**Model ID:** `model_elevenlabs-multilingual-v2`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-multilingual-v2/markdown>

| Parameter           | Type   | Required | Default         | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                    | Description                                                                                                              |
| ------------------- | ------ | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `text`              | string | Yes      | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | The text to convert to speech                                                                                            |
| `voiceId`           | model  | No       | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | Your cloned ElevenLabs voice model                                                                                       |
| `publicVoice`       | string | No       | `Adam`          | -   | -   | `Adam`, `Alice`, `Bella`, `Bill`, `Brian`, `Callum`, `Charlie`, `Chris`, `Daniel`, `Eric`, `George`, `Harry`, `Jessica`, `Laura`, `Liam`, `Lily`, `Matilda`, `River`, `Roger`, `Sarah`, `Will`                                                                                                    | Select a pre-built ElevenLabs public voice. Ignored if the input Voice is set.                                           |
| `stability`         | number | No       | `0.5`           | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | Voice stability                                                                                                          |
| `similarityBoost`   | number | No       | `0.5`           | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | Similarity boost                                                                                                         |
| `styleExaggeration` | number | No       | `0`             | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | Style exaggeration                                                                                                       |
| `speed`             | number | No       | `1`             | 0.7 | 1.2 | -                                                                                                                                                                                                                                                                                                 | Speech speed (0.7-1.2). Values below 1.0 slow down the speech, above 1.0 speed it up. Extreme values may affect quality. |
| `languageCode`      | string | No       | -               | -   | -   | “, `en`, `ca`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ru`, `ar`, `hi`, `bn`, `pa`, `ta`, `te`, `mr`, `ur`, `fa`, `tr`, `nl`, `sv`, `da`, `no`, `fi`, `el`, `ro`, `hu`, `cs`, `sk`, `sl`, `pt`, `id`, `th`, `vi`, `ms`, `tl`, `yo`, `ig`, `ha`, `am`, `az`, `be`, `bg`, `hr`                   | Language code (ISO 639-1) used to enforce a language for the model.                                                      |
| `outputFormat`      | string | No       | `mp3_44100_128` | -   | -   | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`, `wav_8000`, `wav_16000`, `wav_22050`, `wav_24000`, `wav_32000`, `wav_44100`, `wav_48000`, `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192` | Output audio format.                                                                                                     |
| `seed`              | number | No       | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | Seed for deterministic output                                                                                            |

## ElevenLabs Music Advanced v2

Advanced AI music generation with chunk-based composition plans and section-by-section control.

**Model ID:** `model_elevenlabs-music-advanced-v2`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-music-advanced-v2/markdown>

| Parameter      | Type          | Required | Default         | Min | Max | Allowed Values                                                                                                                                                                                          | Description                                                                                                                                          |
| -------------- | ------------- | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sections`     | inputs\_array | Yes      | -               | -   | -   | -                                                                                                                                                                                                       | Ordered song sections defining the composition structure.                                                                                            |
| `outputFormat` | string        | No       | `mp3_44100_128` | -   | -   | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`, `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192` | The format and quality of the audio you get back. Higher numbers mean better quality and larger files.                                               |
| `seed`         | number        | No       | -               | -   | -   | -                                                                                                                                                                                                       | A number that makes results repeatable. Reusing the same seed and settings produces the same music; leave it empty for a different result each time. |

## ElevenLabs Music v2

Next-generation AI music generation from text descriptions.

**Model ID:** `model_elevenlabs-music-v2`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-music-v2/markdown>

| Parameter           | Type    | Required | Default         | Min | Max | Allowed Values                                                                                                                                                                                          | Description                                                                                                                                                   |
| ------------------- | ------- | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`            | string  | Yes      | -               | -   | -   | -                                                                                                                                                                                                       | Describe the music you want — mood, genre, instruments, tempo, and any other direction. For example, “upbeat lo-fi hip-hop with mellow piano and soft drums.” |
| `durationSeconds`   | number  | No       | `30`            | 3   | 180 | -                                                                                                                                                                                                       | How long the music lasts, in seconds (3–180). Longer tracks cost more.                                                                                        |
| `forceInstrumental` | boolean | No       | `false`         | -   | -   | -                                                                                                                                                                                                       | Generates music without any vocals.                                                                                                                           |
| `outputFormat`      | string  | No       | `mp3_44100_128` | -   | -   | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`, `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192` | The format and quality of the audio you get back. Higher numbers mean better quality and larger files.                                                        |
| `seed`              | number  | No       | -               | -   | -   | -                                                                                                                                                                                                       | A number that makes results repeatable. Reusing the same seed and settings produces the same music; leave it empty for a different result each time.          |

## ElevenLabs Sound Effects v2

Professional sound effects generation for audio production and content creation.

**Model ID:** `model_elevenlabs-sound-effects-v2`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-sound-effects-v2/markdown>

| Parameter         | Type    | Required | Default         | Min | Max | Allowed Values                                                                                                                                                                                          | Description                                                                                |
| ----------------- | ------- | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `text`            | string  | Yes      | -               | -   | -   | -                                                                                                                                                                                                       | A textual description of the sound effect to generate.                                     |
| `durationSeconds` | number  | No       | `5`             | 0.5 | 30  | -                                                                                                                                                                                                       | Duration in seconds (0.5-30). If not set, optimal duration will be determined from prompt. |
| `promptInfluence` | number  | No       | `0.3`           | 0   | 1   | -                                                                                                                                                                                                       | How closely to follow the sound description. Higher values mean less variation.            |
| `loop`            | boolean | No       | `false`         | -   | -   | -                                                                                                                                                                                                       | Whether to loop the sound effect.                                                          |
| `outputFormat`    | string  | No       | `mp3_44100_128` | -   | -   | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`, `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192` | Output audio format.                                                                       |

## ElevenLabs Speech to Speech

Transform speech audio into a different voice while preserving natural cadence and emotion.

**Model ID:** `model_elevenlabs-sts`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-sts/markdown>

| Parameter               | Type    | Required | Default         | Min | Max | Allowed Values                                                                                                                                                                                          | Description                                                                    |
| ----------------------- | ------- | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `audio`                 | file    | Yes      | -               | -   | -   | -                                                                                                                                                                                                       | The audio file to convert                                                      |
| `voiceId`               | model   | No       | -               | -   | -   | -                                                                                                                                                                                                       | Your cloned ElevenLabs voice model                                             |
| `publicVoice`           | string  | No       | `Adam`          | -   | -   | `Adam`, `Alice`, `Bella`, `Bill`, `Brian`, `Callum`, `Charlie`, `Chris`, `Daniel`, `Eric`, `George`, `Harry`, `Jessica`, `Laura`, `Liam`, `Lily`, `Matilda`, `River`, `Roger`, `Sarah`, `Will`          | Select a pre-built ElevenLabs public voice. Ignored if the input Voice is set. |
| `removeBackgroundNoise` | boolean | No       | `false`         | -   | -   | -                                                                                                                                                                                                       | Whether to remove background noise from the input audio before converting.     |
| `outputFormat`          | string  | No       | `mp3_44100_128` | -   | -   | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`, `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192` | Output audio format.                                                           |
| `seed`                  | number  | No       | -               | -   | -   | -                                                                                                                                                                                                       | Seed for deterministic output                                                  |

## ElevenLabs Turbo v2.5

High-quality, low-latency text-to-speech model in multiple languages.

**Model ID:** `model_elevenlabs-turbo-v2-5`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-turbo-v2-5/markdown>

| Parameter           | Type   | Required | Default         | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                    | Description                                                                                                              |
| ------------------- | ------ | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `text`              | string | Yes      | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | The text to convert to speech                                                                                            |
| `voiceId`           | model  | No       | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | Your cloned ElevenLabs voice model                                                                                       |
| `publicVoice`       | string | No       | `Adam`          | -   | -   | `Adam`, `Alice`, `Bella`, `Bill`, `Brian`, `Callum`, `Charlie`, `Chris`, `Daniel`, `Eric`, `George`, `Harry`, `Jessica`, `Laura`, `Liam`, `Lily`, `Matilda`, `River`, `Roger`, `Sarah`, `Will`                                                                                                    | Select a pre-built ElevenLabs public voice. Ignored if the input Voice is set.                                           |
| `stability`         | number | No       | `0.5`           | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | Voice stability                                                                                                          |
| `similarityBoost`   | number | No       | `0.5`           | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | Similarity boost                                                                                                         |
| `styleExaggeration` | number | No       | `0`             | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | Style exaggeration                                                                                                       |
| `speed`             | number | No       | `1`             | 0.7 | 1.2 | -                                                                                                                                                                                                                                                                                                 | Speech speed (0.7-1.2). Values below 1.0 slow down the speech, above 1.0 speed it up. Extreme values may affect quality. |
| `languageCode`      | string | No       | -               | -   | -   | “, `en`, `ca`, `es`, `fr`, `de`, `it`, `ja`, `ko`, `zh`, `ru`, `ar`, `hi`, `bn`, `pa`, `ta`, `te`, `mr`, `ur`, `fa`, `tr`, `nl`, `sv`, `da`, `no`, `fi`, `el`, `ro`, `hu`, `cs`, `sk`, `sl`, `pt`, `id`, `th`, `vi`, `ms`, `tl`, `yo`, `ig`, `ha`, `am`, `az`, `be`, `bg`, `hr`                   | Language code (ISO 639-1) used to enforce a language for the model.                                                      |
| `outputFormat`      | string | No       | `mp3_44100_128` | -   | -   | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`, `wav_8000`, `wav_16000`, `wav_22050`, `wav_24000`, `wav_32000`, `wav_44100`, `wav_48000`, `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192` | Output audio format.                                                                                                     |
| `seed`              | number | No       | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | Seed for deterministic output                                                                                            |

## ElevenLabs v3

Next-generation text-to-speech model with advanced voice synthesis and enhanced naturalness.

**Model ID:** `model_elevenlabs-tts-v3`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-tts-v3/markdown>

| Parameter           | Type   | Required | Default         | Min | Max | Allowed Values                                                                                                                                                                                                                                                                                    | Description                                                                                                           |
| ------------------- | ------ | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `text`              | string | Yes      | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | The words that will be spoken aloud in the generated audio.                                                           |
| `voiceId`           | model  | No       | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | A custom voice you cloned or trained to speak the text.                                                               |
| `publicVoice`       | string | No       | `Adam`          | -   | -   | `Adam`, `Alice`, `Bella`, `Bill`, `Brian`, `Callum`, `Charlie`, `Chris`, `Daniel`, `Eric`, `George`, `Harry`, `Jessica`, `Laura`, `Liam`, `Lily`, `Matilda`, `River`, `Roger`, `Sarah`, `Will`                                                                                                    | A ready-made ElevenLabs voice, used only when no custom Voice is set.                                                 |
| `stability`         | number | No       | `0.5`           | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | Higher values make the voice steadier and more consistent; lower values make it more varied and expressive.           |
| `similarityBoost`   | number | No       | `0.75`          | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | How closely the output matches the original voice; higher values track it more tightly but can amplify artifacts.     |
| `styleExaggeration` | number | No       | `0`             | 0   | 1   | -                                                                                                                                                                                                                                                                                                 | Amplifies the speaker’s style and emotion; higher values are more expressive but can reduce stability.                |
| `speed`             | number | No       | `1`             | 0.7 | 1.2 | -                                                                                                                                                                                                                                                                                                 | How fast the speech is delivered; below 1.0 slows it down, above 1.0 speeds it up. Extreme values may affect quality. |
| `outputFormat`      | string | No       | `mp3_44100_128` | -   | -   | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`, `wav_8000`, `wav_16000`, `wav_22050`, `wav_24000`, `wav_32000`, `wav_44100`, `wav_48000`, `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192` | File type, sample rate, and bitrate of the generated audio.                                                           |
| `seed`              | number | No       | -               | -   | -   | -                                                                                                                                                                                                                                                                                                 | Fixes randomness so identical inputs produce the same audio every time.                                               |

## ElevenLabs Voice Changer

Transform speech audio into a different voice while preserving emotion, timing, and delivery.

**Model ID:** `model_elevenlabs-voice-changer`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-voice-changer/markdown>

| Parameter               | Type    | Required | Default         | Min | Max | Allowed Values                                                                                                                                                                                          | Description                                                                                                                                                                       |
| ----------------------- | ------- | -------- | --------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio`                 | file    | Yes      | -               | -   | -   | -                                                                                                                                                                                                       | The audio file you want to transform. The words, timing, and emotion are kept. Only the voice itself changes. Audio file should be less than 5 minutes long.                      |
| `voiceId`               | model   | No       | -               | -   | -   | -                                                                                                                                                                                                       | The voice you want the recording to sound like. Pick one of your own cloned ElevenLabs voices                                                                                     |
| `publicVoice`           | string  | No       | `Adam`          | -   | -   | `Adam`, `Alice`, `Bella`, `Bill`, `Brian`, `Callum`, `Charlie`, `Chris`, `Daniel`, `Eric`, `George`, `Harry`, `Jessica`, `Laura`, `Liam`, `Lily`, `Matilda`, `River`, `Roger`, `Sarah`, `Will`          | One of ElevenLabs’ ready-made voices to use as the target. Ignored if you’ve selected your own Voice above. Ignored if the input Voice is set.                                    |
| `fileFormat`            | string  | No       | `other`         | -   | -   | `pcm_s16le_16`, `other`                                                                                                                                                                                 | The format of the file you upload. Choose ‘Encoded’ for common files like MP3 or WAV. ‘PCM’ is a raw audio format that’s slightly faster to process if your file already uses it. |
| `removeBackgroundNoise` | boolean | No       | `false`         | -   | -   | -                                                                                                                                                                                                       | Cleans up background noise in your recording before converting it. Useful for noisy or low-quality audio.                                                                         |
| `stability`             | number  | No       | -               | 0   | 1   | -                                                                                                                                                                                                       | Controls how steady the voice sounds. Higher values keep it calm and consistent; lower values make it more varied and expressive. Leave empty to use the voice’s own setting.     |
| `similarityBoost`       | number  | No       | -               | 0   | 1   | -                                                                                                                                                                                                       | How closely the result should match the target voice. Higher values stick to it more tightly. Leave empty to use the voice’s own setting.                                         |
| `styleExaggeration`     | number  | No       | -               | 0   | 1   | -                                                                                                                                                                                                       | How much to amplify the target voice’s style and emotion. Higher values are more expressive but can make the voice less steady. Leave empty to use the voice’s own setting.       |
| `useSpeakerBoost`       | boolean | No       | -               | -   | -   | -                                                                                                                                                                                                       | Makes the result sound more like the chosen voice, at the cost of slightly slower processing. Leave empty to use the voice’s own setting.                                         |
| `outputFormat`          | string  | No       | `mp3_44100_128` | -   | -   | `mp3_22050_32`, `mp3_24000_48`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`, `opus_48000_32`, `opus_48000_64`, `opus_48000_96`, `opus_48000_128`, `opus_48000_192` | The format and quality of the audio you get back. Higher numbers mean better quality and larger files.                                                                            |
| `seed`                  | number  | No       | -               | -   | -   | -                                                                                                                                                                                                       | An optional number that locks in the result. Reusing the same seed with the same settings produces the same audio every time; leave it empty for a fresh result on each run.      |

## ElevenLabs Voice Isolator

Remove background noise from audio and isolate the voice.

**Model ID:** `model_elevenlabs-voice-isolator`

**Capabilities:** `audio2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_elevenlabs-voice-isolator/markdown>

| Parameter    | Type   | Required | Default | Min | Max | Allowed Values          | Description                                                                                                                                                                       |
| ------------ | ------ | -------- | ------- | --- | --- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio`      | file   | Yes      | -       | -   | -   | -                       | The recording you want to clean up. The voice is kept and isolated, while background noise, music, and other sounds are removed.                                                  |
| `fileFormat` | string | No       | `other` | -   | -   | `pcm_s16le_16`, `other` | The format of the file you upload. Choose ‘Encoded’ for common files like MP3 or WAV. ‘PCM’ is a raw audio format that’s slightly faster to process if your file already uses it. |
