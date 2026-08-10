import type { GraphHandleInput, GraphHandleOutput, GraphNode } from '@shared/domain/graph'

/**
 * The naming Scenario's converter reads, copied rather than invented.
 *
 * `workflow_converter.js` matches handle ids literally — it builds `` `${nodeId}-source-items` ``
 * to find a port — so a handle named any other way is a port the compiler cannot see.
 */
export const handleId = (nodeId: string, side: 'source' | 'target', field: string): string =>
  `${nodeId}-${side}-${field}`

/**
 * The nth list a loop walks, which the converter finds by the regexp `/-input-(\d+)$/`.
 *
 * Not `handleId`: a loop's own ports are the one place the converter numbers instead of naming,
 * and it pairs the list coming IN with the item going OUT by that number alone.
 */
export const loopInputId = (nodeId: string, index: number): string => `${nodeId}-input-${index}`

/** The nth output of a loop, which the converter finds by the regexp `/-output-(\d+)$/`. */
export const loopOutputId = (nodeId: string, index: number): string => `${nodeId}-output-${index}`

/** What an output is called when it does not say — `?? 'output'` in the converter. */
export const DEFAULT_OUTPUT_NAME = 'output'

/**
 * What a CEL expression calls one wire: the node it comes from, then the name of the port it
 * leaves by.
 *
 * Here beside the other three namings for the reason this file exists: the converter builds it
 * itself when it compiles a `transformText`, so an expression naming a wire any other way reads
 * an unknown variable the day the App is published. `ifElse` reads the same names.
 */
export const celVariableName = (nodeId: string, output: string): string => `${nodeId}_${output}`

/**
 * The id the webapp gives an edge: the output handle, then the input handle.
 *
 * The converter never reads it — it walks `source`/`target` — so this is for the eye and for the
 * round trip. Matching their spelling costs nothing and makes a diff between the two editors
 * readable.
 */
export const edgeId = (outputHandle: string, inputHandle: string): string =>
  `${outputHandle}--TO--${inputHandle}`

/** Every type an input port accepts. A list means polymorphic; nothing means it takes anything. */
export function acceptedTypes(handle: GraphHandleInput): readonly string[] {
  if (handle.type === undefined) return []
  return typeof handle.type === 'string' ? [handle.type] : handle.type
}

/**
 * What an input port takes BESIDES the type it names — read off a published App, not reasoned.
 *
 * `workflow_get` on `wflow_H1bKz78jgpinWPKJfVCM5uAp` (62 nodes, 94 edges) holds exactly two wired
 * pairs, and they are the whole table: `image` → `image` 69 times, and **`text` → `prompt` 25
 * times**. The webapp types a text node's output `text` and a generator's prompt port `prompt` —
 * the same two types the studio writes — and it wires them anyway.
 *
 * A table rather than a special case: the day another pair turns up in an App, it is a line here
 * and a line in the test, not a second `if` somewhere in the middle of a predicate.
 */
const ALSO_ACCEPTED: Readonly<Record<string, readonly string[]>> = { prompt: ['text'] }

/**
 * Whether an output can feed an input.
 *
 * An untyped port on either side accepts anything: the studio must not refuse a connection the
 * webapp would allow, and Scenario leaves the type off wherever it does not narrow. Refusing on
 * silence would make a graph imported from the webapp unwireable in the studio.
 */
export function typesConnect(output: GraphHandleOutput, input: GraphHandleInput): boolean {
  const accepted = acceptedTypes(input)
  const offered = output.type
  if (accepted.length === 0 || offered === undefined) return true

  return accepted.some(type => type === offered || (ALSO_ACCEPTED[type] ?? []).includes(offered))
}

// Both live in `shared/domain/graph.ts`, where the READER can reach them without pulling the
// engine into the opening chunk. Re-exported so the engine still has one door for its ports.
export { inputHandleOf, inputHandlesOf } from '@shared/domain/graph'

export const outputHandlesOf = (node: GraphNode): readonly GraphHandleOutput[] =>
  node.data.outputHandles ?? []

export const outputHandleOf = (node: GraphNode, id: string): GraphHandleOutput | undefined =>
  outputHandlesOf(node).find(handle => handle.id === id)
