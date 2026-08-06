## Update Tags

`client.assets.updateTags(stringassetID, AssetUpdateTagsParamsparams, RequestOptionsoptions?): AssetUpdateTagsResponse`

**put** `/assets/{assetId}/tags`

Add/delete tags on a specific asset

### Parameters

- `assetID: string`

- `params: AssetUpdateTagsParams`

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `add?: Array<string>`

    Body param: The list of tags to add

  - `_delete?: Array<string>`

    Body param: The list of tags to delete

  - `strict?: boolean`

    Body param: If true, the function will throw an error if:

    - one of the tags to add already exists
    - one of the tags to delete is not found
      If false, the endpoint will behave as if it was idempotent

### Returns

- `AssetUpdateTagsResponse`

  - `added: Array<string>`

    The list of added tags

  - `deleted: Array<string>`

    The list of deleted tags

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.assets.updateTags('assetId');

console.log(response.added);
```

#### Response

```json
{
  "added": [
    "string"
  ],
  "deleted": [
    "string"
  ]
}
```
