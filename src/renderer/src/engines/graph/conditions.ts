import type {
  GraphCondition,
  GraphConditionBlock,
  GraphConditionOperator,
  GraphHandleOutput,
  GraphNode,
  GraphState,
} from '@shared/domain/graph'
import { CONDITION_LOGICS, conditionArity, isGraphConditionOperator } from '@shared/domain/graph'
import { isRecord } from '@shared/guards'
import { handleId } from './handles'
import { providersOf } from './mutations'

/** What a branch with nothing chosen yet holds — a condition the converter drops rather than one it misreads. */
const EMPTY_CONDITION: GraphCondition = { operator: 'equals' }

const EMPTY_BLOCK: GraphConditionBlock = { conditions: [EMPTY_CONDITION], logic: 'and' }

/**
 * The blocks a node holds, read as untrusted data.
 *
 * `parseGraph` validates the node and not its `data`, so everything here comes off a file: a block
 * that is not an object, an operator that is a number, a `conditions` that is a string. Anything
 * unreadable is dropped rather than repaired — the alternative is an editor showing a branch whose
 * compiled CEL says something else.
 */
export function conditionBlocksOf(node: GraphNode): readonly GraphConditionBlock[] {
  return node.type === 'ifElse' ? readConditionBlocks(node.data.conditionBlocks) : []
}

/**
 * The same reader, off a raw field — what the canvas has, where React Flow hands a node its `data`
 * as a free record and the type it was drawn for is gone.
 */
export function readConditionBlocks(held: unknown): readonly GraphConditionBlock[] {
  if (!Array.isArray(held)) return []

  return held.flatMap(block => (isRecord(block) ? [blockOf(block)] : []))
}

function blockOf(block: Record<string, unknown>): GraphConditionBlock {
  const conditions: unknown = block.conditions
  const logic = CONDITION_LOGICS.find(known => known === block.logic) ?? 'and'

  return {
    logic,
    conditions: Array.isArray(conditions)
      ? conditions.flatMap(condition => (isRecord(condition) ? [conditionOf(condition)] : []))
      : [],
  }
}

function conditionOf(condition: Record<string, unknown>): GraphCondition {
  const operator: GraphConditionOperator = isGraphConditionOperator(condition.operator)
    ? condition.operator
    : 'equals'

  return {
    operator,
    ...(typeof condition.field === 'string' ? { field: condition.field } : {}),
    ...valueOf(condition.value, operator),
  }
}

/**
 * The value of a condition, kept only in the shape its operator reads.
 *
 * `between` compiles to `false` unless it holds a pair, and every other operator formats an array
 * as a CEL list — which `equals` would then compare a string to. So the arity decides, and a value
 * that does not fit the operator is dropped rather than carried into an expression.
 */
function valueOf(
  value: unknown,
  operator: GraphConditionOperator,
): { value?: string | readonly string[] } {
  const arity = conditionArity(operator)
  if (arity === 'none') return {}

  if (arity === 'range') {
    if (!Array.isArray(value)) return {}
    const pair = value.filter(item => typeof item === 'string')
    return pair.length === 2 ? { value: pair } : {}
  }

  return typeof value === 'string' ? { value } : {}
}

/**
 * The output ports an `ifElse` with these blocks carries: one per branch, then the else.
 *
 * Untyped, both sides: a branch passes on whatever reached the node, and a type here would refuse
 * the wire for a picture on a node steering text. Their ids are ours — the converter matches an
 * `ifElse` port by its index among the handles, never by its spelling, which is the one node type
 * where that is true.
 */
export function ifElseOutputs(id: string, blocks: number): readonly GraphHandleOutput[] {
  const cases = Array.from({ length: blocks }, (_unused, index) => ({
    id: handleId(id, 'target', `case${index + 1}`),
    name: `case${index + 1}`,
  }))

  return [...cases, { id: handleId(id, 'target', 'else'), name: 'else' }]
}

/**
 * What a condition may test: the nodes wired INTO this one, by id.
 *
 * `providersOf` reads the inverted convention — an edge points from consumer to provider — so what
 * feeds the branch is its own outgoing edges.
 *
 * A list rather than a field to type into, and the reason is measured in `workflow-compile.test`:
 * a field naming a node that feeds nothing is NOT dropped — `conditionBlockToCEL` falls back to the
 * raw name, and the case compiles against a variable the flow never declares.
 */
export function conditionFieldsOf(graph: GraphState, id: string): readonly string[] {
  const fields = new Set(providersOf(graph, id).map(edge => edge.target))
  return [...fields]
}

/** Blocks with one changed, the rest untouched — the shape every edit below is written from. */
function replaceBlock(
  blocks: readonly GraphConditionBlock[],
  index: number,
  next: (block: GraphConditionBlock) => GraphConditionBlock,
): readonly GraphConditionBlock[] {
  return blocks.map((block, at) => (at === index ? next(block) : block))
}

export const addConditionBlock = (
  blocks: readonly GraphConditionBlock[],
): readonly GraphConditionBlock[] => [...blocks, EMPTY_BLOCK]

export const removeConditionBlock = (
  blocks: readonly GraphConditionBlock[],
  index: number,
): readonly GraphConditionBlock[] => blocks.filter((_block, at) => at !== index)

export const setBlockLogic = (
  blocks: readonly GraphConditionBlock[],
  index: number,
  logic: GraphConditionBlock['logic'],
): readonly GraphConditionBlock[] => replaceBlock(blocks, index, block => ({ ...block, logic }))

export const addCondition = (
  blocks: readonly GraphConditionBlock[],
  index: number,
): readonly GraphConditionBlock[] =>
  replaceBlock(blocks, index, block => ({
    ...block,
    conditions: [...block.conditions, EMPTY_CONDITION],
  }))

export const removeCondition = (
  blocks: readonly GraphConditionBlock[],
  index: number,
  at: number,
): readonly GraphConditionBlock[] =>
  replaceBlock(blocks, index, block => ({
    ...block,
    conditions: block.conditions.filter((_condition, position) => position !== at),
  }))

/**
 * One condition, changed.
 *
 * The patch goes through `valueOf` rather than being merged as it stands: changing the operator is
 * what changes the arity, and a value kept across that change is a value the new operator reads
 * differently — a pair left behind by `between` becomes a CEL list that `equals` compares a string
 * against, silently false forever.
 */
export function setCondition(
  blocks: readonly GraphConditionBlock[],
  index: number,
  at: number,
  patch: Partial<GraphCondition>,
): readonly GraphConditionBlock[] {
  return replaceBlock(blocks, index, block => ({
    ...block,
    conditions: block.conditions.map((condition, position) => {
      if (position !== at) return condition
      const merged = { ...condition, ...patch }

      return {
        operator: merged.operator,
        ...(merged.field === undefined ? {} : { field: merged.field }),
        ...valueOf(merged.value, merged.operator),
      }
    }),
  }))
}
