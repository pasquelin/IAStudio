import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  THEME_ATTRIBUTE,
  type Density,
  type Theme,
} from '@shared/domain/settings'
import { AA_NORMAL_TEXT, contrastRatio, HEX_COLOR } from '@shared/domain/color'
import { onPaletteChange } from '@/engines/core/palette'
import { useSettings } from '@/stores/settings'
import { useAppearance } from './useAppearance'

type Listener = (event: MediaQueryListEvent) => void

const realMatchMedia = window.matchMedia

/**
 * jsdom answers `matchMedia` but never reports a change, and the whole point of `system` is
 * that it follows one. This stands in for the query and lets a test flip it.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>()
  const media = {
    matches,
    addEventListener: (_type: string, listener: Listener) => void listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => void listeners.delete(listener),
  }

  // `as`: a real MediaQueryList carries nine members, and the hook reads three of them.
  window.matchMedia = (() => media) as unknown as typeof window.matchMedia

  return {
    watchers: () => listeners.size,
    switchTo(dark: boolean): void {
      media.matches = dark
      act(() => {
        for (const listener of listeners) listener({ matches: dark } as MediaQueryListEvent)
      })
    },
  }
}

function withAppearance(theme: Theme, density: Density = 'comfortable', accent?: string) {
  useSettings.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance, theme, density, accent },
    },
  })
  return renderHook(() => useAppearance())
}

function published(name: string): string {
  return document.documentElement.style.getPropertyValue(name)
}

const publishedTheme = (): string | undefined => document.documentElement.dataset['theme']

afterEach(() => {
  window.matchMedia = realMatchMedia
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  delete document.documentElement.dataset['theme']
  delete document.documentElement.dataset['density']
})

describe('publishing the appearance', () => {
  it('names the daisyUI theme, which is what selects the studio tokens with it', () => {
    stubMatchMedia(true)
    withAppearance('light')

    expect(publishedTheme()).toBe(THEME_ATTRIBUTE.light)
  })

  it('publishes the density, without which the compact gauges simply do not exist', () => {
    stubMatchMedia(true)
    withAppearance('dark', 'compact')

    expect(document.documentElement.dataset['density']).toBe('compact')
  })

  it('invalidates the cached palette once, not once per attribute', () => {
    stubMatchMedia(true)
    let invalidations = 0
    const stop = onPaletteChange(() => void (invalidations += 1))

    withAppearance('dark', 'compact')

    expect(invalidations).toBe(1)
    stop()
  })
})

describe('following the system', () => {
  it('resolves to what the system currently prefers', () => {
    stubMatchMedia(false)
    withAppearance('system')

    expect(publishedTheme()).toBe(THEME_ATTRIBUTE.light)
  })

  it('switches when the system does, so an evening does not need a relaunch', () => {
    const media = stubMatchMedia(true)
    withAppearance('system')
    expect(publishedTheme()).toBe(THEME_ATTRIBUTE.dark)

    media.switchTo(false)

    expect(publishedTheme()).toBe(THEME_ATTRIBUTE.light)
  })

  it('watches nothing while the theme is explicit', () => {
    const media = stubMatchMedia(true)
    withAppearance('light')

    // A listener kept on an explicit theme wakes the renderer for a preference nothing reads.
    expect(media.watchers()).toBe(0)
  })

  it('ignores the system once the theme stops being system', () => {
    const media = stubMatchMedia(true)
    const view = withAppearance('system')
    expect(publishedTheme()).toBe(THEME_ATTRIBUTE.dark)

    act(() => {
      useSettings.setState({
        settings: {
          ...DEFAULT_SETTINGS,
          appearance: { ...DEFAULT_SETTINGS.appearance, theme: 'light' },
        },
      })
    })
    view.rerender()

    expect(publishedTheme()).toBe(THEME_ATTRIBUTE.light)
    expect(media.watchers()).toBe(0)
  })
})

/**
 * The accent a user picks overrides the fill inline, so the ink has to follow it there or the
 * words keep the blue the studio shipped with while every button turns the chosen colour.
 */
describe('the accent a user picks', () => {
  it('publishes an ink beside the fill', () => {
    stubMatchMedia(true)
    // The sheet is not loaded under jsdom, and the hook reads the chassis back off the root.
    document.documentElement.style.setProperty('--color-chassis', '#2b2d30')
    withAppearance('dark', 'comfortable', '#c62828')

    expect(published('--color-accent')).toBe('#c62828')
    expect(published('--color-accent-ink')).toMatch(HEX_COLOR)
    expect(contrastRatio(published('--color-accent-ink'), '#2b2d30')).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    )
    expect(contrastRatio('#c62828', '#2b2d30')).toBeLessThan(AA_NORMAL_TEXT)
  })

  /**
   * The ink ON the fill, which is the other half and was nobody's until 2026-08-12. A light
   * accent is where it earns its keep: the white the sheet ships reads 1.71:1 on a yellow, and a
   * primary button's label cannot be read at all.
   */
  it('publishes an ink for what is written on the fill, and turns it dark on a light one', () => {
    stubMatchMedia(true)
    document.documentElement.style.setProperty('--color-chassis', '#2b2d30')
    withAppearance('dark', 'comfortable', '#f0c035')

    expect(published('--color-accent-content')).toBe('#000000')
    // daisyUI's name follows for the reason its fill does: the two are one blue in this studio.
    expect(published('--color-primary-content')).toBe('#000000')
    expect(contrastRatio(published('--color-accent-content'), '#f0c035')).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    )
  })

  it('keeps white on an accent white can be read on, rather than flipping every dark pick', () => {
    stubMatchMedia(true)
    document.documentElement.style.setProperty('--color-chassis', '#2b2d30')
    withAppearance('dark', 'comfortable', '#5b21b6')

    expect(published('--color-accent-content')).toBe('#ffffff')
  })

  // Removed rather than blanked, like the fill above it: an empty value parses as nothing, and
  // the theme's own ink never comes back.
  it('takes the ink away again when nothing is picked', () => {
    stubMatchMedia(true)
    document.documentElement.style.setProperty('--color-chassis', '#2b2d30')
    withAppearance('dark', 'comfortable', '#c62828')
    expect(published('--color-accent-ink')).not.toBe('')
    expect(published('--color-accent-content')).not.toBe('')

    withAppearance('dark')

    expect(published('--color-accent-ink')).toBe('')
    expect(published('--color-accent-content')).toBe('')
    expect(published('--color-primary-content')).toBe('')
    expect(published('--color-accent')).toBe('')
  })
})
