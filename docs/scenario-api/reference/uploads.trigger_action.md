## Trigger Action

`client.uploads.triggerAction(stringuploadID, UploadTriggerActionParamsparams, RequestOptionsoptions?): UploadTriggerActionResponse`

**post** `/uploads/{uploadId}/action`

Trigger an action on upload

### Parameters

- `uploadID: string`

- `params: UploadTriggerActionParams`

  - `action: "complete"`

    Body param: The action to perform on an upload, currently only "upload-complete" is supported

    - `"complete"`

  - `projectId?: unknown`

    Query param

### Returns

- `UploadTriggerActionResponse`

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

const response = await client.uploads.triggerAction('uploadId', { action: 'complete' });

console.log(response.upload);
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
