---
title: Beatoven | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-04-09.

This reference lists all available **Beatoven** audio generation models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [Beatoven Music Generation](#beatoven-music-generation)
- [Beatoven Sound Effect](#beatoven-sound-effect)

---

## Beatoven Music Generation

Generate royalty-free instrumental music from electronic, hip hop, and indie rock to cinematic and classical genres. Perfect for games, films, social content, podcasts, and more.

**Model ID:** `model_beatoven-music-generation`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_beatoven-music-generation/markdown>

| Parameter        | Type   | Required | Default | Min | Max        | Allowed Values | Description                                                                       |
| ---------------- | ------ | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -          | -              | Describe the music you want to generate                                           |
| `negativePrompt` | string | No       | -       | -   | -          | -              | Describe what you want to avoid in the music (instruments, styles, moods).        |
| `duration`       | number | No       | `90`    | 5   | 150        | -              | Length of the generated music in seconds                                          |
| `refinement`     | number | No       | `100`   | 10  | 200        | -              | Refinement level - Higher values may improve quality but take longer              |
| `creativity`     | number | No       | `16`    | 1   | 20         | -              | Creativity level - higher values allow more creative interpretation of the prompt |
| `seed`           | number | No       | -       | 0   | 2147483647 | -              | Use a seed for reproducible results. Leave blank to use a random seed.            |

## Beatoven Sound Effect

Create professional-grade sound effects from animal and vehicle to nature, sci-fi, and otherworldly sounds. Perfect for films, games, and digital content.

**Model ID:** `model_beatoven-sound-effect`

**Capabilities:** `txt2audio`

**LLM Markdown:** <https://app.scenario.com/api/models/model_beatoven-sound-effect/markdown>

| Parameter        | Type   | Required | Default | Min | Max        | Allowed Values | Description                                                                       |
| ---------------- | ------ | -------- | ------- | --- | ---------- | -------------- | --------------------------------------------------------------------------------- |
| `prompt`         | string | Yes      | -       | -   | -          | -              | Describe the sound effect you want to generate                                    |
| `negativePrompt` | string | No       | -       | -   | -          | -              | Describe the types of sounds you don’t want to generate in the output             |
| `duration`       | number | No       | `7`     | 1   | 35         | -              | Length of the generated sound effect in seconds                                   |
| `refinement`     | number | No       | `40`    | 10  | 200        | -              | Refinement level - Higher values may improve quality but take longer              |
| `creativity`     | number | No       | `16`    | 1   | 20         | -              | Creativity level - higher values allow more creative interpretation of the prompt |
| `seed`           | number | No       | -       | 0   | 2147483647 | -              | Use a seed for reproducible results. Leave blank to use a random seed.            |
