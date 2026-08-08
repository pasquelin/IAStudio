import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'opentype.js'
import { describe, expect, it } from 'vitest'
import { EMBEDDED_FONTS } from '@shared/domain/font'
import { collection, nameTable, sfnt } from './font-fixtures'
import {
  collectionOffsets,
  directorySize,
  extractFont,
  isCollection,
  readNames,
  SFNT_HEADER_SIZE,
  tableCount,
  tableRange,
} from './sfnt'

const FONTS = join(process.cwd(), 'src/renderer/public/fonts')

const LATIN = nameTable([
  { platform: 3, nameId: 1, text: 'Avenir Next Bold' },
  { platform: 3, nameId: 2, text: 'Bold' },
  { platform: 3, nameId: 16, text: 'Avenir Next' },
  { platform: 3, nameId: 17, text: 'Bold' },
])

/** The same family, as a face localised into two languages names itself. */
const ENGLISH = { platform: 3, language: 0x0409, nameId: 1, text: 'System Font' }
const LOCALISED = { platform: 3, language: 0x0403, nameId: 1, text: 'Tipus de lletra del sistema' }

/** The names of the `name` table a file holds, read the way the index reads them. */
function familyOf(file: Uint8Array): { family: string; subfamily: string } | null {
  const count = tableCount(file.subarray(0, SFNT_HEADER_SIZE))
  if (count === null) return null

  const directory = file.subarray(SFNT_HEADER_SIZE, SFNT_HEADER_SIZE + directorySize(count))
  const found = tableRange(directory, 'name')

  return found ? readNames(file.subarray(found.offset, found.offset + found.length)) : null
}

describe('the head of a font file', () => {
  it('counts the tables a TrueType font announces', () => {
    expect(tableCount(sfnt([{ tag: 'name', data: LATIN }]).subarray(0, SFNT_HEADER_SIZE))).toBe(1)
  })

  it('counts them for CFF outlines too, which open on a tag rather than on a version', () => {
    const file = sfnt([{ tag: 'name', data: LATIN }], 0x4f54544f)

    expect(tableCount(file.subarray(0, SFNT_HEADER_SIZE))).toBe(1)
  })

  // Most of what a font folder holds is not a font: a `.DS_Store`, a licence, a `.dfont`.
  it('refuses bytes that open on nothing it knows', () => {
    expect(tableCount(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull()
  })

  it('refuses a header cut short', () => {
    expect(tableCount(Uint8Array.from([0, 1, 0, 0]))).toBeNull()
  })
})

describe('the table directory', () => {
  it('finds where a named table sits', () => {
    const file = sfnt([
      { tag: 'head', data: Uint8Array.from([1, 2, 3]) },
      { tag: 'name', data: LATIN },
    ])
    const directory = file.subarray(SFNT_HEADER_SIZE, SFNT_HEADER_SIZE + directorySize(2))

    const found = tableRange(directory, 'name')

    expect(found?.length).toBe(LATIN.byteLength)
    expect(file.subarray(found?.offset, (found?.offset ?? 0) + LATIN.byteLength)).toEqual(LATIN)
  })

  it('answers nothing for a table the font has not got', () => {
    const file = sfnt([{ tag: 'name', data: LATIN }])

    expect(tableRange(file.subarray(SFNT_HEADER_SIZE), 'CFF ')).toBeNull()
  })
})

describe('what a face calls itself', () => {
  // The legacy name of a light cut is "IBM Plex Mono Light", which would offer one family per
  // weight; the typographic one stays "IBM Plex Mono" with the weight as its subfamily.
  it('prefers the typographic family over the legacy one', () => {
    expect(readNames(LATIN)).toEqual({ family: 'Avenir Next', subfamily: 'Bold' })
  })

  it('falls back on the legacy pair when the face declares no typographic one', () => {
    const table = nameTable([
      { platform: 3, nameId: 1, text: 'Geneva' },
      { platform: 3, nameId: 2, text: 'Regular' },
    ])

    expect(readNames(table)).toEqual({ family: 'Geneva', subfamily: 'Regular' })
  })

  // A face carrying both should be read as Windows wrote it: the Macintosh record is a single
  // byte per character, and anything above ASCII in it would come back as mojibake.
  it('reads the Windows record when a face carries both', () => {
    const table = nameTable([
      { platform: 1, nameId: 1, text: 'Mac Name' },
      { platform: 3, nameId: 1, text: 'Windows Name' },
    ])

    expect(readNames(table)?.family).toBe('Windows Name')
  })

  it('takes the Macintosh record when it is the only one', () => {
    expect(readNames(nameTable([{ platform: 1, nameId: 1, text: 'Geneva' }]))).toEqual({
      family: 'Geneva',
      subfamily: 'Regular',
    })
  })

  it('leaves out a face whose name is in an encoding it does not decode', () => {
    expect(readNames(nameTable([{ platform: 1, nameId: 1, text: 'Crème' }]))).toBeNull()
  })

  /**
   * A face carries its name in every language it was localised into. Without a preference, the
   * first record found wins — which is how macOS's own system font came back as "Tipus de lletra
   * del sistema", a picker sorted into a language nobody chose.
   */
  it.each([
    ['before', [LOCALISED, ENGLISH]],
    ['after', [ENGLISH, LOCALISED]],
  ])('takes the English name when a localised one comes %s it', (_case, records) => {
    expect(readNames(nameTable(records))?.family).toBe('System Font')
  })

  it('takes a localised name when English is the one language the face has not got', () => {
    expect(readNames(nameTable([LOCALISED]))?.family).toBe('Tipus de lletra del sistema')
  })

  it('refuses a table with no family in it at all', () => {
    expect(readNames(nameTable([{ platform: 3, nameId: 2, text: 'Regular' }]))).toBeNull()
  })
})

describe('a collection', () => {
  const one = sfnt([{ tag: 'name', data: LATIN }])
  const other = sfnt([
    { tag: 'name', data: nameTable([{ platform: 3, nameId: 1, text: 'Courier' }]) },
  ])

  it('is told apart from a plain font', () => {
    expect(isCollection(collection([one, other]).subarray(0, SFNT_HEADER_SIZE))).toBe(true)
    expect(isCollection(one.subarray(0, SFNT_HEADER_SIZE))).toBe(false)
  })

  it('says where each of its faces starts', () => {
    const file = collection([one, other])

    const offsets = collectionOffsets(
      file.subarray(0, SFNT_HEADER_SIZE),
      file.subarray(SFNT_HEADER_SIZE, SFNT_HEADER_SIZE + 8),
    )

    expect(offsets).toEqual([SFNT_HEADER_SIZE + 8, SFNT_HEADER_SIZE + 8 + one.byteLength])
  })

  it('offers no faces when the file is not one', () => {
    expect(collectionOffsets(one.subarray(0, SFNT_HEADER_SIZE), one)).toEqual([])
  })

  /**
   * `opentype.js` refuses a `ttcf` signature outright, so the face someone asked for has to come
   * out as a font that stands on its own — tables byte for byte, directory rewritten.
   */
  it('hands over one face as a font of its own', () => {
    const file = collection([one, other])

    const lifted = extractFont(file, SFNT_HEADER_SIZE + 8 + one.byteLength)

    expect(familyOf(lifted)?.family).toBe('Courier')
  })

  it('hands over the first face just as well as the last', () => {
    const file = collection([one, other])

    expect(familyOf(extractFont(file, SFNT_HEADER_SIZE + 8))?.family).toBe('Avenir Next')
  })

  // The offsets come out of the collection's own header, which is to say out of the file: one
  // pointing past the end must give nothing rather than read whatever follows in memory.
  it.each([
    ['past the end of the file', 10_000],
    ['at bytes that open on no font', 4],
  ])('hands over nothing for an offset %s', (_case, at) => {
    expect(extractFont(collection([one, other]), at)).toHaveLength(0)
  })
})

/**
 * Read off the files the studio actually ships rather than off bytes this test wrote itself: a
 * parser tested only against its own fixtures agrees with its own mistakes.
 */
describe('the faces the studio ships', () => {
  it.each(EMBEDDED_FONTS)('reads $family off its own file', async ({ family, file }) => {
    const bytes = new Uint8Array(await readFile(join(FONTS, file)))

    expect(familyOf(bytes)).toEqual({ family, subfamily: 'Regular' })
  })

  /**
   * Asserted here and not in the renderer, which is where the parse actually runs: a jsdom test
   * has no filesystem to read a face with, and a shipped file that `opentype.js` refuses would
   * otherwise be found by a user rather than by the suite.
   */
  it.each(EMBEDDED_FONTS)('hands $family to opentype, which draws it', async ({ file }) => {
    const bytes = new Uint8Array(await readFile(join(FONTS, file)))

    const font = parse(bytes.buffer)

    expect(font.unitsPerEm).toBeGreaterThan(0)
    expect(font.getPath('Ag', 0, 0, 1).commands.length).toBeGreaterThan(0)
  })

  /**
   * The whole point of `assembleFont`, proved end to end on real glyph tables: two shipped faces
   * are laid into a collection the way macOS lays out its own, one is lifted back out, and the
   * library that refuses a `ttcf` signature is asked to draw with it.
   *
   * Read off a directory the studio wrote and a face it reassembled, so a wrong offset, a missed
   * four-byte boundary or a dropped table is a failure here rather than a family that mysteriously
   * draws nothing on someone's Mac.
   */
  it('lifts a face out of a collection into something opentype still draws', async () => {
    const members = await Promise.all(
      EMBEDDED_FONTS.map(async ({ file }) => new Uint8Array(await readFile(join(FONTS, file)))),
    )
    const file = collection(members)
    const at = new DataView(file.buffer).getUint32(SFNT_HEADER_SIZE + 4)

    const font = parse(extractFont(file, at).slice().buffer)

    expect(font.getPath('Ag', 0, 0, 1).commands.length).toBeGreaterThan(0)
    expect(font.unitsPerEm).toBe(parse(members[1]?.slice().buffer ?? new ArrayBuffer(0)).unitsPerEm)
  })
})
