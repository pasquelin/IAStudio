---
title: Key Capabilities at a Glance | Scenario Docs
---

The Scenario API is a unified platform for AI-powered content creation — images, videos, 3D models, audio, and more — all accessible through a single REST API. This page gives you a quick overview of everything you can do.

## Table of Contents

- [Image Generation](#image-generation)
- [Video Generation](#video-generation)
- [3D Model Generation](#3d-model-generation)
- [Audio Generation](#audio-generation)
- [Image Editing](#image-editing)
- [Custom Model Training](#custom-model-training)
- [Asset Tools](#asset-tools)
- [Asset Management](#asset-management)
- [How It All Works](#how-it-all-works)
- [What’s Next?](#whats-next)

---

## Image Generation

Generate images from text prompts using state-of-the-art models from Google, OpenAI, Meta, xAI, Ideogram, Recraft, BFL, and more.

- **Custom-trained models**: Use your own trained LoRA to generate images in a specific style, character, or concept (see [Custom Model Training](#custom-model-training)).
- **Text-to-image**: Describe what you want, get an image back.
- **Image-to-image**: Pass a reference image (by asset ID) to guide generation with a text prompt.

All image generation goes through the unified endpoint: `POST /generate/custom/{modelId}`.

Browse available models: [Image Models](/get-started/generation/third-party-model-generation/index.md)

---

## Video Generation

Create videos from text prompts, images, or existing videos using 24+ models from Google, OpenAI, Meta, Runway, Luma, Pika, Kling, MiniMax, xAI, HeyGen, and more.

- **Text-to-video**: Generate a video from a text description.
- **Image-to-video**: Animate a still image into a video.
- **Video-to-video**: Transform an existing video with new styles or edits.

Common parameters include `prompt`, `duration`, `fps`, `aspectRatio`, and `image` (asset ID for image-to-video). Each model supports different parameters — check the model’s page in the [Scenario web app](https://app.scenario.com) for details.

Browse available models: [Video Models](/get-started/generation/video-generation/index.md)

---

## 3D Model Generation

Convert images or text descriptions into 3D models using providers like Tripo AI, Meshy, Meta, Microsoft, Tencent, Deemos, and more.

- **Image-to-3D**: Upload a reference image and generate a 3D asset.
- **Text-to-3D**: Describe a 3D object and generate it from scratch.

Configurable parameters vary by model and may include inference steps, guidance scale, target face count, and paint mode.

Browse available models: [3D Models](/get-started/generation/3d-model-generation/index.md)

---

## Audio Generation

Generate music, sound effects, and speech using models from ElevenLabs, Google, Meta, MiniMax, Beatoven, xAI, and more.

- **Text-to-audio**: Generate audio from a text description or lyrics.
- **Audio-guided generation**: Pass reference audio files (song, voice, or instrumental) to guide output.

Parameters vary by model and may include `prompt`, audio file references, sample rate, and bitrate.

Browse available models: [Audio Models](/get-started/generation/audio-generation/index.md)

---

## Image Editing

Transform existing images using natural language instructions with image editing models like Google Gemini 3.1 Flash.

- **Restyle**: Change the visual style of an image (e.g., “make this minimalist” or “convert to dark mode”).
- **Modify**: Apply specific edits (e.g., “remove the text”, “change the background to a beach”).
- **Refine**: Iterate on generated results with follow-up instructions.

Image editing models use `referenceImages` (an array of asset IDs) to pass source images. See [Uploading Assets](/get-started/content/uploading-assets/index.md) for how to get asset IDs.

---

## Custom Model Training

Train your own AI models (LoRAs) to capture a specific art style, character, or concept, then generate unlimited images in that style.

- **Standard training**: Upload 5–15 example images to train a style or subject LoRA.
- **Edit training**: Upload before/after image pairs to train an instruction-following editor.
- **Multiple base models**: Train on FLUX.2 Dev, FLUX.2 Klein, Qwen Image, Z-Image, and more.

Training workflow:

1. Create a model → `POST /models`
2. Upload training images → `POST /models/{modelId}/training-images`
3. Start training → `PUT /models/{modelId}/train`
4. Poll status until `trained` → `GET /models/{modelId}`
5. Generate with your model → `POST /generate/custom/{baseModelId}` with `modelId` in the body

Learn more: [Training Custom Models](/get-started/training/training-models/index.md)

---

## Asset Tools

Scenario provides utility models for common asset processing tasks — all accessible through the same `/generate/custom/{modelId}` endpoint.

### Background Removal

Remove backgrounds from images automatically using models from Photoroom and Pixa.

Browse available models: [Background Removal Models](/get-started/generation/background-removal-models/index.md)

### Image Upscale

Enhance image resolution and quality using models from Magnific, Topaz Labs, Clarity AI, Recraft, BFL, and more.

Browse available models: [Image Upscale Models](/get-started/generation/image-upscale-models/index.md)

### Video Upscale

Enhance video resolution using models from Topaz Labs, Runway, Clarity AI, and more.

Browse available models: [Video Upscale Models](/get-started/generation/video-upscale-models/index.md)

### Vectorization

Convert raster images to scalable vector format using models from Recraft, Vision Cortex, and more.

Browse available models: [Vectorization Models](/get-started/generation/vectorization-models/index.md)

---

## Asset Management

Organize and manage all your generated content through the Assets and Collections APIs.

- **Upload assets**: Upload images to get asset IDs for use in generation requests. See [Uploading Assets](/get-started/content/uploading-assets/index.md).
- **Collections**: Group related assets (e.g., “Game Icons”, “Product Shots”) for easy organization.
- **Captioning**: Auto-generate descriptions for your images using `POST /generate/caption`.

---

## How It All Works

Every generation — image, video, 3D, audio, or tool — follows the same pattern:

1. **Send a request** to `POST /generate/custom/{modelId}` with your parameters.
2. **Get a job ID** back immediately (generation runs in the background).
3. **Poll for status** via `GET /jobs/{jobId}` until `succeeded` or `failed`.
4. **Retrieve assets** from the completed job’s `assets` array.

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


// Generate an image and wait for the result
const response = await client.generate.runModel('your-model-id', {
  body: { prompt: 'a fantasy landscape, epic, detailed', numOutputs: 2 },
});


const completed = await response.job.wait();
console.log(completed.status);
console.log(completed.metadata?.assetIds);
```

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


# Generate an image
response = client.generate.run_model(
    "your-model-id",
    body={"prompt": "a fantasy landscape, epic, detailed", "numOutputs": 2},
)
job_id = response.job.job_id


# Poll for results
job = client.jobs.retrieve(job_id)
print(job.status)
```

Terminal window

```
# Example: generate an image
curl -X POST https://api.cloud.scenario.com/v1/generate/custom/your-model-id \
  -H "Authorization: Basic $(echo -n 'your-api-key:your-api-secret' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a fantasy landscape, epic, detailed", "numOutputs": 2}'


# Poll for results
curl https://api.cloud.scenario.com/v1/jobs/{jobId} \
  -H "Authorization: Basic $(echo -n 'your-api-key:your-api-secret' | base64)"
```

Use `?dryRun=true` on any generation request to preview the credit cost without actually generating.

The available API parameters for each model are listed on the model’s page in the [Scenario web app](https://app.scenario.com).

---

## What’s Next?

- **[Quick Start Guide](/get-started/documentation/quick-start-guide/index.md)** — Make your first API call in 5 minutes.
- **[Integrating with Applications](/get-started/documentation/integrating-with-applications-real-world-scenarios/index.md)** — Real-world integration patterns with code examples.
- **[Uploading Assets](/get-started/content/uploading-assets/index.md)** — How to upload images for use in generation.
- **[Training Custom Models](/get-started/training/training-models/index.md)** — Train models on your own art style.
- **[Workflows & Apps](/get-started/documentation/workflows-and-apps/index.md)** — Chain multiple generation steps into automated pipelines.
- **[API Reference](https://cdn.cloud.scenario.com/static/api/swagger.yaml)** — Full OpenAPI specification.

