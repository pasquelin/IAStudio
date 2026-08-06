---
title: SDK Helpers | Scenario Docs
description: Enhanced methods for the Scenario TypeScript SDK.
---

The Scenario SDK extends the auto-generated API client with convenience methods. These helpers are built on top of the generated client — all standard API methods continue to work as documented in the [API Reference](/api/index.md).

## Installation

Terminal window

```
npm install @scenario-labs/sdk
```

## Quick start

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


// Run a workflow and wait for completion
const run = await client.workflows.run('wflow_...', {
  body: { prompt: 'a red sports car' },
});
const completed = await run.job.wait();
console.log(completed.status); // 'success'
```

## Enhanced resources

| Resource       | Method                                      | Enhancement                                                                           |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `workflows`    | `retrieve()`                                | `response.workflow` gains `.findNode()`, `.getNodesByType()`, `.validate()`, `.run()` |
| `workflows`    | `run()`, `userApproval()`                   | `response.job` gains `.wait()`                                                        |
| `generate`     | all methods                                 | `response.job` gains `.wait()`                                                        |
| `models`       | `retrieve()`                                | `response.model` gains `.run()`                                                       |
| `models.train` | `trigger()`                                 | `response.job` gains `.wait()`                                                        |
| `jobs`         | `retrieve()`, `triggerAction()`             | `response.job` gains `.wait()`                                                        |
| `assets`       | `retrieve()`, `update()`                    | `response.asset` gains `.download()`                                                  |
| `uploads`      | `create()`, `retrieve()`, `triggerAction()` | `response.upload` gains `.wait()`                                                     |
| `uploads`      | `uploadFile()`                              | One-call wrapper: init → upload parts → complete → poll until imported                |

All other resources (`collections`, `search`, `tags`, `usages`) work exactly as documented — no changes.

## Tools

Separate from the client enhancements above, the SDK ships **standalone utilities** under dedicated `@scenario-labs/sdk/tools/*` subpaths. These are not attached to the `client` instance and are not part of the default entry point — import each explicitly. See [Tools](/sdk-helpers/tools/index.md) for the full list.

| Tool                                             | Import                         | Purpose                                                               |
| ------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------- |
| [CEL Utilities](/sdk-helpers/tools/cel/index.md) | `@scenario-labs/sdk/tools/cel` | Shared CEL evaluation environment for workflow transform expressions. |

## Authentication & project scope

The client accepts either `apiKey` + `apiSecret` (long-lived) or `bearerAuth` (a short-lived session JWT). When using bearer auth in a multi-project context, pass `projectId` to scope requests to a project — see [Bearer Auth](/sdk-helpers/auth/index.md) for `ClientOptions.projectId` and the `withBearerRefresh()` helper that transparently refreshes expired JWTs mid-request.
