import {
  CONDITIONAL_PORT,
  type GraphHandleInput,
  type GraphHandleOutput,
  type GraphNode,
} from '@shared/domain/graph'

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

/**
 * Every type an input port DECLARES. A list means polymorphic; nothing means it takes anything.
 *
 * What it declares, not what it takes: a port that steers rather than feeds declares `conditional`
 * and takes anything all the same. `typesConnect` holds that verdict, and holds it alone.
 */
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
 * A port that steers rather than feeds, which takes anything: `conditional` names a ROLE, not a
 * payload. A branch computes nothing — it hands on what it received to the port its condition
 * chose — so what it carries is not its to narrow, and typing the port after itself left the node
 * executing perfectly while the canvas refused every wire into it.
 *
 * `conditional` and NOTHING else: a file is free to write `['image', 'conditional']`, and a port
 * that names a payload beside its role is narrowing after all. Not a line of `ALSO_ACCEPTED`,
 * which pairs one accepted type with a finite list of offered ones — "anything" is not a pair.
 */
const steers = (accepted: readonly string[]): boolean =>
  accepted.length === 1 && accepted[0] === CONDITIONAL_PORT

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
  if (accepted.length === 0 || offered === undefined || steers(accepted)) return true

  return accepted.some(type => type === offered || (ALSO_ACCEPTED[type] ?? []).includes(offered))
}

// All three live in `shared/domain/graph.ts`, where the READER can reach them without pulling the
// engine into the opening chunk. Re-exported so the engine still has one door for its ports.
export { handleId, inputHandleOf, inputHandlesOf } from '@shared/domain/graph'

/**
 * `Array.isArray` rather than `?? []`, here and on the input side: the type is what the editor
 * writes, not what a file holds, and `"outputHandles": {}` read off one took every panel that maps
 * them into its error boundary. `parseGraph` validates the node, never its `data`.
 */
export const outputHandlesOf = (node: GraphNode): readonly GraphHandleOutput[] =>
  Array.isArray(node.data.outputHandles) ? node.data.outputHandles : []

export const outputHandleOf = (
  node: GraphNode,
  id: string | undefined,
): GraphHandleOutput | undefined => outputHandlesOf(node).find(handle => handle.id === id)
