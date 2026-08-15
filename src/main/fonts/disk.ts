import { open, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, platform } from 'node:os'
import { clamp } from '@shared/numeric'
import { createSystemFonts, fontFolders, type FontDisk, type SystemFonts } from './system-fonts'

/** The real disk behind the index. Apart from it so the walk itself is testable without one. */
export const nodeFontDisk: FontDisk = {
  // Recursive, because none of the three platforms keeps its fonts flat: macOS puts most of
  // what it ships under `Supplemental/`, and a Linux font folder is a tree of foundries.
  list: async folder =>
    (await readdir(folder, { recursive: true })).map(name => join(folder, name)),

  open: async path => {
    const handle = await open(path, 'r')
    const { size } = await handle.stat()

    return {
      /**
       * Clamped to what the file actually holds, and that is not a nicety: every length asked for
       * comes from a field inside the font, and Node's own binding *asserts* that a read length
       * fits in a signed 32-bit integer. One corrupt table entry with its high bit set aborts the
       * process — the whole main process, every window with it — below the level any `catch` can
       * reach. Clamped, the same file merely yields a short read, which is what the parsers are
       * already written to refuse.
       */
      read: async (at, length) => {
        const wanted = clamp(length, 0, Math.max(size - at, 0))
        if (at < 0 || wanted === 0) return new Uint8Array()

        const buffer = new Uint8Array(wanted)
        const { bytesRead } = await handle.read(buffer, 0, wanted, at)
        return buffer.subarray(0, bytesRead)
      },
      close: () => handle.close(),
    }
  },

  readAll: async path => new Uint8Array(await readFile(path)),
}

export function createInstalledFonts(): SystemFonts {
  return createSystemFonts(
    nodeFontDisk,
    fontFolders(platform(), homedir(), process.env.LOCALAPPDATA),
  )
}
