import type { GraphNode, GraphState } from './graph'

/**
 * The version `validateEditorInfo` accepts on the webapp side. Written on every file the studio
 * exports so the two editors read each other's.
 *
 * A workflow READ BACK from the API carries no `version` at all — `editor_info` on
 * `wflow_H1bKz78jgpinWPKJfVCM5uAp` holds `{nodes, edges, inputKeys, nodeGroups}` and nothing
 * more — so whoever writes the import must treat its absence as legitimate, not as a bad file.
 */
export const WORKFLOW_FILE_VERSION = '1.0'

/**
 * One input a published workflow asks its caller for.
 *
 * Every field was read off `inputs_definition` of that same App rather than reasoned:
 * `required` is an OBJECT (`{ always: false }`), not a boolean, and `costImpact` is spelled out
 * even when false.
 */
export type WorkflowInputDefinition = {
  /** The node's own id — `image2`, not a label and not a port name. */
  name: string
  label: string
  description: string
  /** `file` for anything the caller uploads. */
  type: string
  /** The asset kind behind the file — `image` on all four inputs of the App read. */
  kind: string
  costImpact: boolean
  required: { always: boolean }
}

/** What the studio writes to a `.workflow.json`, and what the webapp reads back. */
export type WorkflowFile = {
  version: string
  name: string
  description: string
  editorInfo: Pick<GraphState, 'nodes' | 'edges' | 'inputKeys'>
  inputs: readonly WorkflowInputDefinition[]
  tagSet: readonly string[]
  exportedAt: string
  exportedBy: string
}

/**
 * The inputs a graph declares, derived from the nodes flagged `isInput` — **never from
 * `inputKeys`**.
 *
 * That is the correction this file exists for. The obvious reading is that `editorInfo.inputKeys`
 * names the workflow's inputs; the App read on 10 August says otherwise, and says it plainly:
 * `inputKeys` is EMPTY there while `inputs_definition` carries four entries, one per node marked
 * `data.isInput`. Deriving them from `inputKeys` would export a workflow that asks its caller for
 * nothing.
 */
export function workflowInputsOf(graph: GraphState): readonly WorkflowInputDefinition[] {
  return graph.nodes.filter(node => node.data.isInput === true).map(inputOf)
}

function inputOf(node: GraphNode): WorkflowInputDefinition {
  const { type, kind } = shapeOf(node)

  return {
    name: node.id,
    // The node's own title, which is what the App shows its caller. Empty rather than the id: a
    // label nobody wrote is better blank than filled with `image2`.
    label: typeof node.data.title === 'string' ? node.data.title : '',
    description: '',
    type,
    kind,
    costImpact: false,
    required: { always: false },
  }
}

/**
 * What one input node asks for. Only the asset case is MEASURED — all four inputs of the App read
 * are `asset` nodes answering `{ type: 'file', kind: 'image' }`.
 *
 * Everything else is the honest fallback rather than a second measurement: a text node marked as
 * an input has never been seen in a published App, so it is exported as the string it holds and
 * that is a deduction, not a reading.
 */
function shapeOf(node: GraphNode): { type: string; kind: string } {
  if (node.type !== 'asset') return { type: 'string', kind: 'text' }

  const kind = node.data.type
  return { type: 'file', kind: typeof kind === 'string' ? kind : 'image' }
}

/**
 * The file a graph becomes. Takes what it cannot know — the clock, the account, the document's
 * own name — rather than reaching for them: `shared/` carries no runtime dependency, and a
 * timestamp read here would make every test depend on the hour it runs at.
 */
export function workflowFileOf(
  graph: GraphState,
  about: { name: string; description?: string; exportedAt: string; exportedBy: string },
): WorkflowFile {
  return {
    version: WORKFLOW_FILE_VERSION,
    name: about.name,
    description: about.description ?? '',
    editorInfo: { nodes: graph.nodes, edges: graph.edges, inputKeys: graph.inputKeys },
    inputs: workflowInputsOf(graph),
    tagSet: [],
    exportedAt: about.exportedAt,
    exportedBy: about.exportedBy,
  }
}
