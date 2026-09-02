import { describe, expect, it } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { createNodeOf, createNodesOf, groupNode, iconOf } from './nodeFactory'
import { PLAYER_KIND } from './playerModule'
import { lightNodeFixture, meshNode, modelNodeFixture, spriteNodeFixture } from './scene-fixtures'

describe('createNodeOf', () => {
  it('builds a mesh from a primitive kind', () => {
    const node = createNodeOf('box')

    expect(node?.type).toBe('mesh')
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('box')
  })

  it('builds a light from a light kind', () => {
    const node = createNodeOf('point')

    expect(node?.type).toBe('light')
    expect(node?.type === 'light' && node.light.kind).toBe('point')
  })

  /**
   * A name is document data. Named after the translated menu row, a scene would read `Cube` in
   * French and `Box` in English — and could not be shared between the two.
   */
  it('names a node after its class, not after the language of the interface', () => {
    expect(createNodeOf('box')?.name).toBe('Box')
    expect(createNodeOf('torusKnot')?.name).toBe('TorusKnot')
    expect(createNodeOf('spot')?.name).toBe('SpotLight')
  })

  it('drops the node at the origin, visible and unparented', () => {
    const node = createNodeOf('sphere')

    expect(node?.parentId).toBeNull()
    expect(node?.visible).toBe(true)
    expect(node?.transform.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('gives every node its own id', () => {
    expect(createNodeOf('box')?.id).not.toBe(createNodeOf('box')?.id)
  })

  it('refuses a kind no registry claims', () => {
    expect(createNodeOf('hologram')).toBeNull()
  })

  // Born with something written in it: a text node that draws nothing until someone finds the
  // field is a node the Add menu appears to have failed at.
  it('builds a text with words in it, in a face the studio ships', () => {
    const node = createNodeOf('text')

    expect(node?.type).toBe('text')
    expect(node?.type === 'text' && node.text.value).toBeTruthy()
    expect(node?.type === 'text' && node.text.font.source).toBe('embedded')
  })

  it('builds a sprite, mapless, since the picture is picked afterwards', () => {
    const node = createNodeOf('sprite')

    expect(node?.type).toBe('sprite')
    expect(node?.type === 'sprite' && node.sprite.map).toBeNull()
  })

  // three.js draws meshes into a shadow map and nothing else, so both boxes would lie.
  it('makes a sprite neither throw a shadow nor catch one', () => {
    const node = createNodeOf('sprite')

    expect(node).toMatchObject({ castShadow: false, receiveShadow: false })
  })

  it('refuses a kind no registry knows', () => {
    expect(createNodeOf('teapot')).toBeNull()
  })
})

// The glyph belongs to the registry entry: a panel that picked its own would drift from the menu.
describe('iconOf', () => {
  it('gives each kind of node its own glyph', () => {
    const icons = [
      iconOf(meshNode('a')),
      iconOf(lightNodeFixture('l')),
      iconOf(spriteNodeFixture('s')),
      iconOf(modelNodeFixture('m')),
      iconOf(groupNode()),
    ]

    expect(new Set(icons).size).toBe(icons.length)
  })
})

/**
 * The module is the one node that IMPOSES a shape on what hangs under it: a body and an eye,
 * always. Who the player is stops being decided by whichever controller a sweep met first.
 */
describe('the player module', () => {
  const bornWith = (name: string) => createNodesOf(PLAYER_KIND).find(node => node.name === name)

  it('is born as a body and an eye, parented the way the module reads', () => {
    const nodes = createNodesOf(PLAYER_KIND)
    const at = (name: string) => nodes.find(node => node.name === name)

    expect(nodes.map(node => node.name)).toEqual([
      'Player_Module',
      'Capsule',
      'Mesh',
      'SpringArm',
      'Camera',
    ])
    expect(at('Player_Module')?.parentId).toBeNull()
    expect(at('Capsule')?.parentId).toBe(at('Player_Module')?.id)
    expect(at('Mesh')?.parentId).toBe(at('Capsule')?.id)
    expect(at('SpringArm')?.parentId).toBe(at('Player_Module')?.id)
    expect(at('Camera')?.parentId).toBe(at('SpringArm')?.id)
  })

  it('marks the module itself, which is what makes it findable at all', () => {
    expect(bornWith('Player_Module')?.components).toEqual([newComponent('Player')])
  })

  /** The capsule is the controller's own height and radius — it draws nothing of its own. */
  it('puts the walking on the capsule and the drawing on the mesh under it', () => {
    expect(bornWith('Capsule')?.type).toBe('group')
    expect(bornWith('Capsule')?.components?.map(one => one.type)).toEqual(['CharacterController'])
    expect(bornWith('Mesh')?.type).toBe('mesh')
    expect(bornWith('Mesh')?.components).toBeUndefined()
  })

  it('hangs the camera on an arm rather than on the body, so a wall can push it in', () => {
    expect(bornWith('SpringArm')?.components?.map(one => one.type)).toEqual(['SpringArm'])
    expect(bornWith('Camera')?.type).toBe('camera')
  })

  /**
   * 🛑 `entityNamed` reads an id first and a NAME after, and every scene the studio ships already
   * holds a node called `Camera`: bound by name, the arm would film that one instead.
   */
  it('binds its arm to its own body and its own eye, by id', () => {
    const nodes = createNodesOf(PLAYER_KIND)
    const at = (name: string) => nodes.find(node => node.name === name)
    const arm = at('SpringArm')?.components?.[0]

    expect(arm?.subject).toBe(at('Capsule')?.id)
    expect(arm?.camera).toBe(at('Camera')?.id)
  })

  /** What is FELT and what is SEEN are one body: the mesh is the controller's capsule, drawn. */
  it('draws a mesh the size of the capsule the physics feels', () => {
    const walker = bornWith('Capsule')?.components?.[0]
    const mesh = bornWith('Mesh')

    expect(mesh?.type === 'mesh' && mesh.geometry.kind === 'capsule' && mesh.geometry.radius).toBe(
      walker?.radius,
    )
    expect(bornWith('Capsule')?.transform.position.y).toBe(Number(walker?.height) / 2)
  })

  it('gives every module its own ids', () => {
    const first = createNodesOf(PLAYER_KIND).map(node => node.id)
    const second = createNodesOf(PLAYER_KIND).map(node => node.id)

    expect(new Set([...first, ...second]).size).toBe(first.length + second.length)
  })
})

/** The door every add goes through. A module is several nodes; everything else is exactly one. */
describe('createNodesOf', () => {
  it('answers one node for a kind that is one node', () => {
    expect(createNodesOf('box')).toHaveLength(1)
  })

  it('answers nothing for a kind no registry claims', () => {
    expect(createNodesOf('hologram')).toEqual([])
  })
})
