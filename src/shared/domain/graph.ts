/**
 * A graph document, in Scenario's own `editorInfo` format rather than a shape of our own.
 *
 * That is what makes the compiler, the validator and the round trip with the webapp free: the
 * SDK publishes `convertWorkflowEditorToFlow`, and it reads exactly these fields. A format of
 * our own would owe a translator in both directions and drift on the first node type Scenario
 * adds.
 *
 * Spelled out here rather than imported from the SDK because `shared/` carries no runtime
 * dependency, and because the main process is the only side that speaks SDK (invariant 2). The
 * compile step of the next milestone hands these very objects to the converter, so a divergence
 * fails the typecheck there rather than at runtime.
 */

/** The fifteen node types of the editor. Ten of them compile to an execution node; five do not. */
export type GraphNodeType =
  | 'text'
  | 'asset'
  | 'aspectRatio'
  | 'model'
  | 'modelInput'
  | 'llm'
  | 'transformText'
  | 'splitText'
  | 'ifElse'
  | 'groupItems'
  | 'sliceAssets'
  | 'forEach'
  | 'forEachEnd'
  | 'stickyNote'
  | 'approval'

export const GRAPH_NODE_TYPES: readonly GraphNodeType[] = [
  'text',
  'asset',
  'aspectRatio',
  'model',
  'modelInput',
  'llm',
  'transformText',
  'splitText',
  'ifElse',
  'groupItems',
  'sliceAssets',
  'forEach',
  'forEachEnd',
  'stickyNote',
  'approval',
]

export function isGraphNodeType(value: unknown): value is GraphNodeType {
  return GRAPH_NODE_TYPES.some(candidate => candidate === value)
}

/**
 * `workflow` is reserved in a reference: it names the inputs of the workflow itself, and the
 * validator does not check it against node ids. A node called `workflow` would silently steal
 * every reference to them.
 *
 * A rule of the FORMAT, so it lives beside the format rather than in the mutations: the reader
 * is what enforces it on a file, and the reader is in the opening chunk — reaching into
 * `engines/graph/` for this one predicate dragged the whole mutation engine in with it.
 */
export const RESERVED_NODE_ID = 'workflow'

export const isReservedNodeId = (id: string): boolean => id === RESERVED_NODE_ID

/**
 * The port every node carries so an `ifElse` can steer it — read off a published App, where all
 * four nodes declare it.
 *
 * It is NOT a model input: whatever is wired into it decides whether the node runs at all, so a
 * run must keep it out of the body it submits, or the generator is handed a parameter its schema
 * has never heard of.
 */
export const CONDITIONAL_PORT = 'conditional'

/**
 * The single input port an `approval` node carries, and the one handle id the converter matches
 * literally: it finds the node an approval guards by `` `${approvalId}-source-approval` ``, and
 * an approval wired through any other port compiles to nothing at all.
 */
export const APPROVAL_PORT = 'approval'

/**
 * An input port, on the LEFT of a node. `type` may be a list, which means the port is
 * polymorphic and accepts any of them — that is what the connection check and the port colours
 * are made of. `subHandles` are the ports nested under one, as a model's grouped inputs are.
 */
export type GraphHandleInput = {
  id: string
  label?: string
  name?: string
  type?: string | readonly string[]
  subHandles?: readonly GraphHandleInput[]
}

/** An output port, on the RIGHT of a node. One type, never a list: a producer knows what it makes. */
export type GraphHandleOutput = {
  id: string
  name?: string
  type?: string
  isArray?: boolean
}

/** What every node carries in `data`, whatever its type adds to it. */
export type GraphNodeData = {
  inputHandles?: readonly GraphHandleInput[]
  outputHandles?: readonly GraphHandleOutput[]
  /** Marks a node as an input of the workflow itself, or as one of its outputs. */
  isInput?: boolean
  isOutput?: boolean
  /** The uuid of the box it is filed under — see `GraphGroups`. */
  group?: string
  title?: string
}

export type GraphPosition = { x: number; y: number }

/**
 * The node types this milestone draws. The other eleven are declared above and land in the
 * editor with the loops and the logic — until then a graph can hold one, and it renders as the
 * type it says it is with nothing but its ports.
 */
export type GraphNodeBody =
  | { type: 'text'; data: GraphNodeData & { value?: string } }
  /**
   * Its text is `content`, NOT `value` — the field the other two use. Read off a published App
   * on 9 August 2026, where the note also carries its own colour and text size. Named `value`
   * here until then, which drew every imported note blank.
   */
  | {
      type: 'stickyNote'
      data: GraphNodeData & {
        content?: string
        backgroundColor?: string
        backgroundColorOpacity?: number
        fontSize?: string
      }
    }
  | {
      type: 'asset'
      data: GraphNodeData & {
        /** The asset kind the port carries: `image`, `video`, `audio`… */
        type?: string
        value?: string | readonly string[]
        isMultiple?: boolean
        isRequired?: boolean
      }
    }
  | {
      type: 'model'
      data: GraphNodeData & {
        modelId?: string
        /** What the model's own form holds — its shape is the model's, not ours (invariant 5). */
        form?: Readonly<Record<string, unknown>>
        type?: string
      }
    }
  /**
   * A workflow input, and the only type whose `data` the converter REQUIRES something of: without
   * `inputName` it is an input nothing can be asked for, and the flow's inputs get keyed on
   * `undefined`. The editor cannot create one yet — it arrives with the import of step 9 — but a
   * graph read off a published App carries them.
   */
  | { type: 'modelInput'; data: GraphNodeData & { inputName?: string } }
  /**
   * A pause for a human, and the one node whose `data` says what the person is asked. `message`
   * is what the converter carries over as the flow node's `label` — the sentence shown beside
   * the two answers, so a graph with three approvals does not ask the same question three times.
   */
  | { type: 'approval'; data: GraphNodeData & { message?: string } }
  | {
      type: Exclude<
        GraphNodeType,
        'text' | 'stickyNote' | 'asset' | 'model' | 'modelInput' | 'approval'
      >
      data: GraphNodeData
    }

export type GraphNode = GraphNodeBody & {
  id: string
  position: GraphPosition
  /** Written by the resize handle on the node types that carry one, and only on those. */
  width?: number
  height?: number
}

/**
 * An edge, and the convention that would cost the most to get wrong: Scenario points it from
 * the CONSUMER to the PROVIDER.
 *
 * `source` is the INPUT, on the left of the screen; `target` is the OUTPUT, on the right. Data
 * flows left to right, the edge object points right to left. Verified in the SDK's own
 * `workflow_converter.js` and against a published App: `{ source: 'imageGenerator1', target:
 * 'image1' }` for an edge feeding the generator from the asset. Wired the intuitive way, every
 * export is reversed — with no error and no warning.
 */
export type GraphEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

/**
 * The named boxes drawn behind a group of nodes, keyed by the uuid each node repeats in
 * `data.group`. A fourth field of `editorInfo` that neither the plan nor the SDK types name —
 * read off a published App on 9 August 2026.
 */
export type GraphGroups = Record<string, { title?: string; color?: string }>

/** The whole state of a graph document: what `editorInfo` holds, and nothing besides. */
export type GraphState = {
  nodes: readonly GraphNode[]
  edges: readonly GraphEdge[]
  /** The node ids that stand for the workflow's own inputs, in the order they are asked. */
  inputKeys: readonly string[]
  nodeGroups?: GraphGroups
}

export const EMPTY_GRAPH: GraphState = { nodes: [], edges: [], inputKeys: [] }

/** Scenario's own limit on a workflow, which only the export has to obey — see the plan, step 9. */
export const MAX_GRAPH_NODES_FOR_EXPORT = 50

/**
 * What the main process accepts of a graph crossing the boundary.
 *
 * Far above anything a hand would draw, and far below what would take the process down: the
 * renderer is sandboxed and trusted for nothing, and a published App already counts 62 nodes —
 * so these are a ceiling on a message, not the limit `MAX_GRAPH_NODES_FOR_EXPORT` names.
 */
export const GRAPH_NODES_MAX = 2000
export const GRAPH_EDGES_MAX = 8000
export const GRAPH_ID_MAX = 200

/**
 * What a node is doing in a run, as the canvas paints it.
 *
 * Here rather than beside the executor that produces it, for the reason `JobStatus` lives in
 * `domain/job.ts`: the canvas builds its label as `` t(`graphRun.${status}`) ``, so a value added
 * without its line in the bundles shows the user the key itself and no typecheck sees it. The
 * guard that catches that (`i18n/bundles.test.ts`) is in `shared/` and cannot reach the renderer.
 */
export type GraphRunStatus = 'idle' | 'running' | 'awaiting' | 'cached' | 'done' | 'failed'

export const GRAPH_RUN_STATUSES: readonly GraphRunStatus[] = [
  'idle',
  'running',
  'awaiting',
  'cached',
  'done',
  'failed',
]

/**
 * Why a node produced nothing. A code, never a message — the renderer translates it, exactly as
 * it does for a job's own failure (`domain/failure.ts`).
 */
export type GraphRunFailure =
  /** Caught in a loop: the plan refused before anything ran. */
  | 'cycle'
  /** A type this milestone has no execution for — the logic and the loops arrive with step 8. */
  | 'unsupported'
  /** A generator with no model chosen. */
  | 'no-model'
  /** Something it reads failed, so it was never asked to run. */
  | 'blocked'
  /** It ran and the job did not succeed. */
  | 'rejected'
  /** A person was asked and said no. Apart from `rejected`: nothing failed, someone decided. */
  | 'declined'

export const GRAPH_RUN_FAILURES: readonly GraphRunFailure[] = [
  'cycle',
  'unsupported',
  'no-model',
  'blocked',
  'rejected',
  'declined',
]

/**
 * The two states with no line of their own in the bundles, and it is deliberate: `idle` is a node
 * saying nothing, and `failed` never shows on its own — a failure always names its reason.
 */
export const SILENT_RUN_STATUSES: readonly GraphRunStatus[] = ['idle', 'failed']

export type GraphNodeRun =
  { status: Exclude<GraphRunStatus, 'failed'> } | { status: 'failed'; failure: GraphRunFailure }

/**
 * The node types Scenario's own converter will take as an OUTPUT of the workflow.
 *
 * Read off `workflow_converter.js` rather than off the prose, and it is narrower than the field
 * suggests: `isOutput` is declared on every node, and the converter looks at it on these three
 * only. Marked anywhere else it is silently ignored — so the studio must not offer the gesture
 * where it would do nothing.
 */
export const OUTPUT_NODE_TYPES: readonly GraphNodeType[] = ['model', 'llm', 'forEachEnd']

export const canBeOutput = (type: GraphNodeType): boolean => OUTPUT_NODE_TYPES.includes(type)

/** The nodes the converter would compile a branch for, in the order the graph holds them. */
export const outputNodesOf = (graph: GraphState): readonly GraphNode[] =>
  graph.nodes.filter(node => node.data.isOutput === true && canBeOutput(node.type))

/**
 * Why a graph would not compile. A code, never a message: the validator's own sentences are
 * English prose written for whoever calls the SDK, and the studio speaks the user's language.
 */
export type GraphCompileProblem =
  /** Nothing is marked as an output, so the converter hands back an empty flow. */
  | 'no-output'
  /** An output is marked and the flow still came back empty — nothing reaches it. */
  | 'empty'
  /** `validateWorkflowFlow` refused it. Its sentence goes to the journal, not to the screen. */
  | 'invalid'

export const GRAPH_COMPILE_PROBLEMS: readonly GraphCompileProblem[] = [
  'no-output',
  'empty',
  'invalid',
]

/**
 * What compiling a graph answers.
 *
 * `steps` rather than the flow itself, and deliberately: nothing consumes a flow yet — the export
 * arrives with step 9 — and carrying one across the boundary on every keystroke would clone the
 * whole workflow for a number. The day it is exported this gains a field; until then it answers
 * what the editor can act on.
 */
export type GraphCompileResult =
  { ok: true; steps: number } | { ok: false; problem: GraphCompileProblem }
