## Delete Images

`client.models.deleteImages(stringmodelID, ModelDeleteImagesParamsparams, RequestOptionsoptions?): ModelDeleteImagesResponse`

**delete** `/models/{modelId}/images`

Delete an image

### Parameters

- `modelID: string`

- `params: ModelDeleteImagesParams`

  - `ids: Array<string>`

    The asset ids of the images to delete

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `ModelDeleteImagesResponse = unknown`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.models.deleteImages('modelId', { ids: ['string'] });

console.log(response);
```

#### Response

```json
{}
```
