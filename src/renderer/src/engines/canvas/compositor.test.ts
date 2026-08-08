import { describe, expect, it } from 'vitest'
import { groupLayer, pixelLayer, type Layer } from './canvas-state'
import { composite, placement, type CompositeNode } from './compositor'

const clipped = (id: string): Layer => ({ ...pixelLayer(id, id), clipped: true })
const masked = (id: string): Layer => ({
  ...pixelLayer(id, id),
  mask: { enabled: true, linked: true },
})

/** The nodes of one level, by id, so an assertion can name the layer it means. */
function byId(nodes: readonly CompositeNode[]): Map<string, CompositeNode> {
  return new Map(nodes.map(node => [node.id, node]))
}

describe('a flat stack', () => {
  it('gives every layer a surface of its own, bottom first', () => {
    const nodes = composite([pixelLayer('a', 'A'), pixelLayer('b', 'B')])

    expect(nodes.map(node => node.id)).toEqual(['a', 'b'])
    expect(nodes.every(node => node.kind === 'surface')).toBe(true)
  })

  it('clips nothing when nothing asks to be clipped', () => {
    const nodes = composite([pixelLayer('a', 'A'), pixelLayer('b', 'B')])

    expect(nodes.map(node => node.kind === 'surface' && node.clippedBy)).toEqual([null, null])
  })
})

describe('groups', () => {
  it('nests their children rather than flattening them', () => {
    const nodes = composite([groupLayer('g', 'G', [pixelLayer('a', 'A'), pixelLayer('b', 'B')])])
    const group = nodes[0]

    expect(group?.kind).toBe('group')
    expect(group?.kind === 'group' && group.children.map(child => child.id)).toEqual(['a', 'b'])
  })

  // A group is a stack of its own: its first child has nothing of the outer stack under it.
  it('does not let a clipped child reach past its group for a base', () => {
    const nodes = composite([pixelLayer('base', 'Base'), groupLayer('g', 'G', [clipped('a')])])
    const group = nodes[1]
    const child = group?.kind === 'group' ? group.children[0] : undefined

    expect(child).toMatchObject({ clippedBy: null })
  })
})

describe('clipping', () => {
  it('cuts a clipped layer out of the one below it', () => {
    const nodes = byId(composite([pixelLayer('base', 'Base'), clipped('a')]))

    expect(nodes.get('a')).toMatchObject({ clippedBy: 'base' })
    expect(nodes.get('base')).toMatchObject({ clippedBy: null })
  })

  // A run of clipped layers shares one base, as it does in Photoshop.
  it('gives a run of three clipped layers the same base', () => {
    const nodes = byId(
      composite([pixelLayer('base', 'Base'), clipped('a'), clipped('b'), clipped('c')]),
    )

    for (const id of ['a', 'b', 'c']) expect(nodes.get(id)).toMatchObject({ clippedBy: 'base' })
  })

  // Hiding it would lose its pixels for a reason nobody could see on screen.
  it('leaves a clipped layer with nothing under it unclipped', () => {
    const nodes = byId(composite([clipped('a'), pixelLayer('b', 'B')]))

    expect(nodes.get('a')).toMatchObject({ clippedBy: null })
  })

  // A group holds no texture, so the engine finds no stencil and declines — but it is the layer
  // under it all the same, and skipping it would let the clip reach further down than it should.
  it('lets a group be the base a clipped layer names', () => {
    const nodes = byId(
      composite([pixelLayer('deep', 'Deep'), groupLayer('g', 'G', []), clipped('a')]),
    )

    expect(nodes.get('a')).toMatchObject({ clippedBy: 'g' })
  })

  it('starts a new run at the next unclipped layer', () => {
    const stack = [pixelLayer('one', 'One'), clipped('a'), pixelLayer('two', 'Two'), clipped('b')]
    const nodes = byId(composite(stack))

    expect(nodes.get('a')).toMatchObject({ clippedBy: 'one' })
    expect(nodes.get('b')).toMatchObject({ clippedBy: 'two' })
  })
})

describe('the placement signature', () => {
  const stack = [pixelLayer('a', 'A'), pixelLayer('b', 'B')]

  // What a dragged layer costs: the same tree, and the engine must be able to say so cheaply.
  it('reads the same for a stack that only moved', () => {
    const moved = stack.map(layer => ({ ...layer, transform: { ...layer.transform, x: 20 } }))

    expect(placement(composite(moved))).toBe(placement(composite(stack)))
  })

  it('changes when the order does', () => {
    expect(placement(composite([...stack].reverse()))).not.toBe(placement(composite(stack)))
  })

  // The tree itself changes when a clip or a mask appears: the sprite is nested differently.
  it('changes when a clip or a mask appears', () => {
    const withClip = [pixelLayer('a', 'A'), clipped('b')]
    const withMask = [pixelLayer('a', 'A'), masked('b')]

    expect(placement(composite(withClip))).not.toBe(placement(composite(stack)))
    expect(placement(composite(withMask))).not.toBe(placement(composite(stack)))
  })

  it('tells a layer inside a group from the same layer beside it', () => {
    const nested = [groupLayer('g', 'G', [pixelLayer('a', 'A')])]
    const beside = [groupLayer('g', 'G', []), pixelLayer('a', 'A')]

    expect(placement(composite(nested))).not.toBe(placement(composite(beside)))
  })
})

describe('masks', () => {
  it('names the mask a layer carries, and none for a layer without one', () => {
    const nodes = byId(composite([masked('a'), pixelLayer('b', 'B')]))

    expect(nodes.get('a')).toMatchObject({ maskedBy: 'a' })
    expect(nodes.get('b')).toMatchObject({ maskedBy: null })
  })

  it('keeps a disabled mask off the sprite while its pixels stay in the state', () => {
    const off: Layer = { ...pixelLayer('a', 'A'), mask: { enabled: false, linked: true } }
    const nodes = byId(composite([off]))

    expect(nodes.get('a')).toMatchObject({ maskedBy: null })
  })

  it('survives a mask and a clip meeting inside a group', () => {
    const inner = [pixelLayer('base', 'Base'), { ...masked('a'), clipped: true }]
    const nodes = composite([groupLayer('g', 'G', inner)])
    const group = nodes[0]
    const child = group?.kind === 'group' ? group.children[1] : undefined

    expect(child).toMatchObject({ clippedBy: 'base', maskedBy: 'a' })
  })
})
