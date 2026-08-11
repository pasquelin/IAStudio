import type { WorkflowEditorFlowItem } from '@scenario-labs/sdk'
import type { GraphPublishResult, GraphRefusal, GraphState } from '@shared/domain/graph'
import { workflowFileOf, type WorkflowInputDefinition } from '@shared/domain/workflow-file'
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
      /** What the App asks its caller for. Derived from the nodes marked as inputs. */
      inputs: readonly WorkflowInputDefinition[]
      status: 'ready'
    },
  ) => Promise<void>
}

export type PublishDeps = {
  write: WorkflowWriter
  /** The graph as Scenario's own flow — `toEditorFlow`, with the models already resolved. */
  flowOf: (graph: GraphState) => Promise<readonly WorkflowEditorFlowItem[]>
  /** The compile's own verdict on that flow, so one question has one answer. `refuseFlow`. */
  refuse: (graph: GraphState, flow: readonly WorkflowEditorFlowItem[]) => GraphRefusal | null
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
 * **The compile's refusals are rejoined here, and by the very function the editor paints from.**
 * A graph the editor shows as `invalid` — a loop whose end names no parent, say — would otherwise
 * be published as `ready` all the same: either the account gains an App that fails at run time, or
 * the API says 400 and a `draft` is left behind, and neither says a word.
 */
export async function publishGraph(
  graph: GraphState,
  about: { name: string; description: string; exportedAt: string; exportedBy: string },
  { write, flowOf, refuse, report }: PublishDeps,
): Promise<GraphPublishResult> {
  const flow = await flowOf(graph)
  const problem = refuse(graph, flow)
  if (problem) return { ok: false, ...problem }

  const file = workflowFileOf(graph, about)

  try {
    const { id } = await write.create({ name: file.name, description: file.description })
    // `editorInfo` is what makes the workflow OPENABLE again — in the webapp, and here. Written
    // as the file writes it, so a graph published and a graph exported carry the same thing.
    // `inputs` and not just the flow: the App asks its caller for what the graph marks as an
    // input, and the converter cannot derive it — `inputKeys` only ever SORTS in that file.
    await write.update(id, {
      editorInfo: { ...file.editorInfo },
      flow,
      inputs: file.inputs,
      status: 'ready',
    })

    return { ok: true, workflowId: id }
  } catch (error) {
    // The API's own sentence belongs to the journal; the screen gets the code, like a compile.
    report(messageOf(error))
    return { ok: false, problem: 'refused', nodes: [] }
  }
}
