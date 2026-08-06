## Request Batch

`client.assets.download.requestBatch(DownloadRequestBatchParamsparams, RequestOptionsoptions?): DownloadRequestBatchResponse`

**post** `/assets/download`

Request a link to batch download assets (batch limited to 1000 assets)

### Parameters

- `params: DownloadRequestBatchParams`

  - `options: Options`

    Body param

    - `fileNameTemplate: string`

      A file naming convention as a string with the following available parameters:
      <seed> (seed used to generate the asset)
      <num> (index of the asset in the inference)
      <prompt> (prompt of the inference)
      <generator> (prompt of the generator)
      Example: "<generator>-<prompt>-<num>-<seed>"

    - `flat?: boolean`

      Flag to prevent grouping assets in directories and store them flat

  - `query: Query`

    Body param

    - `assetIds: Array<string>`

      Every individual assets specified will be included in the archive

    - `inferenceIds: Array<string>`

      All assets issued from the provided inference ids will be included in the archive

    - `modelIds: Array<string>`

      All assets issued from the provided model ids will be included in the archive

  - `projectId?: string`

    Query param: The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `DownloadRequestBatchResponse`

  - `jobId: string`

    The job id associated with the download request

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.assets.download.requestBatch({
  options: { fileNameTemplate: 'fileNameTemplate' },
  query: {
    assetIds: ['string'],
    inferenceIds: ['string'],
    modelIds: ['string'],
  },
});

console.log(response.jobId);
```

#### Response

```json
{
  "jobId": "jobId"
}
```
