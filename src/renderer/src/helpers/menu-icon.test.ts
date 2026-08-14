import { afterEach, describe, expect, it, vi } from 'vitest'
import { THEME_ATTRIBUTE } from '@shared/domain/settings'
import { menuIcon } from './menu-icon'

const CHECK = 'M9 20.42 2.79 14.2l2.83-2.83L9 14.77l9.88-9.89 2.83 2.83z'

const noCanvas = HTMLCanvasElement.prototype.getContext

/** A 2D context that remembers the colour it was told to paint in, and nothing else. */
function installCanvas(): string[] {
  const inks: string[] = []

  vi.stubGlobal('Path2D', class {})
  HTMLCanvasElement.prototype.getContext = (() => ({
    scale: () => {},
    fill: () => {},
    set fillStyle(value: string) {
      inks.push(value)
    },
  })) as unknown as HTMLCanvasElement['getContext']
  HTMLCanvasElement.prototype.toDataURL = () => `data:image/png;base64,${inks.at(-1) ?? ''}`

  return inks
}

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = noCanvas
  vi.unstubAllGlobals()
})

describe('a glyph drawn for the system’s menu', () => {
  /**
   * macOS recolours it from its alpha and never looks at this, but Windows and Linux draw the
   * bitmap as it arrives — where a black glyph on a dark menu is an invisible one. The theme
   * belongs in the cache key for the same reason: it changes without the path changing.
   */
  it('takes the ink of the theme in front, and follows it when it changes', () => {
    const inks = installCanvas()
    const root = document.documentElement

    root.dataset['theme'] = THEME_ATTRIBUTE.dark
    const onDark = menuIcon(CHECK)
    root.dataset['theme'] = THEME_ATTRIBUTE.light
    const onLight = menuIcon(CHECK)

    expect(inks).toEqual(['#ffffff', '#000000'])
    expect(onDark).not.toBe(onLight)
  })

  // Every renderer test runs without one, and a menu with no glyphs beats no menu at all. Its
  // own path, because what is drawn once is remembered — the case above would answer from there.
  it('draws nothing where there is no canvas', () => {
    expect(menuIcon('M12 2 2 22h20z')).toBeUndefined()
  })
})
