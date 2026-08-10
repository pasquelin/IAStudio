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
import { handleId, outputHandlesOf } from './handles'
import { providersOf } from './mutations'

/** What a branch with nothing chosen yet holds — a condition the converter drops rather than one it misreads. */
const EMPTY_CONDITION: GraphCondition = { operator: 'equals' }

const EMPTY_BLOCK: GraphConditionBlock = { conditions: [EMPTY_CONDITION], logic: 'and' }

/**
 * The blocks a node holds, read as untrusted data.
 *
 * `parseGraph` validates the node and not its `data`, so everything here comes off a file: a block
 * that is not an object, an operator that is a number, a `conditions` that is a string. Anything
 * Unreadable CONTENTS are dropped rather than repaired — the alternative is an editor showing a
 * branch whose compiled CEL says something else. An unreadable BLOCK is another matter: see below.
 */
export function conditionBlocksOf(node: GraphNode): readonly GraphConditionBlock[] {
  return node.type === 'ifElse' ? readConditionBlocks(node.data.conditionBlocks) : []
}

/**
 * The same reader, off a raw field — what the canvas has, where React Flow hands a node its `data`
 * as a free record and the type it was drawn for is gone.
 *
 * **An unreadable block is kept, empty, rather than dropped**, and that is the one place this
 * reader departs from `parseGraph`'s "drop what does not hold". A block is a POSITION: the
 * converter reads `conditionBlocks` raw, gives block `i` the case value `i + 2`, and calls every
 * port past the last block the else. Drop the first of two and the screen shows one branch while
 * the converter still counts two — the port the panel labels "otherwise" compiles as case 3, and
 * the wire on it leaves by a branch nobody chose.
 */
export function readConditionBlocks(held: unknown): readonly GraphConditionBlock[] {
  if (!Array.isArray(held)) return []

  return held.map(block => (isRecord(block) ? blockOf(block) : { conditions: [], logic: 'and' }))
}

function blockOf(block: Record<string, unknown>): GraphConditionBlock {
  const conditions: unknown = block.conditions
  const logic = CONDITION_LOGICS.find(known => known === block.logic) ?? 'and'

  return {
    logic,
    conditions: Array.isArray(conditions)
      ? conditions.flatMap(condition => (isRecord(condition) ? conditionOf(condition) : []))
      : [],
  }
}

/**
 * One condition, or nothing where its operator is not one the studio knows.
 *
 * DROPPED rather than folded to `equals`, which is what this did until the branch began to run
 * locally. The converter answers `'false'` for an operator it does not know and filters the
 * condition out; repairing it to `equals` gave the studio a comparison that can be TRUE, so the
 * same document took one branch here and another once published. That is the rule this file's own
 * header states — unreadable contents are dropped, never repaired — applied to the operator too.
 */
function conditionOf(condition: Record<string, unknown>): readonly GraphCondition[] {
  if (!isGraphConditionOperator(condition.operator)) return []

  const operator: GraphConditionOperator = condition.operator

  return [
    {
      operator,
      ...(typeof condition.field === 'string' ? { field: condition.field } : {}),
      ...valueOf(condition.value, operator),
    },
  ]
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
 * Adding a branch: a block at the end, and its port just before the else.
 *
 * **The handles already there are kept as they are, never regenerated**, and that is what makes
 * the wires survive. The converter matches an `ifElse` port by its INDEX among the handles — the
 * one node type where the spelling of an id means nothing — so a file is free to name them its own
 * way, and rebuilding the list would rename every port and cut every wire into it. It would also
 * drop the `approval` handles the converter explicitly skips when it counts the cases.
 */
export function addedBranch(node: GraphNode): BranchPatch {
  const blocks = conditionBlocksOf(node)
  const handles = outputHandlesOf(node)
  const port = freePort(node.id, handles, `case${blocks.length + 1}`)
  // Inserted AT the count of blocks, which is where the else begins: appended instead, the new
  // case would sit past the else and compile as a branch nothing can reach.
  const grown = [...handles.slice(0, blocks.length), port, ...handles.slice(blocks.length)]

  return {
    conditionBlocks: [...blocks, EMPTY_BLOCK],
    // Then the else, for a node that came with no handles at all: without a port past the last
    // block there is nowhere to wire what none of the branches matched.
    outputHandles: grownTo(node.id, grown, blocks.length + 2),
  }
}

/**
 * Dropping branch `at`: its block and its port, together.
 *
 * The ports after it slide up on their own — they keep their ids, so the wires on them follow, and
 * each lands on the block that slid up with it. Regenerating the list instead left the wire of the
 * dropped branch pointing at `case1` and re-routed it to the branch that took its place.
 */
export function removedBranch(node: GraphNode, at: number): BranchPatch {
  return {
    conditionBlocks: conditionBlocksOf(node).filter((_block, index) => index !== at),
    outputHandles: outputHandlesOf(node).filter((_handle, index) => index !== at),
  }
}

/** What a branch is edited by: the two halves of one fact, never written apart. */
export type BranchPatch = {
  conditionBlocks: readonly GraphConditionBlock[]
  outputHandles: readonly GraphHandleOutput[]
}

/**
 * A port no handle of this node already carries.
 *
 * Ours in spelling only, and the numbering is cosmetic: a file may already hold a `case1` of its
 * own, and two handles sharing an id would make `replaceNodePorts` keep a wire aimed at the wrong
 * one.
 */
function freePort(
  id: string,
  handles: readonly GraphHandleOutput[],
  name: string,
): GraphHandleOutput {
  const taken = new Set(handles.map(handle => handle.id))

  for (let number = 1; ; number += 1) {
    const field = number === 1 ? name : `${name}${number}`
    const candidate = handleId(id, 'target', field)
    if (!taken.has(candidate)) return { id: candidate, name: field }
  }
}

/**
 * The handles, padded to `wanted` — never trimmed.
 *
 * A file carrying MORE ports than blocks is carrying several else ports, which is its business:
 * the converter reads every one of them as the else. Cutting them back would be this editor
 * deciding what a document it did not write meant.
 */
function grownTo(
  id: string,
  handles: readonly GraphHandleOutput[],
  wanted: number,
): readonly GraphHandleOutput[] {
  const grown = [...handles]

  while (grown.length < wanted) {
    grown.push(freePort(id, grown, 'else'))
  }

  return grown
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
