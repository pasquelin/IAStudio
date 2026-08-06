---
title: Step 2: Authenticate Your Requests | Scenario Docs
---

The Scenario API uses **Basic Authentication** with your API Key and API Secret.

### Basic Authentication

Use your API Key and API Secret, joined by a colon and Base64-encoded.

**1. Combine Key and Secret:**\
`YOUR_API_KEY:YOUR_API_SECRET`

**2. Base64 Encode the Combined String:**\
For example, if `YOUR_API_KEY` is `hello` and `YOUR_API_SECRET` is `world`, the combined string is `hello:world`. The Base64 encoding of `hello:world` is `aGVsbG86d29ybGQ=`.

**3. Construct the Authorization Header:**\
`Authorization: Basic aGVsbG86d29ybGQ=`

#### TypeScript

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


const data = await client.users.get();
console.log(data);
```

#### Python

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


response = client.users.get()
print(response)
```

#### cURL

Terminal window

```
curl -u "YOUR_API_KEY:YOUR_API_SECRET" \
  https://api.cloud.scenario.com/v1/user
```
