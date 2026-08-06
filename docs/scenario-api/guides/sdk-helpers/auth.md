---
title: Bearer Auth | Scenario Docs
description: Utilities for bearer JWT authentication, including automatic token refresh on expiry.
---

Bearer (JWT) authentication is used in multi-project contexts where the caller belongs to more than one project and must pass `projectId` per request. Bearer tokens are typically short-lived session tokens that can expire after \~60 seconds. Any SDK call that outlives the token window — a long `.wait()` poll or a slow `uploadFile()` — risks a mid-flight 403. `withBearerRefresh` wraps `fetch` to detect these rejections and retry transparently.

Not applicable to API-key auth — API keys are long-lived credentials and don’t expire mid-session.

---

## `withBearerRefresh(refresh, options?)`

Wraps `fetch` so that AWS API Gateway authorizer rejections (HTTP 403 with header `x-amzn-errortype: AccessDeniedException`) automatically trigger a JWT refresh and a transparent retry.

**Signature**

```
withBearerRefresh(
  refresh: () => Promise<string | null>,
  options?: BearerRefreshOptions,
): typeof fetch
```

**Parameters**

| Name       | Type                            | Description                                                                                                                     |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `refresh`  | `() => Promise<string \| null>` | Async callback that returns a fresh JWT string, or `null` if the refresh fails (the original 403 is then propagated unchanged). |
| `options?` | `BearerRefreshOptions`          | Optional configuration.                                                                                                         |

**Returns**

`typeof fetch` — a drop-in `fetch` replacement. Pass it to the `fetch` option of the `Scenario` constructor.

**Example**

```
import Scenario, { withBearerRefresh } from '@scenario-labs/sdk';


const client = new Scenario({
  bearerAuth: initialJwt,
  projectId: 'proj_...',
  fetch: withBearerRefresh(async () => {
    // Replace with your IdP or session-token API call.
    return await mintFreshJwt();
  }),
});


// Long-running poll — JWT can expire mid-flight; the wrapper handles it:
const run = await client.workflows.run('wflow_...', { body: { prompt: 'a snowy mountain pass' } });
const completed = await run.job.wait({ timeoutMs: 600_000 });
```

Note

`withBearerRefresh` only intercepts AWS API Gateway authorizer rejections. Real downstream permission denials (HTTP 403 **without** `x-amzn-errortype: AccessDeniedException`) are propagated unchanged so the caller can still read the error.

Caution

Multiple concurrent requests that all hit a gateway 403 share a single in-flight refresh (single-flight coalescing). Only one new JWT is minted per round, regardless of how many requests were waiting.

---

## `BearerRefreshOptions`

Options for `withBearerRefresh()`.

```
interface BearerRefreshOptions {
  maxRefreshes?: number;  // Default: 2
  fetch?: typeof fetch;   // Default: globalThis.fetch
}
```

| Name            | Type           | Default            | Description                                                                                                           |
| --------------- | -------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `maxRefreshes?` | `number`       | `2`                | Maximum refresh attempts per wrapper instance. After this limit, subsequent authorizer 403s are propagated unchanged. |
| `fetch?`        | `typeof fetch` | `globalThis.fetch` | Underlying fetch to wrap. Useful for composing with other wrappers (logging, retries, test mocks).                    |

---

## `ClientOptions.projectId`

The enhanced `Scenario` constructor accepts a `projectId` option, which is required for bearer auth when the user belongs to multiple projects.

```
const client = new Scenario({
  bearerAuth: jwt,
  projectId: 'proj_...',
});
```

| Name         | Type             | Default | Description                                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectId?` | `string \| null` | `null`  | Default project scope for all requests (sent as `?projectId=...`). Useful with `bearerAuth` when the user belongs to multiple projects — the server derives the team from the project, so `teamId` doesn’t need to be set separately. With `apiKey` auth the project is implied by the key and this option is unnecessary. |

**Per-call override:** pass `options.query.projectId` to override for a single request. SDK helpers (`.wait()`, `model.run()`, `workflow.run()`) automatically reuse the scope of the originating call, so an action created in project A always polls in project A even if the client default changes later.
