import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { CHANNELS, type TextureExportRequest } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseTextureExport } from './validation'

export type TextureHandlerDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickFolder: () => Promise<string | null>
}

/**
 * Writing an exported texture to disk. A folder rather than a file, and one of its own inside
 * the folder that was picked: the files of an export mean nothing apart — a base colour without
 * the ORM beside it is half a material — and dropping eight of them loose into somebody's
 * Documents is how an export becomes a cleanup.
 *
 * The renderer has no `fs` and never learns where they landed, exactly as for a scene.
 */
export function registerTextureHandlers({ pickFolder }: TextureHandlerDeps): void {
  handle(CHANNELS.textureExport, async (_event, request) => {
    const { folder, files }: TextureExportRequest = parseTextureExport(request)

    const chosen = await pickFolder()
    if (!chosen) return null

    const destination = join(chosen, folder)
    // `recursive`, so exporting the same texture twice overwrites its folder rather than
    // failing on the second — which is what re-exporting after a change means.
    await mkdir(destination, { recursive: true })

    // One after another: they land in the same folder, and a partial failure that had written
    // half of them in parallel would leave a folder nobody can tell from a finished one.
    for (const file of files) {
      await writeFile(join(destination, `${file.name}${file.extension}`), file.bytes)
    }

    // The name, never the path: where a folder sits is this side's business.
    return basename(destination)
  })
}
