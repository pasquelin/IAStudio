/**
 * Where the memories of a project land when nothing places them by hand.
 *
 * A force layout, written here rather than taken from a library, and the reason is the size: a
 * settings section shows what ONE project holds — tens of memories, not the thousands
 * ForceAtlas2 and its Barnes-Hut approximation exist for. Reach for `graphology` on the day this
 * panel is asked to draw a graph it cannot draw in a frame; until then this is forty lines that
 * need no dependency and no worker.
 *
 * 🛑 Arithmetic alone, and no canvas: what places a point is testable without a browser, which
 * is the studio's rule for every engine. What draws it is the panel's business.
 */

export type MemoryGraphNode = {
  id: string
  /** What the point is coloured by — a memory's own sort. */
  type: string
  /** What the reader is shown on hover. Already the memory's own words. */
  label: string
}

export type MemoryGraphEdge = { from: string; to: string }

export type PlacedNode = MemoryGraphNode & {
  x: number
  y: number
  /** How many links reach it, which is what sizes the dot: what is talked about most is biggest. */
  degree: number
}

export type MemoryLayout = {
  nodes: readonly PlacedNode[]
  edges: readonly { from: PlacedNode; to: PlacedNode }[]
}

type Body = PlacedNode & { vx: number; vy: number }

/** Settled rather than animated: a graph that drifts under the pointer is one nobody can aim at. */
const PASSES = 260

const DAMPING = 0.86
const PULL = 0.0016
const CENTRE = 0.0022

/**
 * The layout, run to a standstill.
 *
 * The repulsion grows with the count so a bigger graph opens out rather than balling up, and
 * every pair is compared: at the scale a settings panel shows, `n²` is cheaper than the tree an
 * approximation would build.
 */
export function memoryLayoutOf(
  nodes: readonly MemoryGraphNode[],
  edges: readonly MemoryGraphEdge[],
  size: { width: number; height: number },
): MemoryLayout {
  const held = new Map<string, Body>()
  const bodies = nodes.map((one, index) => {
    // A ring rather than random: the same memories place the same way twice, so reopening the
    // panel does not redraw a graph the reader had just learned to read.
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2
    const spread = 40 + Math.sqrt(nodes.length) * 9
    const body: Body = {
      ...one,
      x: size.width / 2 + Math.cos(angle) * spread,
      y: size.height / 2 + Math.sin(angle) * spread,
      vx: 0,
      vy: 0,
      degree: 0,
    }
    held.set(one.id, body)
    return body
  })

  const linked = edges
    .map(edge => ({ from: held.get(edge.from), to: held.get(edge.to) }))
    .filter((edge): edge is { from: Body; to: Body } => !!edge.from && !!edge.to)
  linked.forEach(edge => {
    edge.from.degree += 1
    edge.to.degree += 1
  })

  const repulsion = 900 + bodies.length * 2
  for (let pass = 0; pass < PASSES; pass += 1) {
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        push(bodies[i], bodies[j], repulsion, pass * bodies.length + j)
      }
    }
    linked.forEach(edge => {
      const dx = edge.to.x - edge.from.x
      const dy = edge.to.y - edge.from.y
      edge.from.vx += dx * PULL
      edge.from.vy += dy * PULL
      edge.to.vx -= dx * PULL
      edge.to.vy -= dy * PULL
    })
    bodies.forEach(body => {
      body.vx = (body.vx + (size.width / 2 - body.x) * CENTRE) * DAMPING
      body.vy = (body.vy + (size.height / 2 - body.y) * CENTRE) * DAMPING
      body.x += body.vx
      body.y += body.vy
    })
  }

  return { nodes: bodies, edges: linked }
}

/**
 * Two bodies pushed apart.
 *
 * 🛑 `nudge` and not `Math.random()`: two memories at the same point have no direction to part
 * along, and a random one would place the graph differently on every open — the very thing the
 * ring above is for.
 */
function push(one: Body | undefined, other: Body | undefined, force: number, nudge: number): void {
  if (!one || !other) return

  let dx = one.x - other.x
  let dy = one.y - other.y
  let square = dx * dx + dy * dy
  if (square < 1) {
    dx = Math.cos(nudge)
    dy = Math.sin(nudge)
    square = 1
  }

  const length = Math.sqrt(square)
  const shove = force / square
  one.vx += (dx / length) * shove
  one.vy += (dy / length) * shove
  other.vx -= (dx / length) * shove
  other.vy -= (dy / length) * shove
}
