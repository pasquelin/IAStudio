import type { Edge, EdgeChange, Node, NodeChange } from '@xyflow/react'
import type { GraphNode, GraphNodeRun, GraphState } from '@shared/domain/graph'

/**
 * The one file that knows what React Flow puts on the objects it is handed.
 *
 * It writes `selected`, `dragging`, `measured` and a handful more onto the very nodes it renders.
 * None of that is graph state — a graph saved mid-selection would reopen selected, and a width
 * measured on one screen would be replayed on another. Stripping them in the engine would mean
 * the engine knowing about React Flow, which invariant 4 forbids; so it happens here, and
 * nothing but `GraphState` ever reaches the store.
 *
 * Selection is the exception that has to travel BACK: a fully controlled canvas keeps none of
 * its own, so what is not handed to it is not selected — and the delete key, which acts on the
 * selection, would then never find anything to delete.
 */
export type CanvasNode = Node<Record<string, unknown>>

/**
 * Where a node's run state rides down to its face, since React Flow gives a node no slot of its
 * own besides `data`. Spelled apart from anything `editorInfo` carries, and one-way only: this
 * object is what React Flow renders, never what goes back to the store.
 */
export const RUN_STATE_KEY = 'runState'

/**
 * Where "the compiler refuses BECAUSE of this node" rides down, beside the run state and never
 * inside it: a refusal is not a failed run — nothing has run — and folding it into `GraphNodeRun`
 * would paint a node red under a status it never reached.
 *
 * Written on every node, a sticky note included, though a note can never be named by one: it
 * compiles to nothing, so no refusal reaches it. A key that appears and disappears is a key every
 * reader has to guard, and the note draws its own shell rather than `NodeShell`.
 */
export const PROBLEM_KEY = 'compileProblem'

const canvasNodeOf = (
  node: GraphNode,
  selected: boolean,
  run: GraphNodeRun | undefined,
  problem: boolean,
): CanvasNode => ({
  id: node.id,
  type: node.type,
  position: node.position,
  data: { ...node.data, [RUN_STATE_KEY]: run, [PROBLEM_KEY]: problem },
  selected,
  ...(node.width === undefined ? {} : { width: node.width }),
  ...(node.height === undefined ? {} : { height: node.height }),
})

/**
 * Keyed by the graph node itself, which is immutable: an edit replaces the node it touches and
 * leaves every other one alone, so the key IS the "did this change" test. A module-level cache
 * rather than a ref, because a ref may not be written during a render — and this is a pure
 * function of its inputs, not state of any component.
 */
const CACHE = new WeakMap<
  GraphNode,
  { selected: boolean; run: GraphNodeRun | undefined; problem: boolean; canvas: CanvasNode }
>()

/**
 * Rebuilds only the nodes that changed, and hands the others back by reference.
 *
 * React Flow compares node objects by IDENTITY (`adoptUserNodes`, `checkEquality`): a new object
 * makes it drop that node's measurements and re-subscribe its `ResizeObserver`. Mapping the whole
 * list afresh does that to EVERY node on every frame of a drag — dozens of observer churns a
 * frame on the UI thread, for the one node that actually moved.
 *
 * A run reports node by node, so the same rule earns its keep a second time: one node turning
 * green must not rebuild the twenty around it.
 */
export function canvasNodesOf(
  graph: GraphState,
  selected: ReadonlySet<string>,
  runs: Readonly<Record<string, GraphNodeRun>> = {},
  problems: ReadonlySet<string> = new Set(),
): CanvasNode[] {
  return graph.nodes.map(node => {
    const isSelected = selected.has(node.id)
    const run = runs[node.id]
    const problem = problems.has(node.id)
    const cached = CACHE.get(node)
    if (
      cached &&
      cached.selected === isSelected &&
      cached.run === run &&
      cached.problem === problem
    )
      return cached.canvas

    const canvas = canvasNodeOf(node, isSelected, run, problem)
    CACHE.set(node, { selected: isSelected, run, problem, canvas })
    return canvas
  })
}

/**
 * The selection a batch of changes leaves behind, applied to the one it started from.
 *
 * Kind-agnostic, which is what lets the two selections share it: the nodes are held above the
 * canvas for the inspector to read, the edges below it.
 *
 * The very same set comes back when nothing about the selection moved — every frame of a drag is
 * a batch of changes, and a new set each time would rebuild the node list for nothing.
 */
export function selectionAfter(
  selected: ReadonlySet<string>,
  changes: readonly (NodeChange | EdgeChange)[],
): ReadonlySet<string> {
  const next = new Set(selected)

  for (const change of changes) {
    if (change.type === 'select') {
      if (change.selected) next.add(change.id)
      else next.delete(change.id)
    }
    if (change.type === 'remove') next.delete(change.id)
  }

  const unchanged = next.size === selected.size && [...next].every(id => selected.has(id))
  return unchanged ? selected : next
}

/**
 * The edge is handed over as it stands. `type` is left off on purpose: the default bezier is
 * what the webapp draws, styled in CSS rather than per edge — a style object here would put a
 * colour in a component, which the studio keeps in its tokens.
 */
export const toCanvasEdges = (graph: GraphState, selected: ReadonlySet<string>): Edge[] =>
  graph.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    // For the reason a node carries it: unselected, an edge cannot be deleted from the keyboard.
    selected: selected.has(edge.id),
    ...(edge.sourceHandle === undefined ? {} : { sourceHandle: edge.sourceHandle }),
    ...(edge.targetHandle === undefined ? {} : { targetHandle: edge.targetHandle }),
  }))

/**
 * The moves a batch of changes ends on, one per node.
 *
 * Only the last position of a node is kept: React Flow reports a drag as a change per frame, and
 * one command per frame would be one undo entry per frame if the coalescing id ever changed.
 * Positions only — selection and dimensions are session state, and this is where they stop.
 */
export function movesIn(changes: readonly NodeChange[]): Map<string, { x: number; y: number }> {
  const moves = new Map<string, { x: number; y: number }>()

  for (const change of changes) {
    if (change.type === 'position' && change.position) moves.set(change.id, change.position)
  }

  return moves
}

/** The nodes a batch of changes removes — a keyboard delete, or the node's own menu. */
export const removalsIn = (changes: readonly NodeChange[]): string[] =>
  changes.filter(change => change.type === 'remove').map(change => change.id)

/** True while a drag is still under the pointer, so the gesture stays open and the undo one entry. */
export const isDragging = (changes: readonly NodeChange[]): boolean =>
  changes.some(change => change.type === 'position' && change.dragging === true)
