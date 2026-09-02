import type { CellKey, CellPlan } from './cellInstancing'
import { cellTouches, type SpatialIndex } from './spatialIndex'

/**
 * B — le loose quadtree, feuilles alignées sur les cellules d'instancing.
 *
 * « Loose » : la boîte d'un nœud est élargie du facteur ci-dessous pour le TEST, sans que les
 * cellules changent de nœud. C'est ce qui évite qu'un corps à cheval remonte vers la racine, où il
 * redeviendrait testé à chaque requête — le défaut exact des 19 régions de cubes de C5-B0.
 *
 * 🛑 Le facteur vaut 1 sur NOS données, et c'est une mesure qui le dit : une cellule ne tient que
 * des corps dont l'empreinte au p99 vaut 1,6 % d'elle-même, les débordants étant déjà sortis dans
 * `oversized`. Un facteur de 2, l'habitude de la littérature, doublerait le nombre de nœuds
 * retenus sans rien rattraper. Il reste réglable pour que la mesure tranche plutôt que l'usage.
 */

export type QuadOptions = { looseness: number }

type Node = {
  /** En cellules, jamais en unités de monde : les feuilles sont les cellules d'instancing. */
  cx: number
  cz: number
  span: number
  children: Node[]
  /** Une feuille porte au plus une cellule ; un nœud interne n'en porte aucune. */
  cell: CellKey | null
  /** Combien de cellules non vides sous ce nœud — un nœud vide ne se descend pas. */
  held: number
}

export function buildQuadtree(plan: CellPlan, { looseness }: QuadOptions): SpatialIndex {
  const started = performance.now()

  let widest = 1
  for (const cell of plan.cells.values()) widest = Math.max(widest, cell.cx + 1, cell.cz + 1)
  let span = 1
  while (span < widest) span *= 2

  const root: Node = { cx: 0, cz: 0, span, children: [], cell: null, held: 0 }
  const attach = (node: Node, cell: CellKey, cx: number, cz: number): void => {
    node.held += 1
    if (node.span === 1) {
      node.cell = cell
      return
    }
    const half = node.span / 2
    const child = (cx >= node.cx + half ? 1 : 0) + (cz >= node.cz + half ? 2 : 0)
    let into = node.children.find(one => one.cx === node.cx + (child % 2) * half && one.cz === node.cz + (child >= 2 ? half : 0))
    if (!into) {
      into = {
        cx: node.cx + (child % 2) * half,
        cz: node.cz + (child >= 2 ? half : 0),
        span: half,
        children: [],
        cell: null,
        held: 0,
      }
      node.children.push(into)
    }
    attach(into, cell, cx, cz)
  }
  for (const cell of plan.cells.values()) attach(root, cell.key, cell.cx, cell.cz)

  const seen = { nodesVisited: 0, cellsReturned: 0 }
  const built = { ms: performance.now() - started }

  /** La boîte d'un nœud, élargie du facteur de relâchement, coupe-t-elle le disque ? */
  const touches = (node: Node, x: number, z: number, radius: number): boolean => {
    const grow = ((looseness - 1) * node.span * plan.cellSize) / 2
    const lowX = plan.low.x + node.cx * plan.cellSize - grow
    const lowZ = plan.low.z + node.cz * plan.cellSize - grow
    const side = node.span * plan.cellSize + grow * 2
    const nearX = Math.max(lowX, Math.min(x, lowX + side))
    const nearZ = Math.max(lowZ, Math.min(z, lowZ + side))
    return (nearX - x) ** 2 + (nearZ - z) ** 2 <= radius * radius
  }

  const descend = (node: Node, x: number, z: number, radius: number, into: CellKey[]): void => {
    seen.nodesVisited += 1
    if (node.held === 0 || !touches(node, x, z, radius)) return
    if (node.cell !== null) {
      const cell = plan.cells.get(node.cell)
      // Le test EXACT sur la feuille : le relâchement sert à descendre, jamais à retenir.
      if (cell && cellTouches(plan, cell.cx, cell.cz, x, z, radius)) into.push(node.cell)
      return
    }
    for (const child of node.children) descend(child, x, z, radius, into)
  }

  let nodes = 0
  const count = (node: Node): void => {
    nodes += 1
    for (const child of node.children) count(child)
  }
  count(root)

  return {
    name: 'quadtree',
    built,
    query: (x, z, radius, into) => {
      into.length = 0
      seen.nodesVisited = 0
      descend(root, x, z, radius, into)
      seen.cellsReturned = into.length
    },
    update: () => {
      // Une cellule ne change jamais de nœud : seul le corps change de cellule, et l'arbre est
      // indexé sur les CELLULES. Un corps qui bouge ne touche donc pas l'arbre.
    },
    stats: () => ({ ...seen }),
    // Un nœud : quatre nombres, un tableau d'enfants, une clé. Compté sur l'arbre réel.
    footprint: () => nodes * 64,
  }
}
