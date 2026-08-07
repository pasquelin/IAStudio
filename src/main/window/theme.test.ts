import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { WINDOW_CHROME_COLOR } from '@shared/constants'
import { THEME_ATTRIBUTE } from '@shared/domain/settings'

/**
 * The stylesheet is the whole token layer, and the only place a hex value may live. It is read
 * here as data, because nothing else can tell that a colour was added to one theme and forgotten
 * in the other — the symptom of that is a panel still dark inside a light interface, and it only
 * shows up by looking at the running application.
 *
 * It lives here rather than beside the stylesheet for two reasons: the renderer tests run in
 * jsdom, where `import.meta.url` is an http URL and no file can be read — and this IS a main
 * process contract, since the window chrome is painted from values it cannot read off the CSS.
 */
const stylesheet = readFileSync(new URL('../../renderer/src/index.css', import.meta.url), 'utf8')

/** The declarations of one block, from its opening line to the brace in the first column. */
function blockFrom(opening: string): string {
  const start = stylesheet.indexOf(opening)
  expect(start, `\`${opening}\` is gone from index.css`).toBeGreaterThan(-1)
  return stylesheet.slice(start, stylesheet.indexOf('\n}', start))
}

function colorsIn(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/(--color-[a-z0-9-]+):\s*([^;]+);/g)].map(match => [match[1]!, match[2]!]),
  )
}

const reference = colorsIn(blockFrom('@theme {'))
const dark = colorsIn(blockFrom(`name: '${THEME_ATTRIBUTE.dark}'`))
const light = colorsIn(blockFrom(`name: '${THEME_ATTRIBUTE.light}'`))

describe('the light theme', () => {
  it('restates every studio colour, so none of them stays on its dark value', () => {
    // `@theme` declares the dark values in `:root`, and a theme block only wins where it
    // declares something. A token missed here is a surface that never turns light.
    const missing = [...reference.keys()].filter(name => !light.has(name))

    expect(missing).toEqual([])
  })

  it('actually changes them, rather than restating the dark value', () => {
    // Deliberately shared: the accent reads on either background, the create button keeps its
    // warm colour, and the monitor stays black because a picture is judged against the black it
    // will be shown on — not against the studio's chrome.
    const shared = ['--color-accent', '--color-create', '--color-create-hover', '--color-monitor']
    const unchanged = [...reference]
      .filter(([name, value]) => light.get(name) === value)
      .map(([name]) => name)

    expect(unchanged.sort()).toEqual([...shared].sort())
  })
})

describe('the dark theme block', () => {
  it('never contradicts the reference tokens it shares a namespace with', () => {
    // daisyUI's variables and the studio's are the same variables, and a theme block wins on
    // layer order. `--color-accent` was declared in both with different values, which silently
    // painted the playhead, the marquee and every `bg-accent` with `accent-soft`.
    const contradicted = [...dark]
      .filter(([name, value]) => reference.has(name) && reference.get(name) !== value)
      .map(([name]) => name)

    expect(contradicted).toEqual([])
  })
})

describe('WINDOW_CHROME_COLOR', () => {
  // The main process paints a window before any stylesheet is parsed, so it cannot read the
  // token and the value is unavoidably written twice. Pinning it turns a repainted palette into
  // a failing test rather than a window with the wrong frame around the right interface.
  it('matches the dark chassis token', () => {
    expect(reference.get('--color-chassis')).toBe(WINDOW_CHROME_COLOR.dark)
  })

  it('matches the light chassis token', () => {
    expect(light.get('--color-chassis')).toBe(WINDOW_CHROME_COLOR.light)
  })
})
