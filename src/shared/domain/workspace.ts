import { reconcileOrder } from './order'

/**
 * Workspace registry, shared by both processes. It sits here for the same reason as
 * `domain/tool.ts`: the document domain needs `WorkspaceId`, and `shared/` cannot import from
 * the renderer. The renderer enriches these ids with icons and model families.
 */
export type WorkspaceId = 'image' | 'video' | '3d' | 'audio' | 'textures' | 'skyboxes' | 'graph'

/**
 * Rail order, and `graph` comes last on purpose: it is the one space that produces no asset
 * type of its own — it chains the six that do — so it stands after them rather than among them.
 */
export const WORKSPACE_IDS: readonly WorkspaceId[] = [
  'image',
  'video',
  '3d',
  'audio',
  'textures',
  'skyboxes',
  'graph',
]

export const DEFAULT_WORKSPACE: WorkspaceId = 'image'

/**
 * Exported because the id often arrives from outside the type system — a stored order, an IPC
 * message, the payload of a drag. `workspaceById` throws on those; a drop has to shrug instead.
 */
export function isWorkspaceId(id: string): id is WorkspaceId {
  return WORKSPACE_IDS.some(known => known === id)
}

/**
 * The order to draw the bar in: the stored one, cleaned of the ids this build no longer knows
 * and completed by the ones it has added since. `reconcileOrder` holds where a newcomer lands,
 * and why.
 */
export function workspaceOrder(stored: unknown): WorkspaceId[] {
  const kept: WorkspaceId[] = []
  // `unknown` rather than an array: the value reaches here off a file or an IPC message, and the
  // window that draws the bar must not be the one to discover it was neither.
  if (Array.isArray(stored)) {
    for (const id of stored) {
      if (typeof id === 'string' && isWorkspaceId(id) && !kept.includes(id)) kept.push(id)
    }
  }

  return reconcileOrder(kept, WORKSPACE_IDS, id => id)
}

/**
 * The order after a space has been dropped on another. Dropping means taking the target's
 * place: released rightwards the space lands after it, leftwards before it — one rule read from
 * either side, which is what a bar of pills affords and a menu of Up/Down does not.
 */
export function movedWorkspace(
  stored: readonly WorkspaceId[],
  id: WorkspaceId,
  onto: WorkspaceId,
): WorkspaceId[] {
  const order = [...stored]
  const from = order.indexOf(id)
  const to = order.indexOf(onto)
  if (from === -1 || to === -1 || from === to) return order

  order.splice(from, 1)
  order.splice(to, 0, id)
  return order
}

/** Which way along the bar. Its own words rather than a number: a `-1` reads as nothing. */
export type WorkspaceMove = 'left' | 'right'

/** Whether the menu may offer the move at all — a row that cannot act is disabled, not silent. */
export function canMoveWorkspace(stored: unknown, id: WorkspaceId, move: WorkspaceMove): boolean {
  const order = workspaceOrder(stored)
  const from = order.indexOf(id)
  const to = from + (move === 'left' ? -1 : 1)
  return from !== -1 && to >= 0 && to < order.length
}

/**
 * The order after a space has been moved one place along the bar. The gesture a keyboard and a
 * menu can both make, where a drop needs a pointer that can hold a button down while it travels.
 */
export function movedWorkspaceBy(
  stored: unknown,
  id: WorkspaceId,
  move: WorkspaceMove,
): WorkspaceId[] {
  const order = workspaceOrder(stored)
  if (!canMoveWorkspace(order, id, move)) return order

  const neighbour = order[order.indexOf(id) + (move === 'left' ? -1 : 1)]
  return neighbour ? movedWorkspace(order, id, neighbour) : order
}
