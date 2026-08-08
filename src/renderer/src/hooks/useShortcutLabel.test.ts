import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useShortcutLabel } from './useShortcutLabel'

describe('useShortcutLabel', () => {
  it('names a word-key from the bundle rather than from its code', () => {
    const { result } = renderHook(() => useShortcutLabel())

    expect(result.current('Space')).toBe('Espace')
    expect(result.current('Meta+Delete')).toBe('⌘Suppr')
  })

  it('still prints the letter a physical key wears', () => {
    const { result } = renderHook(() => useShortcutLabel())

    expect(result.current('Shift+Meta+KeyZ')).toBe('⇧⌘Z')
  })

  // It feeds the dependency list of every toolbar's `useMemo`; a new closure per render would
  // rebuild them all on every keystroke.
  it('holds the same function across renders', () => {
    const { result, rerender } = renderHook(() => useShortcutLabel())
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
  })
})
