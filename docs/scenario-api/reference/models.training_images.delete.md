## Delete

`client.models.trainingImages.delete(stringtrainingImageID, TrainingImageDeleteParamsparams, RequestOptionsoptions?): TrainingImageDeleteResponse`

**delete** `/models/{modelId}/training-images/{trainingImageId}`

Delete the given `trainingImageId` from the given `modelId`

### Parameters

- `trainingImageID: string`

- `params: TrainingImageDeleteParams`

  - `modelId: string`

    Path param: The training image's `modelId`

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `TrainingImageDeleteResponse = unknown`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const trainingImage = await client.models.trainingImages.delete('trainingImageId', {
  modelId: 'modelId',
});

console.log(trainingImage);
```

#### Response

```json
{}
```
