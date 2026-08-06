## Download

`client.models.download(stringmodelID, ModelDownloadParamsparams, RequestOptionsoptions?): ModelDownloadResponse`

**post** `/models/{modelId}/download`

Request a link to download the given `modelId`

### Parameters

- `modelID: string`

- `params: ModelDownloadParams`

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `modelEpoch?: string`

    Body param: The epoch hash of the model to download
    Only available for Flux Lora Trained models with epochs
    Will only apply to the main model in the download request
    If not set, the default (latest or setup at model level) epoch will be used

### Returns

- `ModelDownloadResponse`

  - `jobId: string`

    The job id associated with the download request

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.models.download('modelId');

console.log(response.jobId);
```

#### Response

```json
{
  "jobId": "jobId"
}
```
