import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  THEME_ATTRIBUTE,
  type Density,
  type Theme,
} from '@shared/domain/settings'
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

function withAppearance(theme: Theme, density: Density = 'comfortable') {
  useSettings.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      appearance: { ...DEFAULT_SETTINGS.appearance, theme, density },
    },
  })
  return renderHook(() => useAppearance())
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
