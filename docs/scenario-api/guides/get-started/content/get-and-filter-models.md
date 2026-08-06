---
title: GET and Filter Models | Scenario Docs
---

One of the most common API tasks is retrieving the right model for your generation. The `GET /models` endpoint offers flexible filtering to help you distinguish between your private models, official Scenario models, and third-party community models.

**Endpoint**: `GET https://api.cloud.scenario.com/v1/models`

## Filtering by Privacy

**Private Models**: By default, calling `GET /models` with your credentials returns **only your private models** (models you have trained).

**Public Models**: To access public models, you can use the `GET /models/public` endpoint or specific tag filters.

## Filtering by Tags (Scenario vs. Third-Party)

You can use the `tags` query parameter to find specific categories of models. This is essential for building UIs that separate “Official” models from “Community” ones.

| Tag                  | Description                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **`sc:scenario`**    | **Official Scenario Models**. High-quality base models and styles curated by the Scenario team. |
| **`sc:third-party`** | **Third-Party Models**. Public models created by partners or the community.                     |

To retrieve Public Models (including Scenario’s official models and community public models), you typically use the dedicated public path or a privacy filter depending on your specific integration level.

**Endpoint:** `GET https://api.cloud.scenario.com/v1/models/public`

To view and update your model’s **Description**, use the following endpoints:

- `GET https://api.cloud.scenario.com/v1/models/{modelId}/description`
- `PUT https://api.cloud.scenario.com/v1/models/{modelId}/description`

### cURL Examples

**Get Official Scenario Models:**

```
curl -X GET "https://api.cloud.scenario.com/v1/models/public?tags=sc:scenario" \
  -H "Authorization: Basic <YOUR_BASE64_CREDENTIALS>
```

**Get Third-Party Models:**

```
curl -X GET "https://api.cloud.scenario.com/v1/models?tags=sc:third-party" \
  -H "Authorization: Basic <YOUR_BASE64_CREDENTIALS>"
```

---

## Integration Code Examples

Below are practical scripts to authenticate and fetch models based on the tags discussed above.

### TypeScript Example

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


async function getModels(tag?: string) {
  // Set parameters
  const params: { pageSize: number; privacy: 'public'; tags?: string } = {
    pageSize: 10,
    privacy: 'public',
  };
  if (tag) params.tags = tag;


  // Fetch data
  try {
    const response = await client.models.list(params);
    console.log(`--- Found ${response.models.length} models for tag: ${tag} ---`);


    response.models.forEach((m) => console.log(`- ${m.name} (${m.id})`));
  } catch (error) {
    console.error('Error:', error);
  }
}


// Usage
getModels('sc:scenario');    // Fetch Official Models
getModels('sc:third-party'); // Fetch Community Models
```



### Python Example

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


def get_models(tag=None):
    # Set parameters
    params = {"page_size": 10, "privacy": "public"}
    if tag:
        params["tags"] = tag


    # Fetch data
    try:
        response = client.models.list(**params)
        models = response.models


        print(f"--- Found {len(models)} models for tag: {tag} ---")
        for m in models:
            print(f"- {m.name} (ID: {m.id})")


    except Exception as e:
        print(f"Error: {e}")


# Usage
get_models(tag="sc:scenario")    # Fetch Official Models
get_models(tag="sc:third-party") # Fetch Community Models
```
