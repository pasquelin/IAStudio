import type { PathKind } from '@shared/domain/settingsRegistry'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseBase64 } from '@main/provider/validation'
import { parseFileName, parsePathKind, parseStartIn } from './validation'

export type DialogHandlerDeps = {
  /** Injected rather than imported: `dialog` needs a live app, which no test has. */
  pickPath: (kind: PathKind, startIn?: string) => Promise<string | null>
  /** Where to save a picture, and the write itself. `null` when the dialog was dismissed. */
  savePicture: (name: string, bytes: Uint8Array) => Promise<string | null>
}

/**
 * The native pickers. Neither a setting nor a project concern — where a project goes and where
 * ffmpeg lives are the same question asked twice, and answering it in one place is what stops a
 * second dialog with slightly different options from appearing.
 */
export function registerDialogHandlers({ pickPath, savePicture }: DialogHandlerDeps): void {
  handle(CHANNELS.dialogPickPath, (_event, kind, startIn) =>
    pickPath(parsePathKind(kind), parseStartIn(startIn)),
  )

  // Decoded here rather than in the renderer: a `Buffer` does not cross the bridge, and the
  // base64 is what the extraction already produced.
  handle(CHANNELS.dialogExportPicture, (_event, name, image) =>
    savePicture(parseFileName(name), Buffer.from(parseBase64(image), 'base64')),
  )
}
