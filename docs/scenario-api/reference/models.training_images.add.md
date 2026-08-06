## Add

`client.models.trainingImages.add(stringmodelID, TrainingImageAddParamsparams, RequestOptionsoptions?): TrainingImageAddResponse`

**post** `/models/{modelId}/training-images`

Add a new training image to the given `modelId`

### Parameters

- `modelID: string`

- `params: TrainingImageAddParams`

  - `originalAssets?: boolean`

    Query param: If set to true, returns the original asset without transformation

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `assetId?: string`

    Body param: The asset ID to use as a training image (example: "asset_GTrL3mq4SXWyMxkOHRxlpw"). If provided, "data" and "name" parameters will be ignored.

  - `assetIds?: Array<string>`

    Body param: The asset IDs to use as training images (example: ["asset_GTrL3mq4SXWyMxkOHRxlpw", "asset_GTrL3mq4SXWyMxkOHRxlpw"])
    Used in batch mode, up to 10 asset IDs are allowed. Cannot be used with "assetId" or "data" and "name" parameters.

  - `data?: string`

    Body param: The training image as a data URL (example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=")

  - `name?: string`

    Body param: The original file name of the image (example: "my-training-image.jpg")

  - `preset?: "default" | "style" | "subject"`

    Body param: The preset to use for training images

    - `"default"`

    - `"style"`

    - `"subject"`

### Returns

- `TrainingImageAddResponse`

  - `trainingImage: TrainingImage`

    - `id: string`

      The training image ID (example: "asset_GTrL3mq4SXWyMxkOHRxlpw")

    - `automaticCaptioning: string`

      Automatic captioning of the image

    - `createdAt: string`

      The training image upload date as an ISO string (example: "2023-02-03T11:19:41.579Z")

    - `description: string`

      Description for the image

    - `downloadUrl: string`

      The URL of the image

    - `name: string`

      The original file name of the image (example: "my-training-image.jpg")

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.models.trainingImages.add('modelId');

console.log(response.trainingImage);
```

#### Response

```json
{
  "trainingImage": {
    "id": "id",
    "automaticCaptioning": "automaticCaptioning",
    "createdAt": "createdAt",
    "description": "description",
    "downloadUrl": "downloadUrl",
    "name": "name"
  }
}
```
