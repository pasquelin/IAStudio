import { describe, expect, it } from 'vitest'
import { briefingFor } from './instruction'

describe('mission briefing', () => {
  it('bounds the catalogue and allowed calls to retrieved actions and discovery', async () => {
    const briefing = await briefingFor(
      { utterance: 'create', history: [], candidates: ['project.create'] },
      200_000,
    )

    expect(briefing.text).toContain('project.create')
    expect(briefing.text).toContain('actions.find')
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
})
