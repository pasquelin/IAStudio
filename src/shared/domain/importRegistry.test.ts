import { describe, expect, it } from 'vitest'
import { capabilityOf } from './formatCapability'
import {
  IMPORT_SOURCE_IDS,
  importSourceOf,
  importSourceOfFile,
  lossesImportingFrom,
} from './importRegistry'

describe('the readers the studio has', () => {
  it('answers the reader a file name asks for, and nothing for a name it reads nothing of', () => {
    expect(importSourceOfFile('Bande.otioz')).toBe('montage.otioz')
    // The cut alone is a DOCUMENT the studio opens, never an import: it points at media that
    // are already in the project, so there is nothing to unpack and nothing to catalogue.
    expect(importSourceOfFile('Bande.otio')).toBeNull()
    expect(importSourceOfFile('Bande.psd')).toBeNull()
  })

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
