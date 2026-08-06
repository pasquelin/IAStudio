## Get Status

`client.assets.download.getStatus(stringjobID, DownloadGetStatusParamsquery?, RequestOptionsoptions?): DownloadGetStatusResponse`

**get** `/assets/download/{jobId}`

Retrieve the status and the url of a batch download assets request

### Parameters

- `jobID: string`

- `query: DownloadGetStatusParams`

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

### Returns

- `DownloadGetStatusResponse`

  - `jobId: string`

    The job id associated with the download request

  - `jobStatus: string`

    The current job status

  - `downloadUrl?: string`

    The download url

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.assets.download.getStatus('jobId');

console.log(response.jobId);
```

#### Response

```json
{
  "jobId": "jobId",
  "jobStatus": "jobStatus",
  "downloadUrl": "downloadUrl"
}
```
