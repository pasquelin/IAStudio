---
title: 3D Model Generation | Scenario Docs
---

The Scenario API extends beyond static image generation to support dynamic content creation, including 3D model generation. These advanced functionalities often involve longer processing times and utilize a flexible “custom” endpoint, requiring a job polling mechanism to retrieve the final results. This guide will explain how to initiate 3D model generation, monitor their progress, and retrieve the completed assets.

## The Custom Endpoint

For specialized generation tasks like 3D models, the Scenario API provides a versatile custom endpoint. This endpoint allows you to interact with specific models tailored for these complex outputs.

`POST https://api.cloud.scenario.com/v1/generate/custom/{modelId}` - [API Reference](/api/postgeneratecustom#/index.md)

Where `{modelId}` is the identifier for the specific video or 3D model generation model you wish to use (e.g., `model_hunyuan-3d-v2-1` for a 3D model). Find the full list of available model IDs here: [/get-started/generation/3d-model-generation](/get-started/generation/3d-model-generation/index.md)

## Request Body for Custom Generation

The payload for the custom endpoint will vary depending on the `modelId` and the type of generation (video or 3D). However, common parameters often include:

| Parameter       | Type    | Description                                                                                                              |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `image`         | string  | The asset ID of an input image to be used as a reference for 3D model generation.                                        |
| `steps`         | integer | The number of processing steps for the generation. Higher values can lead to higher quality but longer processing times. |
| `guidanceScale` | number  | Controls how closely the generation follows the prompt.                                                                  |
| `targetFaceNum` | integer | The target number of faces for the generated 3D model.                                                                   |

You can find the full list of parameters here: [/get-started/generation/3d-model-generation](/get-started/generation/3d-model-generation/index.md)

## Job Polling: Retrieving Asynchronous Results

When you make a request to the custom endpoint, you will receive a `jobId` immediately, but the actual generation will happen in the background. You then need to periodically poll a separate endpoint to check the status and retrieve the final asset.

### Polling Endpoint

`GET https://api.cloud.scenario.com/v1/jobs/{jobId}` - [API Reference](/api/getjobid/index.md)

### Polling Response

The response from the polling endpoint will contain the current status of your job. You should continue polling until the `status` field indicates `success` or `failed`.

```
{
  "job": {
    "jobId": "job_abc123def456",
    "status": "processing", // Can be \"queued\", \"processing\", \"success\", \"failed\", \"canceled\"
    "progress": 0.5, // Optional: progress percentage
    "metadata": {
      "assetIds": []
    }
  },
  "creativeUnitsCost": 5
}
```

Once the `status` is `success`, the `metadata.assetIds` field will contain the IDs to your generated video or 3D model assets.

## Code Example: 3D Model Generation with Hunyuan 3D v2.1

This example demonstrates generating a 3D model using the `model_hunyuan-3d-v2-1` model and then polling for the result.

### TypeScript

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


async function generate3DModel() {
  const customModelId = 'model_hunyuan-3d-v2-1';


  console.log('Initiating 3D model generation...');


  // Step 1: Initiate 3D Model Generation
  const response = await client.generate.runModel(customModelId, {
    body: {
      image: 'asset_1gHMbHjSjWYLyAnd7ZxzPkcQ', // Replace with your asset ID
      paint: false,
      steps: 30,
      guidanceScale: 7.5,
      targetFaceNum: 40000,
    },
  });


  const jobId = response.job.jobId;
  console.log(`3D model generation job initiated. Job ID: ${jobId}`);


  // Step 2: Wait for completion using the built-in .wait() helper
  const completed = await response.job.wait();


  if (completed.status === 'success') {
    const assetIds = completed.metadata?.assetIds || [];
    console.log('3D model generation completed! Asset IDs:', assetIds);
  } else {
    console.error(`3D model generation ended with status: ${completed.status}`);
  }
}


generate3DModel();
```

### Python

```
from scenario_sdk import Scenario
import time


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


# Step 1: Initiate 3D Model Generation
custom_model_id = "model_hunyuan-3d-v2-1"


print("Initiating 3D model generation...")
response = client.generate.run_model(
    custom_model_id,
    body={
        "image": "asset_1gHMbHjSjWYLyAnd7ZxzPkcQ",  # Replace with your asset ID
        "paint": False,
        "steps": 30,
        "guidanceScale": 7.5,
        "targetFaceNum": 40000,
    },
)


job_id = response.job.job_id
print(f"3D model generation job initiated. Job ID: {job_id}")


# Step 2: Poll for Job Status (or use response.job.wait() for a simpler approach)
status = "queued"
while status not in ["success", "failure", "canceled"]:
    print(f"Polling job {job_id}... Current status: {status}")
    time.sleep(3)


    poll = client.jobs.retrieve(job_id)
    status = poll.job.status
    progress = (poll.job.progress or 0) * 100
    print(f"Progress: {progress:.2f}%")


    if status == "success":
        asset_ids = poll.job.metadata.get("assetIds", [])
        print(f"3D model generation completed! Asset IDs: {asset_ids}")
    elif status in ["failure", "canceled"]:
        print(f"3D model generation failed or canceled: {poll.job.error}")
```

### cURL

Terminal window

```
curl -X POST \
  -u "YOUR_API_KEY:YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "image":"asset_1gHMbHjSjWYLyAnd7ZxzPkcQ",
    "paint":false,
    "steps":30,
    "guidanceScale":7.5,
    "targetFaceNum":40000
  }' \
  https://api.cloud.scenario.com/v1/generate/custom/model_hunyuan-3d-v2-1?projectId=yourprojectid
```
