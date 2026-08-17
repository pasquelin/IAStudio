import { describe, expect, it } from 'vitest'
import { createNodeOf, groupNode, iconOf } from './nodeFactory'
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
