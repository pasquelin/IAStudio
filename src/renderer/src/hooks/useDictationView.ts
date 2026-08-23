import type { DownloadProgress, SttFailure, SttState } from '@shared/domain/dictation'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'

export type DictationView = {
  state: SttState
  isListening: boolean
  /** The running hypothesis. Empty between sentences. */
  partial: string
  failure: SttFailure | null
  download: DownloadProgress | null
  /** Whether the setting allows any of this. False hides the button rather than disabling it. */
  enabled: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
  cancel: () => Promise<void>
  downloadModel: () => Promise<void>
  cancelDownload: () => Promise<void>
  openPrivacySettings: () => Promise<void>
}

/**
 * What a component sees of dictation, and what it can ask of it.
 *
 * The state lives in the store, the engine in another process, and nothing here holds either. A
 * component reads what it needs and calls what it offers — it never owns a session.
 *
 * **The input level is deliberately absent.** It changes ten times a second, and returning it
 * here would re-render every consumer at that rate — including the ones that only show the
 * running text. `LevelMeter` subscribes to it on its own, and it is the only thing that does.
 */
export function useDictationView(): DictationView {
  const state = useDictation(store => store.state)
  const partial = useDictation(store => store.partial)
  const failure = useDictation(store => store.failure)
  const download = useDictation(store => store.download)
  const enabled = useSettings(settings => settings.settings.dictation.enabled)

  // Read once rather than subscribed to: these are set when the store is created and never
  // replaced, so a subscription apiece would be six selectors run on every level update.
  const { start, stop, cancel, downloadModel, cancelDownload, openPrivacySettings } =
    useDictation.getState()

  return {
    state,
    isListening: state === 'listening',
    partial,
    failure,
    download,
    enabled,
    start,
    stop,
    cancel,
    downloadModel,
    cancelDownload,
    openPrivacySettings,
  }
}
