import type { PathKind } from '@shared/domain/settings-registry'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parsePathKind } from './validation'

export type DialogHandlerDeps = {
  /** Injected rather than imported: `dialog` needs a live app, which no test has. */
  pickPath: (kind: PathKind) => Promise<string | null>
}

/**
 * The native pickers. Neither a setting nor a project concern — where a project goes and where
 * ffmpeg lives are the same question asked twice, and answering it in one place is what stops a
 * second dialog with slightly different options from appearing.
 */
export function registerDialogHandlers({ pickPath }: DialogHandlerDeps): void {
  handle(CHANNELS.dialogPickPath, (_event, kind) => pickPath(parsePathKind(kind)))
}
