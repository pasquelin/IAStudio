## Delete Multiple

`client.assets.deleteMultiple(AssetDeleteMultipleParamsparams, RequestOptionsoptions?): AssetDeleteMultipleResponse`

**delete** `/assets`

Delete multiple assets

### Parameters

- `params: AssetDeleteMultipleParams`

  - `assetIds: Array<string>`

    Body param: The ids of the assets to delete. (Max 100 at once)

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `AssetDeleteMultipleResponse = unknown`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.assets.deleteMultiple({ assetIds: ['string'] });

console.log(response);
```

#### Response

```json
{}
```
