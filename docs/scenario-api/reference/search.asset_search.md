## Asset Search

`client.search.assetSearch(SearchAssetSearchParamsparams, RequestOptionsoptions?): SearchHitsOffset<SearchAssetSearchResponse>`

**post** `/search/assets`

Search for assets.
At least one of the following fields must have a value: `query`, `filter`, `image`, or `images`.

`image`, `images` are mutually exclusive.

### Parameters

- `params: SearchAssetSearchParams`

  - `originalAssets?: boolean`

    Query param: If set to true, returns the original asset without transformation

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `filter?: string`

    Body param: Filter queries by an attribute's value

  - `hitsPerPage?: number`

    Body param: Maximum number of documents returned for a page. Must be used with `page`.

  - `image?: string`

    Body param: Search for similar images with `image` as a reference.

    Must be an existing `AssetId` or a valid data URL.

  - `images?: Images`

    Body param: Search for similar images with `images.like` and `images.unlike` as a reference

    Must be arrays of existing `AssetId` or valid data URLs.

    - `like?: Array<string>`

      Search for similar images with `images.like` as a reference.

      Must be an array of existing `AssetId` or valid data URLs.

    - `unlike?: Array<string>`

      Search for images that are not similar to `images.unlike` as a reference.

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

- `SearchAssetSearchResponse`

  - `id: string`

    Unique identifier for the asset (e.g., "asset_GTrL3mq4SXWyMxkOHRxlpw")

  - `authorId: string`

    User ID of the asset creator/author

  - `collectionIds: Array<string>`

    Array of collection IDs this asset belongs to

  - `createdAt: string`

    Creation timestamp in ISO 8601 format (e.g., "2025-01-16T11:19:41.579Z")

  - `metadata: Metadata`

    Metadata containing detailed information about the asset's properties and generation parameters

    - `aspectRatio?: string`

      Aspect ratio of the asset (e.g., "1:1", "16:9")

    - `baseModelId?: string`

      ID of the base model used for generation

    - `guidance?: number`

      Guidance scale used for diffusion models to control prompt adherence

    - `height?: number`

      Height of the asset in pixels

    - `kind?: string`

      Classification of the asset (e.g., "image", "video")

    - `modelId?: string`

      ID of the specific model used if asset is model-based

    - `modelType?: string`

      Type of model used for generation (e.g., "flux.1", "flux.1-lora")

    - `name?: string`

      Custom name given to the asset

    - `negativePrompt?: string`

      Negative prompt used during generation to specify what to avoid

    - `negativePromptStrength?: number`

      For Flux models: controls the influence of the negative prompt

    - `numInferenceSteps?: number`

      Number of inference steps used during generation

    - `parentJobId?: string`

      ID of the parent job that created this asset

    - `prompt?: string`

      Text prompt used to generate the asset

    - `scheduler?: string`

      Scheduler algorithm used during generation

    - `seed?: string`

      Random seed used for generation, enables reproducibility

    - `size?: number`

      File size of the asset in bytes

    - `text?: string`

      Text used to generate the asset: mainly for speech to text

    - `thumbnail?: Thumbnail`

      Thumbnail image information for the asset. Ex. Canvas thumbnail

      - `assetId: string`

        ID of the asset used as thumbnail

    - `type?: string`

      Specific type/category of the asset (e.g., "canvas", "inference-txt")

    - `width?: number`

      Width of the asset in pixels

  - `mimeType: string`

    MIME type of the asset (e.g., "image/png", "image/jpeg")

  - `nsfw: Array<string>`

    Array of detected NSFW categories

  - `ownerId: string`

    Project ID of the asset owner

  - `privacy: string`

    Privacy setting of the asset ("public", "private", or "unlisted")

  - `tags: Array<string>`

    Array of user-assigned tags for categorization

  - `teamId: string`

    Team ID of the asset owner

  - `updatedAt: string`

    Last modification timestamp in ISO 8601 format (e.g., "2025-01-16T11:19:41.579Z")

  - `url: string`

    Signed URL of the asset

  - `content?: string`

    Indexed body for text assets (`AssetKind.Text`). The full content lives in S3;
    this field carries up to TEXT_INDEX_MAX_BYTES of UTF-8 for BM25 lookup.
    Always undefined for non-text assets.

  - `description?: string`

    Textual description of the asset. Can be either:

    - User-provided description for training images
    - Automatically generated caption for images and videos assets
    - Automatically generated description for audio assets

  - `score?: number`

    Score assigned to the asset based on usage and popularity

  - `thumbnail?: Thumbnail`

    Thumbnail preview of the asset 3D, video...

    - `assetId: string`

      ID of the asset used as thumbnail

    - `url: string`

      Signed URL of the thumbnail

  - `transcription?: string`

    Transcription of the asset. Can be either:

    - Automatically generated transcription for audio assets with speech

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

// Automatically fetches more pages as needed.
for await (const searchAssetSearchResponse of client.search.assetSearch()) {
  console.log(searchAssetSearchResponse.id);
}
```

#### Response

```json
{
  "hits": [
    {
      "id": "id",
      "authorId": "authorId",
      "collectionIds": [
        "string"
      ],
      "createdAt": "createdAt",
      "metadata": {
        "aspectRatio": "aspectRatio",
        "baseModelId": "baseModelId",
        "guidance": 0,
        "height": 0,
        "kind": "kind",
        "modelId": "modelId",
        "modelType": "modelType",
        "name": "name",
        "negativePrompt": "negativePrompt",
        "negativePromptStrength": 0,
        "numInferenceSteps": 0,
        "parentJobId": "parentJobId",
        "prompt": "prompt",
        "scheduler": "scheduler",
        "seed": "seed",
        "size": 0,
        "text": "text",
        "thumbnail": {
          "assetId": "assetId"
        },
        "type": "type",
        "width": 0
      },
      "mimeType": "mimeType",
      "nsfw": [
        "string"
      ],
      "ownerId": "ownerId",
      "privacy": "privacy",
      "tags": [
        "string"
      ],
      "teamId": "teamId",
      "updatedAt": "updatedAt",
      "url": "url",
      "content": "content",
      "description": "description",
      "score": 0,
      "thumbnail": {
        "assetId": "assetId",
        "url": "url"
      },
      "transcription": "transcription"
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
