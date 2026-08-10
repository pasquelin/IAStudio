import {
  convertWorkflowEditorToFlow,
  validateWorkflowFlow,
  type WorkflowEditorEdge,
  type WorkflowEditorFlowItem,
  type WorkflowEditorNode,
} from '@scenario-labs/sdk'
import type { GraphEdge, GraphNode, GraphState } from '@shared/domain/graph'
import { outputNodesOf, type GraphCompileResult } from '@shared/domain/graph'
import { messageOf } from '@shared/guards'

/**
 * The studio's node as the converter's own union — a `switch` rather than an assertion.
 *
 * The two unions are the same shape written twice, because `shared/` carries no runtime
 * dependency (invariant 2), and TypeScript cannot see that a narrowed `type` picks the matching
 * arm of the OTHER union. Spelling the arms out costs fourteen lines and buys two things a cast
 * would have thrown away: a sixteenth node type stops compiling — in `unhandled` below, which is
 * what makes that true and without which the `switch` proved nothing — and `stickyNote`, which
 * the converter's union has no variant for at all, is refused by the type system rather than by
 * a list kept in step by hand.
 *
 * `undefined` for a node that does not compile. `data` is handed over as it stands: `parseGraph`
 * validates the node and not its contents, and the converter reads it defensively.
 */
function asEditorNode(node: GraphNode): WorkflowEditorNode | undefined {
  const id = node.id
  const data: Record<string, unknown> = { ...node.data }

  switch (node.type) {
    case 'model':
      return { id, type: 'model', data }
    case 'llm':
      return { id, type: 'llm', data }
    case 'text':
      return { id, type: 'text', data }
    case 'asset':
      return { id, type: 'asset', data }
    case 'transformText':
      return { id, type: 'transformText', data }
    case 'splitText':
      return { id, type: 'splitText', data }
    case 'aspectRatio':
      return { id, type: 'aspectRatio', data }
    case 'groupItems':
      return { id, type: 'groupItems', data }
    case 'sliceAssets':
      return { id, type: 'sliceAssets', data }
    case 'forEach':
      return { id, type: 'forEach', data }
    case 'forEachEnd':
      return { id, type: 'forEachEnd', data }
    case 'ifElse':
      return { id, type: 'ifElse', data }
    case 'approval':
      return { id, type: 'approval', data }
    case 'modelInput':
      // The one arm with a REQUIRED field. Without a name it is a workflow input nothing can be
      // asked for, and the converter would key the flow's inputs on `undefined`.
      return typeof data.inputName === 'string'
        ? { id, type: 'modelInput', data: { ...data, inputName: data.inputName } }
        : undefined
    // Drawn on the canvas, part of no flow: the converter's union has no variant for it.
    case 'stickyNote':
      return undefined
  }

  // Outside the `switch` rather than a `default` arm, which would be a branch no test can enter
  // and which the coverage budget of this folder counts as one.
  return unhandled(node)
}

/**
 * The arm a sixteenth node type would not have.
 *
 * Without it the `switch` proves nothing: `noImplicitReturns` is off and the function already
 * answers `undefined`, so a type added to the union would fall out of every flow in silence.
 * Reached only by a type the compiler cannot see, which is why the parameter is `never`.
 */
const unhandled = (_node: never): undefined => undefined

const asEditorEdge = (edge: GraphEdge): WorkflowEditorEdge => ({
  source: edge.source,
  target: edge.target,
  ...(edge.sourceHandle === undefined ? {} : { sourceHandle: edge.sourceHandle }),
  ...(edge.targetHandle === undefined ? {} : { targetHandle: edge.targetHandle }),
})

export type CompileDeps = {
  /** Where the validator's own sentence goes: a developer's English, never the user's screen. */
  report: (message: string) => void
}

/**
 * The graph as Scenario's own flow — what an export sends, and what a test can look at.
 *
 * **No compiler is written here.** `convertWorkflowEditorToFlow` is Scenario's own, so the studio
 * cannot drift from what the webapp produces; this file is the adapter and nothing else.
 *
 * Exported rather than hidden inside `compileGraph`, for two reasons pointing the same way: the
 * step 9 export needs this very array, and a verdict reduced to a number is a contract no test can
 * hold to account — four mutations of the adapter survived a suite that could only assert `ok`.
 *
 * ⚠️ **`getModel` is NOT passed, and that is a hole, not a saving.** Read off the converter rather
 * than off its documentation: `workflow_converter.ts` derives `modelInputs` from `getModel` and
 * then skips every wire it cannot name — `if (!modelInput) continue`. So a generator's INCOMING
 * EDGES are dropped from the flow while its form values are kept, and this function answers a
 * flow that would export a workflow whose generators are wired to nothing.
 *
 * Not fixed here because it is a lot of its own: the converter wants the API's own input type,
 * and `ModelRegistry` translates that away into a `FieldKind` before caching. It is written up in
 * `docs/todo.md` § 5.1, and `refuses to carry a wire into a generator` pins the behaviour so the
 * day it is fixed a test says so.
 */
export function toEditorFlow(graph: GraphState): readonly WorkflowEditorFlowItem[] {
  const nodes: WorkflowEditorNode[] = []
  for (const node of graph.nodes) {
    const editor = asEditorNode(node)
    if (editor) nodes.push(editor)
  }

  return convertWorkflowEditorToFlow({
    nodes,
    edges: graph.edges.map(asEditorEdge),
    inputKeys: [...graph.inputKeys],
  })
}

/** Whether that flow holds together, and the three refusals the converter answers with silence. */
export function compileGraph(graph: GraphState, { report }: CompileDeps): GraphCompileResult {
  // Asked before the converter rather than read off its answer: an empty flow has two causes, and
  // "nothing is marked as an output" is the one the user can do something about.
  if (outputNodesOf(graph).length === 0) return { ok: false, problem: 'no-output' }

  const flow = toEditorFlow(graph)

  if (flow.length === 0) return { ok: false, problem: 'empty' }

  try {
    // Copied because the validator takes a mutable array. It reads only — checked in
    // `workflow_validator.js` — but the export's own answer must not be handed free rein over,
    // so the copy stays on this side rather than the type being loosened.
    validateWorkflowFlow([...flow])
  } catch (error) {
    // The sentence names a node and what is wrong with it, which is worth keeping — in the
    // journal, where a developer reads it. The screen gets the code.
    report(messageOf(error))
    return { ok: false, problem: 'invalid' }
  }

  return { ok: true, steps: flow.length }
}
