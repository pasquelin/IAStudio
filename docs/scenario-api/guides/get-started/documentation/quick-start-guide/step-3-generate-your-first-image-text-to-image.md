---
title: Step 3: Generate Your First Image (Text-to-Image) | Scenario Docs
---

Now that you have authenticated your requests, it’s time to generate your first image. While Scenario offers standard text-to-image endpoints, high-performance third-party models (such as **Flux** or **Imagen**) utilize a **Custom Generation** workflow.

Unlike standard generation, this process is **asynchronous**. You will submit a request to start a “job,” receive a Job ID, and then poll the API to retrieve your final image asset.

## 1. Initiate the Generation

To generate an image, you will send a `POST` request to the custom generation endpoint. You must specify a `modelId` (e.g., `model_bfl-flux-2-dev` or `model_imagen4-ultra`) in the URL.

### The Request

- **Endpoint:** `POST https://api.cloud.scenario.com/v1/generate/custom/{modelId}`
- **Key Parameters:**
- `prompt`: A detailed description of the image you want.
- `width`: The desired width of the image, must be a multiple of 16.
- `height`: The desired height of the image, must be a multiple of 16.

**Example — TypeScript:**

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


const response = await client.generate.runModel('model_bfl-flux-2-dev', {
  body: {
    prompt:
      'A cinematic shot of a futuristic neon city in the rain, hyper-realistic, 8k',
    width: 1344,
    height: 768,
  },
});


console.log(response.job.id);
```

**Example — Python:**

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


response = client.generate.run_model(
    "model_bfl-flux-2-dev",
    body={
        "prompt": "A cinematic shot of a futuristic neon city in the rain, hyper-realistic, 8k",
        "width": 1344,
        "height": 768,
    },
)


print(response.job.id)
```

**Example — cURL:**

Terminal window

```
curl -X POST "https://api.cloud.scenario.com/v1/generate/custom/model_bfl-flux-2-dev" \
     -u "YOUR_API_KEY:YOUR_API_SECRET" \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "A cinematic shot of a futuristic neon city in the rain, hyper-realistic, 8k",
       "width": 1344,
       "height": 768,
     }'
```

**The Response:** The API will return a `job` object containing a `jobId`.

```
{
  "job": {
    "id": "job_abcd1234efgh",
    "status": "queued"
  }
}
```

---

## 2. Poll for the Result

Because the image is being processed in the cloud, you need to check the status of your `jobId` until it is completed.

**Endpoint:** `GET https://api.cloud.scenario.com/v1/jobs/{jobId}`

**Example — TypeScript:**

```
// Option 1: poll manually
const job = await client.jobs.retrieve('job_abcd1234efgh');
console.log(job.status);


// Option 2: use the SDK helper to wait until the job reaches a terminal status
const completed = await response.job.wait();
console.log(completed.status);
console.log(completed.metadata?.assetIds);
```

**Example — Python:**

```
import time


while True:
    job = client.jobs.retrieve("job_abcd1234efgh")
    if job.status in ("success", "failure", "canceled"):
        break
    time.sleep(2)


print(job.status)
```

**Example — cURL:**

Terminal window

```
curl -u "YOUR_API_KEY:YOUR_API_SECRET" \
     "https://api.cloud.scenario.com/v1/jobs/job_abcd1234efgh"
```

Keep polling every 2–3 seconds until the `status` changes from `"queued"` or `"in-progress"` to `"success"`.

---

## 3. Retrieve Your Image

Once the job status is `"success"`, the response will include an `images` array (or `result` object) containing the URL of your generated asset.

**Success Response Snippet:**

```
{
  "job": {
    "id": "job_abcd1234efgh",
    "status": "success",
    "result": {
      "images": [
        {
          "url": "https://media.scenario.com/assets/asset_xyz123.png"
        }
      ]
    }
  }
}
```

## What’s Next?

Now that you’ve successfully generated an image using a third-party model, you can:

- **Explore advanced parameters:** Check the specific [Parameters Reference](/get-started/generation/3d-model-generation/index.md) for the model you are using.
- **List available models:** Use `GET /v1/models` to see which other models you can use.
- **Train your own:** Move to Step 4 to learn how to train a model on your own specific art style.
