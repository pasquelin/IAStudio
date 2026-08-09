import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useModels } from '@/stores/models'
import { preferModels } from '@/stores/settings-fixtures'
import { modelForScope, useModelForScope } from './model-for-scope'

beforeEach(() => {
  preferModels()
  useModels.setState({ selected: {} })
})

/**
 * The two forms answer one question, so they are tested against the same four cases: the day
 * they disagree is the day a panel says a model is there and the one beside it says it is not.
 */
describe.each([
  ['read once', (scope: 'image' | 'all') => modelForScope(scope) ?? null],
  [
    'subscribed',
    (scope: 'image' | 'all') => renderHook(() => useModelForScope(scope)).result.current,
  ],
])('the model a scope generates with, %s', (_form, read) => {
  it('takes the one chosen in the panel', () => {
    useModels.setState({ selected: { image: 'flux' } })

    expect(read('image')).toBe('flux')
  })

  it('falls back to the one the preferences name', () => {
    preferModels({ image: 'sdxl' })

    expect(read('image')).toBe('sdxl')
  })

  /** A preference is where to start from, never what was decided — reversing it is the one
   * mistake a helper written to reconcile three callers can make silently. */
  it('lets the choice win over the preference', () => {
    preferModels({ image: 'sdxl' })
    useModels.setState({ selected: { image: 'flux' } })

    expect(read('image')).toBe('flux')
  })

  // A default model "for every family" would mean nothing, so a scope narrowed to none has none.
  it('reads no preference for a scope that narrows to no family', () => {
    preferModels({ image: 'sdxl' })

    expect(read('all')).toBeNull()
  })
})

/** Only the subscribed form takes one: the rail asks about the home, which generates nothing. */
it('answers nothing for no scope at all', () => {
  preferModels({ image: 'sdxl' })

  expect(renderHook(() => useModelForScope(null)).result.current).toBeNull()
})
