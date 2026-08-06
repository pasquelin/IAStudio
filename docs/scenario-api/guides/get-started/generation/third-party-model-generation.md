---
title: Image Model Generation | Scenario Docs
---

## Introduction

The Scenario API offers a powerful suite of tools for programmatic access to AI-powered content generation.

This article will guide you through the process of using the Scenario API to generate images with your custom models, focusing on `POST /generate/custom/{modelId}` endpoint.

## The Custom Model Endpoint

For generating images with custom models, as well as for other advanced generation tasks like creating videos or 3D models, the Scenario API provides a flexible endpoint:

```
POST https://api.cloud.scenario.com/v1/generate/custom/{modelId}
```

This endpoint is designed to handle the complexities of various generative models. When you make a request to this endpoint, the API initiates a job in the background and returns a `jobId`. You can then use this `jobId` to poll for the status of your generation and retrieve the final asset once it’s complete.

### Authentication

The Scenario API uses Basic Authentication. You will need to provide your API key and secret, encoded in Base64, in the `Authorization` header of your request.

## Crafting Your Request

To generate an image, you will need to send a JSON payload in the body of your POST request. The parameters in this payload will vary depending on the model you are using. You can retrieve the specific inputs for any model by using the `GET /models/{modelId}` endpoint.

For our example, we will use the `model_imagen4-ultra` model. The key parameters for a text-to-image generation request with this model are `prompt` and `aspectRatio`.

| Parameter     | Type   | Description                                              | Allowed Values                                |
| ------------- | ------ | -------------------------------------------------------- | --------------------------------------------- |
| `prompt`      | string | A textual description of the image you want to generate. | Any string of text.                           |
| `aspectRatio` | string | The aspect ratio of the generated image.                 | `"1:1"`, `"4:3"`, `"3:4"`, `"9:16"`, `"16:9"` |

### Code Example: Generating an Image

Here is a Python example demonstrating how to make a request to the custom model endpoint to generate an image. This snippet initiates the generation process.

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


model_id = "model_imagen4-ultra"


response = client.generate.run_model(
    model_id,
    body={
        "prompt": "a futuristic cityscape at sunset, with flying cars and neon signs, photorealistic",
        "aspectRatio": "16:9",
    },
)


job_id = response.job.job_id
print(f"Image generation job initiated successfully. Job ID: {job_id}")
```

## Handling the Asynchronous Response

After initiating the generation, you need to poll the `/jobs/{jobId}` endpoint to check the status of your request. The job will go through `queued` and `processing` states before reaching `success`, `failed`, or `canceled`.

### Code Example: Polling for Results

This Python script shows how to poll for the job status and retrieve the asset ID of the generated image upon successful completion.

```
# Option 1: Use the built-in .wait() helper (recommended)
completed = response.job.wait()
print(f"Job status: {completed.status}")
asset_ids = completed.metadata.get("assetIds", [])
if asset_ids:
    print(f"Job complete. Asset ID: {asset_ids[0]}")


# Option 2: Manual polling
import time


job_id = response.job.job_id  # from the previous step


while True:
    poll = client.jobs.retrieve(job_id)
    status = poll.job.status
    print(f"Job status: {status}")


    if status == "success":
        asset_ids = poll.job.metadata.get("assetIds", [])
        if asset_ids:
            print(f"Job complete. Asset ID: {asset_ids[0]}")
        else:
            print("Job complete, but no asset IDs found.")
        break
    elif status in ["failed", "canceled"]:
        print(f"Job ended with status: {status}")
        break


    time.sleep(3)  # Wait for 3 seconds before polling again
```

## Conclusion

Generating images with custom models via the Scenario API is a straightforward process that opens up a world of creative possibilities. By using the `POST /generate/custom/{modelId}` endpoint and implementing a simple polling mechanism, you can integrate powerful, customized image generation directly into your applications and workflows. The flexibility of the API allows you to tailor your requests with specific parameters like `prompt` and `aspectRatio`, giving you fine-grained control over the creative output.

