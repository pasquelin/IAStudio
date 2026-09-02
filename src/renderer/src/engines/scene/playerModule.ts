import type { ObjectKind } from '@shared/domain/scene'
import { subtreesOf, type SceneNode } from './sceneState'

/** What the Add menu, the native menu and the toolbar all name the module by. */
export const PLAYER_KIND: ObjectKind = 'player'

/** What makes a node the module: the mark it carries, never its type — a module IS a group. */
export function isPlayerModule(node: SceneNode): boolean {
  return node.components?.some(one => one.type === 'Player') ?? false
}

/** The one node a scene may hold with a `Player` on it, or `null` where it holds none. */
export function playerModuleOf(nodes: readonly SceneNode[]): SceneNode | null {
  return nodes.find(isPlayerModule) ?? null
}

/**
 * The body the module designates — the descendant that walks. Structural, not a name: renaming
 * a node breaks nothing, and two characters in one scene stop depending on the sweep order.
 */
export function playerBodyIdOf(nodes: readonly SceneNode[]): string | null {
  const module = playerModuleOf(nodes)
  if (!module) return null

  return (
    subtreesOf(nodes, [module.id]).find(node =>
      node.components?.some(one => one.type === 'CharacterController'),
    )?.id ?? null
  )
}
