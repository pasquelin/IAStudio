import { describe, expect, it } from 'vitest'
import stylesheet from '../index.css?raw'

/**
 * Tailwind 4 builds `text-<name>` from BOTH the font-size scale and the colour tokens, and the
 * colour wins. A token named after a size therefore repaints text instead of sizing it — the
 * `base` token did exactly that, painting titles in the panel background they sat on.
 */
const TEXT_SIZE_NAMES = [
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
]

/**
 * The only gauge derived from other gauges. It held a literal `14px` for a whole session and the
 * whole suite stayed green, though the derivation gives 6px in comfort and 5px in compact.
 */
const DERIVED_GAUGE = { name: '--sc-rail-inset', terms: ['--sc-rail', '--sc-rail-button'] }

function blockOf(selector: string): string {
  const [block = ''] = stylesheet.slice(stylesheet.indexOf(`${selector} {`)).split('\n}')

  return block
}

function declarationOf(selector: string, name: string): string | undefined {
  return blockOf(selector)
    .match(new RegExp(`(?<![\\w-])${name}\\s*:\\s*([^;]+);`))?.[1]
    ?.trim()
}

function colorTokenNames(): string[] {
  const [theme = ''] = stylesheet.slice(stylesheet.indexOf('@theme {')).split('\n}')

  return [...theme.matchAll(/--color-([a-z0-9-]+)\s*:/g)].flatMap(([, name]) => name ?? [])
}

describe('color tokens', () => {
  it('are found at all, so the rule below cannot pass on an empty list', () => {
    expect(colorTokenNames()).toContain('panel')
  })

  it('never take a name from the Tailwind font-size scale', () => {
    expect(colorTokenNames().filter(name => TEXT_SIZE_NAMES.includes(name))).toEqual([])
  })
})

describe('gauge tokens', () => {
  it('are read at all, so the rules below cannot pass on an empty parse', () => {
    expect(declarationOf(':root', '--sc-rail')).toBe('48px')
    expect(declarationOf(":root[data-density='compact']", '--sc-rail')).toBe('42px')
  })

  it('state the derivation of the derived one instead of a length that happens to match', () => {
    const value = declarationOf(':root', DERIVED_GAUGE.name)

    for (const term of DERIVED_GAUGE.terms) expect(value).toContain(`var(${term})`)
  })

  it('leave the derived one undeclared in compact, where both its terms already change', () => {
    expect(declarationOf(":root[data-density='compact']", DERIVED_GAUGE.name)).toBeUndefined()
  })
})
