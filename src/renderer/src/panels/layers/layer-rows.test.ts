import { describe, expect, it } from 'vitest'
import { groupLayer, pixelLayer, type Layer } from '@/engines/canvas/canvas-state'
import { layerRows } from './layer-rows'

const named = (rows: readonly { layer: Layer; depth: number }[]): string[] =>
  rows.map(row => `${'  '.repeat(row.depth)}${row.layer.id}`)

describe('listing a stack', () => {
  // The state is bottom first, because that is the order it is drawn in.
  it('puts the top of the stack at the top of the list', () => {
    expect(named(layerRows([pixelLayer('a', 'A'), pixelLayer('b', 'B')]))).toEqual(['b', 'a'])
  })

  it('indents the children of a group under it', () => {
    const stack = [groupLayer('g', 'G', [pixelLayer('a', 'A'), pixelLayer('b', 'B')])]

    expect(named(layerRows(stack))).toEqual(['g', '  b', '  a'])
  })

  it('nests as deep as the tree goes', () => {
    const inner = groupLayer('inner', 'Inner', [pixelLayer('a', 'A')])
    const stack = [groupLayer('outer', 'Outer', [inner])]

    expect(named(layerRows(stack))).toEqual(['outer', '  inner', '    a'])
  })

  // Folding a group is what keeps a busy document's stack readable.
  it('keeps a collapsed group and hides its subtree', () => {
    const folded: Layer = { ...groupLayer('g', 'G', [pixelLayer('a', 'A')]), collapsed: true }

    expect(named(layerRows([pixelLayer('under', 'Under'), folded]))).toEqual(['g', 'under'])
  })

  it('leaves an empty group as a row of its own', () => {
    expect(named(layerRows([groupLayer('g', 'G', [])]))).toEqual(['g'])
  })
})
