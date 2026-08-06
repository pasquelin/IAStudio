## Delete

`client.collections.delete(stringcollectionID, CollectionDeleteParamsparams?, RequestOptionsoptions?): CollectionDeleteResponse`

**delete** `/collections/{collectionId}`

Delete a collection

### Parameters

- `collectionID: string`

- `params: CollectionDeleteParams`

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `CollectionDeleteResponse = unknown`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const collection = await client.collections.delete('collectionId');

console.log(collection);
```

#### Response

```json
{}
```
