import { describe, expect, it } from 'vitest'
import { effectiveOf, reclaimableOf, type Governed } from './aiMemory'

const bounded = (requested: number, bound: number): Governed<number> => ({
  requested,
  constraint: { bound, by: 'memory-pressure' },
})

describe('effectiveOf', () => {
  it('applies what the person set when nothing bounds it', () => {
    expect(effectiveOf({ requested: 4096 }, Math.min)).toBe(4096)
  })

  // The rule `shadowMapSizeFor` already uses: a ceiling composes with a chosen size instead of
  // replacing it, so someone who chose 1024 keeps 1024 under a 2048 bound.
  it('composes by the rule it is handed, never by overwriting', () => {
    expect(effectiveOf(bounded(1024, 2048), Math.min)).toBe(1024)
    expect(effectiveOf(bounded(4096, 2048), Math.min)).toBe(2048)
  })

  // A constraint is revocable, so reading through one may not spend the figure it bounds.
  it('bounds a setting without consuming it', () => {
    const governed = bounded(4096, 2048)

    effectiveOf(governed, Math.min)

    expect(governed).toEqual(bounded(4096, 2048))
  })
})

describe('reclaimableOf', () => {
  it('never counts on what is opaque, confirmed or not', () => {
    expect(reclaimableOf('opaque', true)).toBe(false)
    expect(reclaimableOf('opaque', false)).toBe(false)
  })

  // The pairs a one-argument derivation cannot tell apart. `owned` sits here rather than beside
  // `opaque` because holding the lifecycle is not the same as getting the bytes back — measured
  // on this studio's own GPU process, which kept 246 MB after closing every document.
  it('waits for a confirmed release on both of the other two, and then counts on them', () => {
    expect(reclaimableOf('advisory', false)).toBe(false)
    expect(reclaimableOf('advisory', true)).toBe(true)
    expect(reclaimableOf('owned', false)).toBe(false)
    expect(reclaimableOf('owned', true)).toBe(true)
  })
})
