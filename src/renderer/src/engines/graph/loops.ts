import type {
  GraphHandleInput,
  GraphHandleOutput,
  GraphNode,
  GraphState,
} from '@shared/domain/graph'
import { isRecord } from '@shared/guards'
import { loopInputId, loopOutputId } from './handles'

/**
 * What a loop walks, per list: a text list or a picture list.
 *
 * The two names are the converter's whole vocabulary here — it calls the flow input `text${n}` or
 * `image${n}` and the item of the iteration by the same word — so a third kind would be a variable
 * the server has never heard of.
 */
export type LoopListKind = 'text' | 'image'

export const LOOP_LIST_KINDS: readonly LoopListKind[] = ['image', 'text']

/** One list a loop walks: the port it arrives by, the port the item of the iteration leaves by. */
export type LoopList = {
  /** The number the two ports share, and the only thing that pairs them. */
  index: number
  kind: LoopListKind
  input: GraphHandleInput | undefined
  output: GraphHandleOutput | undefined
}

/** What a loop is edited by: its two sides, never written apart. */
export type LoopPatch = {
  inputHandles: readonly GraphHandleInput[]
  outputHandles: readonly GraphHandleOutput[]
}

const LOOP_INPUT = /-input-(\d+)$/
const LOOP_OUTPUT = /-output-(\d+)$/

/**
 * The lists a loop walks, read off its ports as untrusted data.
 *
 * `parseGraph` validates the node and not its `data`, so everything here comes off a file: a
 * handle that is not an object, an id that is not a string, a number the editor never wrote. A
 * port that does not answer the converter's own regexp is not a list — the `conditional` input
 * every node carries lands here too, and counting it would offer to delete a port no loop walks.
 *
 * The numbers need not run 0, 1, 2: the converter parses each one and pairs by its value, so a
 * file holding `input-0` and `input-7` holds two lists and this reads two.
 */
export function loopListsOf(node: GraphNode): readonly LoopList[] {
  const inputs = numbered(ownInputHandles(node), LOOP_INPUT)
  const outputs = numbered(ownOutputHandles(node), LOOP_OUTPUT)
  const indices = [...new Set([...inputs.keys(), ...outputs.keys()])].sort((a, b) => a - b)

  return indices.map(index => {
    const output = outputs.get(index)

    return {
      index,
      input: inputs.get(index),
      output,
      // The converter's own test, copied rather than reasoned: `outputHandle?.type === 'text'`
      // decides between `text${n}` and `image${n}`, and everything that is not the word `text`
      // is a picture to it — an untyped port included.
      kind: output?.type === 'text' ? 'text' : 'image',
    }
  })
}

/**
 * A list added, on both sides at once.
 *
 * The number is one past the highest already there, never the count: a file whose lists are
 * numbered 0 and 7 would otherwise get a second `input-1`, and `.find` would hand the converter
 * whichever came first.
 */
export function addedList(node: GraphNode, kind: LoopListKind): LoopPatch {
  const lists = loopListsOf(node)
  const index = lists.reduce((highest, list) => Math.max(highest, list.index + 1), 0)

  return {
    inputHandles: [...ownInputHandles(node), { id: loopInputId(node.id, index), type: kind }],
    outputHandles: [...ownOutputHandles(node), { id: loopOutputId(node.id, index), type: kind }],
  }
}

/**
 * A list dropped, both of its ports with it.
 *
 * The survivors keep their numbers — and keeping them is what keeps their wires, since the
 * converter reads the pairing off the id rather than off the position. Renumbering to close the
 * gap would hand the flow input of one list to the item port of another, in silence.
 */
export function removedList(node: GraphNode, index: number): LoopPatch {
  return {
    inputHandles: ownInputHandles(node).filter(handle => numberOf(handle, LOOP_INPUT) !== index),
    outputHandles: ownOutputHandles(node).filter(handle => numberOf(handle, LOOP_OUTPUT) !== index),
  }
}

/**
 * A list's kind, changed on both ports.
 *
 * The output's is what the converter reads to name the item; the input's is what the canvas
 * refuses a wrong wire by. Written apart, a text list would accept a picture and then ask the
 * server for a variable it never declared.
 */
export function setListKind(node: GraphNode, index: number, kind: LoopListKind): LoopPatch {
  const retyped = <T>(handles: readonly T[], pattern: RegExp): T[] =>
    handles.map(handle =>
      numberOf(handle, pattern) === index ? { ...handle, type: kind } : handle,
    )

  return {
    inputHandles: retyped(ownInputHandles(node), LOOP_INPUT),
    outputHandles: retyped(ownOutputHandles(node), LOOP_OUTPUT),
  }
}

/**
 * The loop an end names — whether or not the graph still holds it.
 *
 * A loop since deleted leaves its id behind, and the panel shows it rather than falling back to
 * "no loop": a picker whose value matches no option renders BLANK, so the screen would read as an
 * end that closes nothing over one that names something, and the next stray change would
 * overwrite it unseen. `IfElseFields` keeps a deleted field visible for the same reason.
 *
 * `typeof` rather than the type: `parseGraph` keeps `data` as it found it, so a file may well
 * hold a number here, and it would reach a `<select>` as its value.
 */
export function namedLoopId(node: GraphNode): string | undefined {
  if (node.type !== 'forEachEnd') return undefined
  return typeof node.data.parentNodeId === 'string' ? node.data.parentNodeId : undefined
}

/** Every loop of the graph, which is what the end of one can be told to close. */
export const loopsOf = (graph: GraphState): readonly GraphNode[] =>
  graph.nodes.filter(node => node.type === 'forEach')

/**
 * Read straight off `data` rather than through `inputHandlesOf`, which FLATTENS: written back
 * flattened, a model's grouped ports would come apart into top-level ones. A loop's own ports are
 * never nested, but this list is what gets written.
 *
 * `Array.isArray` for the reason `numberOf` guards its handle: the type is what the editor writes,
 * not what a file holds, and `"inputHandles": {}` would throw on the first `.filter`.
 */
const ownInputHandles = (node: GraphNode): readonly GraphHandleInput[] =>
  Array.isArray(node.data.inputHandles) ? node.data.inputHandles : []

const ownOutputHandles = (node: GraphNode): readonly GraphHandleOutput[] =>
  Array.isArray(node.data.outputHandles) ? node.data.outputHandles : []

/** First one wins, as `.find` does in the converter: two ports on one number are the file's doing. */
function numbered<T>(handles: readonly T[], pattern: RegExp): ReadonlyMap<number, T> {
  const found = new Map<number, T>()

  for (const handle of handles) {
    const index = numberOf(handle, pattern)
    if (index !== undefined && !found.has(index)) found.set(index, handle)
  }

  return found
}

/**
 * The number a port carries, off a handle that may be anything at all.
 *
 * The type says `{ id: string }` and a file says otherwise: `parseGraph` keeps `data` as it found
 * it, so a `null` in `inputHandles` reaches here and reading `.id` off it takes the whole panel
 * into its error boundary.
 */
function numberOf(handle: unknown, pattern: RegExp): number | undefined {
  if (!isRecord(handle) || typeof handle.id !== 'string') return undefined
  const match = pattern.exec(handle.id)
  if (!match) return undefined
  const index = Number(match[1])
  return Number.isSafeInteger(index) ? index : undefined
}
