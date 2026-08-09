import { writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { isRecord, readString } from '@shared/guards'
import { EXPORT_EXTENSIONS } from '@shared/domain/scene'
import { CHANNELS, type SceneExportRequest } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseSceneExport } from './validation'

export type SceneHandlerDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickSavePath: (name: string, extension: string) => Promise<string | null>
}

/**
 * Writing an exported scene to disk. The renderer has no `fs` and never learns where the file
 * landed — it hands over bytes and gets back a name, exactly as an edited take does.
 */
export function registerSceneHandlers({ pickSavePath }: SceneHandlerDeps): void {
  handle(CHANNELS.sceneExport, async (_event, request) => {
    const { name, format, data }: SceneExportRequest = parseSceneExport(request)

    const path = await pickSavePath(name, EXPORT_EXTENSIONS[format])
    if (!path) return null

    try {
      await writeFile(path, data)
    } catch (error) {
      // The message Node builds carries the absolute path, and a rejected `ipcMain.handle` hands
      // it to the renderer, which files it in the journal. This handler exists so that where a
      // file sits stays on this side — the code says what went wrong without saying where.
      // The cause stays on this side: Electron rebuilds the rejection from the message alone.
      throw new Error(`the file could not be written${codeOf(error)}`, { cause: error })
    }

    // The name, never the path: where a file sits is this side's business.
    return basename(path)
  })
}

/** `EPERM`, `ENOSPC` and their kin: what went wrong, from an error that also knows where. */
function codeOf(error: unknown): string {
  const code = isRecord(error) ? readString(error, 'code', '') : ''
  return code ? ` (${code})` : ''
}
