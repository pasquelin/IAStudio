import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePlanRefusal } from './usePlanRefusal'

const BASIC = { name: 'cu-basic', level: 25 }

describe('usePlanRefusal', () => {
  it('names the plan a model outranks, rather than the model', () => {
    const { result } = renderHook(() => usePlanRefusal(BASIC))

    expect(result.current(50)).toBe(
      'Ce modèle n’est pas inclus dans l’abonnement cu-basic. La génération serait refusée.',
    )
  })

  it('says nothing about a model the plan covers', () => {
    const { result } = renderHook(() => usePlanRefusal(BASIC))

    expect(result.current(25)).toBeUndefined()
  })

  // The three callers dropped their own `plan !== null` guard onto this: an unread plan must
  // refuse nothing, or the studio grey out models the account is paying for.
  it('says nothing while the plan is unknown', () => {
    const { result } = renderHook(() => usePlanRefusal(null))

    expect(result.current(50)).toBeUndefined()
  })

  // The plan is passed in, so nothing re-reads it on its own: an account switch that lands a
  // different plan on the same mounted panel must move the sentence with it.
  it('names the new plan once the account switches', () => {
    const { result, rerender } = renderHook(plan => usePlanRefusal(plan), { initialProps: BASIC })

    rerender({ name: 'cu-free', level: 0 })

    expect(result.current(25)).toBe(
      'Ce modèle n’est pas inclus dans l’abonnement cu-free. La génération serait refusée.',
    )
  })
})
