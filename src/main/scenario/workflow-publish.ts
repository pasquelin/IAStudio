import type { WorkflowEditorFlowItem } from '@scenario-labs/sdk'
import type { GraphPublishResult, GraphState } from '@shared/domain/graph'
import { workflowFileOf } from '@shared/domain/workflow-file'
import { messageOf } from '@shared/guards'

/**
 * The two writes a publication is, as a narrow port rather than the SDK's own shape.
 *
 * `create` takes a NAME AND A DESCRIPTION AND NOTHING ELSE — no nodes, no edges, no flow. The
 * chantier had it that `workflow_create` refuses empty `nodes`/`edges` arrays; that is the MCP
 * tool's contract, not this one, and mixing the two would have put a refusal on the studio's side
 * for a rule the REST API does not have.
 */
export type WorkflowWriter = {
  create: (about: { name: string; description: string }) => Promise<{ id: string }>
  update: (
    workflowId: string,
    body: {
      editorInfo: Record<string, unknown>
      flow: readonly WorkflowEditorFlowItem[]
      status: 'ready'
    },
  ) => Promise<void>
}

export type PublishDeps = {
  write: WorkflowWriter
  /** The graph as Scenario's own flow — `toEditorFlow`, with the models already resolved. */
  flowOf: (graph: GraphState) => Promise<readonly WorkflowEditorFlowItem[]>
  report: (message: string) => void
}

/**
 * A graph, published as a workflow of the account: created, then filled and marked ready.
 *
 * **Two calls and not one, because the API has no third.** `create` accepts only a name and a
 * description, so the flow and the editor's own state can only arrive by `update` — and `update`
 * is also the only place `status` can be set. A workflow left between the two is a `draft`, which
 * is inert rather than broken: it appears in the account, and it runs nothing.
 *
 * An empty flow is refused HERE rather than sent: a workflow marked `ready` with nothing in it is
 * an App that answers nothing, and the user gets the same code the compile already speaks.
 */
export async function publishGraph(
  graph: GraphState,
  about: { name: string; description: string; exportedAt: string; exportedBy: string },
  { write, flowOf, report }: PublishDeps,
): Promise<GraphPublishResult> {
  const flow = await flowOf(graph)
  if (flow.length === 0) return { ok: false, problem: 'empty' }

  const file = workflowFileOf(graph, about)

  try {
    const { id } = await write.create({ name: file.name, description: file.description })
    // `editorInfo` is what makes the workflow OPENABLE again — in the webapp, and here. Written
    // as the file writes it, so a graph published and a graph exported carry the same thing.
    await write.update(id, { editorInfo: { ...file.editorInfo }, flow, status: 'ready' })

    return { ok: true, workflowId: id }
  } catch (error) {
    // The API's own sentence belongs to the journal; the screen gets the code, like a compile.
    report(messageOf(error))
    return { ok: false, problem: 'refused' }
  }
}
