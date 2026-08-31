import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LOCAL_RUNTIME, type ModelSummary } from '@shared/domain/model'
import type { PlanAccess } from '@shared/domain/plan'
import { useModelReach } from './useModelReach'

const model = (over: Partial<ModelSummary> = {}): ModelSummary => ({
  id: 'ssd-1b',
  name: 'SSD-1B',
  family: 'image',
  runsOn: LOCAL_RUNTIME,
  source: 'https://example.invalid/model',
  origin: 'community',
  featured: false,
  capabilities: [],
  tags: [],
  ...over,
})

const reachOf = (plan: PlanAccess | null, summary: ModelSummary) =>
  renderHook(() => useModelReach(plan)).result.current(summary)

describe('why a model is out of reach', () => {
  /**
   * 🛑 Seen on screen: eight models of this machine wore "beyond your plan" when their only
   * problem was not being downloaded. Scenario is an OPTION, never what a local model answers to.
   */
  it('never speaks of a subscription about weights that are merely absent', () => {
    const plan: PlanAccess = { name: 'cu-basic', level: 25 }
    const reach = reachOf(plan, model({ installed: false, requiredPlanLevel: 50 }))

    expect(reach.refusal?.word).toBe('Pas encore téléchargé')
    expect(reach.fetchable).toBe(true)
  })

  it('offers no download for a model that runs in a cloud', () => {
    expect(reachOf(null, model({ runsOn: 'scenario' })).fetchable).toBe(false)
  })

  it('offers no download for a card listed before any engine can open it', () => {
    const reach = reachOf(null, model({ installed: false, downloadable: false }))

    expect(reach.fetchable).toBe(false)
    expect(reach.refusal?.word).toBe('Pas de moteur')
  })

  it('says nothing about a model that is here and within reach', () => {
    expect(reachOf(null, model({ installed: true })).refusal).toBeUndefined()
  })

  /**
   * The catalogue's tiles are memoised on this word, and a scroll asks it again for every one of
   * them: a fresh object per model woke the whole grid on every frame of a scroll.
   */
  it('hands the same refusal to two models locked behind the same plan', () => {
    const plan: PlanAccess = { name: 'cu-basic', level: 25 }
    const { result } = renderHook(() => useModelReach(plan))

    const one = result.current(model({ id: 'a', installed: true, requiredPlanLevel: 50 }))
    const two = result.current(model({ id: 'b', installed: true, requiredPlanLevel: 50 }))

    expect(one.refusal).toBe(two.refusal)
  })

  it('still names the plan for a cloud model beyond it', () => {
    const plan: PlanAccess = { name: 'cu-basic', level: 25 }
    const reach = reachOf(plan, model({ runsOn: 'scenario', requiredPlanLevel: 50 }))

    expect(reach.refusal?.word).toBe('Hors abonnement')
    expect(reach.fetchable).toBe(false)
  })
})
