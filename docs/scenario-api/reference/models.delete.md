## Delete

`client.models.delete(stringmodelID, ModelDeleteParamsparams?, RequestOptionsoptions?): ModelDeleteResponse`

**delete** `/models/{modelId}`

Delete a model

### Parameters

- `modelID: string`

- `params: ModelDeleteParams`

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `ModelDeleteResponse = unknown`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const model = await client.models.delete('modelId');

console.log(model);
```

#### Response

```json
{}
```
