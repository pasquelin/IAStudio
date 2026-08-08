/**
 * Font files built byte by byte, so the readers next door can be tested without a font folder
 * — and so a collection, which is what macOS mostly ships and what CI has none of, is a fixture
 * rather than a machine the suite happens to run on.
 */
import { SFNT_HEADER_SIZE, directorySize } from './sfnt'

export type NameRecord = {
  platform: number
  nameId: number
  text: string
  /** American English unless a case is about a face localised into several. */
  language?: number
}

const LANGUAGE_ENGLISH = 0x0409

export type Table = { tag: string; data: Uint8Array }

const TRUETYPE_VERSION = 0x00010000

function tagBytes(tag: string): Uint8Array {
  return Uint8Array.from([...tag].map(character => character.charCodeAt(0)))
}

/** Tables start on a four-byte boundary, as they do in a real file. */
function padded(length: number): number {
  return length + ((4 - (length % 4)) % 4)
}

/** UTF-16BE for a Windows record, one byte per character for a Macintosh one. */
function encode(record: NameRecord): Uint8Array {
  const codes = [...record.text].map(character => character.charCodeAt(0))
  if (record.platform === 1) return Uint8Array.from(codes)

  return Uint8Array.from(codes.flatMap(code => [Math.floor(code / 256), code % 256]))
}

export function nameTable(records: readonly NameRecord[]): Uint8Array {
  const encoded = records.map(encode)
  const stringsAt = 6 + records.length * 12
  const table = new Uint8Array(stringsAt + encoded.reduce((sum, one) => sum + one.byteLength, 0))
  const write = new DataView(table.buffer)

  write.setUint16(2, records.length)
  write.setUint16(4, stringsAt)

  let at = 0
  records.forEach((record, index) => {
    const bytes = encoded[index] ?? new Uint8Array()
    const entry = 6 + index * 12
    write.setUint16(entry, record.platform)
    write.setUint16(entry + 4, record.language ?? LANGUAGE_ENGLISH)
    write.setUint16(entry + 6, record.nameId)
    write.setUint16(entry + 8, bytes.byteLength)
    write.setUint16(entry + 10, at)
    table.set(bytes, stringsAt + at)
    at += bytes.byteLength
  })

  return table
}

/** A whole font file, so the offsets its directory holds are the absolute ones a reader expects. */
export function sfnt(tables: readonly Table[], version = TRUETYPE_VERSION): Uint8Array {
  const dataAt = SFNT_HEADER_SIZE + directorySize(tables.length)
  const total = tables.reduce((sum, table) => sum + padded(table.data.byteLength), dataAt)

  const file = new Uint8Array(total)
  const write = new DataView(file.buffer)
  write.setUint32(0, version)
  write.setUint16(4, tables.length)

  let at = dataAt
  tables.forEach((table, index) => {
    const entry = SFNT_HEADER_SIZE + index * 16
    file.set(tagBytes(table.tag), entry)
    write.setUint32(entry + 8, at)
    write.setUint32(entry + 12, table.data.byteLength)
    file.set(table.data, at)
    at += padded(table.data.byteLength)
  })

  return file
}

/** One font file naming itself, which is all the index ever reads of one. */
export function namedFont(family: string, subfamily = 'Regular'): Uint8Array {
  return sfnt([
    {
      tag: 'name',
      data: nameTable([
        { platform: 3, nameId: 1, text: family },
        { platform: 3, nameId: 2, text: subfamily },
      ]),
    },
  ])
}

/** Several fonts in one file, offsets rewritten as laying them down does. */
export function collection(members: readonly Uint8Array[]): Uint8Array {
  const header = SFNT_HEADER_SIZE + members.length * 4
  const total = members.reduce((sum, member) => sum + member.byteLength, header)
  const file = new Uint8Array(total)
  const write = new DataView(file.buffer)

  file.set(tagBytes('ttcf'), 0)
  write.setUint32(8, members.length)

  let at = header
  members.forEach((member, index) => {
    write.setUint32(SFNT_HEADER_SIZE + index * 4, at)
    file.set(shift(member, at), at)
    at += member.byteLength
  })

  return file
}

/**
 * Moves a standalone font's table offsets by `by`. They are absolute from the start of the file
 * even inside a collection, which is exactly what makes lifting one back out a rewrite.
 */
function shift(member: Uint8Array, by: number): Uint8Array {
  const moved = Uint8Array.from(member)
  const write = new DataView(moved.buffer)
  const count = write.getUint16(4)

  for (let index = 0; index < count; index += 1) {
    const entry = SFNT_HEADER_SIZE + index * 16
    write.setUint32(entry + 8, write.getUint32(entry + 8) + by)
  }
  return moved
}
