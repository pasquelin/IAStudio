import { describe, expect, it } from 'vitest'
import { isLicencesRoute, LICENCES_ROUTE, type Licence } from './licence'
import licences from '../licences.json'
import manifest from '../../../package.json'

const entries: Licence[] = licences

describe('the licences route', () => {
  it('answers to the hash the main process loads', () => {
    expect(isLicencesRoute(`#${LICENCES_ROUTE}`)).toBe(true)
    expect(isLicencesRoute(LICENCES_ROUTE)).toBe(true)
  })

  it('leaves every other window alone', () => {
    expect(isLicencesRoute('')).toBe(false)
    expect(isLicencesRoute('#/settings')).toBe(false)
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

  // The only component whose licence asks for more than attribution: whoever receives the
  // binary must be able to reach the sources of the FFmpeg it was built from.
  it('offers the sources of the copyleft component it ships', () => {
    const ffmpeg = entries.find(entry => entry.name === 'FFmpeg')
    expect(ffmpeg?.sources).toBeTruthy()
  })

  /**
   * A runtime dependency added without a line in `SHIPPED` would ship unattributed, and the
   * notice would look complete while missing it. The generated file is what proves the script
   * was run — comparing it against the manifest is what proves the script knows everything.
   */
  it('covers every runtime dependency the manifest declares', () => {
    const dependencies = Object.keys(manifest.dependencies)
    expect(dependencies.length).toBeGreaterThan(0)

    const covered = new Set(entries.map(entry => entry.name))
    expect(dependencies.filter(name => !covered.has(name))).toEqual([])
  })
})
