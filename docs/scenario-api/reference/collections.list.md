## List

`client.collections.list(CollectionListParamsquery?, RequestOptionsoptions?): CollectionsCursor<CollectionListResponse>`

**get** `/collections`

List collections of a team

### Parameters

- `query: CollectionListParams`

  - `pageSize?: number`

    The number of items to return in the response. The default value is 10, maximum value is 100, minimum value is 1

  - `paginationToken?: string`

    A token you received in a previous request to query the next page of items

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `CollectionListResponse`

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

// Automatically fetches more pages as needed.
for await (const collectionListResponse of client.collections.list()) {
  console.log(collectionListResponse.id);
}
```

#### Response

```json
{
  "collections": [
    {
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
  ],
  "nextPaginationToken": "nextPaginationToken"
}
```
