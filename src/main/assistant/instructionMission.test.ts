import { describe, expect, it, vi } from 'vitest'
import { answeredTurn } from './brainTurn'
import { briefingFor } from './instruction'

describe('mission briefing', () => {
  it('bounds the catalogue and allowed calls to retrieved actions and discovery', async () => {
    const briefing = await briefingFor(
      { utterance: 'create', history: [], candidates: ['project.create'] },
      200_000,
    )

    expect(briefing.text).toContain('project.create')
    expect(briefing.text).toContain('actions.find')
    expect(briefing.text).toContain('Never ask the person')
    expect(briefing.text).toContain('that an action can discover')
    expect(briefing.text).not.toContain('git.checkout')
    expect([...briefing.allowed]).toEqual(['project.create', 'actions.find'])
    expect(briefing.loaded).toEqual(['project.create'])
  })

  it('allows an action opened by the bounded discovery fallback', async () => {
    const briefing = await briefingFor(
      { utterance: 'create', history: [], candidates: ['project.create'] },
      200_000,
    )
    const expanded = briefing.expand?.('git checkout')

    expect(expanded?.allowed.has('git.checkout')).toBe(true)
    expect(expanded?.text).toContain('git.checkout')
  })

  it('opens a registered action requested outside the bounded candidates before executing it', async () => {
    const briefing = await briefingFor(
      { utterance: 'use the first project asset', history: [], candidates: ['project.create'] },
      200_000,
    )
    const answer =
      '{"say":"Searching.","ask":null,"calls":' +
      '[{"action":"assets.searchProjectCatalogue","input":{"query":"skybox"}}]}'
    const round = vi.fn(async () => ({ answer, cost: 1 }))

    const result = await answeredTurn(briefing, round)

    expect(round).toHaveBeenCalledTimes(2)
    expect(result.calls).toEqual([
      { action: 'assets.searchProjectCatalogue', input: { query: 'skybox' } },
    ])
    expect(result.loaded).toContain('assets.searchProjectCatalogue')
    expect(result.cost).toBe(2)
  })
})
