import { describe, expect, it } from 'vitest'
import { isCopyleft, isLicencesRoute, LICENCES_ROUTE, type Licence } from './licence'
import licences from '../licences.json'

const entries: Licence[] = licences

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
})
