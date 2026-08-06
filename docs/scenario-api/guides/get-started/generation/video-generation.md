---
title: Video Generation | Scenario Docs
---

The Scenario API extends beyond static image generation to support dynamic content creation, including video. These advanced functionalities often involve longer processing times and utilize a flexible “custom” endpoint, requiring a job polling mechanism to retrieve the final results. This guide will explain how to initiate video , monitor their progress, and retrieve the completed assets.

## The Custom Endpoint

For specialized generation tasks like video, the Scenario API provides a versatile custom endpoint. This endpoint allows you to interact with specific models tailored for these complex outputs.

`POST https://api.cloud.scenario.com/v1/generate/custom/{modelId}` - [API Reference](/api/postgeneratecustom#/index.md)

Where `{modelId}` is the identifier for the specific video generation model you wish to use (e.g., `model_kling-v2-1` for Kling 2.1 video model). Available models ID are here: [/get-started/generation/video-generation](/get-started/generation/video-generation/index.md)

## Request Body for Custom Generation

The payload for the custom endpoint will vary depending on the `modelId` and the type of generation (video or 3D). However, common parameters often include:

| Parameter       | Type    | Description                                                                                                              |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `image`         | string  | The first frame of your model.                                                                                           |
| `prompt`        | string  | A textual description to guide the generation.                                                                           |
| `steps`         | integer | The number of processing steps for the generation. Higher values can lead to higher quality but longer processing times. |
| `guidanceScale` | number  | Controls how closely the generation follows the prompt.                                                                  |
| `duration`      | number  | The desired duration of the video in seconds.                                                                            |
| `fps`           | integer | Frames per second for the video output.                                                                                  |

To find the correct list of parameters for a specific model you can [spy network requests](https://help.scenario.com/en/articles/finding-the-right-api-parameters-using-the-web-application). You can also have the parameters of all video models here: [/get-started/generation/video-generation](/get-started/generation/video-generation/index.md)

## Job Polling: Retrieving Asynchronous Results

Unlike instant image generation, video and 3D model generation are asynchronous processes. This means that when you make a request to the custom endpoint, you will receive a `jobId` immediately, but the actual generation will happen in the background. You then need to periodically poll a separate endpoint to check the status and retrieve the final asset.

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

## Code Examples: Video Generation with VEO3

This example demonstrates initiating a video generation and then polling for the result.

### TypeScript

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


async function generateVideo() {
  const customVideoModelId = 'model_veo3';


  console.log('Initiating video generation...');


  // Step 1: Initiate Video Generation
  const response = await client.generate.runModel(customVideoModelId, {
    body: {
      prompt:
        'A lone skateboarder, silhouetted against the golden burnish of a late afternoon sun, carves gracefully along a winding, empty coastal road high above the shimmering sea.',
      generateAudio: true,
      aspectRatio: '16:9',
      duration: 8,
    },
  });


  const jobId = response.job.jobId;
  console.log(`Video generation job initiated. Job ID: ${jobId}`);


  // Step 2: Wait for completion using the built-in .wait() helper
  const completed = await response.job.wait();


  if (completed.status === 'success') {
    const assetIds = completed.metadata?.assetIds || [];
    console.log('Video generation completed! Asset IDs:', assetIds);
  } else {
    console.error(`Video generation ended with status: ${completed.status}`);
  }
}


generateVideo();
```

### Python

```
from scenario_sdk import Scenario
import time


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


# Step 1: Initiate Video Generation
custom_video_model_id = "model_veo3"


print("Initiating video generation...")
response = client.generate.run_model(
    custom_video_model_id,
    body={
        "prompt": "A lone skateboarder, silhouetted against the golden burnish of a late afternoon sun, carves gracefully along a winding, empty coastal road high above the shimmering sea.",
        "generateAudio": True,
        "aspectRatio": "16:9",
        "duration": 8,
    },
)


job_id = response.job.job_id
print(f"Video generation job initiated. Job ID: {job_id}")


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
        print(f"Video generation completed! Asset IDs: {asset_ids}")
    elif status in ["failure", "canceled"]:
        print(f"Video generation failed or canceled: {poll.job.error}")
```

### cURL

Terminal window

```
curl -X POST \
  -u "YOUR_API_KEY:YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"A lone skateboarder, silhouetted against the golden burnish of a late afternoon sun, carves gracefully along a winding, empty coastal road high above the shimmering sea.",
    "generateAudio":true,
    "aspectRatio":"16:9",
    "duration":8
  }' \
  https://api.cloud.scenario.com/v1/generate/custom/model_veo3?projectId=yourprojectid
```
