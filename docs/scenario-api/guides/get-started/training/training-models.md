---
title: Training Models | Scenario Docs
---

Scenario lets you train custom LoRA models on top of state-of-the-art base architectures. Once trained, your model captures your specific style, character, or concept and can be used for generation and editing.

---

## Choosing a training type

When creating a model, you set its `type` to one of the supported training types. This determines which base model is used during training and which inference models the resulting LoRA is compatible with.

**Standard training types** produce LoRAs for text-to-image and image-to-image generation. You provide a set of example images.

**Edit training types** (those ending in `-edit-lora`) produce LoRAs for instruction-following image editing. Instead of individual images, you provide before/after pairs with an instruction describing the change.

---

## FLUX.2 Models

### FLUX.2 Dev

**Training type:** `flux.2-dev-lora`

High-quality text-to-image and image-to-image model. Best choice when output fidelity is the priority. Generates at 28 inference steps by default.

### FLUX.2 Dev Edit

**Training type:** `flux.2-dev-edit-lora`

Edit variant of FLUX.2 Dev. Train with before/after image pairs to teach the model how to apply edits (e.g. changing style, adding elements, recoloring). Requires at least 2 image pairs.

---

### FLUX.2 Klein — distilled vs. base

The Klein family comes in two flavors:

- **Distilled (non-base):** Optimized for speed. Generates in \~4 steps at guidance 1.0. Lower cost, faster iteration.
- **Base:** Higher quality output using \~28 steps and guidance 4.0, closer to FLUX.2 Dev in quality.

| Training type               | Variant              | Steps | Profile                      |
| --------------------------- | -------------------- | ----- | ---------------------------- |
| `flux.2-klein-4b-lora`      | Distilled, 4b params | \~4   | Fast                         |
| `flux.2-klein-9b-lora`      | Distilled, 9b params | \~4   | Fast, larger model           |
| `flux.2-klein-base-4b-lora` | Base, 4b params      | \~28  | Higher quality               |
| `flux.2-klein-base-9b-lora` | Base, 9b params      | \~28  | Higher quality, larger model |

Edit variants follow the same pattern and require image pairs:

| Training type                    | Variant           |
| -------------------------------- | ----------------- |
| `flux.2-klein-4b-edit-lora`      | Distilled 4b edit |
| `flux.2-klein-9b-edit-lora`      | Distilled 9b edit |
| `flux.2-klein-base-4b-edit-lora` | Base 4b edit      |
| `flux.2-klein-base-9b-edit-lora` | Base 9b edit      |

---

## Qwen Image Models

### Qwen Image

**Training type:** `qwen-image-lora`

Cost-effective text-to-image and image-to-image model. Good choice for high-volume use cases where budget matters.

### Qwen Image 2512

**Training type:** `qwen-image-2512-lora`

Updated Qwen Image checkpoint with improved resolution support.

### Qwen Image Edit variants

Edit variants for instruction-following image editing. All require before/after image pairs.

| Training type               | Checkpoint             |
| --------------------------- | ---------------------- |
| `qwen-image-edit-lora`      | Base edit model        |
| `qwen-image-edit-2509-lora` | September 2025         |
| `qwen-image-edit-2511-lora` | November 2025 (latest) |

---

## Z-Image Models

### Z-Image

**Training type:** `zimage-lora`

Highest quality text-to-image and image-to-image model. Also supports ControlNet (edge, depth, pose) for advanced structural control during inference.

### Z-Image Turbo

**Training type:** `zimage-turbo-lora`

Fast variant optimized for low step counts (default: 9 steps). Use when generation speed matters more than maximum fidelity.

### Z-Image De-Turbo

**Training type:** `zimage-de-turbo-lora`

A variant between Z-Image and Z-Image Turbo in speed/quality trade-off. Compatible with both Z-Image and Z-Image Turbo inference models.

---

## Training images

**Recommended:** 5–15 images **Maximum:** 50 images

Use clean, consistent images that clearly represent the subject or style you want to capture. Quality and consistency matter more than quantity.

For **edit models**, provide before/after image pairs with a text instruction per pair. A minimum of 2 pairs is required.

---

## Training flow

### 1. Create a model

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


const response = await client.models.create({
  name: 'My Character',
  type: 'flux.2-dev-lora',
});
const modelId = response.model.id;
```

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


response = client.models.create(
    name="My Character",
    type="flux.2-dev-lora",
)
model_id = response.model.id
```

Terminal window

```
curl -X POST "https://api.cloud.scenario.com/v1/models?projectId=<projectId>" \
  -H "Authorization: Basic <base64(key:secret)>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Character",
    "type": "flux.2-dev-lora"
  }'
```

```
{
  "model": {
    "id": "model_xxxxxxxxxxxx",
    "name": "My Character",
    "type": "flux.2-dev-lora",
    "status": "draft"
  }
}
```

---

### 2. Upload training images

Upload images one at a time or in batches by asset ID (up to 10 per request):

```
import * as fs from 'fs';


// Single image via base64
const imageData = fs.readFileSync('image-01.jpg').toString('base64');


await client.models.trainingImages.add(modelId, {
  name: 'image-01.jpg',
  data: `data:image/jpeg;base64,${imageData}`,
});


// Batch by asset IDs
await client.models.trainingImages.add(modelId, {
  assetIds: ['asset_aaa', 'asset_bbb', 'asset_ccc'],
});
```

```
import base64


# Single image via base64
with open("image-01.jpg", "rb") as f:
    image_data = base64.b64encode(f.read()).decode()


client.models.training_images.add(
    model_id,
    name="image-01.jpg",
    data=f"data:image/jpeg;base64,{image_data}",
)


# Batch by asset IDs
client.models.training_images.add(
    model_id,
    asset_ids=["asset_aaa", "asset_bbb", "asset_ccc"],
)
```

Terminal window

```
# Single image via base64
curl -X POST "https://api.cloud.scenario.com/v1/models/<modelId>/training-images?projectId=<projectId>" \
  -H "Authorization: Basic <base64(key:secret)>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "image-01.jpg",
    "data": "data:image/jpeg;base64,<base64data>"
  }'


# Batch by asset IDs
curl -X POST "https://api.cloud.scenario.com/v1/models/<modelId>/training-images?projectId=<projectId>" \
  -H "Authorization: Basic <base64(key:secret)>" \
  -H "Content-Type: application/json" \
  -d '{
    "assetIds": ["asset_aaa", "asset_bbb", "asset_ccc"]
  }'
```

---

### 2b. Upload image pairs (edit models only)

For edit training types, provide before/after pairs with an instruction instead of individual images:

```
await client.models.trainingImages.replacePairs(modelId, {
  body: [
    {
      sourceId: 'asset_before_01',
      targetId: 'asset_after_01',
      instruction: 'make the background a snowy forest',
    },
    {
      sourceId: 'asset_before_02',
      targetId: 'asset_after_02',
      instruction: 'add rain and dark clouds',
    },
  ],
});
```

```
client.models.training_images.replace_pairs(
    model_id,
    body=[
        {
            "sourceId": "asset_before_01",
            "targetId": "asset_after_01",
            "instruction": "make the background a snowy forest",
        },
        {
            "sourceId": "asset_before_02",
            "targetId": "asset_after_02",
            "instruction": "add rain and dark clouds",
        },
    ],
)
```

Terminal window

```
curl -X PUT "https://api.cloud.scenario.com/v1/models/<modelId>/training-images/pairs?projectId=<projectId>" \
  -H "Authorization: Basic <base64(key:secret)>" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "sourceId": "asset_before_01",
      "targetId": "asset_after_01",
      "instruction": "make the background a snowy forest"
    },
    {
      "sourceId": "asset_before_02",
      "targetId": "asset_after_02",
      "instruction": "add rain and dark clouds"
    }
  ]'
```

---

### 3. Start training

```
const trainResponse = await client.models.train.trigger(modelId, {
  parameters: {
    seed: 123456789,
  },
});
console.log(trainResponse);
```

```
response = client.models.train.trigger(
    model_id,
    parameters={
        "seed": 123456789,
    },
)
print(response)
```

Terminal window

```
curl -X PUT "https://api.cloud.scenario.com/v1/models/<modelId>/train?projectId=<projectId>" \
  -H "Authorization: Basic <base64(key:secret)>" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "seed": 123456789
    }
  }'
```

```
{
  "model": {
    "id": "model_xxxxxxxxxxxx",
    "status": "training",
    "trainingProgress": {
      "stage": "queued-for-train",
      "position": 2,
      "progress": 0
    }
  },
  "job": {
    "id": "job_xxxxxxxxxxxx",
    "type": "flux-model-training"
  },
  "creativeUnits": {
    "estimatedCreativeUnits": 150
  }
}
```

---

### 4. Poll for completion

```
// Option 1: Manual polling
const poll = async () => {
  while (true) {
    const response = await client.models.retrieve(modelId);
    const status = response.model.status;
    console.log(`Status: ${status}`);


    if (status === 'trained' || status === 'failed') {
      break;
    }


    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
};
await poll();


// Option 2: Using the SDK helper (see SDK Helpers > Jobs)
const trainResponse = await client.models.train.trigger(modelId, { /* params */ });
const completed = await trainResponse.job.wait({ intervalMs: 10_000, timeoutMs: 900_000 });
console.log(completed.status); // 'success' or 'failure'
```

```
import time


while True:
    response = client.models.retrieve(model_id)
    status = response.model.status
    print(f"Status: {status}")


    if status in ("trained", "failed"):
        break


    time.sleep(10)
```

Terminal window

```
curl "https://api.cloud.scenario.com/v1/models/<modelId>?projectId=<projectId>" \
  -H "Authorization: Basic <base64(key:secret)>"
```

The `model.status` field transitions through:

`draft` → `training` → `trained` *(success)* or `failed`

`trainingProgress.stage` provides finer-grained status during training.

---

### 5. Cancel training (optional)

```
await client.models.train.action(modelId, { action: 'cancel' });
```

```
client.models.train.action(model_id, action="cancel")
```

Terminal window

```
curl -X POST "https://api.cloud.scenario.com/v1/models/<modelId>/train/action?projectId=<projectId>" \
  -H "Authorization: Basic <base64(key:secret)>" \
  -H "Content-Type: application/json" \
  -d '{ "action": "cancel" }'
```

---

## Training parameters

| Parameter            | Type      | Description                                                                               |
| -------------------- | --------- | ----------------------------------------------------------------------------------------- |
| `seed`               | number    | For reproducibility                                                                       |
| `learningRate`       | number    | Min: 0.00001 · Max: 0.001 · Default: 0.00005                                              |
| `rank`               | number    | LoRA rank · Min: 2 · Max: 128 · Default: 64                                               |
| `batchSize`          | number    | Min: 1 · Max: 8 · Default: 1                                                              |
| `nbEpochs`           | number    | Min: 1 · Max: 100 · Default: 10                                                           |
| `nbRepeats`          | number    | Min: 1 · Max: 100 · Default: 20                                                           |
| `samplePrompts`      | string\[] | Up to 4 prompts — sample images generated at each epoch so you can monitor progress       |
| `sampleSourceImages` | string\[] | Edit models only: asset IDs to use as source images for sample generation during training |

---

## Compatibility

A LoRA trained on one base model family cannot be used with a different family. For example, a `flux.2-dev-lora` can only be used with FLUX.2 Dev inference — not with Qwen or Z-Image models.

Within the Z-Image family, LoRAs trained with `zimage-lora`, `zimage-turbo-lora`, and `zimage-de-turbo-lora` are all compatible with both **Z-Image** and **Z-Image Turbo** inference models.

