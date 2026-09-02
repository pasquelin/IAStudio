import { withComponent, type Component } from '@shared/domain/component'
import type { ObjectKind } from '@shared/domain/scene'
import { subtreesOf, type SceneNode } from './sceneState'

/** What the Add menu, the native menu and the toolbar all name the module by. */
export const PLAYER_KIND: ObjectKind = 'player'

const carries = (node: SceneNode, type: Component['type']): boolean =>
  node.components?.some(one => one.type === type) ?? false

/** What makes a node the module: the mark it carries, never its type — a module IS a group. */
export function isPlayerModule(node: SceneNode): boolean {
  return carries(node, 'Player')
}

/** What a module names, each answered structurally — a rename breaks none of the three. */
export type PlayerParts = {
  module: SceneNode
  /** What walks. The seat the camera takes, where a sweep used to hand it to the first controller. */
  body?: SceneNode
  arm?: SceneNode
  /** The camera anywhere under the arm, so tidying one into a group of its own breaks nothing. */
  eye?: SceneNode
}

type FoundParts = PlayerParts & { inside: readonly SceneNode[] }

/**
 * What the scene's module names. 🛑 The FIRST module in document order, which is a choice nothing
 * shows — refusing a second one is what makes that honest, and it is not written yet.
 */
export function playerPartsOf(nodes: readonly SceneNode[]): PlayerParts | null {
  const module = nodes.find(isPlayerModule)
  return module ? partsIn(nodes, module) : null
}

function partsIn(nodes: readonly SceneNode[], module: SceneNode): FoundParts {
  const inside = subtreesOf(nodes, [module.id])
  const arm = inside.find(node => carries(node, 'SpringArm'))
  const byId = new Map(inside.map(node => [node.id, node]))
  const hangsFrom = (node: SceneNode, ancestorId: string): boolean => {
    // No visited set, as every other walk of this chain here: `canReparent` refuses a cycle.
    for (let held = node.parentId; held !== null; held = byId.get(held)?.parentId ?? null) {
      if (held === ancestorId) return true
    }
    return false
  }

  return {
    module,
    inside,
    body: inside.find(node => carries(node, 'CharacterController')),
    arm,
    eye: arm && inside.find(node => node.type === 'camera' && hangsFrom(node, arm.id)),
  }
}

/**
 * Every module's arm, pointed at the body and the eye it HANGS with rather than at two written
 * names. 🛑 `copiesOf` remaps `id` and `parentId` and nothing inside a component, so a duplicated
 * module keeps an arm aimed at the original's camera — and a name resolved globally did the same.
 *
 * What an author WROTE is left alone: both fields stay editable, so only a blank, a name the
 * scene no longer holds, or one belonging to ANOTHER module is filled in from the tree.
 */
export function withBoundPlayerArm(nodes: readonly SceneNode[]): readonly SceneNode[] {
  const modules = nodes.filter(isPlayerModule)
  if (modules.length === 0) return nodes

  const holder = new Map<string, string>()
  const found = modules.map(module => partsIn(nodes, module))
  for (const parts of found) {
    for (const node of parts.inside) holder.set(node.id, parts.module.id)
  }

  const bound = new Map<string, Component>()
  for (const { module, arm, body, eye } of found) {
    const held = arm?.components?.find(one => one.type === 'SpringArm')
    if (!arm || !held) continue

    const own = (said: unknown, fresh?: SceneNode): string | null => {
      if (!fresh) return null
      const at = typeof said === 'string' ? holder.get(said) : undefined
      const stale = said === '' || (at !== undefined && at !== module.id)
      return stale || !nodes.some(node => node.id === said) ? fresh.id : null
    }

    const subject = own(held.subject, body)
    const camera = own(held.camera, eye)
    if (subject !== null || camera !== null) {
      bound.set(arm.id, {
        ...held,
        ...(subject === null ? {} : { subject }),
        ...(camera === null ? {} : { camera }),
      })
    }
  }

  if (bound.size === 0) return nodes

  return nodes.map(node => {
    const arm = bound.get(node.id)
    return arm ? { ...node, components: withComponent(node.components ?? [], arm) } : node
  })
}
