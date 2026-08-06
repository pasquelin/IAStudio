## Replace Pairs

`client.models.trainingImages.replacePairs(stringmodelID, TrainingImageReplacePairsParamsparams, RequestOptionsoptions?): TrainingImageReplacePairsResponse`

**put** `/models/{modelId}/training-images/pairs`

Replace all training image pairs for the given `modelId`

### Parameters

- `modelID: string`

- `params: TrainingImageReplacePairsParams`

  - `body: Array<Body>`

    Body param: Array of training image pairs

    - `instruction?: string`

      The instruction for the image pair, source to target

    - `sourceId?: string`

      The source asset ID (must be a training asset)

    - `targetId?: string`

      The target asset ID (must be a training asset)

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `TrainingImageReplacePairsResponse`

  - `count: number`

    Number of training image pairs

  - `pairs: Array<Pair>`

    Array of training image pairs

    - `instruction?: string`

      The instruction for the image pair, source to target

    - `sourceId?: string`

      The source asset ID (must be a training asset)

    - `targetId?: string`

      The target asset ID (must be a training asset)

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.models.trainingImages.replacePairs('modelId', { body: [{}] });

console.log(response.count);
```

#### Response

```json
{
  "count": 0,
  "pairs": [
    {
      "instruction": "instruction",
      "sourceId": "sourceId",
      "targetId": "targetId"
    }
  ]
}
```
