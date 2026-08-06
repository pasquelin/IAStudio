---
title: Academia | Scenario Docs
---

> This page is auto-generated from model configurations. Last updated: 2026-07-29.

This reference lists all available **Academia** background removal models and their parameters. Use these parameter names when calling the [Generation API](/api/postgeneratecustom/index.md).

- [851 Labs Background Remover](#851-labs-background-remover)

---

## 851 Labs Background Remover

Remove backgrounds from images using the transparent-background package. Fast, open-source background removal powered by InSPyReNet.

**Model ID:** `model_851-labs-background-remover`

**Capabilities:** `img2img`

**LLM Markdown:** <https://app.scenario.com/api/models/model_851-labs-background-remover/markdown>

| Parameter        | Type    | Required | Default | Min | Max | Allowed Values                                     | Description                                                                                                                                                                                |
| ---------------- | ------- | -------- | ------- | --- | --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `image`          | file    | Yes      | -       | -   | -   | -                                                  | The image you want to remove the background from.                                                                                                                                          |
| `threshold`      | number  | No       | `0`     | 0   | 1   | -                                                  | Controls how sharply the subject is cut out. At 0, edges are soft and natural (good for hair or fur); higher values give a harder, cleaner-edged cutout.                                   |
| `reverse`        | boolean | No       | `false` | -   | -   | -                                                  | Removes the subject instead of the background, keeping the background only.                                                                                                                |
| `backgroundType` | string  | No       | `rgba`  | -   | -   | `rgba`, `map`, `green`, `white`, `blur`, `overlay` | What to put behind the subject: Transparent (see-through), a solid color like white or green screen, a blurred version of the original, or an overlay. Map returns the cutout mask itself. |
