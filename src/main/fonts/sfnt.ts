/**
 * Just enough of the OpenType container to learn what a font file is called.
 *
 * Written by hand rather than parsed with `opentype.js`, and read in slices rather than whole:
 * enumerating what a machine has installed means touching several hundred files, and a full parse
 * of each would be tens of megabytes of I/O and a visible stall — while the answer is a couple of
 * kilobytes per file. The renderer still parses the one face it is about to draw with.
 *
 * References: the `sfnt` table directory and the `name` table of the OpenType specification.
 */

/** The fixed header every sfnt opens with: a tag, then the size of its table directory. */
export const SFNT_HEADER_SIZE = 12

const DIRECTORY_ENTRY_SIZE = 16

/** A collection holds several fonts in one file — how most of macOS ships its system faces. */
const COLLECTION_TAG = 'ttcf'

/** TrueType outlines announce themselves as version 1.0 — a number, where the rest are tags. */
const TRUETYPE_VERSION = 0x00010000

/** The tags that open a font all the same: CFF outlines, and two shapes of legacy Apple file. */
const SFNT_TAGS: readonly string[] = ['OTTO', 'true', 'typ1']

export type TableRange = { offset: number; length: number }

/** The names a face answers to. Both are needed: one face per family is the offer. */
export type FontNames = { family: string; subfamily: string }

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function tagAt(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + 4))
}

/**
 * How many tables the directory that follows this header holds, or `null` when the bytes open
 * on something that is not a font at all — which is most of what a font folder also contains.
 */
export function tableCount(header: Uint8Array): number | null {
  if (header.byteLength < SFNT_HEADER_SIZE) return null

  const opening = view(header)
  const known = opening.getUint32(0) === TRUETYPE_VERSION || SFNT_TAGS.includes(tagAt(header, 0))

  return known ? opening.getUint16(4) : null
}

/** Whether the file opens on a collection rather than on a single face. */
export function isCollection(header: Uint8Array): boolean {
  return header.byteLength >= SFNT_HEADER_SIZE && tagAt(header, 0) === COLLECTION_TAG
}

/**
 * Where each face of a collection starts. The count sits where a plain font keeps its table
 * count, which is exactly why the tag has to be read before either is believed.
 */
export function collectionOffsets(header: Uint8Array, directory: Uint8Array): number[] {
  if (!isCollection(header)) return []

  const count = view(header).getUint32(8)
  const offsets = view(directory)
  const found: number[] = []
  for (let at = 0; at < count && (at + 1) * 4 <= directory.byteLength; at += 1) {
    found.push(offsets.getUint32(at * 4))
  }
  return found
}

/** How many bytes of directory follow a header announcing `count` tables. */
export function directorySize(count: number): number {
  return count * DIRECTORY_ENTRY_SIZE
}

/**
 * Where a named table sits in the file. Offsets are absolute from the start of the file, even
 * inside a collection — which is what lets one directory point at a table another shares.
 */
export function tableRange(directory: Uint8Array, tag: string): TableRange | null {
  return tableEntries(directory).find(entry => entry.tag === tag) ?? null
}

/** A table as its directory names it: what it is called, where it is, and how long. */
export type TableEntry = TableRange & { tag: string; checksum: number }

/** Every table a directory names, in the order it names them. */
export function tableEntries(directory: Uint8Array): TableEntry[] {
  const entries = view(directory)
  const found: TableEntry[] = []

  for (let at = 0; at + DIRECTORY_ENTRY_SIZE <= directory.byteLength; at += DIRECTORY_ENTRY_SIZE) {
    found.push({
      tag: tagAt(directory, at),
      checksum: entries.getUint32(at + 4),
      offset: entries.getUint32(at + 8),
      length: entries.getUint32(at + 12),
    })
  }
  return found
}

/** Windows, in UTF-16BE — what every font shipped this century carries. */
const PLATFORM_WINDOWS = 3
/** Macintosh, in a single-byte encoding whose first 128 code points are ASCII. */
const PLATFORM_MACINTOSH = 1

/** Unicode, and therefore UTF-16BE too — what Apple's own system faces name themselves in. */
const PLATFORM_UNICODE = 0

/**
 * The typographic family and subfamily when the face declares them, the legacy pair otherwise.
 *
 * The distinction matters for anything with more than four weights: the legacy name of a light
 * cut is "IBM Plex Mono Light", which would offer one family per weight, while the typographic
 * one stays "IBM Plex Mono" with "Light" as its subfamily.
 */
const FAMILY_IDS: readonly number[] = [16, 1]
const SUBFAMILY_IDS: readonly number[] = [17, 2]

/**
 * What the face calls itself, or `null` when the table says nothing readable — a font whose
 * names are in a platform encoding the studio does not decode is left out rather than offered
 * under mojibake.
 */
export function readNames(table: Uint8Array): FontNames | null {
  if (table.byteLength < 6) return null

  const header = view(table)
  const count = header.getUint16(2)
  const strings = header.getUint16(4)

  const family = pickName(table, count, strings, FAMILY_IDS)
  if (!family) return null

  return { family, subfamily: pickName(table, count, strings, SUBFAMILY_IDS) ?? 'Regular' }
}

/** The first id of the list any record answers to, so a typographic name beats a legacy one. */
function pickName(
  table: Uint8Array,
  count: number,
  strings: number,
  ids: readonly number[],
): string | null {
  for (const id of ids) {
    const found = findRecord(table, count, strings, id)
    if (found) return found
  }
  return null
}

const RECORD_SIZE = 12
const RECORDS_AT = 6

/** American English, the language a face names itself in when it names itself in several. */
const LANGUAGE_ENGLISH = 0x0409

/**
 * How much a record is wanted, lowest first, and `null` for a platform whose encoding the studio
 * does not know.
 *
 * A face carries its name in every language it was localised into, so the first Windows record
 * found offers macOS's system font as "Tipus de lletra del sistema" — a picker sorted into a
 * language nobody chose.
 */
function rankOf(platform: number, language: number): number | null {
  if (platform === PLATFORM_WINDOWS) return language === LANGUAGE_ENGLISH ? 0 : 1
  if (platform === PLATFORM_UNICODE) return 1
  // Last: a single byte per character, so anything above ASCII in it would come back mangled.
  return platform === PLATFORM_MACINTOSH ? 2 : null
}

function findRecord(
  table: Uint8Array,
  count: number,
  strings: number,
  nameId: number,
): string | null {
  const records = view(table)
  let best: { rank: number; name: string } | null = null

  for (let at = 0; at < count; at += 1) {
    const record = RECORDS_AT + at * RECORD_SIZE
    if (record + RECORD_SIZE > table.byteLength) break
    if (records.getUint16(record + 6) !== nameId) continue

    const platform = records.getUint16(record)
    const rank = rankOf(platform, records.getUint16(record + 4))
    if (rank === null || (best && rank >= best.rank)) continue

    const length = records.getUint16(record + 8)
    const offset = strings + records.getUint16(record + 10)
    const bytes = table.subarray(offset, offset + length)
    if (bytes.byteLength < length) continue

    const name = platform === PLATFORM_MACINTOSH ? decodeAscii(bytes) : decodeUtf16(bytes)
    if (name) best = { rank, name }
  }

  return best?.name ?? null
}

function decodeUtf16(bytes: Uint8Array): string {
  const chars: number[] = []
  for (let at = 0; at + 1 < bytes.byteLength; at += 2) {
    chars.push((bytes[at] ?? 0) * 256 + (bytes[at + 1] ?? 0))
  }
  return String.fromCharCode(...chars).trim()
}

/**
 * The Macintosh encoding read as ASCII: its first 128 code points are, and a name using the rest
 * is a face from the nineties whose family the studio would rather leave out than mangle.
 */
function decodeAscii(bytes: Uint8Array): string {
  for (const byte of bytes) if (byte > 127) return ''
  return String.fromCharCode(...bytes).trim()
}

/**
 * A font file built from a version and its tables — which is all that lifting one face out of a
 * collection amounts to, since the tables travel verbatim and only the directory has to move.
 *
 * Needed because `opentype.js` refuses a `ttcf` signature outright, while macOS ships most of
 * what it installs as collections: without this the picker would offer a dozen faces on the very
 * platform the studio is built on.
 *
 * Taking the bytes rather than the file they came from is what lets a caller read only the tables
 * of the one face wanted — `Apple Color Emoji.ttc` is 192 MB, and the face inside it is not.
 */
export function assembleFont(
  version: number,
  tables: readonly { entry: TableEntry; data: Uint8Array }[],
): Uint8Array {
  const dataAt = SFNT_HEADER_SIZE + directorySize(tables.length)
  const size = tables.reduce((sum, table) => sum + aligned(table.data.byteLength), dataAt)

  const out = new Uint8Array(size)
  const write = view(out)
  write.setUint32(0, version)
  write.setUint16(4, tables.length)
  // The three search hints the format asks for. No reader the studio uses needs them, but a font
  // that lies about its own shape is one no other tool would open either.
  const power = Math.floor(Math.log2(Math.max(tables.length, 1)))
  write.setUint16(6, 16 * 2 ** power)
  write.setUint16(8, power)
  write.setUint16(10, 16 * tables.length - 16 * 2 ** power)

  let writeAt = dataAt
  tables.forEach(({ entry, data }, index) => {
    const at = SFNT_HEADER_SIZE + index * DIRECTORY_ENTRY_SIZE
    out.set(Uint8Array.from([...entry.tag].map(one => one.charCodeAt(0))), at)
    write.setUint32(at + 4, entry.checksum)
    write.setUint32(at + 8, writeAt)
    write.setUint32(at + 12, data.byteLength)

    out.set(data, writeAt)
    writeAt += aligned(data.byteLength)
  })

  return out
}

/** The same, when the whole file is already in hand — which is what a test has, and a small font. */
export function extractFont(file: Uint8Array, sfntOffset: number): Uint8Array {
  const header = file.subarray(sfntOffset, sfntOffset + SFNT_HEADER_SIZE)
  const count = tableCount(header)
  // Like every other reader here: an offset taken from a collection's own header is a number the
  // file supplied, and a file may say anything.
  if (count === null) return new Uint8Array()

  const directoryAt = sfntOffset + SFNT_HEADER_SIZE
  const entries = tableEntries(file.subarray(directoryAt, directoryAt + directorySize(count)))

  return assembleFont(
    view(header).getUint32(0),
    entries.map(entry => ({
      entry,
      data: file.subarray(entry.offset, entry.offset + entry.length),
    })),
  )
}

/** Tables start on a four-byte boundary, and a reader that assumes so reads the next one. */
function aligned(length: number): number {
  return length + ((4 - (length % 4)) % 4)
}
