import type Scenario from '@scenario-labs/sdk'
import { log } from '@main/log'
import { tokenAfter } from './cursor'
import type { WorkflowCatalog, WorkflowListRequest } from './workflow-registry'

/**
 * The flow as `workflows.update` types it, which is NOT how the converter types what it produced.
 *
 * `convertWorkflowEditorToFlow` answers `type: string`; `update` wants the ten-value union. The
 * two halves of one SDK, describing the same items, and they do not meet — so the narrowing
 * happens here, in the one file where the SDK and the port already meet, rather than by a list of
 * ten strings written on our side that would drift the day an eleventh arrives.
 */
type UpdatableFlow = Parameters<Scenario['workflows']['update']>[1]['flow']

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

    /**
     * A name and a description, and nothing else: the flow and the editor's own state can only
     * arrive by `update`, which is also the only place `status` can be set. `workflows.publish`
     * does not exist on the client — the two calls are the whole of it.
     */
    create: async about => {
      log.info('scenario', `POST /workflows ${JSON.stringify(about)}`)
      const { workflow } = await client.workflows.create(about)
      log.info('scenario', `POST /workflows → ${workflow.id}`)

      return { id: workflow.id }
    },

    update: async (workflowId, body) => {
      log.info('scenario', `PUT /workflows/${workflowId} ${body.flow.length} steps`)
      // Copied because the SDK takes a mutable array, and what the caller holds must not be
      // handed free rein over — the same care `compileGraph` takes with the validator.
      // The one cast of this file, and the reason is above: the values come from the SDK's own
      // converter, so they are the union it asks for — only its types fail to say so.
      const flow = [...body.flow] as UpdatableFlow

      await client.workflows.update(workflowId, { ...body, flow })
    },
  }
}
