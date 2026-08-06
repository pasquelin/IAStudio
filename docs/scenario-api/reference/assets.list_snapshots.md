## List Snapshots

`client.assets.listSnapshots(stringassetID, AssetListSnapshotsParamsquery?, RequestOptionsoptions?): SnapshotsCursor<AssetListSnapshotsResponse>`

**get** `/assets/{assetId}/snapshots`

List snapshots of a canvas type asset

### Parameters

- `assetID: string`

- `query: AssetListSnapshotsParams`

  - `pageSize?: number`

    The number of items to return in the response. The default value is 10, maximum value is 100, minimum value is 10

  - `paginationToken?: string`

    A token you received in a previous request to query the next page of items

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `AssetListSnapshotsResponse`

  - `authorId: string`

  - `hash: string`

  - `rawData: string`

  - `takenAt: number`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

// Automatically fetches more pages as needed.
for await (const assetListSnapshotsResponse of client.assets.listSnapshots('assetId')) {
  console.log(assetListSnapshotsResponse.authorId);
}
```

#### Response

```json
{
  "snapshots": [
    {
      "authorId": "authorId",
      "hash": "hash",
      "rawData": "rawData",
      "takenAt": 0
    }
  ],
  "nextPaginationToken": "nextPaginationToken"
}
```
