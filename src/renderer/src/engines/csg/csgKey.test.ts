import { describe, expect, it } from 'vitest'
import { csgGraphOf, csgPartOf, type CsgGraph } from '@shared/domain/csg'
import { csgKeyOf } from './csgKey'

const wall = () => csgPartOf('wall', { kind: 'box', width: 4, height: 3, depth: 0.2 })
const hole = () => csgPartOf('hole', { kind: 'box', width: 1, height: 1, depth: 1 })

function pierced(): CsgGraph {
  return { ...csgGraphOf(wall()), steps: [{ operation: 'subtract', part: hole() }] }
}

describe('csgKeyOf', () => {
  it('gives two identical graphs the same key, so they share one mesh', () => {
    expect(csgKeyOf(pierced())).toBe(csgKeyOf(pierced()))
  })

  it('ignores the names, which a rename must not cost a re-evaluation', () => {
    const renamed: CsgGraph = {
      ...pierced(),
      base: { ...wall(), name: 'south wall' },
      steps: [{ operation: 'subtract', part: { ...hole(), name: 'window' } }],
    }
    expect(csgKeyOf(renamed)).toBe(csgKeyOf(pierced()))
  })

  it('ignores the collision fidelity, which leaves the mesh untouched', () => {
    expect(csgKeyOf({ ...pierced(), collision: 'convexes' })).toBe(csgKeyOf(pierced()))
  })

  it('separates two solids that differ by one dimension', () => {
    const wider: CsgGraph = {
      ...pierced(),
      base: { ...wall(), geometry: { kind: 'box', width: 5, height: 3, depth: 0.2 } },
    }
    expect(csgKeyOf(wider)).not.toBe(csgKeyOf(pierced()))
  })

  it('separates two solids that differ by where a brush stands', () => {
    const moved: CsgGraph = {
      ...pierced(),
      steps: [
        {
          operation: 'subtract',
          part: { ...hole(), transform: { ...hole().transform, position: { x: 1, y: 0, z: 0 } } },
        },
      ],
    }
    expect(csgKeyOf(moved)).not.toBe(csgKeyOf(pierced()))
  })

  it('separates a cut from a weld of the very same brushes', () => {
    const welded: CsgGraph = { ...pierced(), steps: [{ operation: 'unite', part: hole() }] }
    expect(csgKeyOf(welded)).not.toBe(csgKeyOf(pierced()))
  })

  it('separates two shapes whose numbers read alike', () => {
    const box = csgGraphOf(csgPartOf('a', { kind: 'box', width: 1, height: 1, depth: 1 }))
    const plane = csgGraphOf(csgPartOf('a', { kind: 'plane', width: 1, height: 1 }))
    expect(csgKeyOf(box)).not.toBe(csgKeyOf(plane))
  })
})
