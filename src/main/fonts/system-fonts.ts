/**
 * What the machine has installed, read where a filesystem exists.
 *
 * The renderer has none — invariant 1 — so the picker asks across the boundary, and the bytes
 * come back the same way. Composing with an installed face is not redistributing it: it is what
 * every design tool does, and what a studio would find missing if it could not.
 *
 * A document naming a system face is only faithful on a machine that has it. That hole is not
 * papered over: a family nothing answers to comes back as nothing, and the renderer says so.
 */
import {
  assembleFont,
  collectionOffsets,
  directorySize,
  isCollection,
  readNames,
  SFNT_HEADER_SIZE,
  tableCount,
  tableEntries,
  tableRange,
} from './sfnt'

/** An open font file, read by ranges: a name costs two kilobytes, never the whole face. */
export type FontFile = {
  read: (at: number, length: number) => Promise<Uint8Array>
  close: () => Promise<void>
}

/** What the index needs of a disk. Injected, so a test needs no font folder of its own. */
export type FontDisk = {
  /** Full paths of the files directly under a folder — empty when the folder is not there. */
  list: (folder: string) => Promise<readonly string[]>
  open: (path: string) => Promise<FontFile>
  readAll: (path: string) => Promise<Uint8Array>
}

/** Where a face lives, and which of a collection's fonts it is. */
export type SystemFace = { family: string; path: string; sfntOffset: number }

export type SystemFonts = {
  /**
   * Every family the machine offers, one entry each, sorted for a reader of `language`.
   *
   * The language is asked for rather than inherited: these names are read down a picker, and the
   * order a bare `localeCompare` gives is the one the OS was installed in — which the studio's
   * own two languages have no say in.
   */
  families: (language: string) => Promise<readonly string[]>
  /** The face's outlines as a font file `opentype.js` will take, or `null` if it is gone. */
  bytesOf: (family: string) => Promise<Uint8Array | null>
}

/** The extensions worth opening. What is not a font is most of what a font folder also holds. */
const FONT_EXTENSIONS: readonly string[] = ['.ttf', '.otf', '.ttc', '.otc']

/**
 * The one cut of each family the studio offers. Weights are not a picker yet, and offering
 * "Helvetica Neue Light" beside "Helvetica Neue" as two families is how a list of two hundred
 * faces becomes a list of nine hundred.
 */
const OFFERED_SUBFAMILY = 'regular'

/**
 * Where each platform keeps its fonts, the user's own folder last — so a face someone installed
 * for themselves does not shadow the system's under the same name.
 */
export function fontFolders(platform: string, home: string, localAppData?: string): string[] {
  if (platform === 'darwin') {
    return ['/System/Library/Fonts', '/Library/Fonts', `${home}/Library/Fonts`]
  }
  if (platform === 'win32') {
    const windows = 'C:\\Windows\\Fonts'
    return localAppData ? [windows, `${localAppData}\\Microsoft\\Windows\\Fonts`] : [windows]
  }
  return [
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    `${home}/.local/share/fonts`,
    `${home}/.fonts`,
  ]
}

export function isFontFile(path: string): boolean {
  return FONT_EXTENSIONS.some(extension => path.toLowerCase().endsWith(extension))
}

/**
 * Whether a family is one to offer. macOS marks its private faces with a leading dot — the
 * fallbacks, the interface cuts, `.LastResort` — and forty-odd of them come first alphabetically,
 * which would make the picker open on a list of things nobody may set text in.
 */
export function isOfferedFamily(family: string): boolean {
  return family !== '' && !family.startsWith('.')
}

export function createSystemFonts(disk: FontDisk, folders: readonly string[]): SystemFonts {
  /**
   * Built once and kept: walking a few hundred headers is cheap but not free, and the picker
   * asks again every time it opens. A font installed while the studio runs waits for the next
   * launch, which is what every other application does too.
   */
  let index: Promise<Map<string, SystemFace>> | null = null

  const read = (): Promise<Map<string, SystemFace>> => (index ??= buildIndex(disk, folders))

  return {
    families: async language =>
      [...(await read()).keys()].sort((one, other) => one.localeCompare(other, language)),

    bytesOf: async family => {
      const face = (await read()).get(family)
      if (!face) return null

      // A plain file already is the face: handing it over untouched is both cheaper and safer
      // than rebuilding a directory around bytes nothing asked to move.
      if (face.sfntOffset === 0) return disk.readAll(face.path).catch(() => null)

      return liftFace(disk, face).catch(() => null)
    },
  }
}

/**
 * One face of a collection, read table by table rather than by loading the file it shares.
 *
 * `Apple Color Emoji.ttc` is 192 MB and `Songti.ttc` 67 MB; the face inside either is a fraction
 * of that, and it is the only part that crosses the boundary afterwards.
 */
async function liftFace(disk: FontDisk, face: SystemFace): Promise<Uint8Array | null> {
  const file = await disk.open(face.path)

  try {
    const header = await file.read(face.sfntOffset, SFNT_HEADER_SIZE)
    const count = tableCount(header)
    if (count === null) return null

    const directory = await file.read(face.sfntOffset + SFNT_HEADER_SIZE, directorySize(count))
    const tables = []
    for (const entry of tableEntries(directory)) {
      tables.push({ entry, data: await file.read(entry.offset, entry.length) })
    }

    return assembleFont(new DataView(header.buffer, header.byteOffset).getUint32(0), tables)
  } finally {
    await file.close().catch(() => {})
  }
}

async function buildIndex(
  disk: FontDisk,
  folders: readonly string[],
): Promise<Map<string, SystemFace>> {
  const found = new Map<string, SystemFace>()

  for (const folder of folders) {
    const paths = await disk.list(folder).catch(() => [])

    for (const path of paths) {
      if (!isFontFile(path)) continue

      // One at a time on purpose: a font folder holds hundreds of files, and opening them all
      // at once is how a process runs out of descriptors on the machines that have the most.
      for (const face of await facesOf(disk, path)) {
        // First wins, and the folders are ordered so that means the system's own copy.
        if (!found.has(face.family)) found.set(face.family, face)
      }
    }
  }

  return found
}

/** Every face a file offers under the one subfamily the studio lists, named. */
async function facesOf(disk: FontDisk, path: string): Promise<SystemFace[]> {
  const file = await disk.open(path).catch(() => null)
  if (!file) return []

  try {
    const header = await file.read(0, SFNT_HEADER_SIZE)
    const offsets = isCollection(header)
      ? collectionOffsets(header, await file.read(SFNT_HEADER_SIZE, memberCount(header) * 4))
      : [0]

    const faces: SystemFace[] = []
    for (const sfntOffset of offsets) {
      const family = await familyAt(file, sfntOffset)
      if (family) faces.push({ family, path, sfntOffset })
    }
    return faces
  } catch {
    // A truncated or unreadable font is left out of the list rather than costing the whole walk:
    // one bad file in a folder of four hundred must not empty the picker.
    return []
  } finally {
    await file.close().catch(() => {})
  }
}

/** A collection keeps its font count where a plain font keeps its table count. */
function memberCount(header: Uint8Array): number {
  return new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(8)
}

async function familyAt(file: FontFile, sfntOffset: number): Promise<string | null> {
  const count = tableCount(await file.read(sfntOffset, SFNT_HEADER_SIZE))
  if (count === null) return null

  const directory = await file.read(sfntOffset + SFNT_HEADER_SIZE, directorySize(count))
  const names = tableRange(directory, 'name')
  if (!names) return null

  const read = readNames(await file.read(names.offset, names.length))
  if (!read || read.subfamily.toLowerCase() !== OFFERED_SUBFAMILY) return null

  return isOfferedFamily(read.family) ? read.family : null
}
