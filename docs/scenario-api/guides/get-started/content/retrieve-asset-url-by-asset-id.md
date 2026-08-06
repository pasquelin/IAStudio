---
title: Retrieve Asset URL by Asset ID | Scenario Docs
---

Once you’ve generated an asset using the Scenario API, it will be referenced in the job response by one or more `assetIds`. To access the final downloadable URL of the generated asset, you need to call the `GET /assets/{assetId}` endpoint.

This guide explains how to retrieve the URL of a generated asset step by step, with examples in multiple programming languages.

## Endpoint

The endpoint to retrieve a specific asset is:

```
GET https://api.cloud.scenario.com/v1/assets/{assetId}
```

You need to provide the **assetId** obtained from the job’s metadata response.

## Workflow Overview

1. **Trigger a generation job** (e.g., `txt2img`, `img2img`, ControlNet, or IP-Adapter).
2. **Poll the job status** using `GET /jobs/{jobId}` until the status is `success`.
3. **Extract the`assetIds`** from the job metadata response.
4. **Call`GET /assets/{assetId}`** for each assetId to retrieve its details, including the **`asset.url`** field containing the final asset URL.

## Example Flow

### 1. Get `assetIds` from a completed job

When you poll a job until it’s completed, the response will look like this:

```
{
  "job": {
    "jobId": "job_abc123",
    "status": "success",
    "metadata": {
      "assetIds": [
        "asset_1gHMbHjSjWYLyAnd7ZxzPkcQ"
      ]
    }
  }
}
```

Here, you need to take `asset_1gHMbHjSjWYLyAnd7ZxzPkcQ` and use it in the next step.

---

### 2. Fetch Asset URL using `GET /assets/{assetId}`

When you call the asset endpoint, you’ll get a detailed JSON response:

```
{
  "asset": {
    "id": "asset_1gHMbHjSjWYLyAnd7ZxzPkcQ",
    "url": "https://cdn.scenario.com/assets/asset_1gHMbHjSjWYLyAnd7ZxzPkcQ.png",
    "createdAt": "2025-07-15T10:00:00Z",
    "metadata": {
      "prompt": "a mystical forest with glowing mushrooms"
    }
  }
}
```

The `asset.url` field is the direct downloadable URL of the generated asset.

---

## Code Examples

Here’s how to fetch the URL in different programming languages.

### TypeScript

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


const assetId = 'asset_1gHMbHjSjWYLyAnd7ZxzPkcQ';


async function getAssetUrl() {
  const response = await client.assets.retrieve(assetId);
  console.log('Asset URL:', response.asset.url);
}


getAssetUrl();
```

---

### Python

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


asset_id = "asset_1gHMbHjSjWYLyAnd7ZxzPkcQ"


response = client.assets.retrieve(asset_id)
print("Asset URL:", response.asset.url)
```

---

### cURL

Terminal window

```
curl -X GET \
  -u "YOUR_API_KEY:YOUR_API_SECRET" \
  https://api.cloud.scenario.com/v1/assets/asset_1gHMbHjSjWYLyAnd7ZxzPkcQ
```

Response:

```
{
  "asset": {
    "id": "asset_1gHMbHjSjWYLyAnd7ZxzPkcQ",
    "url": "https://cdn.scenario.com/assets/asset_1gHMbHjSjWYLyAnd7ZxzPkcQ.png"
  }
}
```

---

## Full End-to-End Example

Here’s the **complete flow** in pseudo-steps:

1. **Trigger a generation job** → receive `jobId`
2. **Poll`GET /jobs/{jobId}`** until `status` is `success`
3. **Extract`assetIds`** from `job.metadata`
4. **For each`assetId`, call`GET /assets/{assetId}`**
5. **Retrieve`asset.url`** for the downloadable asset
