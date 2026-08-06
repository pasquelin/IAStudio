## Retrieve

`client.collections.retrieve(stringcollectionID, CollectionRetrieveParamsquery?, RequestOptionsoptions?): CollectionRetrieveResponse`

**get** `/collections/{collectionId}`

Get the details of a collection

### Parameters

- `collectionID: string`

- `query: CollectionRetrieveParams`

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `CollectionRetrieveResponse`

  - `collection: Collection`

    - `id: string`

      The collection ID (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

    - `assetCount: number`

    - `createdAt: string`

      The collection creation date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `itemCount: number`

    - `modelCount: number`

    - `name: string`

      The collection name

    - `ownerId: string`

      The owner ID (example: "dcf121faaa1a0a0bbbd9ca1b73d62aea")

    - `updatedAt: string`

      The collection last update date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `thumbnail?: Thumbnail`

      The thumbnail for the collection (if any)

      - `assetId: string`

      - `url: string`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const collection = await client.collections.retrieve('collectionId');

console.log(collection.collection);
```

#### Response

```json
{
  "collection": {
    "id": "id",
    "assetCount": 0,
    "createdAt": "createdAt",
    "itemCount": 0,
    "modelCount": 0,
    "name": "name",
    "ownerId": "ownerId",
    "updatedAt": "updatedAt",
    "thumbnail": {
      "assetId": "assetId",
      "url": "url"
    }
  }
}
```
