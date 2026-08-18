import { describe, expect, it } from 'vitest'
import { foldForFileName, isSafeFileName, safeFileName } from './fileName'

/**
 * What `safeFileName` already did when it belonged to the texture export is covered in
 * `textureExport.test.ts`, where those cases stay: one of them carries a literal NUL byte.
 * Here is what it learnt when documents came to be named by hand.
 */
describe('the name a file takes', () => {
  /**
   * Windows drops a trailing dot without a word, so `Niveau.` and `Niveau` are one file there
   * and two everywhere else — the second document written would overwrite the first.
   */
  it('drops a trailing dot, which one platform ignores and the others keep', () => {
    expect(safeFileName('Niveau.')).toBe('Niveau')
    expect(safeFileName('Niveau ')).toBe('Niveau')
  })

  /**
   * Device names, not files: a project holding `CON.scene` cannot be opened on Windows at all,
   * so a title typed on a Mac would travel to a machine that cannot read the document.
   */
  it('keeps a reserved device name from becoming a file name', () => {
    expect(safeFileName('CON')).toBe('CON_')
    expect(safeFileName('com1')).toBe('com1_')
    expect(safeFileName('Console')).toBe('Console')
  })

  /**
   * The boundary refuses every `\p{Cc}`, and this used to hand DEL and the C1 range over
   * untouched: the export came back refused with nothing on screen to say why. A title carries
   * one by being pasted from mis-decoded text — CP1252 `’` read as Latin-1 is U+0092.
   */
  it('neutralises every control character, not only those below the space', () => {
    expect(safeFileName(`Plan${String.fromCodePoint(0x85)}large`)).toBe('Plan large')
    expect(safeFileName(`Plan${String.fromCodePoint(0x7f)}large`)).toBe('Plan large')
    expect(safeFileName(`Plan${String.fromCodePoint(0x1f)}large`)).toBe('Plan large')
  })

  /** Cut by code point: half a surrogate pair reaches the disk as U+FFFD, and two titles merge. */
  it('cuts between characters rather than through one', () => {
    const cut = safeFileName('🎬'.repeat(100))

    expect([...cut]).toHaveLength(80)
    expect(cut.endsWith('🎬')).toBe(true)
  })
})

describe('whether a name can be used as it was typed', () => {
  it('accepts what survives whole and refuses what would be rewritten', () => {
    expect(isSafeFileName('Brique rouge')).toBe(true)
    expect(isSafeFileName('Brique 1/2')).toBe(false)
    expect(isSafeFileName('///')).toBe(false)
    expect(isSafeFileName('')).toBe(false)
  })
})

describe('two names that would land on the same file', () => {
  it('folds case, which the file systems of two platforms ignore', () => {
    expect(foldForFileName('Niveau')).toBe(foldForFileName('NIVEAU'))
  })

  /** APFS stores decomposed, keyboards send composed: the same six bytes, two strings. */
  it('folds the two spellings of an accented name together', () => {
    expect(foldForFileName('Été'.normalize('NFD'))).toBe(foldForFileName('Été'.normalize('NFC')))
  })

  /** Stripping diacritics would merge two names that every file system keeps apart. */
  it('keeps an accented name apart from its unaccented twin', () => {
    expect(foldForFileName('Été')).not.toBe(foldForFileName('Ete'))
  })
})
