## Model Search

`client.search.modelSearch(SearchModelSearchParamsparams, RequestOptionsoptions?): SearchHitsOffset<SearchModelSearchResponse>`

**post** `/search/models`

Search for models.
At least one of the following fields must have a value: `query`, `filter`, `image`, or `images`.

`image`, and `images` are mutually exclusive.

### Parameters

- `params: SearchModelSearchParams`

  - `originalAssets?: boolean`

    Query param: If set to true, returns the original asset without transformation

  - `originalModels?: unknown`

    Query param

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `filter?: string`

    Body param: Filter queries by an attribute's value

  - `hitsPerPage?: number`

    Body param: Maximum number of documents returned for a page. Must be used with `page`.

  - `image?: string`

    Body param: Search for model with `image` as a reference

    Must be an existing `AssetId` or a valid data URL.

  - `images?: Images`

    Body param: Search for model with `images.like` and `images.unlike` as a reference

    Must be an array of existing `AssetId` or valid data URLs.

    - `like?: Array<string>`

      Search for model images with `images.like` as a reference

      Must be an array of existing `AssetId` or valid data URLs.

    - `unlike?: Array<string>`

      Search for model images that are not similar to `images.unlike` as a reference

      Must be an array of existing `AssetId` or valid data URLs.

  - `imageSemanticRatio?: number`

    Body param: Image embedding ratio for hybrid search, applied when `image`, `images.like`, or `images.unlike`
    are provided

  - `limit?: number`

    Body param: Maximum number of documents returned. Must be used with `offset`.

  - `offset?: number`

    Body param: Number of documents to skip. Must be used with `limit`. Starts from 0.

  - `page?: number`

    Body param: Request a specific page of results. Must be used with `hitsPerPage`.

  - `_public?: boolean`

    Body param: Search for public images not necessarily belonging to the current `ownerId`

  - `query?: string`

    Body param: A string used for querying search results.

  - `querySemanticRatio?: number`

    Body param: Query embedding for hybrid search, if possible

  - `sortBy?: Array<string>`

    Body param: Sort the search results by the given attributes. Each attribute in the list must be followed by a colon (`:`) and the preferred sorting order: either ascending (`asc`) or descending (`desc`).

    Example: `['createdAt:desc']`

### Returns

- `SearchModelSearchResponse`

  - `id: string`

    Unique identifier for the model (e.g., "model_GTrL3mq4SXWyMxkOHRxlpw")

  - `authorId: string`

    User ID of the model creator/author

  - `capabilities: Array<string>`

    Array of model capabilities

  - `collectionIds: Array<string>`

    Array of collection IDs this model belongs to

  - `concepts: Array<Concept>`

    Array of concept models associated with this model
    Each concept contains a reference to its source model

    - `modelId: string`

      ID of the concept's source model

  - `createdAt: string`

    Creation timestamp in ISO 8601 format (e.g., "2025-01-16T11:19:41.579Z")

  - `exampleAssetIds: Array<string>`

    Array of example asset IDs associated with this model

  - `name: string`

    Display name of the model

  - `ownerId: string`

    Project ID of the model owner

  - `privacy: string`

    Privacy setting of the model ("public", "private", or "unlisted")

  - `shortDescription: string`

    Short description of the model

  - `source: string`

    Source/origin of the model (e.g., "training", "import")

  - `tags: Array<string>`

    Array of user-assigned tags for categorization

  - `teamId: string`

    Team ID of the model owner

  - `trainingImagesNumber: number`

    Number of images used to train this model

  - `type: string`

    Type of the model (e.g., "flux.1", "flux.1-lora")

  - `updatedAt: string`

    Last modification timestamp in ISO 8601 format (e.g., "2025-01-16T11:19:41.579Z")

  - `parentModelId?: string`

    ID of the parent model this model was derived from

  - `score?: number`

    Score assigned to the model based on usage and popularity

  - `thumbnail?: Thumbnail`

    Thumbnail image information for the model

    - `assetId: string`

      ID of the asset used as thumbnail

    - `url: string`

      Signed URL of the thumbnail

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

// Automatically fetches more pages as needed.
for await (const searchModelSearchResponse of client.search.modelSearch()) {
  console.log(searchModelSearchResponse.id);
}
```

#### Response

```json
{
  "hits": [
    {
      "id": "id",
      "authorId": "authorId",
      "capabilities": [
        "string"
      ],
      "collectionIds": [
        "string"
      ],
      "concepts": [
        {
          "modelId": "modelId"
        }
      ],
      "createdAt": "createdAt",
      "exampleAssetIds": [
        "string"
      ],
      "name": "name",
      "ownerId": "ownerId",
      "privacy": "privacy",
      "shortDescription": "shortDescription",
      "source": "source",
      "tags": [
        "string"
      ],
      "teamId": "teamId",
      "trainingImagesNumber": 0,
      "type": "type",
      "updatedAt": "updatedAt",
      "parentModelId": "parentModelId",
      "score": 0,
      "thumbnail": {
        "assetId": "assetId",
        "url": "url"
      }
    }
  ],
  "limit": 0,
  "offset": 0,
  "estimatedTotalHits": 0,
  "hitsPerPage": 0,
  "page": 0,
  "totalHits": 0,
  "totalPages": 0
}
```
