import { writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
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

    await writeFile(path, data)
    // The name, never the path: where a file sits is this side's business.
    return basename(path)
  })
}
