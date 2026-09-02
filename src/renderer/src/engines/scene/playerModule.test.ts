import { describe, expect, it } from 'vitest'
import { copiesOf } from './commands'
import { playerModuleNodes } from './nodeFactory'
import { cameraNode, groupNode } from './nodeFactory'
import { playerPartsOf, withBoundPlayerArm } from './playerModule'
import type { SceneNode } from './sceneState'

const armOf = (nodes: readonly SceneNode[], moduleId: string) =>
  nodes.find(
    node => node.parentId === moduleId && node.components?.some(one => one.type === 'SpringArm'),
  )

const childOf = (nodes: readonly SceneNode[], parentId: string) =>
  nodes.find(node => node.parentId === parentId)

describe('what a module points its arm at', () => {
  it('is the body and the eye it hangs with', () => {
    const nodes = withBoundPlayerArm(playerModuleNodes())
    const module = nodes[0]
    const arm = armOf(nodes, module?.id ?? '')

    expect(arm?.components?.[0]?.subject).toBe(playerPartsOf(nodes)?.body?.id)
    expect(arm?.components?.[0]?.camera).toBe(childOf(nodes, arm?.id ?? '')?.id)
  })

  /**
   * 🛑 `copiesOf` remaps `id` and `parentId` and NOTHING inside a component, so a duplicated
   * module carries an arm still pointed at the original's camera — measured, and a name did it too.
   */
  it('is its OWN eye in a module that was duplicated', () => {
    const first = playerModuleNodes()
    const both = [...first, ...copiesOf(first, [first[0] ?? ({} as SceneNode)])]
    const bound = withBoundPlayerArm(both)
    const copy = bound.filter(node => !first.some(one => one.id === node.id))
    const arm = armOf(bound, copy[0]?.id ?? '')

    expect(arm?.components?.[0]?.camera).toBe(childOf(bound, arm?.id ?? '')?.id)
    expect(first.some(node => node.id === arm?.components?.[0]?.camera)).toBe(false)
  })

  /** A scene may hold cameras of its own, and one of them met first is not the module's choice. */
  it('names the eye its own arm carries, never a loose camera of the scene', () => {
    const module = playerModuleNodes()
    const nodes = [cameraNode(), ...module]

    expect(playerPartsOf(nodes)?.eye?.id).toBe(module.find(node => node.type === 'camera')?.id)
  })

  it('names nothing at all where the scene holds no module', () => {
    expect(playerPartsOf([cameraNode()])).toBeNull()
  })

  /**
   * 🛑 Both fields stay editable in the inspector. An author aiming the arm at the car the player
   * drives must not have it silently put back on the capsule at every Play.
   */
  it('leaves a subject the author aimed somewhere else alone', () => {
    const car = groupNode(undefined, 'Car')
    const nodes = withBoundPlayerArm([
      car,
      ...playerModuleNodes().map(node =>
        node.name === 'SpringArm' && node.components?.[0]
          ? { ...node, components: [{ ...node.components[0], subject: car.id }] }
          : node,
      ),
    ])
    const arm = nodes.find(node => node.name === 'SpringArm')

    expect(arm?.components?.[0]?.subject).toBe(car.id)
  })

  /** A camera tidied into a group of its own under the arm is still the eye the module films. */
  it('finds its eye however deep under the arm it was tidied', () => {
    const built = playerModuleNodes()
    const arm = built.find(node => node.name === 'SpringArm')
    const holder = { ...groupNode(undefined, 'Eye'), parentId: arm?.id ?? null }
    const nodes = built.map(node =>
      node.type === 'camera' ? { ...node, parentId: holder.id } : node,
    )

    expect(playerPartsOf([...nodes, holder])?.eye?.type).toBe('camera')
  })

  it('leaves a scene holding no module untouched', () => {
    const nodes = playerModuleNodes().slice(1)

    expect(withBoundPlayerArm(nodes)).toBe(nodes)
  })
})
