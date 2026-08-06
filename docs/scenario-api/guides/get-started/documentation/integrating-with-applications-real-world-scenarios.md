---
title: Integrating with Applications: Real-World Scenarios | Scenario Docs
---

The Scenario API gives you programmatic access to AI-powered image generation, video creation, custom model training, and asset management. This guide walks through five real-world integration patterns with architecture guidance, code examples, and best practices to help you ship production-ready integrations.

## Table of Contents

- [Before You Start](#before-you-start)

- [Available Models](#available-models)

- [1. Game Asset Pipeline — Batch Generation with Style Consistency](#1-game-asset-pipeline--batch-generation-with-style-consistency)

- [2. E-Commerce — Dynamic Product Visuals](#2-e-commerce--dynamic-product-visuals)

- [3. Content Platform — Automated Illustration Generation](#3-content-platform--automated-illustration-generation)

- [4. User-Generated Content — Personalized Avatar & Art Creation](#4-user-generated-content--personalized-avatar--art-creation)

- [5. Design Automation — Rapid Visual Iteration with Image Editing Models](#5-design-automation--rapid-visual-iteration-with-image-editing-models)

- [Production Integration Patterns](#production-integration-patterns)

  - [Error Handling & Retries](#error-handling--retries)
  - [Cost Management](#cost-management)

- [API Quick Reference](#api-quick-reference)

- [What’s Next?](#whats-next)

---

## Before You Start

All examples use the following base configuration:

Terminal window

```
# Base URL
https://api.cloud.scenario.com/v1


# Authentication: Basic Auth (Base64-encoded API_KEY:API_SECRET)
Authorization: Basic <base64(API_KEY:API_SECRET)>
```

Terminal window

```
# Example with curl
curl https://api.cloud.scenario.com/v1/models \
  -H "Authorization: Basic $(echo -n 'your-api-key:your-api-secret' | base64)"
```

You can generate API key pairs from your [Scenario dashboard](https://app.scenario.com) under **Settings > API Keys**. You will generate an **API Key** and an **API Secret**.

All generation endpoints use the unified path **`/generate/custom/{modelId}`**. You pass the model ID in the URL and the generation parameters (prompt, images, settings) in the request body. The available API parameters for each model are listed on the model’s page in the [Scenario web app](https://app.scenario.com) — check there for supported inputs, defaults, and constraints specific to the model you’re using.

### Uploading Assets

When passing images to generation endpoints, you reference them by **asset ID**. Upload images first via the Assets API to get an asset ID. See [Uploading Assets](/get-started/content/uploading-assets/index.md) for details.

---

## Available Models

Scenario provides a wide catalog of models accessible via `/generate/custom/{modelId}`. Browse available models by category:

| Category               | Description                                                                  | Documentation                                                                    |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Image Generation**   | Third-party and Scenario-trained models for text-to-image and image-to-image | [Image Models](/get-started/generation/third-party-model-generation/index.md)    |
| **Video Generation**   | Text-to-video and image-to-video models (Runway, Luma, Kling, etc.)          | [Video Models](/get-started/generation/video-generation/index.md)                |
| **3D Generation**      | Text-to-3D and image-to-3D model generation                                  | [3D Models](/get-started/generation/3d-model-generation/index.md)                |
| **Audio Generation**   | Text-to-audio and music generation                                           | [Audio Models](/get-started/generation/audio-generation/index.md)                |
| **Background Removal** | Remove backgrounds from images automatically                                 | [Background Removal](/get-started/generation/background-removal-models/index.md) |
| **Vectorization**      | Convert raster images to vector format                                       | [Vectorization](/get-started/generation/vectorization-models/index.md)           |
| **Image Upscale**      | Enhance image resolution and quality                                         | [Image Upscale](/get-started/generation/image-upscale-models/index.md)           |
| **Video Upscale**      | Enhance video resolution and quality                                         | [Video Upscale](/get-started/generation/video-upscale-models/index.md)           |

You can also **train your own custom models** to capture a specific art style, character, or concept. See [Training Custom Models](/get-started/training/training-models/index.md) for details.

---

## 1. Game Asset Pipeline — Batch Generation with Style Consistency

### The Problem

Game studios need hundreds of consistent assets — character portraits, item icons, environment textures — that all share the same art style. Manual creation is slow and expensive. Outsourcing risks style drift.

### Architecture

```
Game Editor / CI/CD → Your Backend (job queue) → Scenario API (generate) → Asset CDN (deliver)
```

### Step 1: Train a Custom Model on Your Art Style

Upload 10–30 reference images of your game’s art style, then kick off training:

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="your-api-key",
    api_secret="your-api-secret",
)


# Create a new model
response = client.models.create(
    name="pixel-dungeon-style",
    training_subject_type="style",
)
model_id = response.model.id


# Upload training images (repeat for each image)
with open("reference_art_01.png", "rb") as f:
    client.models.training_images.upload(model_id, image=f)


# Start training
client.models.train.trigger(model_id)
```

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
});


// Create a new model
const response = await client.models.create({
  name: 'pixel-dungeon-style',
  trainingSubjectType: 'style',
});
const modelId = response.model.id;


// Upload training images (repeat for each image)
const fs = await import('fs');
const image = fs.createReadStream('reference_art_01.png');
await client.models.trainingImages.upload(modelId, { image });


// Start training
await client.models.train.trigger(modelId);
```

### Step 2: Generate Assets in Batch

Once trained, generate assets using your custom model. The `modelId` in the URL is the **base model** (e.g., the Flux variant you trained on), and your **trained model ID** is passed in the request body as a parameter:

```
def generate_asset(client, prompt, base_model_id, trained_model_id, num_images=4):
    """Generate game assets with consistent style using a trained LoRA."""
    response = client.generate.run_model(
        base_model_id,
        body={
            "prompt": prompt,
            "modelId": trained_model_id,  # Your trained model ID
            "numOutputs": num_images,
            "seed": 42,  # Fix seed for reproducibility during iteration
        },
    )
    return response


# Generate a batch of game assets
asset_prompts = [
    "iron sword icon, game item, top-down view, transparent background",
    "healing potion icon, red liquid, glass bottle, game item",
    "wooden shield icon, game item, top-down view",
    "fire spell icon, magical flames, game UI element",
]


BASE_MODEL = "flux-2-dev"  # The base model your LoRA was trained on
TRAINED_MODEL = "your-trained-model-id"  # The trained model ID from Step 1


jobs = []
for prompt in asset_prompts:
    result = generate_asset(client, prompt, base_model_id=BASE_MODEL, trained_model_id=TRAINED_MODEL)
    jobs.append(result.job.job_id)
    print(f"Started job: {result.job.job_id} for: {prompt[:50]}")
```

### Step 3: Poll for Completion

Generation is asynchronous. Poll the job status until it completes:

```
import time


def wait_for_job(client, job_id, timeout=120):
    """Poll until job completes."""
    start = time.time()
    while time.time() - start < timeout:
        response = client.jobs.get(job_id)
        job = response.job


        if job.status == "succeeded":
            return job
        elif job.status == "failed":
            raise Exception(f"Job failed: {getattr(job, 'error', 'Unknown error')}")


        time.sleep(2)
    raise TimeoutError(f"Job {job_id} did not complete within {timeout}s")


# Collect all generated assets
for job_id in jobs:
    completed = wait_for_job(client, job_id)
    for asset in (completed.assets or []):
        print(f"Asset ready: {asset.id} — {asset.url}")
```

### Best Practices for Game Pipelines

- **Train once, generate many**: A single trained model can produce thousands of consistent assets.
- **Use seeds**: Fix the `seed` parameter during iteration to get reproducible results. Randomize in production for variety.
- **Use collections**: Group related assets (e.g., “Forest Tileset”, “UI Icons”) via the Collections API for easy management.

---

## 2. E-Commerce — Dynamic Product Visuals

### The Problem

E-commerce platforms need product images in multiple styles, contexts, and formats — lifestyle shots, seasonal themes, A/B test variants — without scheduling a photoshoot for each variation.

### Architecture

```
Product DB (new product) → Image Worker → Scenario API (generate) → Your App (display variants)
```

### Generate Product Variants

Upload your product photo first to get an asset ID (see [Uploading Assets](/get-started/content/uploading-assets/index.md)), then transform it into new contexts:

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
});


async function generateProductVariant(modelId: string, assetId: string, context: string) {
  const response = await client.generate.runModel(modelId, {
    body: {
      prompt: `professional product photo, ${context}, studio lighting, clean background`,
      image: assetId, // Asset ID of your uploaded product photo
      strength: 0.6, // How much to transform (0 = keep original, 1 = fully reimagine)
      numOutputs: 3,
    },
  });


  return response;
}


// Generate seasonal variants for a product
const MODEL_ID = 'your-product-model-id';
const PRODUCT_ASSET_ID = 'asset_sneaker01'; // Upload your product photo first
const contexts = [
  'winter holiday theme, snowflakes, cozy warm lighting',
  'summer beach theme, bright natural sunlight',
  'minimalist modern, white background, editorial style',
  'luxury premium feel, dark background, dramatic lighting',
];


for (const context of contexts) {
  const result = await generateProductVariant(MODEL_ID, PRODUCT_ASSET_ID, context);
  console.log(`Job ${result.job.jobId}: ${context.slice(0, 40)}...`);
}
```

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="your-api-key",
    api_secret="your-api-secret",
)


def generate_product_variant(model_id, asset_id, context):
    response = client.generate.run_model(
        model_id,
        body={
            "prompt": f"professional product photo, {context}, studio lighting, clean background",
            "image": asset_id,  # Asset ID of your uploaded product photo
            "strength": 0.6,  # How much to transform (0 = keep original, 1 = fully reimagine)
            "numOutputs": 3,
        },
    )
    return response


# Generate seasonal variants for a product
MODEL_ID = "your-product-model-id"
PRODUCT_ASSET_ID = "asset_sneaker01"  # Upload your product photo first
contexts = [
    "winter holiday theme, snowflakes, cozy warm lighting",
    "summer beach theme, bright natural sunlight",
    "minimalist modern, white background, editorial style",
    "luxury premium feel, dark background, dramatic lighting",
]


for context in contexts:
    result = generate_product_variant(MODEL_ID, PRODUCT_ASSET_ID, context)
    print(f"Job {result.job.job_id}: {context[:40]}...")
```

### Remove & Replace Backgrounds

Use the background removal tool, then place the product in a new scene with an image editing model:

```
// Step 1: Remove background
async function removeBackground(assetId: string) {
  return client.generate.runModel('photoroom-background-remover', {
    body: { image: assetId },
  });
}


// Step 2: Generate the product in a new scene using an image editing model
async function placeInScene(modelId: string, assetId: string, scenePrompt: string) {
  return client.generate.runModel(modelId, {
    body: {
      prompt: scenePrompt,
      image: assetId,
      numOutputs: 2,
    },
  });
}
```

```
# Step 1: Remove background
def remove_background(asset_id):
    return client.generate.run_model(
        "photoroom-background-remover",
        body={"image": asset_id},
    )


# Step 2: Generate the product in a new scene using an image editing model
def place_in_scene(model_id, asset_id, scene_prompt):
    return client.generate.run_model(
        model_id,
        body={
            "prompt": scene_prompt,
            "image": asset_id,
            "numOutputs": 2,
        },
    )
```

### Best Practices for E-Commerce

- **Use moderate strength (0.4–0.7)** when passing a reference image: preserves product identity while changing context.
- **Cache generated variants**: Store asset IDs and URLs in your product database to avoid regenerating.
- **A/B test with `numOutputs`**: Generate 3–4 variants per product, then measure click-through rates.
- **Use `?dryRun=true`**: Preview the credit cost of a generation before committing.

---

## 3. Content Platform — Automated Illustration Generation

### The Problem

Content platforms (blogs, news, storytelling apps) need relevant visuals for every piece of content. Stock photos feel generic. Manual illustration is too slow for content velocity.

### Architecture

```
CMS / Editor (publish) → NLP Extract (keywords) → Scenario API (generate) → Article (with art)
```

### Extract Keywords and Generate Illustrations

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="your-api-key",
    api_secret="your-api-secret",
)


def generate_article_illustration(model_id, title, summary, style="editorial illustration"):
    """Generate an illustration based on article content."""


    # Build a descriptive prompt from article metadata
    prompt = (
        f"{style}, {title}, "
        f"depicting: {summary[:200]}, "
        f"professional illustration, high quality, vivid colors"
    )


    response = client.generate.run_model(
        model_id,
        body={
            "prompt": prompt,
            "numOutputs": 3,
        },
    )


    return response


# Example: Auto-illustrate a blog post
result = generate_article_illustration(
    model_id="your-editorial-model-id",
    title="The Future of Renewable Energy",
    summary="Solar panels and wind turbines powering a modern sustainable city",
    style="flat vector illustration, modern tech style",
)


print(f"Job started: {result.job.job_id}")
```

### Auto-Caption Generated Images for SEO

Use the caption endpoint to generate alt text automatically:

```
def generate_caption(asset_id):
    """Generate an SEO-friendly caption for a generated image."""
    response = client.generate.caption(
        asset_id=asset_id,
    )
    return response


# After generation completes, caption the best result
caption_result = generate_caption("asset_abc123")
alt_text = getattr(caption_result, "caption", "")
print(f"Alt text: {alt_text}")
```

### Best Practices for Content Platforms

- **Create style-specific models**: Train separate models for “tech blog,” “lifestyle,” “news editorial” etc. to match your brand.
- **Generate at publish time**: Hook into your CMS publish event to trigger generation, with a fallback placeholder.
- **Caption everything**: Use the caption API for accessibility and SEO.

---

## 4. User-Generated Content — Personalized Avatar & Art Creation

### The Problem

Social apps and gaming platforms want users to create personalized content — avatars, profile art, custom stickers — without exposing raw AI complexity.

### Architecture

```
Mobile App (user picks style + prompt) → Your API (validates, rate limits) → Scenario API (generates) → User Gallery
```

### Expose a Curated Generation Interface

Never expose raw Scenario API access to end users. Wrap it in your own API with guardrails:

your-backend/routes/generate-avatar.ts

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: process.env.SCENARIO_API_KEY!,
  apiSecret: process.env.SCENARIO_API_SECRET!,
});


// Pre-approved styles users can pick from
const STYLE_PRESETS: Record<string, { modelId: string }> = {
  anime: { modelId: 'model-anime-portrait-id' },
  pixel: { modelId: 'model-pixel-art-id' },
  fantasy: { modelId: 'model-fantasy-portrait-id' },
};


export async function generateAvatar(req, res) {
  const { style, description } = req.body;
  const userId = req.user.id;


  // Validate style
  const preset = STYLE_PRESETS[style];
  if (!preset) {
    return res.status(400).json({ error: 'Invalid style. Choose: anime, pixel, or fantasy.' });
  }


  // Sanitize user input (basic example — use a content filter in production)
  const safeDescription = description
    .replace(/[^a-zA-Z0-9\s,.-]/g, '')
    .slice(0, 200);


  // Rate limit check (implement per your needs)
  const dailyCount = await getUserDailyGenerationCount(userId);
  if (dailyCount >= 10) {
    return res.status(429).json({ error: 'Daily generation limit reached.' });
  }


  // Generate via Scenario
  const result = await client.generate.runModel(preset.modelId, {
    body: {
      prompt: `portrait avatar, ${safeDescription}, centered, clean background`,
      numOutputs: 4, // Give users choices
    },
  });


  return res.json({
    jobId: result.job.jobId,
    message: 'Generating your avatar — check back in a few seconds!',
  });
}
```

### Best Practices for User-Facing Apps

- **Never expose your API key client-side**: Always proxy through your backend.
- **Use style presets**: Let users choose from curated styles rather than typing raw prompts.
- **Sanitize input**: Filter user text for prompt injection and inappropriate content.
- **Rate limit per user**: Prevent abuse — 5–20 generations per day is typical for free tiers.
- **Use `?dryRun=true`** to preview costs before committing to generation.
- **Generate multiple outputs**: Return 3–4 options so users can pick their favorite.

---

## 5. Design Automation — Rapid Visual Iteration with Image Editing Models

### The Problem

Design agencies need to rapidly iterate on visual concepts for clients — exploring different aesthetics, refining details, and restyling existing assets. Manual iteration through Photoshop is slow and expensive.

### Architecture

```
Design / Asset Upload → Your Backend (orchestrate) → Scenario API (image editing) → Client Review App
```

### Use Image Editing Models to Restyle and Refine

Image editing models (like Gemini 3.1) let you transform existing visuals with natural language instructions. Upload your source design (see [Uploading Assets](/get-started/content/uploading-assets/index.md)), then describe the changes you want:

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="your-api-key",
    api_secret="your-api-secret",
)


def generate_design_variations(model_id, source_asset_id, style_instructions):
    """Generate multiple design directions from a single source design."""
    results = []


    for instruction in style_instructions:
        response = client.generate.run_model(
            model_id,
            body={
                "prompt": instruction,
                "referenceImages": [source_asset_id],  # Array of asset IDs
                "numOutputs": 2,
            },
        )
        results.append({
            "instruction": instruction,
            "jobId": response.job.job_id,
        })


    return results


# Generate 4 different design directions from one source design
variations = generate_design_variations(
    model_id="google-gemini-3-1-flash",  # Image editing model
    source_asset_id="asset_landingPageV3",  # Upload source design first
    style_instructions=[
        "Restyle this to a minimalist tech startup look with white space and sans-serif typography",
        "Make this bold and colorful with gradient backgrounds, playful consumer brand feel",
        "Convert to dark mode with neon accents, futuristic SaaS dashboard aesthetic",
        "Restyle with warm earth tones, organic shapes, lifestyle brand editorial feel",
    ],
)


for v in variations:
    print(f"Instruction: {v['instruction'][:50]}... → Job: {v['jobId']}")
```

### Iterate on a Selected Direction

Once a client picks a direction, continue refining with follow-up edit instructions:

```
def refine_design(model_id, asset_id, refinement_instruction):
    """Refine a selected design with natural language instructions."""
    response = client.generate.run_model(
        model_id,
        body={
            "referenceImages": [asset_id],
            "prompt": refinement_instruction,
            "numOutputs": 3,
        },
    )
    return response


# Client likes the minimalist direction, wants tweaks
refine_design(
    model_id="google-gemini-3-1-flash",
    asset_id="asset_selectedDesign123",
    refinement_instruction="Make the colors softer, add subtle drop shadows, and round the corners",
)
```

### Best Practices for Design Workflows

- **Start broad, then refine**: Generate multiple style directions first, then iterate on the client’s favorite.
- **Use image editing models for modifications**: Models like Gemini 3.1 understand natural language edit instructions — no need to describe the full image, just the changes.
- **Chain edits**: Apply incremental refinements rather than trying to get everything right in one prompt.
- **Organize with collections**: Create a collection per client/project to keep generated concepts organized.

---

## Production Integration Patterns

### Error Handling & Retries

```
import time
from scenario_sdk import Scenario
from scenario_sdk.errors import APIError


client = Scenario(
    api_key="your-api-key",
    api_secret="your-api-secret",
)


def generate_with_retries(model_id, body, retries=3):
    """Make a Scenario API request with retry logic."""


    for attempt in range(retries):
        try:
            return client.generate.run_model(model_id, body=body)


        except APIError as e:
            if e.status_code == 429:
                # Rate limited — back off exponentially
                wait = 2 ** attempt
                print(f"Rate limited. Retrying in {wait}s...")
                time.sleep(wait)


            elif e.status_code >= 500:
                # Server error — retry
                wait = 2 ** attempt
                print(f"Server error {e.status_code}. Retrying in {wait}s...")
                time.sleep(wait)


            else:
                # Client error (400, 401, 403, 404) — don't retry
                raise Exception(f"API error {e.status_code}: {e.message}")


    raise Exception(f"Failed after {retries} retries")


# Usage
result = generate_with_retries("your-model-id", body={
    "prompt": "a fantasy sword icon",
    "numOutputs": 1,
})
```

### Cost Management

Use `dryRun` to estimate costs before committing:

```
# Preview cost without generating — pass dryRun=True as a query parameter
dry_run = client.generate.run_model(
    "your-model-id",
    body={
        "prompt": "a fantasy landscape, epic, detailed",
        "numOutputs": 4,
    },
    dry_run=True,
)


estimated_cost = getattr(dry_run, "billing", {}).get("cost", 0)
print(f"This generation would cost {estimated_cost} credits")
```

---

## API Quick Reference

| Task                          | Endpoint                                             | Key Parameters                                   |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| Upload asset                  | `POST /assets`                                       | `image` (file)                                   |
| Generate images               | `POST /generate/custom/{modelId}`                    | `prompt`, `numOutputs`                           |
| Generate with reference image | `POST /generate/custom/{modelId}`                    | `prompt`, `image` (asset ID), `strength`         |
| Image editing                 | `POST /generate/custom/{modelId}`                    | `prompt`, `referenceImages` (array of asset IDs) |
| Remove background             | `POST /generate/custom/photoroom-background-remover` | `image` (asset ID)                               |
| Upscale                       | `POST /generate/custom/{upscaleModelId}`             | `image` (asset ID)                               |
| Caption image                 | `POST /generate/caption`                             | `assetId`                                        |
| Generate video                | `POST /generate/custom/{videoModelId}`               | `prompt`, `image` (asset ID)                     |
| Check job status              | `GET /jobs/{jobId}`                                  | —                                                |
| List assets                   | `GET /assets`                                        | `pageSize`, `privacy`, `tags`                    |
| Create collection             | `POST /collections`                                  | `name`                                           |
| Train model                   | `PUT /models/{modelId}/train`                        | `parameters` (optional training settings)        |

---

## What’s Next?

- **[Quick Start Guide](/get-started/documentation/quick-start-guide/index.md)** — Make your first API call in 5 minutes.
- **[Uploading Assets](/get-started/content/uploading-assets/index.md)** — How to upload images to get asset IDs for generation.
- **[Training Custom Models](/get-started/training/training-models/index.md)** — Deep dive into model training for style consistency.
- **[Workflows & Apps](/get-started/documentation/workflows-and-apps/index.md)** — Chain multiple generation steps into automated pipelines.
- **[API Reference](https://cdn.cloud.scenario.com/static/api/swagger.yaml)** — Full OpenAPI specification.

