import type Scenario from '@scenario-labs/sdk'
import { log } from '@main/log'
import { tokenAfter } from './cursor'
import type { WorkflowCatalog, WorkflowListRequest } from './workflow-registry'

/**
 * Binds the registry's narrow catalogue to the real SDK. The only file where the two meet, so
 * a change in the SDK's shape lands here rather than throughout the registry.
 */
export function workflowCatalogOf(client: Scenario): WorkflowCatalog {
  return {
    /**
     * `privacy: 'public'` is what makes this the App library: those are the workflows anyone may
     * discover and run. The default is `private`, which on a fresh key answers nothing at all —
     * the same trap `GET /models` sets.
     */
    list: async ({ privacy, pageSize, token }: WorkflowListRequest) => {
      const params = { privacy, pageSize, ...(token ? { paginationToken: token } : {}) }

      log.info('scenario', `GET /workflows ${JSON.stringify(params)}`)
      const page = await client.workflows.list(params)
      log.info('scenario', `GET /workflows → ${page.workflows.length} workflows`)

      return {
        workflows: page.workflows,
        token: tokenAfter(page.nextPaginationToken, page.workflows.length),
      }
    },

    retrieve: workflowId => client.workflows.retrieve(workflowId),
  }
}
