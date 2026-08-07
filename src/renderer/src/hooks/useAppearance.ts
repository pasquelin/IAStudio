import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { THEME_ATTRIBUTE, type ResolvedTheme, type Theme } from '@shared/domain/settings'
import { refreshPalette } from '@/engines/core/palette'
import { useSettings } from '@/stores/settings'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Absent under a test that never built a DOM, and under an old runtime. */
function darkQuery(): MediaQueryList | null {
  return typeof window === 'undefined' || !window.matchMedia ? null : window.matchMedia(DARK_QUERY)
}

/**
 * What `system` currently means. Chromium answers this according to `nativeTheme.themeSource`,
 * which the main process sets from this same setting — so one query covers both the OS switching
 * on its own and the setting being changed in another window.
 *
 * Dark when nothing can answer: the palette in `index.css` is declared dark first.
 */
function systemPrefersDark(): boolean {
  return darkQuery()?.matches ?? true
}

export function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
  if (theme !== 'system') return theme
  return systemDark ? 'dark' : 'light'
}

/**
 * Publishes the appearance on the root element: `data-theme`, which selects the daisyUI theme
 * and the studio tokens with it, and `data-density`, which the `--sc-*` gauges hang off.
 *
 * One hook for both, and one invalidation of the palette rather than two: the canvases cache
 * what `getComputedStyle` answers, and a theme and a density landing in separate effects would
 * make them read the tokens twice for a single change — `getComputedStyle` resolves style over
 * the whole shell, which is the whole frame budget.
 *
 * It reads the store itself: every window that renders needs exactly this, and having each one
 * select the settings on its own is how one of them ends up publishing the density and not the
 * theme.
 */
export function useAppearance(): void {
  const theme = useSettings(state => state.settings.appearance.theme)
  const density = useSettings(state => state.settings.appearance.density)

  // Subscribed only while it can change anything: on an explicit theme the listener would wake
  // the renderer for a preference nothing reads. Changing the setting re-subscribes, and React
  // reads the snapshot again with it.
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const media = theme === 'system' ? darkQuery() : null
      if (!media) return () => {}

      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [theme],
  )

  const resolved = resolveTheme(theme, useSyncExternalStore(subscribe, systemPrefersDark))

  useEffect(() => {
    const root = document.documentElement
    root.dataset['theme'] = THEME_ATTRIBUTE[resolved]
    root.dataset['density'] = density

    // After the attributes, never before: the engines read the tokens back the moment they are
    // told, and `getComputedStyle` would hand them the palette they are leaving.
    refreshPalette()
  }, [resolved, density])
}
