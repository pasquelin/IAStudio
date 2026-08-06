---
title: Workflows and Apps | Scenario Docs
---

Workflows are programmable pipelines that allow you to chain multiple AI models and tools together to automate complex creative tasks. A workflow can accept inputs, process them through multiple nodes (models/tools), and produce outputs.

**Apps** are workflows that can be discovered and used by anyone through the API. They provide pre-built creative pipelines that you can integrate into your applications.

---

## Workflows

### Core Concepts

- **Workflow**: A pipeline definition containing nodes, inputs, and execution logic
- **Node**: A step in the workflow (e.g., a model inference, transformation, or logic operation)
- **Inputs**: Parameters that must be provided when running the workflow
- **Flow**: The graph of nodes that defines the workflow execution order
- **Privacy**: Controls who can access the workflow (`public`, `private`)
- **Status**: Lifecycle state (`draft`, `ready`, `deleted`)

### Workflow Privacy Levels

| Privacy   | Description                                         |
| --------- | --------------------------------------------------- |
| `public`  | Discoverable by anyone, can be run by anyone (Apps) |
| `private` | Only accessible by the owning project               |

### Workflow Status

| Status    | Description                          |
| --------- | ------------------------------------ |
| `draft`   | Work in progress, cannot be executed |
| `ready`   | Complete and executable              |
| `deleted` | Soft-deleted (not returned by API)   |

---

## Endpoints

### List Workflows

Retrieve a list of workflows. By default, returns private workflows for authenticated users.

**Endpoint:**

```
GET /v1/workflows
```

**Query Parameters:**

| Parameter         | Type    | Required | Default   | Description                                       |
| ----------------- | ------- | -------- | --------- | ------------------------------------------------- |
| `projectId`       | string  | Yes\*    | -         | Your project ID (\*optional for public workflows) |
| `privacy`         | string  | No       | `private` | Filter by privacy: `public`, `private`            |
| `status`          | string  | No       | -         | Filter by status: `draft`, `ready`                |
| `tags`            | string  | No       | -         | Comma-separated list of tags to filter by         |
| `pageSize`        | integer | No       | 50        | Number of results per page (1-100)                |
| `paginationToken` | string  | No       | -         | Token for fetching the next page                  |

**Example Request:**

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


// List your private workflows
const privateWorkflows = await client.workflows.list({
  projectId: 'proj_abc123',
  privacy: 'private',
});


// List public workflows (Apps)
const apps = await client.workflows.list({ privacy: 'public' });


// Filter by tags
const filtered = await client.workflows.list({
  projectId: 'proj_abc123',
  tags: 'upscale,image-enhancement',
});
```

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


# List your private workflows
private_workflows = client.workflows.list(
    project_id="proj_abc123",
    privacy="private",
)


# List public workflows (Apps)
apps = client.workflows.list(privacy="public")


# Filter by tags
filtered = client.workflows.list(
    project_id="proj_abc123",
    tags="upscale,image-enhancement",
)
```

Terminal window

```
# List your private workflows
curl -X GET "https://api.cloud.scenario.com/v1/workflows?projectId=proj_abc123&privacy=private" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>"


# List public workflows (Apps)
curl -X GET "https://api.cloud.scenario.com/v1/workflows?privacy=public" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>"


# Filter by tags
curl -X GET "https://api.cloud.scenario.com/v1/workflows?projectId=proj_abc123&tags=upscale,image-enhancement" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>"
```

**Response:**

```
{
  "workflows": [
    {
      "id": "workflow_abc123",
      "name": "Image Upscaler",
      "description": "Upscale images to 4K resolution with AI enhancement",
      "shortDescription": "AI-powered 4K image upscaling",
      "status": "ready",
      "privacy": "public",
      "ownerId": "proj_xyz789",
      "authorId": "user_123",
      "createdAt": "2026-01-15T10:30:00Z",
      "updatedAt": "2026-02-01T14:22:00Z",
      "tagSet": ["upscale", "image-enhancement", "tool"],
      "inputs": [
        {
          "name": "image",
          "type": "file",
          "kind": "image",
          "description": "The image to upscale",
          "required": { "always": true }
        }
      ],
      "thumbnail": {
        "assetId": "asset_thumb123",
        "url": "https://cdn.scenario.com/..."
      },
      "before": {
        "assetId": "asset_before123",
        "url": "https://cdn.scenario.com/..."
      },
      "after": {
        "assetId": "asset_after123",
        "url": "https://cdn.scenario.com/..."
      },
      "outputAssetKinds": ["image"],
      "isLocked": false,
      "flow": [...],
      "editorInfo": {...}
    }
  ],
  "nextPaginationToken": "eyJsYXN0S2V5IjoiLi4uIn0="
}
```

---

### Get Workflow

Retrieve details of a specific workflow.

**Endpoint:**

```
GET /v1/workflows/{workflowId}
```

**Path Parameters:**

| Parameter    | Type   | Required | Description     |
| ------------ | ------ | -------- | --------------- |
| `workflowId` | string | Yes      | The workflow ID |

**Query Parameters:**

| Parameter   | Type   | Required | Description                                        |
| ----------- | ------ | -------- | -------------------------------------------------- |
| `projectId` | string | No\*     | Your project ID (\*required for private workflows) |

**Example Request:**

```
const response = await client.workflows.retrieve('workflow_abc123');
console.log(response.workflow);
```

```
response = client.workflows.retrieve("workflow_abc123")
print(response.workflow)
```

Terminal window

```
curl -X GET "https://api.cloud.scenario.com/v1/workflows/workflow_abc123?projectId=proj_abc123" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>"
```

**Response:**

```
{
  "workflow": {
    "id": "workflow_abc123",
    "name": "Background Remover",
    "description": "Remove backgrounds from images automatically",
    "shortDescription": "AI background removal",
    "status": "ready",
    "privacy": "public",
    "ownerId": "proj_xyz789",
    "authorId": "user_123",
    "createdAt": "2026-01-10T08:15:00Z",
    "updatedAt": "2026-01-28T11:45:00Z",
    "tagSet": ["remove-background", "editing", "tool"],
    "inputs": [
      {
        "name": "image",
        "type": "file",
        "kind": "image",
        "description": "Image to remove background from",
        "required": { "always": true }
      }
    ],
    "flow": [
      {
        "id": "node_1",
        "type": "remove-background",
        "inputs": [
          {
            "name": "image",
            "type": "file",
            "kind": "image",
            "ref": {
              "node": "workflow",
              "name": "image"
            }
          }
        ],
        "status": "pending"
      }
    ],
    "thumbnail": {
      "assetId": "asset_thumb456",
      "url": "https://cdn.scenario.com/..."
    },
    "outputAssetKinds": ["image"],
    "isLocked": false,
    "editorInfo": {...}
  }
}
```

---

### Create Workflow

Create a new workflow. New workflows start with `draft` status.

**Endpoint:**

```
POST /v1/workflows
```

**Query Parameters:**

| Parameter   | Type   | Required | Description     |
| ----------- | ------ | -------- | --------------- |
| `projectId` | string | Yes      | Your project ID |

**Request Body:**

| Field         | Type   | Required | Description      |
| ------------- | ------ | -------- | ---------------- |
| `name`        | string | Yes      | Workflow name    |
| `description` | string | Yes      | Full description |

**Example Request:**

```
const response = await client.workflows.create({
  projectId: 'proj_abc123',
  name: 'My Custom Pipeline',
  description: 'A custom workflow for image processing',
});
console.log(response.workflow.id);
```

```
response = client.workflows.create(
    project_id="proj_abc123",
    name="My Custom Pipeline",
    description="A custom workflow for image processing",
)
print(response.workflow.id)
```

Terminal window

```
curl -X POST "https://api.cloud.scenario.com/v1/workflows?projectId=proj_abc123" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Pipeline",
    "description": "A custom workflow for image processing"
  }'
```

**Response:**

```
{
  "workflow": {
    "id": "workflow_new123",
    "name": "My Custom Pipeline",
    "description": "A custom workflow for image processing",
    "status": "draft",
    "privacy": "private",
    "ownerId": "proj_abc123",
    "authorId": "user_123",
    "createdAt": "2026-02-11T10:30:00Z",
    "updatedAt": "2026-02-11T10:30:00Z",
    "tagSet": [],
    "inputs": [],
    "flow": [],
    "isLocked": false,
    "editorInfo": {}
  }
}
```

---

### Update Workflow

Update an existing workflow’s configuration, inputs, flow, or metadata.

**Endpoint:**

```
PUT /v1/workflows/{workflowId}
```

**Path Parameters:**

| Parameter    | Type   | Required | Description     |
| ------------ | ------ | -------- | --------------- |
| `workflowId` | string | Yes      | The workflow ID |

**Query Parameters:**

| Parameter   | Type   | Required | Description     |
| ----------- | ------ | -------- | --------------- |
| `projectId` | string | Yes      | Your project ID |

**Request Body:** (all fields optional)

| Field              | Type    | Description                                           |
| ------------------ | ------- | ----------------------------------------------------- |
| `name`             | string  | Workflow name                                         |
| `description`      | string  | Full description                                      |
| `shortDescription` | string  | Short description for UI display                      |
| `status`           | string  | Set to `draft` or `ready`                             |
| `inputs`           | array   | Array of input definitions (see Input Schema below)   |
| `flow`             | array   | Array of workflow nodes (see Node Schema below)       |
| `tagSet`           | array   | Array of tag strings                                  |
| `outputAssetKinds` | array   | Expected output types: `["image"]`, `["video"]`, etc. |
| `before`           | string  | Asset ID for “before” preview (or `null` to remove)   |
| `after`            | string  | Asset ID for “after” preview (or `null` to remove)    |
| `thumbnail`        | string  | Asset ID for thumbnail (or `null` to remove)          |
| `isLocked`         | boolean | Lock/unlock the workflow                              |
| `editorInfo`       | object  | Editor-specific metadata                              |

**Example Request:**

```
const response = await client.workflows.update('workflow_abc123', {
  projectId: 'proj_abc123',
  name: 'Enhanced Image Pipeline',
  shortDescription: 'Quick image enhancement',
  status: 'ready',
  inputs: [
    {
      name: 'image',
      type: 'file',
      kind: 'image',
      description: 'Input image',
      required: { always: true },
    },
    {
      name: 'strength',
      type: 'number',
      description: 'Enhancement strength',
      default: 0.8,
      min: 0,
      max: 1,
      required: { always: false },
    },
  ],
  flow: [
    {
      id: 'node_upscale',
      type: 'custom-model',
      modelId: 'model_upscaler',
      inputs: [
        {
          name: 'image',
          type: 'file',
          kind: 'image',
          ref: { node: 'workflow', name: 'image' },
        },
      ],
    },
  ],
  tagSet: ['upscale', 'enhancement'],
});
```

```
response = client.workflows.update(
    "workflow_abc123",
    project_id="proj_abc123",
    name="Enhanced Image Pipeline",
    short_description="Quick image enhancement",
    status="ready",
    inputs=[
        {
            "name": "image",
            "type": "file",
            "kind": "image",
            "description": "Input image",
            "required": {"always": True},
        },
        {
            "name": "strength",
            "type": "number",
            "description": "Enhancement strength",
            "default": 0.8,
            "min": 0,
            "max": 1,
            "required": {"always": False},
        },
    ],
    flow=[
        {
            "id": "node_upscale",
            "type": "custom-model",
            "modelId": "model_upscaler",
            "inputs": [
                {
                    "name": "image",
                    "type": "file",
                    "kind": "image",
                    "ref": {"node": "workflow", "name": "image"},
                }
            ],
        }
    ],
    tag_set=["upscale", "enhancement"],
)
```

Terminal window

```
curl -X PUT "https://api.cloud.scenario.com/v1/workflows/workflow_abc123?projectId=proj_abc123" \
  -H "Authorization: Basic <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Enhanced Image Pipeline",
    "shortDescription": "Quick image enhancement",
    "status": "ready",
    "inputs": [
      {
        "name": "image",
        "type": "file",
        "kind": "image",
        "description": "Input image",
        "required": { "always": true }
      },
      {
        "name": "strength",
        "type": "number",
        "description": "Enhancement strength",
        "default": 0.8,
        "min": 0,
        "max": 1,
        "required": { "always": false }
      }
    ],
    "flow": [
      {
        "id": "node_upscale",
        "type": "custom-model",
        "modelId": "model_upscaler",
        "inputs": [
          {
            "name": "image",
            "type": "file",
            "kind": "image",
            "ref": { "node": "workflow", "name": "image" }
          }
        ]
      }
    ],
    "tagSet": ["upscale", "enhancement"]
  }'
```

**Response:**

```
{
  "workflow": {
    "id": "workflow_abc123",
    "name": "Enhanced Image Pipeline",
    ...
  }
}
```

---

### Delete Workflow

Delete a workflow. Locked workflows can only be deleted by their author.

**Endpoint:**

```
DELETE /v1/workflows/{workflowId}
```

**Path Parameters:**

| Parameter    | Type   | Required | Description     |
| ------------ | ------ | -------- | --------------- |
| `workflowId` | string | Yes      | The workflow ID |

**Query Parameters:**

| Parameter   | Type   | Required | Description     |
| ----------- | ------ | -------- | --------------- |
| `projectId` | string | Yes      | Your project ID |

**Example Request:**

```
await client.workflows.delete('workflow_abc123');
```

```
client.workflows.delete("workflow_abc123")
```

Terminal window

```
curl -X DELETE "https://api.cloud.scenario.com/v1/workflows/workflow_abc123?projectId=proj_abc123" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>"
```

**Response:**

```
{
  "success": true
}
```

---

### Run Workflow

Execute a workflow with provided inputs. Returns a job that tracks the execution.

**Endpoint:**

```
PUT /v1/workflows/{workflowId}/run
```

**Path Parameters:**

| Parameter    | Type   | Required | Description     |
| ------------ | ------ | -------- | --------------- |
| `workflowId` | string | Yes      | The workflow ID |

**Query Parameters:**

| Parameter   | Type   | Required | Description                                        |
| ----------- | ------ | -------- | -------------------------------------------------- |
| `projectId` | string | Yes      | Your project ID                                    |
| `dryRun`    | string | No       | Set to `"true"` to estimate cost without executing |

**Request Body:**

| Field         | Type   | Required                       | Description                                                                                   |
| ------------- | ------ | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `{inputName}` | varies | Depends on workflow definition | Key-value pairs matching the workflow’s input parameters, placed directly in the request body |

**Example Request:**

```
const response = await client.workflows.run('workflow_abc123', {
  body: {
    image: 'asset_input123',
    strength: 0.85,
  },
});


// SDK helper: wait for the job to finish
const completed = await response.job.wait();
console.log(completed.status);
```

```
response = client.workflows.run(
    "workflow_abc123",
    body={
        "image": "asset_input123",
        "strength": 0.85,
    },
)
print(response.job.job_id)
```

Terminal window

```
curl -X PUT "https://api.cloud.scenario.com/v1/workflows/workflow_abc123/run?projectId=proj_abc123" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "asset_input123",
    "strength": 0.85
  }'
```

**Response:**

```
{
  "job": {
    "jobId": "job_wf_abc123xyz",
    "jobType": "workflow",
    "status": "in-progress",
    "progress": 15,
    "ownerId": "proj_abc123",
    "authorId": "user_123",
    "createdAt": "2026-02-11T10:35:00Z",
    "updatedAt": "2026-02-11T10:35:05Z",
    "metadata": {
      "input": {
        "image": "asset_input123",
        "strength": 0.85
      },
      "flow": [
        {
          "id": "node_upscale",
          "type": "custom-model",
          "modelId": "model_upscaler",
          "status": "processing",
          "jobId": "job_node_123",
          "inputs": [...]
        }
      ],
      "isApiKey": true
    }
  },
  "workflow": {
    "id": "workflow_abc123",
    "name": "Enhanced Image Pipeline",
    ...
  }
}
```

**Dry Run Example:**

```
// Estimate cost without executing
const dryRun = await client.workflows.run('workflow_abc123', {
  body: { image: 'asset_input123' },
  dryRun: 'true',
});
console.log(dryRun);
```

```
# Estimate cost without executing
dry_run = client.workflows.run(
    "workflow_abc123",
    body={"image": "asset_input123"},
    dry_run="true",
)
print(dry_run)
```

Terminal window

```
# Estimate cost without executing
curl -X PUT "https://api.cloud.scenario.com/v1/workflows/workflow_abc123/run?projectId=proj_abc123&dryRun=true" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "asset_input123"
  }'
```

**Dry Run Response:**

```
{
  "statusCode": 402,
  "message": "Dry run completed",
  "estimatedCost": 12
}
```

---

### Get Workflow Tags

Retrieve unique tags used in workflows for a project.

**Endpoint:**

```
GET /v1/workflows/tags
```

**Query Parameters:**

| Parameter   | Type   | Required | Default | Description               |
| ----------- | ------ | -------- | ------- | ------------------------- |
| `projectId` | string | Yes      | -       | Your project ID           |
| `status`    | string | No       | `ready` | Filter by workflow status |

**Example Request:**

```
const tags = await client.workflows.getTags({ projectId: 'proj_abc123' });
console.log(tags);
```

```
tags = client.workflows.get_tags(project_id="proj_abc123")
print(tags)
```

Terminal window

```
curl -X GET "https://api.cloud.scenario.com/v1/workflows/tags?projectId=proj_abc123" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>"
```

**Response:**

```
{
  "tags": [
    "upscale",
    "remove-background",
    "image-enhancement",
    "video",
    "tool",
    "editing"
  ]
}
```

---

## Apps (Public Workflows)

Apps are public workflows that anyone can discover and use. They’re pre-built creative pipelines optimized for specific tasks.

### Discover Apps

List all available apps by filtering for public workflows.

**Example Request:**

```
const apps = await client.workflows.list({ privacy: 'public', status: 'ready' });
```

```
apps = client.workflows.list(privacy="public", status="ready")
```

Terminal window

```
curl -X GET "https://api.cloud.scenario.com/v1/workflows?privacy=public&status=ready" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>"
```

**Use Case Examples:**

```
// Find background removal apps
const bgRemovers = await client.workflows.list({ privacy: 'public', tags: 'remove-background' });


// Find upscaling apps
const upscalers = await client.workflows.list({ privacy: 'public', tags: 'upscale' });


// Find all tool-type apps
const tools = await client.workflows.list({ privacy: 'public', tags: 'tool' });
```

```
# Find background removal apps
bg_removers = client.workflows.list(privacy="public", tags="remove-background")


# Find upscaling apps
upscalers = client.workflows.list(privacy="public", tags="upscale")


# Find all tool-type apps
tools = client.workflows.list(privacy="public", tags="tool")
```

Terminal window

```
# Find background removal apps
curl -X GET "https://api.cloud.scenario.com/v1/workflows?privacy=public&tags=remove-background"


# Find upscaling apps
curl -X GET "https://api.cloud.scenario.com/v1/workflows?privacy=public&tags=upscale"


# Find all tool-type apps
curl -X GET "https://api.cloud.scenario.com/v1/workflows?privacy=public&tags=tool"
```

### Run an App

Running an app is identical to running a workflow:

**Example Request:**

```
// Run the Background Remover app
const response = await client.workflows.run('workflow_bg_remover', {
  body: { image: 'asset_photo123' },
});
const completed = await response.job.wait();
```

```
# Run the Background Remover app
response = client.workflows.run(
    "workflow_bg_remover",
    body={"image": "asset_photo123"},
)
```

Terminal window

```
# Run the Background Remover app
curl -X PUT "https://api.cloud.scenario.com/v1/workflows/workflow_bg_remover/run?projectId=proj_abc123" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "asset_photo123"
  }'
```

---

## Monitoring Job Execution

After running a workflow, monitor its progress using the Jobs API:

**Get Job Status:**

```
const response = await client.jobs.retrieve('job_wf_abc123xyz');
console.log(response.job.status);
```

```
response = client.jobs.retrieve("job_wf_abc123xyz")
print(response.job.status)
```

Terminal window

```
curl -X GET "https://api.cloud.scenario.com/v1/jobs/job_wf_abc123xyz?projectId=proj_abc123" \
  -H "Authorization: Basic <base64(YOUR_API_KEY:YOUR_API_SECRET)>"
```

**Job Status Values:**

| Status        | Description                 |
| ------------- | --------------------------- |
| `queued`      | Job is queued for execution |
| `in-progress` | Job is currently executing  |
| `succeeded`   | Job completed successfully  |
| `failed`      | Job failed with an error    |
| `canceled`    | Job was canceled            |

**Completed Job Response:**

```
{
  "job": {
    "jobId": "job_wf_abc123xyz",
    "jobType": "workflow",
    "status": "succeeded",
    "progress": 100,
    "createdAt": "2026-02-11T10:35:00Z",
    "updatedAt": "2026-02-11T10:35:45Z",
    "metadata": {
      "flow": [
        {
          "id": "node_upscale",
          "status": "success",
          "assets": [
            {
              "assetId": "asset_output123",
              "url": "https://cdn.scenario.com/output/..."
            }
          ]
        }
      ]
    }
  }
}
```

---

## Input Schema Reference

Workflow inputs define the parameters that must be provided when running the workflow.

**Common Input Types:**

### File Input (Image)

```
{
  "name": "image",
  "type": "file",
  "kind": "image",
  "description": "Input image",
  "required": { "always": true }
}
```

### String Input

```
{
  "name": "prompt",
  "type": "string",
  "description": "Text prompt for generation",
  "default": "A beautiful landscape",
  "required": { "always": true }
}
```

### Number Input

```
{
  "name": "strength",
  "type": "number",
  "description": "Processing strength",
  "default": 0.75,
  "min": 0,
  "max": 1,
  "step": 0.05,
  "required": { "always": false }
}
```

### Boolean Input

```
{
  "name": "enable_feature",
  "type": "boolean",
  "description": "Enable advanced feature",
  "default": false,
  "required": { "always": false }
}
```

### Select Input

```
{
  "name": "style",
  "type": "select",
  "description": "Output style",
  "options": ["realistic", "artistic", "cartoon"],
  "default": "realistic",
  "required": { "always": true }
}
```

---

## Node Schema Reference

Nodes define the processing steps in a workflow’s flow.

### Node Types

| Type                | Description                 |
| ------------------- | --------------------------- |
| `custom-model`      | Run a custom AI model       |
| `remove-background` | Remove image background     |
| `logic`             | Conditional logic (if/else) |
| `transform`         | Transform data              |
| `user-approval`     | Require user approval       |
| `workflow`          | Run a sub-workflow          |
| `generate-prompt`   | Generate/refine prompts     |

### Custom Model Node

```
{
  "id": "node_generation",
  "type": "custom-model",
  "modelId": "model_xyz123",
  "inputs": [
    {
      "name": "prompt",
      "type": "string",
      "ref": {
        "node": "workflow",
        "name": "prompt"
      }
    },
    {
      "name": "image",
      "type": "file",
      "kind": "image",
      "ref": {
        "node": "workflow",
        "name": "image"
      }
    }
  ]
}
```

### Logic Node (If/Else)

```
{
  "id": "node_condition",
  "type": "logic",
  "logicType": "if-else",
  "inputs": [
    {
      "name": "condition",
      "type": "string",
      "ref": {
        "node": "workflow",
        "name": "mode"
      }
    }
  ],
  "logic": {
    "cases": [
      {
        "condition": "fast",
        "value": "output_fast"
      },
      {
        "condition": "quality",
        "value": "output_quality"
      }
    ],
    "default": "output_balanced"
  }
}
```

### Transform Node

```
{
  "id": "node_resize",
  "type": "transform",
  "inputs": [
    {
      "name": "width",
      "type": "number",
      "value": 1024
    }
  ],
  "logic": {
    "transform": "resize(width, height)"
  }
}
```

### Node References

Nodes can reference outputs from other nodes or workflow inputs:

```
{
  "ref": {
    "node": "workflow",        // or node ID like "node_1"
    "name": "prompt"           // input/output name
  }
}
```

**Reference previous node output:**

```
{
  "ref": {
    "node": "node_upscale",
    "name": "all"              // get all outputs
  }
}
```

**Conditional references:**

```
{
  "ref": {
    "conditional": ["node_check_1", "node_check_2"],
    "equal": "success"
  }
}
```

---

## Workflow Locking

Locked workflows cannot be modified or deleted except by specific users.

**Lock a Workflow:**

```
await client.workflows.update('workflow_abc123', {
  projectId: 'proj_abc123',
  isLocked: true,
});
```

```
client.workflows.update(
    "workflow_abc123",
    project_id="proj_abc123",
    is_locked=True,
)
```

Terminal window

```
curl -X PUT "https://api.cloud.scenario.com/v1/workflows/workflow_abc123?projectId=proj_abc123" \
  -H "Authorization: Basic <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{ "isLocked": true }'
```

**Lock Rules:**

- Only the workflow author or project editors can lock/unlock
- Only the author can modify or delete a locked workflow
- Locking prevents accidental changes to production workflows

---

## Error Handling

### Common Error Codes

| Status Code | Description                                               |
| ----------- | --------------------------------------------------------- |
| `400`       | Bad Request - Invalid parameters or body                  |
| `401`       | Unauthorized - Invalid or missing API key                 |
| `403`       | Forbidden - Insufficient permissions                      |
| `404`       | Not Found - Workflow doesn’t exist                        |
| `402`       | Payment Required - Returned for dry run billing estimates |

**Error Response Format:**

```
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid privacy. Must be one of: public, private, unlisted"
}
```

---

## Best Practices

### 1. **Use Draft Status During Development**

Create workflows with `draft` status while building them. Set to `ready` only when complete and tested.

### 2. **Leverage Tags for Organization**

Use consistent tags to categorize workflows:

- `tool` - Utility workflows (upscale, remove-background)
- `editing` - Image/video editing workflows
- `generation` - Content generation workflows
- Custom domain tags (e.g., `gaming`, `marketing`)

### 3. **Provide Clear Input Descriptions**

Help users understand what each input does with clear descriptions and appropriate defaults.

### 4. **Use Dry Run for Cost Estimation**

Before executing expensive workflows, use `dryRun=true` to estimate costs.

### 5. **Monitor Jobs Asynchronously**

Workflows can take time to complete. Poll the Jobs API or use webhooks to monitor progress.

### 6. **Lock Production Workflows**

Lock workflows that are used in production to prevent accidental modifications.

### 7. **Use Before/After/Thumbnail Assets**

Add visual examples to help users understand what the workflow does.

---

## Rate Limits

- **API Requests:** 100 requests per minute per project
- **Concurrent Workflow Jobs:** 10 concurrent executions per project
- **Workflow Size:** Maximum 50 nodes per workflow

---

## Support & Resources

- **API Reference:** [/](/index.md)
- **Help Center:** <https://help.scenario.com>
- **Discord Community:** <https://discord.gg/scenario>
- **Email Support:** <support@scenario.com>

