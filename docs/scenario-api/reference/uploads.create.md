## Create

`client.uploads.create(UploadCreateParamsparams, RequestOptionsoptions?): UploadCreateResponse`

**post** `/uploads`

Create a temporary upload URL for a file. Support multipart uploads. Return a list of URLs for each part of the file.

### Parameters

- `params: UploadCreateParams`

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `assetOptions?: AssetOptions`

    Body param: Asset extra options. Only available for kinds which produce an asset. (Not available for model kind)

    - `collectionIds?: Array<string>`

      The collection ids to add the asset to.

    - `hide?: boolean`

      Specify if the asset should be hidden from the user.

    - `parentId?: string`

      The parentId of the asset.

  - `civitaiModelUrl?: string`

    Body param: The civitai.com url of the model (example: "https://civitai.com/models/370194/translucent-subsurface-scattering-test?modelVersionId=413566").

  - `contentType?: string`

    Body param: Required for multipart upload. The MIME type of the file (example: "image/jpeg")

  - `fileName?: string`

    Body param: Required for multipart upload. The original file name of the image (example: "low-res-image.jpg"). It will be ignored if assetId is provided.

  - `fileSize?: number`

    Body param: Required for multipart upload. The size of the file in bytes

  - `huggingFaceModelName?: string`

    Body param: The huggingface.co modelName (example: "black-forest-labs/FLUX.1-dev").
    No need to setup other fields if you setup huggingFaceModelName

  - `kind?: "3d" | "asset" | "audio" | 5 more`

    Body param: Required for multipart upload and url. The purpose of the file once validated (example: "model")

    - `"3d"`

    - `"asset"`

    - `"audio"`

    - `"avatar"`

    - `"image"`

    - `"model"`

    - `"text"`

    - `"video"`

  - `parts?: number`

    Body param: Required for multipart upload. The number of parts the file will be uploaded in

  - `url?: string`

    Body param: The url where to download the file.
    If you setup url you MUST setup kind as well.

### Returns

- `UploadCreateResponse`

  - `upload: Upload`

    - `id: string`

    - `authorId: string`

    - `createdAt: string`

    - `fileName: string`

    - `kind: "3d" | "asset" | "audio" | 5 more`

      The kind of the file once validated (example: "model")

      - `"3d"`

      - `"asset"`

      - `"audio"`

      - `"avatar"`

      - `"image"`

      - `"model"`

      - `"text"`

      - `"video"`

    - `ownerId: string`

    - `source: "civitai" | "huggingface" | "multipart" | 2 more`

      - `"civitai"`

      - `"huggingface"`

      - `"multipart"`

      - `"other"`

      - `"url"`

    - `status: "complete" | "failed" | "imported" | 3 more`

      - `"complete"`

      - `"failed"`

      - `"imported"`

      - `"pending"`

      - `"validated"`

      - `"validating"`

    - `updatedAt: string`

    - `assetOptions?: AssetOptions`

      - `collectionIds?: Array<string>`

        The collection ids to add the asset to.

      - `hide?: boolean`

        Specify if the asset should be hidden from the user.

      - `parentId?: string`

        The parentId of the asset.

    - `config?: unknown`

    - `contentType?: string`

    - `entityId?: string`

    - `errorMessage?: string`

    - `fileSize?: number`

    - `jobId?: string`

    - `originalFileName?: string`

    - `parts?: Array<Part>`

      - `expires: string`

      - `number: number`

      - `url: string`

    - `partsCount?: number`

    - `provider?: "civitai" | "huggingface" | "other"`

      - `"civitai"`

      - `"huggingface"`

      - `"other"`

    - `url?: string`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const upload = await client.uploads.create();

console.log(upload.upload);
```

#### Response

```json
{
  "upload": {
    "id": "id",
    "authorId": "authorId",
    "createdAt": "createdAt",
    "fileName": "fileName",
    "kind": "3d",
    "ownerId": "ownerId",
    "source": "civitai",
    "status": "complete",
    "updatedAt": "updatedAt",
    "assetOptions": {
      "collectionIds": [
        "string"
      ],
      "hide": true,
      "parentId": "parentId"
    },
    "config": {},
    "contentType": "contentType",
    "entityId": "entityId",
    "errorMessage": "errorMessage",
    "fileSize": 0,
    "jobId": "jobId",
    "originalFileName": "originalFileName",
    "parts": [
      {
        "expires": "expires",
        "number": 0,
        "url": "url"
      }
    ],
    "partsCount": 0,
    "provider": "civitai",
    "url": "url"
  }
}
```
