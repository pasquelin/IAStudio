## Delete

`client.workflows.delete(stringworkflowID, WorkflowDeleteParamsparams?, RequestOptionsoptions?): WorkflowDeleteResponse`

**delete** `/workflows/{workflowId}`

Delete workflow

### Parameters

- `workflowID: string`

- `params: WorkflowDeleteParams`

  - `projectId?: unknown`

### Returns

- `WorkflowDeleteResponse = unknown`

### Example

```typescript
import Scenario from '@scenario-labs/sdk';

const client = new Scenario({
  apiKey: process.env['SCENARIO_SDK_API_KEY'], // This is the default and can be omitted
  apiSecret: process.env['SCENARIO_SDK_API_SECRET'], // This is the default and can be omitted
});

const workflow = await client.workflows.delete('workflowId');

console.log(workflow);
```

#### Response

```json
{}
```
