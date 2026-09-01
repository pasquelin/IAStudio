import { readFile, stat } from 'node:fs/promises'
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

/** A stack is a few dozen numbers per effect: a megabyte is four orders of magnitude of room. */
const MAX_PRESET_BYTES = 1024 * 1024

const EXTENSION = 'json'

const tooLarge = (): Error =>
  new Error('this file is too large to be a post-processing composition')

const postExport = z.object({
  name: pathSegment,
  content: z.string().refine(text => Buffer.byteLength(text, 'utf8') <= MAX_PRESET_BYTES),
})

/**
 * This side reads BYTES and writes bytes. What a file is ALLOWED to say is decided by
 * `readPostPresetFile` against the catalogue, in the window: a second reader here would be a
 * second set of rules to keep in agreement.
 */
export function registerPostPresetHandlers({ pickSavePath, pickImportPath }: PostPresetDeps): void {
  handle(CHANNELS.postExport, async (_event, request) => {
    const { name, content }: PostPresetExportRequest = postExport.parse(request)
    return writePickedFile(() => pickSavePath(name, EXTENSION), Buffer.from(content, 'utf8'))
  })

  handle(CHANNELS.postImport, async () => {
    const path = await pickImportPath(EXTENSION)
    if (!path) return null

    // Asked of the DISK before a byte is read: a file of a hundred megabytes would otherwise be
    // held whole in the main process, and then again as a string on the way to the window.
    const found = await stat(path)
    if (found.size > MAX_PRESET_BYTES) throw tooLarge()

    // Measured again on what was actually read, because the first answer is about the file as it
    // stood: a picker points at a path, and nothing stops it growing between the two calls.
    const bytes = await readFile(path)
    if (bytes.byteLength > MAX_PRESET_BYTES) throw tooLarge()

    return bytes.toString('utf8')
  })
}
