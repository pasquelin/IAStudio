import { describe, expect, it } from 'vitest'
import { createNodeOf } from './node-factory'

describe('createNodeOf', () => {
  it('builds a mesh from a primitive kind', () => {
    const node = createNodeOf('box', 'Cube')

    expect(node?.type).toBe('mesh')
    expect(node?.type === 'mesh' && node.geometry.kind).toBe('box')
  })

  it('builds a light from a light kind', () => {
    const node = createNodeOf('point', 'Ponctuelle')

    expect(node?.type).toBe('light')
    expect(node?.type === 'light' && node.light.kind).toBe('point')
  })

  it('names the node whatever the caller chose, since only it knows the language', () => {
    expect(createNodeOf('box', 'Cube')?.name).toBe('Cube')
  })

  it('drops the node at the origin, visible and unparented', () => {
    const node = createNodeOf('sphere', 'Sphere')

    expect(node?.parentId).toBeNull()
    expect(node?.visible).toBe(true)
    expect(node?.transform.position).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('gives every node its own id', () => {
    expect(createNodeOf('box', 'Cube')?.id).not.toBe(createNodeOf('box', 'Cube')?.id)
  })

  it('refuses a primitive that is announced but not buildable yet', () => {
    expect(createNodeOf('text', 'Text')).toBeNull()
    expect(createNodeOf('sprite', 'Sprite')).toBeNull()
  })

  it('refuses a kind no registry knows', () => {
    expect(createNodeOf('teapot', 'Teapot')).toBeNull()
  })
})
