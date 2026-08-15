import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePlanRefusal } from './plan-access'

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

  // The model panel asks per mounted cell, on every keystroke and every scroll frame, and feeds
  // the answer to a virtualised list: a fresh closure per render would rebuild every row.
  it('holds the same function across renders', () => {
    const { result, rerender } = renderHook(() => usePlanRefusal(BASIC))
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})
