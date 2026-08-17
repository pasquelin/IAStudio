import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useModels } from '@/stores/models'
import { preferModels } from '@/stores/settings-fixtures'
import { modelForFamily, useModelForFamily } from './modelForFamily'

beforeEach(() => {
  preferModels()
  useModels.setState({ selected: {} })
})

/**
 * The two forms answer one question, so they are tested against the same cases: the day they
 * disagree is the day a panel says a model is there and the one beside it says it is not.
 */
describe.each([
  ['read once', () => modelForFamily('image') ?? null],
  ['subscribed', () => renderHook(() => useModelForFamily('image')).result.current],
])('the model a family generates with, %s', (_form, read) => {
  it('takes the one chosen in the panel', () => {
    useModels.setState({ selected: { image: 'flux' } })

    expect(read()).toBe('flux')
  })

  it('falls back to the one the settings name', () => {
    preferModels({ image: 'sdxl' })

    expect(read()).toBe('sdxl')
  })

  /** A preference is where to start from, never what was decided — reversing it is the one
   * mistake a helper written to reconcile three callers can make silently. */
  it('lets the choice win over the preference', () => {
    preferModels({ image: 'sdxl' })
    useModels.setState({ selected: { image: 'flux' } })

    expect(read()).toBe('flux')
  })
})

/** Only the subscribed form takes one: the rail asks about the home, which generates nothing. */
it('answers nothing for no family at all', () => {
  preferModels({ image: 'sdxl' })

  expect(renderHook(() => useModelForFamily(null)).result.current).toBeNull()
})
