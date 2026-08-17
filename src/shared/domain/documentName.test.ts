import { describe, expect, it } from 'vitest'
import { checkDocumentName, documentFileName, nextFreeDocumentName } from './documentName'

const named = (fileName: string, id = fileName): { id: string; fileName: string } => ({
  id,
  fileName,
})

describe('the file a document lands on', () => {
  it('names the file after the document, extension by kind', () => {
    expect(documentFileName('Niveau', 'scene')).toBe('Niveau.scene')
    expect(documentFileName('Planche', 'image')).toBe('Planche.img')
  })
})

describe('whether a document may be called this', () => {
  it('accepts an ordinary title', () => {
    expect(checkDocumentName('Niveau', 'scene', [])).toBeNull()
  })

  it('refuses a name nobody typed', () => {
    expect(checkDocumentName('', 'scene', [])).toBe('empty')
    expect(checkDocumentName('   ', 'scene', [])).toBe('empty')
  })

  /**
   * Refused rather than quietly cleaned: `Brique 1/2` written to disk as `Brique 1 2` is a
   * second name for the document, and one name is the whole point of this.
   */
  it('refuses a title the disk would have to rewrite', () => {
    expect(checkDocumentName('Brique 1/2', 'scene', [])).toBe('invalid')
    expect(checkDocumentName('///', 'scene', [])).toBe('invalid')
  })

  it('refuses a title longer than a file name can be', () => {
    expect(checkDocumentName('a'.repeat(81), 'scene', [])).toBe('too-long')
  })

  it('refuses a name the folder already holds', () => {
    expect(checkDocumentName('Niveau', 'scene', [named('Niveau.scene')])).toBe('duplicate')
  })

  /** Case alone does not make two files on APFS or NTFS, so it does not make two documents. */
  it('reads a name that differs only in case as the same name', () => {
    expect(checkDocumentName('NIVEAU', 'scene', [named('Niveau.scene')])).toBe('duplicate')
  })

  /** Two kinds, two extensions, two files — and the space glyph tells them apart on screen. */
  it('lets two kinds share a name, as the disk does', () => {
    expect(checkDocumentName('Niveau', 'image', [named('Niveau.scene')])).toBeNull()
  })

  it('lets a document keep the name it already has', () => {
    expect(checkDocumentName('Niveau', 'scene', [named('Niveau.scene', 'a3f1')], 'a3f1')).toBeNull()
  })
})

describe('the name the studio gives when there is nobody to ask', () => {
  it('takes the plain name while it is free', () => {
    expect(nextFreeDocumentName('Sans titre', 'scene', [])).toBe('Sans titre')
  })

  it('counts up to the first name the folder does not hold', () => {
    const folder = [named('Sans titre.scene'), named('Sans titre 2.scene')]

    expect(nextFreeDocumentName('Sans titre', 'scene', folder)).toBe('Sans titre 3')
  })

  /**
   * Counted on the names taken, not on how many there are: three documents created and one
   * deleted used to answer with the name of a file still sitting in the folder.
   */
  /**
   * A long name has no room left for a suffix: cut back to the bound, `Nom 2` IS `Nom`, so no
   * candidate is ever free and the search for one never ends — synchronously, in the process
   * that owns every window.
   */
  it('ends on a name too long to take a suffix, rather than looking for ever', () => {
    const long = 'a'.repeat(80)
    const folder = [named(`${long}.scene`)]

    expect(nextFreeDocumentName(long, 'scene', folder)).not.toBe(long)
  })

  it('fills a gap left by a document that was removed', () => {
    const folder = [named('Sans titre.scene'), named('Sans titre 3.scene')]

    expect(nextFreeDocumentName('Sans titre', 'scene', folder)).toBe('Sans titre 2')
  })
})
