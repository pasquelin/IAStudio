import {
  EMPTY_GRAPH,
  isGraphNodeType,
  inputHandleOf,
  isReservedNodeId,
  takesManyWires,
  type GraphEdge,
  type GraphGroups,
  type GraphNode,
  type GraphState,
} from '@shared/domain/graph'
import { editorInfoOf } from '@shared/domain/workflow-file'
import { isRecord } from '@shared/guards'

/**
 * Reads a graph back, from a file or from a workflow the API answered with.
 *
 * Both are untrusted: one is a file a user may have edited, the other is a format Scenario can
 * extend at any time. A node whose shape does not hold is DROPPED rather than failing the whole
 * read — losing one node of a graph beats an editor that will not open. Its edges go with it,
 * for the same reason `removeNode` takes them.
 */
export function parseGraph(source: unknown): GraphState {
  // A studio file and a workflow of the API both nest the graph; a document holds it bare.
  const raw = editorInfoOf(source)
  if (!isRecord(raw)) return EMPTY_GRAPH

  const nodes = firstOfEach(asArray(raw.nodes).map(parseNode).filter(isPresent), node => node.id)
  const known = new Set(nodes.map(node => node.id))

  const wired = asArray(raw.edges)
    .map(parseEdge)
    .filter(isPresent)
    .filter(edge => known.has(edge.source) && known.has(edge.target))

  // One producer per input, EXCEPT on a port that takes several (`takesManyWires`) — there the key
  // is the whole edge, so two providers both survive and only a wire drawn twice is dropped.
  // Keyed by the port alone everywhere else, and the first is what a reader keeps, because that is
  // the one the compiler picks. Read here rather than left to the editor: a graph imported from the
  // webapp carries the wires the editor would now allow, and they must reach the plan.
  const byId = new Map(nodes.map(node => [node.id, node]))
  const edges = firstOfEach(wired, edge => edgeKeyOf(edge, byId))

  const inputKeys = firstOfEach(
    asArray(raw.inputKeys)
      .filter(isString)
      .filter(key => known.has(key)),
    key => key,
  )
  const nodeGroups = parseGroups(raw.nodeGroups)

  return nodeGroups ? { nodes, edges, inputKeys, nodeGroups } : { nodes, edges, inputKeys }
}

/**
 * What makes two edges the same for the reader: the port they land on, and — where that port takes
 * several wires — which provider they come from.
 */
function edgeKeyOf(edge: GraphEdge, byId: ReadonlyMap<string, GraphNode>): string {
  const port = `${edge.source}\0${edge.sourceHandle ?? ''}`
  const consumer = byId.get(edge.source)
  const many =
    consumer !== undefined &&
    takesManyWires(consumer.type, inputHandleOf(consumer, edge.sourceHandle)?.name)

  return many ? `${port}\0${edge.target}\0${edge.targetHandle ?? ''}` : port
}

/**
 * The first of each, by whatever names it.
 *
 * Duplicates are not merely untidy: every mutation matches by id, so two nodes called `text1`
 * would be moved together, edited together and deleted together, by one gesture aimed at one of
 * them.
 */
function firstOfEach<T>(items: readonly T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()

  return items.filter(item => {
    const key = keyOf(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const isPresent = <T>(value: T | undefined): value is T => value !== undefined
const isString = (value: unknown): value is string => typeof value === 'string'
const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

const isFinitePosition = (value: unknown): value is { x: number; y: number } =>
  isRecord(value) &&
  typeof value.x === 'number' &&
  typeof value.y === 'number' &&
  Number.isFinite(value.x) &&
  Number.isFinite(value.y)

/**
 * A node without a usable position would be drawn at NaN, where nothing can be clicked and
 * `fitView` collapses the whole viewport onto an unreachable point.
 */
function parseNode(raw: unknown): GraphNode | undefined {
  if (!isRecord(raw)) return undefined
  if (!isString(raw.id) || raw.id.length === 0) return undefined
  // `workflow` names the inputs of the workflow itself in a reference, and the validator does not
  // check it against node ids: a node called that steals every reference to them, in silence.
  if (isReservedNodeId(raw.id)) return undefined
  if (!isGraphNodeType(raw.type)) return undefined
  if (!isFinitePosition(raw.position)) return undefined

  const data = isRecord(raw.data) ? raw.data : {}
  const node = { id: raw.id, type: raw.type, position: raw.position, data }

  return {
    ...node,
    ...(typeof raw.width === 'number' && Number.isFinite(raw.width) ? { width: raw.width } : {}),
    ...(typeof raw.height === 'number' && Number.isFinite(raw.height)
      ? { height: raw.height }
      : {}),
  }
}

function parseEdge(raw: unknown): GraphEdge | undefined {
  if (!isRecord(raw)) return undefined
  if (!isString(raw.id) || !isString(raw.source) || !isString(raw.target)) return undefined

  return {
    id: raw.id,
    source: raw.source,
    target: raw.target,
    ...(isString(raw.sourceHandle) ? { sourceHandle: raw.sourceHandle } : {}),
    ...(isString(raw.targetHandle) ? { targetHandle: raw.targetHandle } : {}),
  }
}

function parseGroups(raw: unknown): GraphGroups | undefined {
  if (!isRecord(raw)) return undefined

  const groups: GraphGroups = {}
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue
    groups[id] = {
      ...(isString(value.title) ? { title: value.title } : {}),
      ...(isString(value.color) ? { color: value.color } : {}),
    }
  }

  return Object.keys(groups).length > 0 ? groups : undefined
}

/**
 * There is no `serializeGraph` on purpose: what the store holds IS what is written.
 *
 * The session fields — `selected`, `dragging`, `measured` — are React Flow's, and stripping them
 * here would mean the engine knowing what React Flow adds, which is exactly what invariant 4
 * forbids. They are dropped where they appear instead, in the canvas adapter, so nothing but
 * `GraphState` ever reaches the store.
 */
