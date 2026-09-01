import { describe, expect, it } from 'vitest'
import { postEffect, type PostEffect, type PostEffectId } from '@shared/domain/postProcessing'
import { heaviestCost, stepsOf, wantsFloat } from './postPlan'
import { fusableKind } from './shaders/fusableChunks'

const of = (effect: PostEffectId): PostEffect => postEffect(effect, effect)

const shape = (...effects: readonly PostEffectId[]): string[] =>
  stepsOf(effects.map(of), fusableKind).map(step =>
    step.kind === 'fused'
      ? `fused(${step.effects.map(one => one.effect).join('+')})`
      : step.effect.effect,
  )

/**
 * What a look actually COSTS, asserted rather than hoped for: each entry below is one full-frame
 * draw, and the merge is the difference between a cinematic look costing three and costing one.
 */
describe('how a stack becomes a chain of draws', () => {
  it('merges neighbouring per-pixel effects into one draw', () => {
    expect(shape('colorGrading', 'vignette', 'filmGrain')).toEqual([
      'fused(colorGrading+vignette+filmGrain)',
    ])
  })

  it('leaves an effect that reads more than one pixel a draw of its own', () => {
    expect(shape('colorGrading', 'sharpen', 'vignette')).toEqual([
      'fused(colorGrading)',
      'sharpen',
      'fused(vignette)',
    ])
  })

  /** One fetch per fused pass: a coordinate chunk after a colour chunk needs a second one. */
  it('starts a new run when a coordinate effect follows a colour one', () => {
    expect(shape('colorGrading', 'pixelate')).toEqual(['fused(colorGrading)', 'fused(pixelate)'])
  })

  it('keeps coordinate effects together while nothing has fetched yet', () => {
    expect(shape('lensDistortion', 'pixelate', 'colorGrading')).toEqual([
      'fused(lensDistortion+pixelate+colorGrading)',
    ])
  })

  it('plans nothing for an empty stack', () => {
    expect(stepsOf([], fusableKind)).toEqual([])
  })
})

describe('what a plan costs and what it needs', () => {
  it('reports the costliest effect it holds', () => {
    expect(heaviestCost([of('vignette'), of('gtao')])).toBe('high')
    expect(heaviestCost([of('vignette'), of('bloom')])).toBe('medium')
    expect(heaviestCost([])).toBeNull()
  })

  /** Half float is twice the bandwidth of every buffer of every pass: bought, never taken. */
  it('asks for high dynamic range only where something works above white', () => {
    expect(wantsFloat([of('vignette')], false)).toBe(false)
    expect(wantsFloat([of('bloom')], false)).toBe(true)
    expect(wantsFloat([of('dof')], false)).toBe(true)
    expect(wantsFloat([of('vignette')], true)).toBe(true)
  })

  it('asks for it when a grade opens the exposure, and not when it leaves it alone', () => {
    const grade = of('colorGrading')

    expect(wantsFloat([grade], false)).toBe(false)
    expect(wantsFloat([{ ...grade, params: { ...grade.params, exposure: 1 } }], false)).toBe(true)
  })
})
