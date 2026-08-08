import { describe, expect, it } from 'vitest'
import { createNodeOf } from './node-factory'

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

  it('refuses a kind that is announced but not buildable yet', () => {
    expect(createNodeOf('text')).toBeNull()
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
