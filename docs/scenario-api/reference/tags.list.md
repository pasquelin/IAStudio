## List

`client.tags.list(TagListParamsquery?, RequestOptionsoptions?): TagsCursor<TagListResponse>`

**get** `/tags`

List all tags in use for the given `projectId`

### Parameters

- `query: TagListParams`

  - `pageSize?: number`

    The number of items to return in the response. The default value is 50, maximum value is 100, minimum value is 1

  - `paginationToken?: string`

    A token you received in a previous request to query the next page of items

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `TagListResponse`

  - `createdAt: string`

    The tag creation date as an ISO string (example: "2023-02-03T11:19:41.579Z")

  - `itemCount: number`

    The number of items that have this tag

  - `ownerId: string`

    The owner ID (example: "dcf121faaa1a0a0bbbd9ca1b73d62aea")

  - `tagName: string`

    The tag name

  - `updatedAt: string`

    The tag last update date as an ISO string (example: "2023-02-03T11:19:41.579Z")

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

// Automatically fetches more pages as needed.
for await (const tagListResponse of client.tags.list()) {
  console.log(tagListResponse.createdAt);
}
```

#### Response

```json
{
  "tags": [
    {
      "createdAt": "createdAt",
      "itemCount": 0,
      "ownerId": "ownerId",
      "tagName": "tagName",
      "updatedAt": "updatedAt"
    }
  ],
  "nextPaginationToken": "nextPaginationToken"
}
```
