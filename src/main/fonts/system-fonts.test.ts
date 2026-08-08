import { describe, expect, it, vi } from 'vitest'
import { collection, namedFont } from './font-fixtures'
import { extractFont, isCollection } from './sfnt'
import {
  createSystemFonts,
  fontFolders,
  isFontFile,
  isOfferedFamily,
  type FontDisk,
  type FontFile,
} from './system-fonts'

/** A disk that is a map of paths to bytes, so a test needs no font folder of its own. */
function fakeDisk(files: Record<string, Record<string, Uint8Array>>): FontDisk {
  const find = (path: string): Uint8Array | null =>
    Object.values(files).flatMap(folder =>
      Object.entries(folder).filter(([at]) => at === path),
    )[0]?.[1] ?? null

  return {
    list: async folder => {
      const held = files[folder]
      if (!held) throw new Error(`no such folder: ${folder}`)
      return Object.keys(held)
    },
    open: async path => {
      const bytes = find(path)
      if (!bytes) throw new Error(`no such file: ${path}`)

      const file: FontFile = {
        read: async (at, length) => bytes.subarray(at, at + length),
        close: async () => {},
      }
      return file
    },
    readAll: async path => {
      const bytes = find(path)
      if (!bytes) throw new Error(`no such file: ${path}`)
      return bytes
    },
  }
}

describe('where each platform keeps its fonts', () => {
  it('reads the system folders before the user one, so the system copy wins a name', () => {
    expect(fontFolders('darwin', '/Users/ada')).toEqual([
      '/System/Library/Fonts',
      '/Library/Fonts',
      '/Users/ada/Library/Fonts',
    ])
  })

  it('adds the per-user folder Windows only has when it says where it is', () => {
    expect(fontFolders('win32', 'C:\\Users\\ada')).toHaveLength(1)
    expect(fontFolders('win32', 'C:\\Users\\ada', 'C:\\Users\\ada\\AppData\\Local')).toEqual([
      'C:\\Windows\\Fonts',
      'C:\\Users\\ada\\AppData\\Local\\Microsoft\\Windows\\Fonts',
    ])
  })

  it('falls back on the freedesktop folders for anything else', () => {
    expect(fontFolders('linux', '/home/ada')).toContain('/home/ada/.local/share/fonts')
  })
})

describe('what counts as a font file', () => {
  it.each(['Lato.ttf', 'Lato.OTF', 'Avenir.ttc', 'Iowan.otc'])('opens %s', path => {
    expect(isFontFile(path)).toBe(true)
  })

  it.each(['.DS_Store', 'OFL.txt', 'HelveLTMM', 'Fonts.dfont'])('leaves %s alone', path => {
    expect(isFontFile(path)).toBe(false)
  })
})

// Forty-odd of macOS's own come first alphabetically, so without this the picker would open on
// a list of things nobody may set text in.
describe('which families are worth offering', () => {
  it.each(['Lato', 'IBM Plex Mono', 'Helvetica Neue'])('offers %s', family => {
    expect(isOfferedFamily(family)).toBe(true)
  })

  it.each(['.LastResort', '.SF Arabic', '.Keyboard', ''])('holds back %s', family => {
    expect(isOfferedFamily(family)).toBe(false)
  })

  it('keeps a private face out of the index it builds', async () => {
    const disk = fakeDisk({
      '/fonts': {
        '/fonts/private.ttf': namedFont('.LastResort'),
        '/fonts/lato.ttf': namedFont('Lato'),
      },
    })

    expect(await createSystemFonts(disk, ['/fonts']).families()).toEqual(['Lato'])
  })
})

describe('the families a machine offers', () => {
  it('names each face it walked past, sorted', async () => {
    const disk = fakeDisk({
      '/fonts': { '/fonts/lato.ttf': namedFont('Lato'), '/fonts/plex.ttf': namedFont('IBM Plex') },
    })

    expect(await createSystemFonts(disk, ['/fonts']).families()).toEqual(['IBM Plex', 'Lato'])
  })

  // One cut per family: offering "Helvetica Neue Light" beside "Helvetica Neue" as two entries
  // is how a list of two hundred faces becomes a list of nine hundred.
  it('offers only the regular cut of a family', async () => {
    const disk = fakeDisk({
      '/fonts': {
        '/fonts/light.ttf': namedFont('Helvetica Neue', 'Light'),
        '/fonts/roman.ttf': namedFont('Helvetica Neue'),
      },
    })

    expect(await createSystemFonts(disk, ['/fonts']).families()).toEqual(['Helvetica Neue'])
  })

  it('names every face a collection holds', async () => {
    const disk = fakeDisk({
      '/fonts': { '/fonts/avenir.ttc': collection([namedFont('Avenir'), namedFont('Courier')]) },
    })

    expect(await createSystemFonts(disk, ['/fonts']).families()).toEqual(['Avenir', 'Courier'])
  })

  it('walks past what is not a font at all', async () => {
    const disk = fakeDisk({
      '/fonts': { '/fonts/OFL.txt': namedFont('Lato'), '/fonts/real.ttf': namedFont('Lato') },
    })

    expect(await createSystemFonts(disk, ['/fonts']).families()).toEqual(['Lato'])
  })

  // One bad file in a folder of four hundred must not empty the picker.
  it('leaves out a truncated font rather than losing the walk', async () => {
    const disk = fakeDisk({
      '/fonts': {
        '/fonts/cut.ttf': namedFont('Broken').subarray(0, 8),
        '/fonts/whole.ttf': namedFont('Lato'),
      },
    })

    expect(await createSystemFonts(disk, ['/fonts']).families()).toEqual(['Lato'])
  })

  it('walks past a folder the machine has not got', async () => {
    const disk = fakeDisk({ '/fonts': { '/fonts/lato.ttf': namedFont('Lato') } })

    expect(await createSystemFonts(disk, ['/nowhere', '/fonts']).families()).toEqual(['Lato'])
  })

  // The folders are ordered system first, so a face someone installed for themselves does not
  // shadow the system's under the same name.
  it('keeps the copy of the first folder when two hold the same family', async () => {
    const disk = fakeDisk({
      '/system': { '/system/lato.ttf': namedFont('Lato') },
      '/home': { '/home/lato.ttf': namedFont('Lato') },
    })

    const fonts = createSystemFonts(disk, ['/system', '/home'])
    const bytes = await fonts.bytesOf('Lato')

    expect(bytes).toEqual(await disk.readAll('/system/lato.ttf'))
  })

  // The picker opens again every time; walking a few hundred headers is cheap but not free.
  it('walks the folders once, however often it is asked', async () => {
    const disk = fakeDisk({ '/fonts': { '/fonts/lato.ttf': namedFont('Lato') } })
    const list = vi.spyOn(disk, 'list')

    const fonts = createSystemFonts(disk, ['/fonts'])
    await fonts.families()
    await fonts.families()

    expect(list).toHaveBeenCalledTimes(1)
  })
})

describe('the outlines of an installed face', () => {
  it('hands a plain font over as it is on the disk', async () => {
    const lato = namedFont('Lato')
    const disk = fakeDisk({ '/fonts': { '/fonts/lato.ttf': lato } })

    expect(await createSystemFonts(disk, ['/fonts']).bytesOf('Lato')).toEqual(lato)
  })

  // `opentype.js` refuses a `ttcf` signature outright, so what comes back has to stand alone.
  it('lifts a face out of the collection it lives in', async () => {
    const file = collection([namedFont('Avenir'), namedFont('Courier')])
    const disk = fakeDisk({ '/fonts': { '/fonts/avenir.ttc': file } })

    const bytes = await createSystemFonts(disk, ['/fonts']).bytesOf('Courier')

    expect(bytes).not.toBeNull()
    expect(isCollection(bytes ?? new Uint8Array())).toBe(false)
    expect(bytes).toEqual(extractFont(file, new DataView(file.buffer).getUint32(16)))
  })

  // The missing-font hole a shared document opens: said plainly rather than swapped in silence.
  it('answers nothing for a family the machine has not got', async () => {
    const disk = fakeDisk({ '/fonts': { '/fonts/lato.ttf': namedFont('Lato') } })

    expect(await createSystemFonts(disk, ['/fonts']).bytesOf('Futura')).toBeNull()
  })

  it('answers nothing when the file went away after it was indexed', async () => {
    const disk = fakeDisk({ '/fonts': { '/fonts/lato.ttf': namedFont('Lato') } })
    const fonts = createSystemFonts(disk, ['/fonts'])
    await fonts.families()

    vi.spyOn(disk, 'readAll').mockRejectedValue(new Error('gone'))

    expect(await fonts.bytesOf('Lato')).toBeNull()
  })

  // The other half of the same accident, and the one that covers most of what macOS installs:
  // a face read table by table out of a collection that is no longer openable.
  it('answers nothing when a collection went away after it was indexed', async () => {
    const file = collection([namedFont('Avenir'), namedFont('Courier')])
    const disk = fakeDisk({ '/fonts': { '/fonts/avenir.ttc': file } })
    const fonts = createSystemFonts(disk, ['/fonts'])
    await fonts.families()

    vi.spyOn(disk, 'open').mockRejectedValue(new Error('gone'))

    expect(await fonts.bytesOf('Courier')).toBeNull()
  })

  // Read by ranges rather than by loading the file: `Apple Color Emoji.ttc` is 192 MB, and the
  // face inside it is not.
  it('lifts a face without ever reading the collection whole', async () => {
    const file = collection([namedFont('Avenir'), namedFont('Courier')])
    const disk = fakeDisk({ '/fonts': { '/fonts/avenir.ttc': file } })
    const readAll = vi.spyOn(disk, 'readAll')

    expect(await createSystemFonts(disk, ['/fonts']).bytesOf('Courier')).not.toBeNull()
    expect(readAll).not.toHaveBeenCalled()
  })
})
