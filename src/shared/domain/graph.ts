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
 * The comparisons an `ifElse` makes, spelled as Scenario's own converter reads them.
 *
 * A closed union rather than the SDK's `string`, and the difference is a branch that exists
 * against one that never fires: `conditionToCelExpression` answers `'false'` for an operator it
 * does not know, `conditionBlockToCEL` then drops the condition, and a misspelt one compiles to a
 * branch nothing can take — with no error at either end.
 */
export type GraphConditionOperator =
  | 'isEmpty'
  | 'isNotEmpty'
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'

export const GRAPH_CONDITION_OPERATORS: readonly GraphConditionOperator[] = [
  'isEmpty',
  'isNotEmpty',
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'between',
]

export const isGraphConditionOperator = (value: unknown): value is GraphConditionOperator =>
  GRAPH_CONDITION_OPERATORS.some(candidate => candidate === value)

/** How many values an operator reads: none, one, or the pair `between` compiles a range from. */
export type ConditionArity = 'none' | 'one' | 'range'

export function conditionArity(operator: GraphConditionOperator): ConditionArity {
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return 'none'
  return operator === 'between' ? 'range' : 'one'
}

/**
 * One comparison an `ifElse` makes.
 *
 * `field` names the node whose output is tested — its id, or `` `${id}_${handleName}` `` for a node
 * with several outputs, which is what `resolveIfElseConditionField` matches. Optional because the
 * converter types it so, and because a condition being written has not chosen one yet: without a
 * field it compiles to `'false'` and is dropped, so a half-written branch is silent rather than
 * wrong.
 */
export type GraphCondition = {
  field?: string
  operator: GraphConditionOperator
  /** A pair for `between`, which refuses anything else; a single value for the rest. */
  value?: string | readonly string[]
}

/** The conditions of ONE branch, and how they combine. One block is one output of the node. */
export type GraphConditionBlock = {
  conditions: readonly GraphCondition[]
  logic: 'and' | 'or'
}

export const CONDITION_LOGICS: readonly GraphConditionBlock['logic'][] = ['and', 'or']

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
  /**
   * A branch, and the one node whose `data` holds a query instead of a value.
   *
   * Each block is one output, in order: the converter finds the port an edge leaves by its INDEX
   * among the output handles, gives block `i` the case value `i + 2`, and treats every handle past
   * the last block as the else — value `1`. So the node's ports and its blocks are one fact
   * written twice, and a block added without its port silently re-routes the ones after it.
   */
  | {
      type: 'ifElse'
      data: GraphNodeData & { conditionBlocks?: readonly GraphConditionBlock[] }
    }
  /**
   * A CEL expression over what its wires carry, and the field is `value` — the same name the text
   * node uses, read off the converter's own union rather than guessed.
   *
   * Left empty the converter compiles `''`, so an expression nobody wrote transforms into nothing
   * rather than refusing the flow.
   */
  | { type: 'transformText'; data: GraphNodeData & { value?: string } }
  /**
   * The end of a loop, and the only node that names another one in its `data`.
   *
   * `parentNodeId` is what pairs it with its `forEach`, and the pair is the loop: the converter
   * finds the end by scanning for it, walks the body between the two, and resolves every wire
   * leaving the end to the LOOP's flow item. Without it the loop compiles with an empty body,
   * which the SDK's own validator then refuses — so the graph is unpublishable until an editor
   * offers the field, rather than only a file being able to write it.
   *
   * The `forEach` itself carries no data of its own: what it walks is written in its PORTS, one
   * numbered pair per list.
   */
  | { type: 'forEachEnd'; data: GraphNodeData & { parentNodeId?: string } }
  | {
      type: Exclude<
        GraphNodeType,
        | 'text'
        | 'stickyNote'
        | 'asset'
        | 'model'
        | 'modelInput'
        | 'approval'
        | 'ifElse'
        | 'transformText'
        | 'forEachEnd'
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

/**
 * Types a local run passes over without a word: a value read straight off the canvas, and a note
 * that compiles to nothing. Read off `engines/graph/executor.ts`, which is what actually decides —
 * every other type either generates, transforms, asks, or reports that the studio cannot run it
 * yet, and all four of those are answers worth pressing the button for.
 */
const SILENT_NODE_TYPES: readonly GraphNodeType[] = ['text', 'asset', 'stickyNote']

/**
 * Whether running this graph would report anything at all — what greys the Run button, and what
 * `start` refuses. Named once and shared, because a bar that offers a run the store then declines
 * is two surfaces of one screen disagreeing.
 */
export const isRunnable = (graph: GraphState): boolean =>
  graph.nodes.some(node => !SILENT_NODE_TYPES.includes(node.type))

/**
 * Scenario's announced limit on a workflow, kept as a NUMBER NOBODY ENFORCES — deliberately.
 *
 * The export was written and does not obey it, and the reason is measured: no call has ever
 * confirmed the ceiling, and the one App readable from here holds 42 editor nodes (its 62 is a
 * count of FLOW items, which is not the same grandeur). A local refusal on an unmeasured
 * threshold turns away graphs Scenario accepts, where the API says the truth. Left here for
 * whoever measures it one day, not as a rule to reinstate on the prose alone.
 */
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
 * What one CEL evaluation may weigh on its way in, for the reason the three above exist: the
 * renderer is sandboxed and trusted for nothing.
 *
 * **Three bounds because three different things are bounded**, and conflating them is how a
 * refusal comes to name the wrong culprit. `GRAPH_EXPRESSION_MAX` is the field someone types — a
 * prompt template runs to a few hundred characters. `GRAPH_VARIABLE_MAX` is what a WIRE carries,
 * which is a whole text node's contents and answers to nobody's typing: bounded at the
 * expression's own size, a long prompt made a perfectly good expression read "invalid". And
 * `GRAPH_VARIABLES_MAX` counts them — one per wire into a single node.
 *
 * None of them bounds the COST of an evaluation, which no length can — see the evaluator's own
 * timeout.
 */
export const GRAPH_EXPRESSION_MAX = 10_000
export const GRAPH_VARIABLE_MAX = 1_000_000
export const GRAPH_VARIABLES_MAX = 200

/**
 * How long a CEL variable's name may be: it is `` `${nodeId}_${outputName}` ``, so it has to
 * clear a node id AND the port name after it. Bounded at `GRAPH_ID_MAX` alone, a node with a long
 * id made its own wire unnameable and the node read "invalid expression" over a sound one.
 */
export const GRAPH_VARIABLE_NAME_MAX = GRAPH_ID_MAX * 2 + 1

/**
 * What a CEL expression reads, by the name the converter gives each wire: `<providerId>_<output>`.
 *
 * A list where the node feeding it produced several, a string where it produced one. The converter
 * declares every such input `type: 'string'`, but the `ref` it writes points at the whole node, so
 * what the variable HOLDS is what that node produced — a deduction from the converter's code, not
 * something an API answer has been read for.
 */
export type GraphTransformVariables = Readonly<Record<string, string | readonly string[]>>

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
  /**
   * A CEL expression the evaluator refused, or one that answered something a wire cannot carry.
   *
   * One code for the two, and deliberately: a transform whose result is a map is as unusable to
   * the node reading it as one that would not parse, and the sentence naming which goes to the
   * journal — the screen gets a code, exactly as a failed job does.
   */
  | 'invalid-expression'

export const GRAPH_RUN_FAILURES: readonly GraphRunFailure[] = [
  'cycle',
  'unsupported',
  'no-model',
  'blocked',
  'rejected',
  'declined',
  'invalid-expression',
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

/**
 * The node types whose wires are NAMED after the node they come from, so one input port holds
 * several of them.
 *
 * Read off `workflow_converter.js` like the list above: these two push one flow input per
 * incoming edge — one `celVariableName` each — where every other type compiles a port to its
 * first edge and drops the rest without a word.
 */
export const MULTI_WIRE_NODE_TYPES: readonly GraphNodeType[] = ['transformText', 'ifElse']

/**
 * Whether ONE input port takes several wires.
 *
 * The conditional port is the exception, and it cuts both ways — which is the whole reason this
 * asks for the port and not just the type. On a `transformText` it STEERS: it decides whether the
 * node runs at all, the converter drops that edge before naming anything, so a second wire there
 * would be one no published run has. On an `ifElse` it is the input itself — a branch reads its
 * condition fields through it (`conditionFieldsOf`), so holding it to one wire would hold every
 * branch to a single field.
 */
export const takesManyWires = (type: GraphNodeType, port: string | undefined): boolean =>
  MULTI_WIRE_NODE_TYPES.includes(type) && (type === 'ifElse' || port !== CONDITIONAL_PORT)

/**
 * Input ports, nested ones included: a sub-handle is a port that can be wired like any other.
 *
 * Here rather than in `engines/graph/handles.ts` for the reason `RESERVED_NODE_ID` is here: the
 * READER needs it — `parseGraph` has to know which port an edge lands on — and the reader is in
 * the opening chunk. Reaching from there into the engine drags the engine along, which a budget
 * test watches (`eager-graph.test.ts`). `handles.ts` re-exports both, so the engine keeps its own
 * door.
 */
export function inputHandlesOf(node: GraphNode): readonly GraphHandleInput[] {
  const flatten = (handles: readonly GraphHandleInput[]): GraphHandleInput[] =>
    handles.flatMap(handle => [handle, ...flatten(handle.subHandles ?? [])])

  // `Array.isArray` rather than `?? []`, as `outputHandlesOf` does it: the type is what the editor
  // writes, not what a file holds, and `"inputHandles": "x"` read off one reached `flatMap` and
  // took every panel that maps a port into its error boundary.
  return flatten(Array.isArray(node.data.inputHandles) ? node.data.inputHandles : [])
}

/** `id` may be missing: an edge read off a file names no handle, and that is no port either. */
export const inputHandleOf = (
  node: GraphNode,
  id: string | undefined,
): GraphHandleInput | undefined => inputHandlesOf(node).find(handle => handle.id === id)

/**
 * The loop a `forEachEnd` names — whether or not the graph still holds it.
 *
 * Read by BOTH sides, which is why it is here: the inspector offers the pairing, and the compiler
 * refuses a loop paired so the converter reads it otherwise. Two readings of one field are two
 * chances to disagree about what a file said.
 *
 * A loop since deleted leaves its id behind, and the panel shows it rather than falling back to
 * "no loop": a picker whose value matches no option renders BLANK, so the screen would read as an
 * end that closes nothing over one that names something, and the next stray change would
 * overwrite it unseen. `IfElseFields` keeps a deleted field visible for the same reason.
 *
 * `typeof` rather than the type: `parseGraph` keeps `data` as it found it, so a file may well hold
 * a number here, and it would reach a `<select>` as its value.
 */
export function namedLoopId(node: GraphNode): string | undefined {
  if (node.type !== 'forEachEnd') return undefined
  const named = node.data.parentNodeId
  // `''` and `undefined` are one answer, not two: choosing "no loop" in the inspector writes the
  // empty string, and a third caller that forgot to test for it would read a pairing to nothing.
  return typeof named === 'string' && named !== '' ? named : undefined
}

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
  /**
   * A `forEachEnd` does not close what it names — and the two below are the studio's own, not the
   * validator's: it accepts both without a word.
   *
   * Measured by running the converter, not deduced. A wire LEAVING an end is resolved to the node
   * that end names, whatever that node is and wherever the end sits. So this covers both an end
   * outside the loop it names and an end naming something that is no loop at all: either way, the
   * node really feeding the end is compiled and then read by nobody, while what read the end
   * reads the named node instead.
   *
   * An end NOTHING reads is never this: with no wire leaving it, there is nothing to misroute —
   * measured, a spare end gives a flow identical item for item to the graph without it.
   */
  | 'loop-end-outside'
  /**
   * Two `forEachEnd` name the same loop. The converter keeps the FIRST it finds and resolves the
   * other's wires to the loop all the same — so a node outside the loop is pulled into its body
   * and runs once per item instead of once. Measured the same way.
   */
  | 'loop-two-ends'

export const GRAPH_COMPILE_PROBLEMS: readonly GraphCompileProblem[] = [
  'no-output',
  'empty',
  'invalid',
  'loop-end-outside',
  'loop-two-ends',
]

/**
/**
 * What publishing a graph answers: the workflow it became, or why it did not.
 *
 * `refused` is the API's own no — its sentence goes to the journal, never to the screen — and it
 * is kept apart from the compile problems for the reason those exist: the user can act on
 * "nothing reaches an output", and cannot act on a 403.
 */
export type GraphPublishResult =
  { ok: true; workflowId: string } | { ok: false; problem: GraphCompileProblem | 'refused' }

/**
 * What compiling a graph answers.
 *
 * `steps` rather than the flow itself: carrying a whole flow across the boundary on every
 * keystroke would clone the workflow for a number. The export builds its own — `refuseFlow` is
 * what the two share, so one question keeps one answer.
 */
export type GraphCompileResult =
  { ok: true; steps: number } | { ok: false; problem: GraphCompileProblem }
