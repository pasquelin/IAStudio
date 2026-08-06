## Get Tags

`client.workflows.getTags(WorkflowGetTagsParamsquery?, RequestOptionsoptions?): WorkflowGetTagsResponse`

**get** `/workflows/tags`

Get all unique tags from workflows in a project (all privacy levels). Optionally filter by status.

### Parameters

- `query: WorkflowGetTagsParams`

  - `projectId?: string`

    The projectId used for ownership resource management. Either to assert ownership or to set the owner of the resource(s)

  - `status?: unknown`

### Returns

- `WorkflowGetTagsResponse`

  - `tags: Array<string>`

    Array of unique tags from workflows in the project

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const response = await client.workflows.getTags();

console.log(response.tags);
```

#### Response

```json
{
  "tags": [
    "string"
  ]
}
```
