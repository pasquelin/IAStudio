import { describe, expect, it } from 'vitest'
import { POST_EFFECT_IDS } from '@shared/domain/postProcessing'
import { fusableFor } from './shaders/fusableChunks'
import { standaloneFor } from './standaloneEffects'

/**
 * The compiler already holds the partition — `STANDALONE_EFFECTS` is typed on
 * `Exclude<PostEffectId, FusedId>`. This says the same thing at RUNTIME, which is what catches
 * the one shape a type cannot: a widened lookup that answers `undefined` where the table has a key.
 */
describe('the two tables that give an effect its implementation', () => {
  it('covers every effect of the catalogue exactly once', () => {
    const uncovered = POST_EFFECT_IDS.filter(id => !fusableFor(id) && !standaloneFor(id))
    const twice = POST_EFFECT_IDS.filter(id => fusableFor(id) && standaloneFor(id))

    expect({ uncovered, twice }).toEqual({ uncovered: [], twice: [] })
  })

  it('builds a chunk with fresh uniforms each time, so two of one effect never collide', () => {
    const grade = fusableFor('colorGrading')
    const first = grade?.make().uniforms.exposure
    const second = grade?.make().uniforms.exposure

    expect(first).not.toBe(second)
  })
})
