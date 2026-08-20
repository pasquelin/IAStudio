import { describe, expect, it } from 'vitest'
import { capabilityOf } from './formatCapability'
import { IMPORT_SOURCE_IDS, importSourceOf, lossesImportingFrom } from './importRegistry'

describe('the readers the studio has', () => {
  it('names every reader by an extension no other one claims', () => {
    const extensions = IMPORT_SOURCE_IDS.map(id => importSourceOf(id).extension)

    expect(new Set(extensions).size).toBe(extensions.length)
  })
})

describe('what arriving does not bring', () => {
  /**
   * The `extended` half and nothing else: a montage written by another application carries the
   * standard part alone, whatever any particular file happens to hold.
   */
  it('answers everything outside the standard part of the format it reads', () => {
    const { interchange, extended, dropped } = capabilityOf('otio')

    expect(lossesImportingFrom('montage.otioz')).toEqual([...extended, ...dropped])
    for (const trait of interchange) {
      expect(lossesImportingFrom('montage.otioz')).not.toContain(trait)
    }
  })

  /**
   * DERIVED from the format, never listed beside it. Two lists disagree the day the writer gains
   * a trait, and this one would then promise something no reader rebuilds.
   */
  it('names the fades and the gains, which no foreign montage carries', () => {
    expect(lossesImportingFrom('montage.otioz')).toEqual(
      expect.arrayContaining(['clipFade', 'clipGain', 'trackHeight']),
    )
  })

  it('never names a track or a trim, which every montage carries', () => {
    const losses = lossesImportingFrom('montage.otioz')

    expect(losses).not.toContain('tracks')
    expect(losses).not.toContain('clipTrim')
    expect(losses).not.toContain('mediaLink')
  })
})
