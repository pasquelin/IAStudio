import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { DictationSession } from './session'
import { parseAudioChunk } from './validation'

export type DictationHandlerDeps = {
  session: DictationSession
  /** Opens the system's microphone privacy screen. Injected: `shell` needs a live app. */
  openPrivacySettings: () => void
}

export function registerDictationHandlers({
  session,
  openPrivacySettings,
}: DictationHandlerDeps): void {
  handle(CHANNELS.dictationState, () => session.snapshot())
  handle(CHANNELS.dictationStart, () => session.start())
  handle(CHANNELS.dictationStop, () => session.stop())
  handle(CHANNELS.dictationCancel, () => session.cancel())

  handle(CHANNELS.dictationPush, (_event, chunk) => {
    // The channel is typed, but TypeScript is gone at runtime and the sender is a renderer:
    // what arrives is `unknown` until this says otherwise.
    session.push(parseAudioChunk(chunk))
  })

  handle(CHANNELS.dictationDownloadModel, () => session.downloadModel())
  handle(CHANNELS.dictationCancelDownload, () => session.cancelDownload())
  handle(CHANNELS.dictationOpenPrivacy, () => openPrivacySettings())
}
