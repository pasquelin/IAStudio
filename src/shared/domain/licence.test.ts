import { describe, expect, it } from 'vitest'
import { isCopyleft, isLicencesRoute, LICENCES_ROUTE, type Licence } from './licence'
import licences from '../licences.json'
import manifest from '../../../package.json'

const entries: Licence[] = licences

/** Declared, never shipped: they run on the machine that builds and never reach a user. */
const BUILD_ONLY = new Set([
  '@electron/rebuild',
  '@eslint/js',
  '@tailwindcss/vite',
  '@testing-library/jest-dom',
  '@testing-library/react',
  '@testing-library/user-event',
  '@types/better-sqlite3',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  '@types/react-is',
  '@types/three',
  '@vitejs/plugin-react',
  '@vitest/coverage-v8',
  'electron-builder',
  'electron-vite',
  'eslint',
  'eslint-plugin-react-hooks',
  'jsdom',
  'prettier',
  'prettier-plugin-tailwindcss',
  'typescript',
  'typescript-eslint',
  'vite',
  'vitest',
])

describe('the licences route', () => {
  it('answers to the hash the main process loads', () => {
    expect(isLicencesRoute(`#${LICENCES_ROUTE}`)).toBe(true)
    expect(isLicencesRoute(LICENCES_ROUTE)).toBe(true)
  })

  it('leaves every other window alone', () => {
    expect(isLicencesRoute('')).toBe(false)
    expect(isLicencesRoute('#settings')).toBe(false)
  })
})

describe('the collected notice', () => {
  it('carries the full text of each licence, not a link to it', () => {
    for (const entry of entries) {
      expect(entry.text.length, `${entry.name} has no licence text`).toBeGreaterThan(20)
    }
  })

  it('names a licence for every entry', () => {
    expect(entries.filter(entry => entry.spdx === 'UNKNOWN')).toEqual([])
  })

  // By licence and through the collector's own predicate, so a new copyleft entry cannot slip by.
  it('offers the sources of every copyleft component it ships', () => {
    const copyleft = entries.filter(entry => isCopyleft(entry.spdx))
    expect(copyleft.length).toBeGreaterThan(0)

    for (const entry of copyleft) {
      expect(entry.sources, `${entry.name} is ${entry.spdx} without a source offer`).toBeTruthy()
    }
  })

  it('leaves the permissive licences out of the source-offer rule', () => {
    expect(isCopyleft('MIT')).toBe(false)
    expect(isCopyleft('BSD-3-Clause')).toBe(false)
    expect(isCopyleft('Apache-2.0')).toBe(false)
    expect(isCopyleft('MPL-2.0')).toBe(true)
    expect(isCopyleft('GPL-3.0-or-later')).toBe(true)
  })

  /**
   * Every declared dependency is either shipped — hence in the notice — or a tool that never
   * leaves the machine that built it. A new one is neither until someone says which, and this
   * is what asks: reading `dependencies` alone would miss the twenty packages Vite bundles out
   * of `devDependencies`, which is most of what the notice owes.
   */
  it('accounts for every declared dependency, as shipped or as a build tool', () => {
    const declared = [
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.devDependencies),
    ]
    expect(declared.length).toBeGreaterThan(20)

    const shipped = new Set(entries.map(entry => entry.name))
    expect(declared.filter(name => !shipped.has(name) && !BUILD_ONLY.has(name))).toEqual([])
  })
})
