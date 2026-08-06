---
title: Composing Models with LoRAs | Scenario Docs
---

> Composing a model is for the moment only applicable for Flux.1 LoRas

Composing models with LoRAs (Low-Rank Adaptations) allows you to blend the capabilities of multiple specialized models into a single, powerful new model. This technique is particularly useful for combining different styles, objects, or concepts learned by individual LoRAs to achieve unique and nuanced image generation results. This guide will walk you through the process of composing your own models using LoRAs, detailing the necessary steps, API endpoints, and parameters. We will also provide code examples to help you integrate model composition into your applications.

## 🚀 Key Concepts

To effectively compose models, it’s helpful to understand these concepts:

- **LoRA (Low-Rank Adaptation)**: As discussed in the [Training Models article](#), LoRA is an efficient fine-tuning method that allows for the adaptation of pre-trained models to new tasks or styles with minimal computational overhead. Each LoRA typically specializes in a particular aspect, such as a specific artistic style, character, or object.

- **Composed Model**: A new model created by combining the strengths of several individual LoRAs. This allows for highly customized and versatile image generation.

- **Concepts**: In the context of model composition, concepts refer to the individual LoRAs that you want to combine. Each concept includes the `modelId` of the LoRA and a `scale` parameter, which determines the weight or influence of that LoRA in the final composed model.

## ⚡️ Composition Workflow

The process of composing a model using LoRAs generally follows these steps:

1. **Get LoRA Models**: Identify and retrieve the `modelId`s of the LoRA models you wish to combine.
2. **Create a Composed Model**: Send a request to the API to create a new model, specifying the selected LoRAs and their respective scales as concepts.
3. **Train the Composed Model**: Initiate the training process for your newly composed model.

Let’s delve into each step.

### 1. Get LoRA Models

Before you can compose a model, you need to know which LoRA models are available and their corresponding `modelId`s. You can retrieve a list of LoRA models by making a `GET` request to the `/v1/models` endpoint and filtering by the `type` parameter set to `flux.1-lora` or `sd-xl-lora` depending on your needs .

**Endpoint:**

`GET https://api.cloud.scenario.com/v1/models`

**Query Parameters:**

| Parameter | Type   | Description                                                                                | Required |
| --------- | ------ | ------------------------------------------------------------------------------------------ | -------- |
| `type`    | string | Filter models by type. Use `flux.1-lora` to retrieve LoRA models suitable for composition. | No       |

**Example Request (Python):**

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


response = client.models.list(type="flux.1-lora")


print("Available LoRA Models:")
for model in response.models:
    print(f"  Name: {model.name}, ID: {model.id}")
```

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


const response = await client.models.list({ type: 'flux.1-lora' });


console.log('Available LoRA Models:');
for (const model of response.models) {
  console.log(`  Name: ${model.name}, ID: ${model.id}`);
}
```

From the returned list, identify the `modelId`s of the LoRAs you wish to combine.

### 2. Create a Composed Model

With the `modelId`s of your desired LoRAs in hand, you can now create a new composed model. This is achieved by making a `POST` request to the `/v1/models` endpoint, similar to creating a new model for training, but with a crucial difference: you will include a `concepts` array in the request body and set the `type` to `flux.1-composition`.

Each object within the `concepts` array should contain:

- `modelId`: The ID of the LoRA model you want to include.
- `scale`: A float value between 0 and 1, representing the weight or influence of this LoRA in the final composition. A higher value means more influence.

**Endpoint:**

`POST https://api.cloud.scenario.com/v1/models`

**Request Body Parameters:**

| Parameter            | Type             | Description                                                                                        | Required |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------------- | -------- |
| `name`               | string           | The name of your composed model (e.g., “My Custom Blended Style”).                                 | Yes      |
| `type`               | string           | The type of model to create. For composition, this MUST be `flux.1-composition`.                   | Yes      |
| `concepts`           | array of objects | An array of objects, each specifying a LoRA model to include in the composition and its influence. | Yes      |
| `concepts[].modelId` | string           | The ID of the LoRA model.                                                                          | Yes      |
| `concepts[].scale`   | number (float)   | The influence of the LoRA, a value between 0 and 1.                                                | Yes      |

**Example Request (Python):**

```
response = client.models.create(
    name="My Blended LoRA Model",
    type="flux.1-composition",
    concepts=[
        {"modelId": "V2anp75qTuKmmHOeInzQhg", "scale": 0.65},
        {"modelId": "I3fUkYcTSY-PEkhvYMDvSQ", "scale": 0.8},
    ],
)
composed_model_id = response.model.id
print(f"Composed model created successfully! Model ID: {composed_model_id}")
```

```
const createResponse = await client.models.create({
  name: 'My Blended LoRA Model',
  type: 'flux.1-composition',
  concepts: [
    { modelId: 'V2anp75qTuKmmHOeInzQhg', scale: 0.65 },
    { modelId: 'I3fUkYcTSY-PEkhvYMDvSQ', scale: 0.8 },
  ],
});
const composedModelId = createResponse.model.id;
console.log(`Composed model created successfully! Model ID: ${composedModelId}`);
```

Upon successful creation, the response will include the `modelId` of your new composed model.

### 3. Train the Composed Model

After creating your composed model, you need to initiate its training. This step is similar to training a regular LoRA model, using the `PUT /v1/models/{modelId}/train` endpoint. This process finalizes the blending of the specified LoRAs into a cohesive model.

**Endpoint:**

`PUT https://api.cloud.scenario.com/v1/models/{modelId}/train`

**Path Parameters:**

| Parameter | Type   | Description                                     | Required |
| --------- | ------ | ----------------------------------------------- | -------- |
| `modelId` | string | The ID of the composed model you want to train. | Yes      |

**Request Body Parameters:**

| Parameter    | Type   | Description                                                                                                                                                                  | Required |
| ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `parameters` | object | An object containing various training parameters. For composed models, default parameters are often sufficient, but you can refer to the API Reference for advanced options. | No       |

**Example Request (Python):**

```
# Assuming composed_model_id is obtained from the previous step
response = client.models.train.trigger(
    composed_model_id,
    parameters={
        # You can add specific training parameters here if needed
    },
)
job_id = response.job.job_id
print(f"Composed model training initiated successfully! Job ID: {job_id}")
```

```
// Assuming composedModelId is obtained from the previous step
const trainResponse = await client.models.train.trigger(composedModelId, {
  parameters: {
    // You can add specific training parameters here if needed
  },
});
const jobId = trainResponse.job.jobId;
console.log(`Composed model training initiated successfully! Job ID: ${jobId}`);


// Wait for completion using the SDK helper (see SDK Helpers > Jobs)
const completed = await trainResponse.job.wait({ intervalMs: 10_000, timeoutMs: 900_000 });
console.log(`Training ${completed.status}`);
```

Similar to regular model training, this is an asynchronous process. You can monitor the training status using the `GET /v1/models/{modelId}` endpoint, or use the SDK helper `response.job.wait()` to poll automatically until the model status is `trained`.

## 📚 References

- [Scenario API Reference: POST /v1/models](/api/postmodels/index.md)
- [Scenario API Reference: PUT /v1/models/{modelId}/train](/api/putmodelstrainbymodelid/index.md)
