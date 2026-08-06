## Request

`client.assets.download.request(stringassetID, DownloadRequestParamsparams, RequestOptionsoptions?): DownloadRequestResponse`

**post** `/assets/{assetId}/download`

Request a link to download the given `assetId` in the given `targetFormat`

### Parameters

- `assetID: string`

- `params: DownloadRequestParams`

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `targetFormat?: "gif" | "heif" | "jpeg" | 10 more`

    Body param: The format to download the asset in

    - `"gif"`

    - `"heif"`

    - `"jpeg"`

    - `"jpg"`

    - `"png"`

    - `"svg"`

    - `"webp"`

    - `"avif"`

    - `"tif"`

    - `"tiff"`

    - `"glb"`

    - `"fbx"`

    - `"obj"`

### Returns

- `DownloadRequestResponse`

  - `url: string`

    The signed URL to download the asset in the given format

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.assets.download.request('assetId');

console.log(response.url);
```

#### Response

```json
{
  "url": "url"
}
```
