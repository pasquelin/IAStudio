import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLoadable } from './useLoadable'

describe('useLoadable', () => {
  it('hands back the url it is given', () => {
    const { result } = renderHook(() => useLoadable('https://cdn/one.png'))

    expect(result.current.src).toBe('https://cdn/one.png')
  })

  // Signed URLs expire, so a picture on screen can stop resolving while it is still mounted.
  it('drops a url that failed to load', () => {
    const { result } = renderHook(() => useLoadable('https://cdn/expired.png'))

    act(() => result.current.onError())

    expect(result.current.src).toBeUndefined()
  })

  // A new url is a new picture: the failure of the old one must not condemn it.
  it('takes a fresh url after a failure', () => {
    const { result, rerender } = renderHook(({ url }) => useLoadable(url), {
      initialProps: { url: 'https://cdn/expired.png' },
    })

    act(() => result.current.onError())
    rerender({ url: 'https://cdn/other.png' })

    expect(result.current.src).toBe('https://cdn/other.png')
  })

  it('has nothing to show without a url', () => {
    const { result } = renderHook(() => useLoadable())

    expect(result.current.src).toBeUndefined()
  })
})
