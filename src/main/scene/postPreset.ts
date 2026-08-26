import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { CHANNELS, type PostPresetExportRequest } from '@shared/ipc'
import { writePickedFile } from '@main/export/writePickedFile'
import { handle } from '@main/ipc/handle'
import { pathSegment } from '@main/validation'

export type PostPresetDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickSavePath: (name: string, extension: string) => Promise<string | null>
  /** Where a composition is read FROM. A file the user pointed at, so nothing confines it. */
  pickImportPath: (extension: string) => Promise<string | null>
}

/**
 * What a composition file may weigh. A stack is a few dozen numbers per effect and a name; a
 * megabyte is four orders of magnitude of room, and a bound is what keeps a file somebody
 * renamed from being read into this process whole.
 */
const MAX_PRESET_BYTES = 1024 * 1024

const EXTENSION = 'json'

const postExport = z.object({
  name: pathSegment,
  content: z.string().refine(text => Buffer.byteLength(text, 'utf8') <= MAX_PRESET_BYTES),
})

/**
 * Reading and writing a post-processing composition as a file two projects exchange.
 *
 * This side reads BYTES and writes bytes. It does not parse the composition, and that is
 * deliberate: what a file is allowed to say is decided by `readPostPresetFile` against the
 * catalogue, in the window — a second reader here would be a second set of rules to keep in
 * agreement, and the one place a file could grow a meaning nobody declared.
 */
export function registerPostPresetHandlers({ pickSavePath, pickImportPath }: PostPresetDeps): void {
  handle(CHANNELS.postExport, async (_event, request) => {
    const { name, content }: PostPresetExportRequest = postExport.parse(request)
    return writePickedFile(() => pickSavePath(name, EXTENSION), Buffer.from(content, 'utf8'))
  })

  handle(CHANNELS.postImport, async () => {
    const path = await pickImportPath(EXTENSION)
    if (!path) return null

    const bytes = await readFile(path)
    // Refused by SIZE before it is decoded: a file of a hundred megabytes becomes a hundred
    // megabytes of string on the way to the window, and nothing downstream would refuse it.
    if (bytes.byteLength > MAX_PRESET_BYTES) {
      throw new Error('this file is too large to be a post-processing composition')
    }
    return bytes.toString('utf8')
  })
}
