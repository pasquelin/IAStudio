import { EXPORT_EXTENSIONS } from '@shared/domain/scene'
import { CHANNELS, type SceneExportRequest } from '@shared/ipc'
import { writePickedFile } from '@main/export/writePickedFile'
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

    return writePickedFile(() => pickSavePath(name, EXPORT_EXTENSIONS[format]), data)
  })
}
